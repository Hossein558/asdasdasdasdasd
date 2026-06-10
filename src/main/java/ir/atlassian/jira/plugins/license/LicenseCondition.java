package ir.atlassian.jira.plugins.license;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.plugin.web.Condition;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;

import java.util.Map;

/**
 * Jira web-resource condition that prevents the Persian Calendar JS/CSS bundle
 * from being injected into any Jira page when the license is invalid.
 *
 * <p>Declared in {@code atlassian-plugin.xml} via:
 * <pre>
 *   &lt;web-resource key="persian-calendar-resources" ...&gt;
 *     &lt;condition class="ir.atlassian.jira.plugins.license.LicenseCondition"/&gt;
 *     ...
 *   &lt;/web-resource&gt;
 * </pre>
 *
 * <p><strong>Why this closes the bypass:</strong> When this condition returns
 * {@code false}, Jira's web-resource manager will not include the
 * {@code <script>} and {@code <link>} tags for the calendar bundle in the
 * rendered HTML. The browser never downloads the JS/CSS, so there is nothing
 * to patch in DevTools. Compare with {@link LicenseGuard}, which operates at
 * the REST layer — this condition operates at the page-delivery layer.
 *
 * <p><strong>Fail-open policy:</strong> If the OSGi container is not yet
 * available (null {@link PluginSettingsFactory}) or an unexpected exception
 * occurs, the condition returns {@code true} (include resources). This avoids
 * breaking Jira for legitimate customers during plugin startup.
 */
public class LicenseCondition implements Condition {

    /**
     * Called once by the plugin framework with any configured parameters.
     * No parameters are used by this condition.
     */
    @Override
    public void init(Map<String, String> params) {
        // No configuration parameters required.
    }

    /**
     * Returns {@code true} (include the web-resource) only when the license
     * is valid or in grace period. Returns {@code false} otherwise so the
     * JS/CSS bundle is never sent to the browser.
     *
     * @param context The Jira rendering context (not used).
     * @return {@code true} if the calendar should be active on this page load.
     */
    @Override
    public boolean shouldDisplay(Map<String, Object> context) {
        try {
            PluginSettingsFactory psf =
                    ComponentAccessor.getOSGiComponentInstanceOfType(PluginSettingsFactory.class);
            if (psf == null) {
                // OSGi not ready — fail open to avoid blocking Jira startup.
                return true;
            }
            LicenseManager licenseManager = new LicenseManager(psf);
            return licenseManager.validateLicense().isCalendarEnabled();
        } catch (Exception e) {
            // Fail open: an unexpected error should not break Jira page renders.
            return true;
        }
    }
}
