package ir.atlassian.jira.plugins.rest;

import com.atlassian.jira.config.properties.ApplicationProperties;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.atlassian.plugins.rest.common.security.AnonymousAllowed;
import org.springframework.stereotype.Component;

import javax.inject.Inject;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;

/**
 * REST Resource to expose Jira's date format settings to the Persian Calendar plugin.
 * This allows the plugin to dynamically adapt to any date format configured by the admin.
 */
@Path("/date-formats")
@Component
public class DateFormatResource {

    private final ApplicationProperties applicationProperties;

    @Inject
    public DateFormatResource(@ComponentImport ApplicationProperties applicationProperties) {
        this.applicationProperties = applicationProperties;
    }

    @GET
    @AnonymousAllowed
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDateFormats() {
        Map<String, String> formats = new HashMap<>();
        
        // Java (server-side) date formats
        formats.put("dateFormat", getPropertyOrDefault(
            "jira.date.picker.java.format", "d/MMM/yy"));
        
        formats.put("dateTimeFormat", getPropertyOrDefault(
            "jira.date.time.picker.java.format", "dd/MMM/yy h:mm a"));
        
        // JavaScript (client-side) date formats
        formats.put("dateFormatJS", getPropertyOrDefault(
            "jira.date.picker.javascript.format", "%e/%b/%y"));
        
        formats.put("dateTimeFormatJS", getPropertyOrDefault(
            "jira.date.time.picker.javascript.format", "%e/%b/%y %I:%M %p"));
        
        // Additional look and feel formats
        formats.put("timeFormat", getPropertyOrDefault(
            "jira.lf.date.time", "h:mm a"));
        
        formats.put("dayFormat", getPropertyOrDefault(
            "jira.lf.date.day", "EEEE h:mm a"));
        
        formats.put("completeDateTimeFormat", getPropertyOrDefault(
            "jira.lf.date.complete", "dd/MMM/yy h:mm a"));
        
        formats.put("dmyFormat", getPropertyOrDefault(
            "jira.lf.date.dmy", "dd/MMM/yy"));
        
        return Response.ok(formats).build();
    }
    
    private String getPropertyOrDefault(String key, String defaultValue) {
        try {
            String value = applicationProperties.getString(key);
            return (value != null && !value.isEmpty()) ? value : defaultValue;
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
