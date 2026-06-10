package ir.atlassian.jira.plugins.license;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;

import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.Collections;
import java.util.Optional;

/**
 * Server-side license enforcement guard for REST endpoints.
 *
 * <p>Usage — call at the top of any REST method that serves calendar data:
 * <pre>
 *   Optional&lt;Response&gt; block = LicenseGuard.check();
 *   if (block.isPresent()) return block.get();
 *   // ... proceed with normal handling
 * </pre>
 *
 * <p><strong>Why this matters:</strong> The JavaScript client-side license check
 * ({@code /rest/persian-calendar/1.0/license/status}) can be bypassed by
 * patching JS in browser dev-tools or intercepting the HTTP response.
 * This guard ensures the <em>server</em> refuses to serve calendar data when the
 * license is missing or invalid — no amount of client-side manipulation can
 * work around a server 402 response.
 *
 * <p><strong>Which endpoints must be guarded:</strong>
 * <ul>
 *   <li>Any endpoint whose response is required for the calendar to render or function.</li>
 *   <li>Do NOT guard {@code /license/status} itself — that is the check endpoint.</li>
 *   <li>Do NOT guard {@code /license/activate}, {@code /license/server-id} — admin utilities.</li>
 * </ul>
 */
public final class LicenseGuard {

    /** HTTP 402 Payment Required — semantically correct for a license gate. */
    private static final int HTTP_PAYMENT_REQUIRED = 402;

    private LicenseGuard() {}

    /**
     * Check whether the current license permits calendar usage.
     *
     * @return {@link Optional#empty()} if the license is valid and the request may proceed;
     *         an {@link Optional} containing a ready-to-return HTTP 402 {@link Response} if not.
     */
    public static Optional<Response> check() {
        try {
            PluginSettingsFactory psf =
                    ComponentAccessor.getOSGiComponentInstanceOfType(PluginSettingsFactory.class);
            if (psf == null) {
                // Cannot retrieve settings — fail open to avoid blocking legitimate users
                // when the OSGi container is still starting up.
                return Optional.empty();
            }

            LicenseManager licenseManager = new LicenseManager(psf);
            LicenseManager.LicenseInfo info = licenseManager.validateLicense();

            if (info.isCalendarEnabled()) {
                return Optional.empty(); // license OK — proceed
            }

            // License invalid / expired — refuse to serve calendar data.
            return Optional.of(buildBlockResponse());
        } catch (Exception e) {
            // Fail open: unexpected errors should not break Jira for end users.
            return Optional.empty();
        }
    }

    /**
     * Builds the HTTP 402 response returned when the license is invalid.
     * Package-private to allow unit testing without an OSGi container.
     */
    static Response buildBlockResponse() {
        return Response.status(HTTP_PAYMENT_REQUIRED)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(Collections.singletonMap("error",
                        "لایسنس معتبر نیست. لطفاً لایسنس را فعال کنید."))
                .build();
    }
}
