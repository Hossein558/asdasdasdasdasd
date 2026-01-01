package ir.atlassian.jira.plugins.rest;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.plugins.rest.common.security.AnonymousAllowed;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import ir.atlassian.jira.plugins.license.LicenseManager;
import ir.atlassian.jira.plugins.license.LicenseManager.LicenseInfo;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;

/**
 * REST API for License Management
 */
@Path("/license")
public class LicenseResource {

    private LicenseManager getLicenseManager() {
        PluginSettingsFactory psf = ComponentAccessor.getOSGiComponentInstanceOfType(PluginSettingsFactory.class);
        return new LicenseManager(psf);
    }

    /**
     * Get license status (called by frontend)
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
     * Get Server ID hash (for license generation)
     */
    @GET
    @Path("/server-id")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getServerId() {
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
     * Set license key (admin only)
     */
    @POST
    @Path("/activate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response activateLicense(Map<String, String> request) {
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
     * Get current license key (masked)
     */
    @GET
    @Path("/current")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCurrentLicense() {
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
