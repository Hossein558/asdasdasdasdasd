package ir.atlassian.jira.plugins.rest;

/**
 * Model representing a client-side log entry sent from the browser.
 * Used by ClientLogResource to receive JavaScript error reports.
 * Plain POJO - Jackson handles JSON serialization automatically.
 */
public class ClientLogModel {

    private String level;
    private String message;
    private String stack;
    private String url;
    private String userAgent;
    private String component;
    private String pluginVersion;

    // Default constructor required for Jackson
    public ClientLogModel() {
    }

    public ClientLogModel(String level, String message, String stack, String url, String userAgent, String component, String pluginVersion) {
        this.level = level;
        this.message = message;
        this.stack = stack;
        this.url = url;
        this.userAgent = userAgent;
        this.component = component;
        this.pluginVersion = pluginVersion;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getStack() {
        return stack;
    }

    public void setStack(String stack) {
        this.stack = stack;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getComponent() {
        return component;
    }

    public void setComponent(String component) {
        this.component = component;
    }

    public String getPluginVersion() {
        return pluginVersion;
    }

    public void setPluginVersion(String pluginVersion) {
        this.pluginVersion = pluginVersion;
    }
}
