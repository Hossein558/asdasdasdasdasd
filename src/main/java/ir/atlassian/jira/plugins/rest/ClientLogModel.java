package ir.atlassian.jira.plugins.rest;

/**
 * Model representing a client-side log entry sent from the browser.
 * <p>
 * This class serves as a Data Transfer Object (DTO) used by {@link ClientLogResource}
 * to receive JavaScript error reports, diagnostic logs, and metrics directly from the
 * end-user's browser. As a Plain Old Java Object (POJO), JSON serialization and
 * deserialization are handled automatically by the Jackson library framework provided by Jira.
 * </p>
 */
public class ClientLogModel {

    private String level;
    private String message;
    private String stack;
    private String url;
    private String userAgent;
    private String component;
    private String pluginVersion;

    /**
     * Default constructor required for JSON deserialization via Jackson.
     */
    public ClientLogModel() {
    }

    /**
     * Constructs a populated {@code ClientLogModel}.
     *
     * @param level         The severity level of the log (e.g., "INFO", "WARN", "ERROR").
     * @param message       The primary descriptive log message or error summary.
     * @param stack         The stack trace associated with an error, if applicable.
     * @param url           The URL of the page where the log event occurred.
     * @param userAgent     The browser User-Agent string of the client reporting the log.
     * @param component     The specific component or module generating the log (e.g., "CalendarPicker").
     * @param pluginVersion The version string of the Persian Calendar plugin currently running on the client.
     */
    public ClientLogModel(String level, String message, String stack, String url, String userAgent, String component, String pluginVersion) {
        this.level = level;
        this.message = message;
        this.stack = stack;
        this.url = url;
        this.userAgent = userAgent;
        this.component = component;
        this.pluginVersion = pluginVersion;
    }

    /**
     * Retrieves the log severity level.
     *
     * @return The severity level string.
     */
    public String getLevel() {
        return level;
    }

    /**
     * Sets the log severity level.
     *
     * @param level The severity level to set.
     */
    public void setLevel(String level) {
        this.level = level;
    }

    /**
     * Retrieves the main log message.
     *
     * @return The log message string.
     */
    public String getMessage() {
        return message;
    }

    /**
     * Sets the main log message.
     *
     * @param message The log message to set.
     */
    public void setMessage(String message) {
        this.message = message;
    }

    /**
     * Retrieves the error stack trace, if one exists.
     *
     * @return The stack trace string, or {@code null} if none was provided.
     */
    public String getStack() {
        return stack;
    }

    /**
     * Sets the error stack trace.
     *
     * @param stack The stack trace string to set.
     */
    public void setStack(String stack) {
        this.stack = stack;
    }

    /**
     * Retrieves the URL where the log event occurred.
     *
     * @return The page URL string.
     */
    public String getUrl() {
        return url;
    }

    /**
     * Sets the URL where the log event occurred.
     *
     * @param url The page URL to set.
     */
    public void setUrl(String url) {
        this.url = url;
    }

    /**
     * Retrieves the client's browser User-Agent string.
     *
     * @return The User-Agent string.
     */
    public String getUserAgent() {
        return userAgent;
    }

    /**
     * Sets the client's browser User-Agent string.
     *
     * @param userAgent The User-Agent string to set.
     */
    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    /**
     * Retrieves the name of the component that generated the log.
     *
     * @return The component name string.
     */
    public String getComponent() {
        return component;
    }

    /**
     * Sets the name of the component that generated the log.
     *
     * @param component The component name to set.
     */
    public void setComponent(String component) {
        this.component = component;
    }

    /**
     * Retrieves the client-side version of the Persian Calendar plugin.
     *
     * @return The plugin version string.
     */
    public String getPluginVersion() {
        return pluginVersion;
    }

    /**
     * Sets the client-side version of the Persian Calendar plugin.
     *
     * @param pluginVersion The plugin version string to set.
     */
    public void setPluginVersion(String pluginVersion) {
        this.pluginVersion = pluginVersion;
    }
}
