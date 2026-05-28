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
import java.util.Map;

/**
 * REST Resource that receives client-side JavaScript log entries from the browser
 * and writes them to the Jira server log (atlassian-jira.log).
 *
 * Endpoint: POST /rest/persian-calendar/1.0/client-log
 *
 * This allows administrators to diagnose JavaScript issues that occur in users'
 * browsers without needing direct access to the browser console.
 *
 * Security: Only logged-in users can submit logs. Rate-limited to prevent abuse.
 */
@Path("/client-log")
public class ClientLogResource {

    private static final Logger log = LoggerFactory.getLogger("ir.atlassian.jira.plugins.persian-calendar.CLIENT");

    // Simple rate limiting: max logs per user per minute
    private static final int MAX_LOGS_PER_MINUTE = 30;
    private static final long RATE_WINDOW_MS = 60_000; // 1 minute
    private static final Map<String, RateInfo> rateLimitMap = new HashMap<>();

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response receiveClientLog(ClientLogModel logEntry) {
        // Security: require authenticated user
        String username = "anonymous";
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
     * Sanitize strings to prevent log injection attacks.
     * Removes newlines and control characters that could fake log entries.
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
     * Simple per-user rate limiting using a sliding window.
     */
    private synchronized boolean isRateLimited(String username) {
        long now = System.currentTimeMillis();
        RateInfo info = rateLimitMap.get(username);
        if (info == null || (now - info.windowStart) > RATE_WINDOW_MS) {
            // New window
            rateLimitMap.put(username, new RateInfo(now, 1));
            return false;
        }
        info.count++;
        if (info.count > MAX_LOGS_PER_MINUTE) {
            return true;
        }
        return false;
    }

    /**
     * Simple rate tracking structure.
     */
    private static class RateInfo {
        long windowStart;
        int count;

        RateInfo(long windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
