package ir.atlassian.jira.plugins.rest;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.user.ApplicationUser;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * REST Resource that receives client-side JavaScript log entries from the browser
 * and writes them to the Jira server log (atlassian-jira.log).
 * <p>
 * <b>Endpoint:</b> POST /rest/persian-calendar/1.0/client-log
 * </p>
 * <p>
 * This functionality allows Jira administrators to remotely diagnose JavaScript issues
 * that occur within users' browsers, eliminating the need to physically access the
 * client machine's browser console.
 * </p>
 * <p>
 * <b>Security Considerations:</b>
 * <ul>
 *   <li>Requires an active, authenticated Jira session.</li>
 *   <li>Enforces per-user rate limiting to prevent log spamming or DoS attacks.</li>
 *   <li>Sanitizes incoming strings to prevent log injection vulnerability (CWE-117).</li>
 * </ul>
 * </p>
 */
@Path("/client-log")
public class ClientLogResource {

    /**
     * Specialized SLF4J Logger targeted specifically for Persian Calendar client events.
     */
    private static final Logger log = LoggerFactory.getLogger("ir.atlassian.jira.plugins.persian-calendar.CLIENT");

    /**
     * The maximum number of log requests an individual user can send within a single time window.
     */
    private static final int MAX_LOGS_PER_MINUTE = 30;

    /**
     * The duration of the rate-limiting sliding window in milliseconds (default: 1 minute).
     */
    private static final long RATE_WINDOW_MS = 60_000; // 1 minute

    /**
     * In-memory cache holding rate limit counters mapped by Jira username.
     * Uses ConcurrentHashMap for thread-safe access without external synchronization.
     */
    private static final Map<String, RateInfo> rateLimitMap = new ConcurrentHashMap<>();

    /**
     * Timestamp of the last cleanup run for stale rate limit entries.
     */
    private static volatile long lastCleanupTime = System.currentTimeMillis();

    /**
     * Interval between stale entry cleanups (5 minutes).
     */
    private static final long CLEANUP_INTERVAL_MS = 300_000;

    /**
     * Receives a log entry payload from the client browser and securely writes it to the server log.
     * <p>
     * Before logging, this method verifies user authentication, checks rate limits,
     * and aggressively sanitizes the payload data to remove newline characters and
     * control codes that could facilitate log forging attacks.
     * </p>
     *
     * @param logEntry The incoming {@link ClientLogModel} populated via Jackson JSON deserialization.
     * @return A {@link Response} indicating the outcome (200 OK, 401 Unauthorized, 429 Too Many Requests, or 400 Bad Request).
     */
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response receiveClientLog(ClientLogModel logEntry) {
        // Security: require authenticated user
        String username;
        try {
            JiraAuthenticationContext authContext = ComponentAccessor.getJiraAuthenticationContext();
            ApplicationUser user = authContext.getLoggedInUser();
            if (user == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity("{\"error\":\"Authentication required\"}")
                        .build();
            }
            username = user.getUsername();
        } catch (Exception e) {
            log.warn("[PERSIAN-CALENDAR-CLIENT] Could not determine authenticated user: {}", e.getMessage());
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("{\"error\":\"Authentication required\"}")
                    .build();
        }

        // Rate limiting
        if (isRateLimited(username)) {
            return Response.status(429) // Too Many Requests
                    .entity("{\"error\":\"Rate limit exceeded. Max " + MAX_LOGS_PER_MINUTE + " logs per minute.\"}")
                    .build();
        }

        // Validate input
        if (logEntry == null || logEntry.getMessage() == null || logEntry.getMessage().trim().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"Missing log message\"}")
                    .build();
        }

        // Sanitize log message to prevent log injection
        String sanitizedMessage = sanitize(logEntry.getMessage());
        String sanitizedStack = sanitize(logEntry.getStack());
        String sanitizedUrl = sanitize(logEntry.getUrl());
        String sanitizedUserAgent = sanitize(logEntry.getUserAgent());
        String sanitizedComponent = sanitize(logEntry.getComponent());
        String sanitizedVersion = sanitize(logEntry.getPluginVersion());
        String level = logEntry.getLevel() != null ? logEntry.getLevel().toUpperCase() : "INFO";

