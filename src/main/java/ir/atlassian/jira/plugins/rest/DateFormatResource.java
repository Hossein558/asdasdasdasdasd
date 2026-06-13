package ir.atlassian.jira.plugins.rest;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.jira.config.properties.ApplicationProperties;
import com.atlassian.plugins.rest.common.security.AnonymousAllowed;
import ir.atlassian.jira.plugins.license.LicenseGuard;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * REST Resource to expose Jira's system date and time format settings to the
 * client-side components of the Persian Calendar plugin.
 * <p>
 * By providing these settings dynamically, the plugin's UI elements (like pickers
 * and display text) can adapt to whatever custom date formats the Jira administrator
 * has configured in the system settings, avoiding hardcoded format assumptions.
 * </p>
 */
@Path("/date-formats")
public class DateFormatResource {

    /**
     * Retrieves a collection of configured Jira date and time formats.
     * <p>
     * This endpoint is accessible anonymously because the date picker scripts
     * run on many pages (including login or anonymous portal pages) and require
     * format configuration to correctly parse and display dates.
     * </p>
     * <p>
     * The response payload includes properties for both Java (server-side)
     * and JavaScript (client-side) representations of the configured patterns.
     * If any properties are unset or an error occurs during retrieval,
     * standard Jira default formats are provided as fallbacks.
     * </p>
     *
     * @return A JSON response mapping format setting keys to their string patterns.
     */
    @GET
    @AnonymousAllowed
    @com.atlassian.plugins.rest.api.security.AnonymousAllowed
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDateFormats() {
        // Server-side license enforcement.
        // Even if client-side JS is patched to ignore /license/status,
        // this guard ensures the server never serves calendar data without a valid license.
        Optional<Response> licenseBlock = LicenseGuard.check();
        if (licenseBlock.isPresent()) {
            return licenseBlock.get();
        }

        Map<String, String> formats = new HashMap<>();

        try {
            ApplicationProperties applicationProperties = ComponentAccessor.getApplicationProperties();

            // Java (server-side) date formats
            formats.put("dateFormat", getPropertyOrDefault(applicationProperties,
                    "jira.date.picker.java.format", "d/MMM/yy"));

            formats.put("dateTimeFormat", getPropertyOrDefault(applicationProperties,
                    "jira.date.time.picker.java.format", "dd/MMM/yy h:mm a"));

            // JavaScript (client-side) date formats
            formats.put("dateFormatJS", getPropertyOrDefault(applicationProperties,
                    "jira.date.picker.javascript.format", "%e/%b/%y"));

            formats.put("dateTimeFormatJS", getPropertyOrDefault(applicationProperties,
                    "jira.date.time.picker.javascript.format", "%e/%b/%y %I:%M %p"));

            // Additional look and feel formats
            formats.put("timeFormat", getPropertyOrDefault(applicationProperties,
                    "jira.lf.date.time", "h:mm a"));

            formats.put("dayFormat", getPropertyOrDefault(applicationProperties,
                    "jira.lf.date.day", "EEEE h:mm a"));

            formats.put("completeDateTimeFormat", getPropertyOrDefault(applicationProperties,
                    "jira.lf.date.complete", "dd/MMM/yy h:mm a"));

            formats.put("dmyFormat", getPropertyOrDefault(applicationProperties,
                    "jira.lf.date.dmy", "dd/MMM/yy"));

        } catch (Exception e) {
            // If ComponentAccessor fails, return defaults
            formats.put("dateFormat", "d/MMM/yy");
            formats.put("dateTimeFormat", "dd/MMM/yy h:mm a");
            formats.put("dateFormatJS", "%e/%b/%y");
            formats.put("dateTimeFormatJS", "%e/%b/%y %I:%M %p");
            formats.put("error", "خطا در دریافت تنظیمات تاریخ");
        }

        return Response.ok(formats).build();
    }

    /**
     * Helper method to safely retrieve a string property from Jira's application properties.
     * <p>
     * If the property corresponding to the given key is null, empty, or an exception
     * is thrown during retrieval, the specified default value is returned instead.
     * </p>
     *
     * @param props        The active {@link ApplicationProperties} instance.
     * @param key          The key of the property to retrieve.
     * @param defaultValue The fallback value to return if the property is missing or inaccessible.
     * @return The retrieved property value or the default fallback.
     */
    private String getPropertyOrDefault(ApplicationProperties props, String key, String defaultValue) {
        try {
            String value = props.getString(key);
            return (value != null && !value.isEmpty()) ? value : defaultValue;
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
