package ir.atlassian.jira.plugins.rest;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.jira.config.properties.ApplicationProperties;
import com.atlassian.plugins.rest.common.security.AnonymousAllowed;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Resource to expose Jira's date format settings to the Persian Calendar
 * plugin.
 * This allows the plugin to dynamically adapt to any date format configured by
 * the admin.
 */
@Path("/date-formats")
public class DateFormatResource {

    @GET
    @AnonymousAllowed
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDateFormats() {
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
            formats.put("error", e.getMessage());
        }

        return Response.ok(formats).build();
    }

    private String getPropertyOrDefault(ApplicationProperties props, String key, String defaultValue) {
        try {
            String value = props.getString(key);
            return (value != null && !value.isEmpty()) ? value : defaultValue;
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