        // Build log line
        StringBuilder sb = new StringBuilder();
        sb.append("[PERSIAN-CALENDAR-CLIENT] ");
        sb.append("[").append(level).append("] ");
        sb.append("[user=").append(username).append("] ");
        if (sanitizedComponent != null && !sanitizedComponent.isEmpty()) {
            sb.append("[component=").append(sanitizedComponent).append("] ");
        }
        if (sanitizedVersion != null && !sanitizedVersion.isEmpty()) {
            sb.append("[v").append(sanitizedVersion).append("] ");
        }
        sb.append("msg=").append(sanitizedMessage);
        if (sanitizedUrl != null && !sanitizedUrl.isEmpty()) {
            sb.append(" | url=").append(sanitizedUrl);
        }
        if (sanitizedUserAgent != null && !sanitizedUserAgent.isEmpty()) {
            sb.append(" | browser=").append(sanitizedUserAgent);
        }
        if (sanitizedStack != null && !sanitizedStack.isEmpty()) {
            sb.append(" | stack=").append(sanitizedStack);
        }

        String logLine = sb.toString();

        // Write to server log at appropriate level
        switch (level) {
            case "ERROR":
                log.error(logLine);
                break;
            case "WARN":
                log.warn(logLine);
                break;
            case "DEBUG":
                log.debug(logLine);
                break;
            default:
                log.info(logLine);
                break;
        }

        Map<String, String> result = new HashMap<>();
        result.put("status", "logged");
        result.put("level", level);
        return Response.ok(result).build();
    }

    /**
     * Sanitizes input strings to prevent log forging and injection attacks.
     * <p>
     * Replaces carriage returns, newlines, and non-printable ASCII control characters
     * with spaces or strips them entirely. Also truncates overly long strings to
     * prevent excessive memory consumption or log flooding.
     * </p>
     *
     * @param input The raw, untrusted string received from the client.
     * @return A sanitized, safe string, or an empty string if the input was null.
     */
    private String sanitize(String input) {
        if (input == null) return "";
        // Remove newlines and carriage returns to prevent log forging
        // Limit length to 2000 chars to prevent log flooding
        String cleaned = input.replaceAll("[\\r\\n]", " ").replaceAll("[\\x00-\\x1F]", "");
        if (cleaned.length() > 2000) {
            cleaned = cleaned.substring(0, 2000) + "...[TRUNCATED]";
        }
        return cleaned;
    }

    /**
     * Evaluates whether a specific user has exceeded their log submission quota.
     * <p>
     * Implements a simple fixed-window rate limiting algorithm. The block is synchronized
     * to ensure thread-safe read/write operations against the shared {@code rateLimitMap}.
     * </p>
     *
     * @param username The authenticated Jira username attempting to log.
     * @return {@code true} if the user has exceeded the limit; {@code false} otherwise.
     */
    private boolean isRateLimited(String username) {
        long now = System.currentTimeMillis();

        // Periodic cleanup of stale entries to prevent memory leak
        if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
            lastCleanupTime = now;
            Iterator<Map.Entry<String, RateInfo>> it = rateLimitMap.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<String, RateInfo> entry = it.next();
                if (now - entry.getValue().windowStart > RATE_WINDOW_MS * 2) {
                    it.remove();
                }
            }
        }

        RateInfo info = rateLimitMap.get(username);
        if (info == null || (now - info.windowStart) > RATE_WINDOW_MS) {
            // New window
            rateLimitMap.put(username, new RateInfo(now, 1));
            return false;
        }
        info.count++;
        return info.count > MAX_LOGS_PER_MINUTE;
    }

    /**
     * A simple state-holding structure used internally to track rate limits per user.
     */
    private static class RateInfo {
        /** The absolute timestamp (ms) when the current window began. */
        long windowStart;

        /** The number of log entries accepted during the current window. */
        int count;

        /**
         * Constructs a new rate tracking record.
         *
         * @param windowStart Timestamp representing window initialization.
         * @param count       Initial count of log entries.
         */
        RateInfo(long windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
