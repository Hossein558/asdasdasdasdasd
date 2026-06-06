package ir.atlassian.jira.plugins.rest;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.plugins.rest.common.security.AnonymousAllowed;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import ir.atlassian.jira.plugins.license.LicenseManager;
import ir.atlassian.jira.plugins.license.LicenseManager.LicenseInfo;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.user.ApplicationUser;
import com.atlassian.jira.permission.GlobalPermissionKey;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;

/**
 * REST API for License Management.
 * <p>
 * Exposes endpoints for managing and retrieving the plugin's license information.
 * This includes checking current license status, fetching the server ID for license generation,
 * and activating new licenses.
 * </p>
 */
@Path("/license")
public class LicenseResource {

    /**
     * Instantiates and retrieves the {@link LicenseManager}.
     * <p>
     * Obtains the {@link PluginSettingsFactory} from the OSGi component system
     * to initialize the manager with the correct context.
     * </p>
     *
     * @return A new instance of {@link LicenseManager}.
     */
    private LicenseManager getLicenseManager() {
        PluginSettingsFactory psf = ComponentAccessor.getOSGiComponentInstanceOfType(PluginSettingsFactory.class);
        return new LicenseManager(psf);
    }

    /**
     * Checks if the currently authenticated user possesses administrative privileges.
     * <p>
     * Verifies that there is a logged-in user and that the user holds the
     * {@link GlobalPermissionKey#ADMINISTER} global permission within Jira.
     * </p>
     *
     * @return {@code true} if the current user is an administrator; {@code false} otherwise.
     */
    private boolean isAdmin() {
        JiraAuthenticationContext authContext = ComponentAccessor.getJiraAuthenticationContext();
        ApplicationUser user = authContext.getLoggedInUser();
        return user != null && ComponentAccessor.getGlobalPermissionManager().hasPermission(GlobalPermissionKey.ADMINISTER, user);
    }

    /**
     * Retrieves the current license status.
     * <p>
     * This endpoint is called by the frontend (often anonymously) to determine
     * if the calendar functionality should be enabled. It returns the validation
     * status, remaining days, and any applicable warning messages.
     * </p>
     *
     * @return A JSON representation of the {@link LicenseInfo} mapped properties.
     */
    @GET
    @Path("/status")
    @AnonymousAllowed
    @Produces(MediaType.APPLICATION_JSON)
    public Response getLicenseStatus() {
        try {
            LicenseManager licenseManager = getLicenseManager();
            LicenseInfo info = licenseManager.validateLicense();

            Map<String, Object> response = new HashMap<>();
            response.put("status", info.getStatus().name());
            response.put("enabled", info.isCalendarEnabled());
            response.put("message", info.getMessage());
            response.put("daysRemaining", info.getDaysRemaining());

            if (info.getType() != null) {
                response.put("type", info.getType().name());
            }
            if (info.getExpiryDate() != null) {
                response.put("expiryDate", info.getExpiryDate().toString());
            }
            if (info.getGraceDaysRemaining() > 0) {
                response.put("graceDaysRemaining", info.getGraceDaysRemaining());
            }

            return Response.ok(response).build();
        } catch (Exception e) {
            // Log error and return a safe response
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "ERROR");
            errorResponse.put("enabled", false);
            errorResponse.put("message", "خطا در بررسی لایسنس: " + e.getMessage());
            errorResponse.put("error", e.getClass().getSimpleName());
            return Response.ok(errorResponse).build();
        }
    }

    /**
     * Retrieves the current Jira Server ID.
     * <p>
     * This endpoint requires administrative privileges. The server ID is necessary
     * for generating a valid, node-locked license key for this specific instance.
     * </p>
     *
     * @return A JSON response containing the server ID string.
     */
    @GET
    @Path("/server-id")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getServerId() {
        if (!isAdmin()) {
            return Response.status(Response.Status.FORBIDDEN).entity(java.util.Collections.singletonMap("error", "Access Denied")).build();
        }
        try {
            LicenseManager licenseManager = getLicenseManager();
            Map<String, String> response = new HashMap<>();
            response.put("serverId", licenseManager.getServerIdHash());
            return Response.ok(response).build();
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("serverId", "ERROR");
            errorResponse.put("error", e.getMessage());
            return Response.ok(errorResponse).build();
        }
    }

    /**
     * Activates a newly provided license key.
     * <p>
     * This endpoint requires administrative privileges. It accepts a JSON payload
     * containing the "licenseKey" field, stores it via the {@link LicenseManager},
     * and performs an immediate validation check.
     * </p>
     *
     * @param request A map containing the "licenseKey" string to activate.
     * @return A JSON response indicating the success status and message.
     */
    @POST
    @Path("/activate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response activateLicense(Map<String, String> request) {
        if (!isAdmin()) {
            return Response.status(Response.Status.FORBIDDEN).entity(java.util.Collections.singletonMap("error", "Access Denied")).build();
        }
        try {
            String licenseKey = request.get("licenseKey");

            if (licenseKey == null || licenseKey.trim().isEmpty()) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("error", "لایسنس نمی‌تواند خالی باشد");
                return Response.status(Response.Status.BAD_REQUEST).entity(errorResponse).build();
            }

            LicenseManager licenseManager = getLicenseManager();
            licenseManager.setLicenseKey(licenseKey.trim().toUpperCase());
            LicenseInfo info = licenseManager.validateLicense();

            Map<String, Object> response = new HashMap<>();
            response.put("success", info.getStatus() == LicenseManager.LicenseStatus.VALID ||
                    info.getStatus() == LicenseManager.LicenseStatus.EXPIRED_IN_GRACE);
            response.put("status", info.getStatus().name());
            response.put("message", info.getMessage());

            return Response.ok(response).build();
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            return Response.ok(errorResponse).build();
        }
    }

    /**
     * Retrieves the currently stored license key in a masked format.
     * <p>
     * This endpoint requires administrative privileges. For security purposes,
     * the returned license string has its middle sections obscured (e.g.,
     * showing only the first 4 and last 4 characters).
     * </p>
     *
     * @return A JSON response containing the masked "licenseKey" string.
     */
    @GET
    @Path("/current")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCurrentLicense() {
        if (!isAdmin()) {
            return Response.status(Response.Status.FORBIDDEN).entity(java.util.Collections.singletonMap("error", "Access Denied")).build();
        }
        try {
            LicenseManager licenseManager = getLicenseManager();
            String licenseKey = licenseManager.getLicenseKey();

            Map<String, Object> response = new HashMap<>();
            if (licenseKey != null && !licenseKey.isEmpty()) {
                if (licenseKey.length() > 8) {
                    response.put("licenseKey", licenseKey.substring(0, 4) + "-****-****-" +
                            licenseKey.substring(licenseKey.length() - 4));
                } else {
                    response.put("licenseKey", "****");
                }
            } else {
                response.put("licenseKey", null);
            }

            return Response.ok(response).build();
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("licenseKey", null);
            response.put("error", e.getMessage());
            return Response.ok(response).build();
        }
    }
}
