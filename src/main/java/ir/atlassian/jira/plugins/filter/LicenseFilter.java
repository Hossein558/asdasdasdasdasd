package ir.atlassian.jira.plugins.filter;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import ir.atlassian.jira.plugins.license.LicenseManager;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Universal security checkpoint for the Persian Calendar Plugin.
 * Intercepts incoming requests for static resources and REST APIs
 * and strictly enforces license validity before allowing the request to proceed.
 */
public class LicenseFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // No initialization required
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        String path = req.getRequestURI();

        // 1. Never block the license administration endpoints or checks
        if (path != null && (
                path.contains("/plugins/servlet/persian-calendar/license") ||
                path.contains("/rest/persian-calendar/1.0/license")
        )) {
            chain.doFilter(request, response);
            return;
        }

        try {
            // 2. Fetch the LicenseManager from OSGi context
            PluginSettingsFactory psf = ComponentAccessor.getOSGiComponentInstanceOfType(PluginSettingsFactory.class);
            
            if (psf != null) {
                LicenseManager licenseManager = new LicenseManager(psf);
                LicenseManager.LicenseInfo info = licenseManager.validateLicense();
                
                if (!info.isCalendarEnabled()) {
                    // Fail closed with 402
                    res.setStatus(402); // 402 Payment Required
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write("{\"error\": \"Invalid or missing license\", \"reason\": \"لایسنس معتبر نیست. لطفاً لایسنس را فعال کنید.\"}");
                    res.getWriter().flush();
                    return;
                }
            } else {
                // Fail open during Jira startup if OSGi is not fully loaded
                chain.doFilter(request, response);
                return;
            }
        } catch (Exception e) {
            // Exception thrown (e.g. database error), fail closed
            res.setStatus(402); // 402 Payment Required
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\": \"License verification failed\"}");
            res.getWriter().flush();
            return;
        }

        // 3. License is valid, proceed
        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        // Cleanup if needed
    }
}
