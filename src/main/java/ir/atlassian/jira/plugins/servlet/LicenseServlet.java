package ir.atlassian.jira.plugins.servlet;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.user.ApplicationUser;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;
import ir.atlassian.jira.plugins.license.LicenseManager;
import ir.atlassian.jira.plugins.license.LicenseManager.LicenseInfo;
import com.atlassian.jira.permission.GlobalPermissionKey;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import com.atlassian.jira.security.xsrf.XsrfTokenGenerator;

/**
 * License Administration Servlet.
 * <p>
 * This servlet acts as the backend for the plugin's license management UI.
 * It provides a web interface where Jira administrators can view their unique
 * Server ID, input a new license key, and check the current license validity status.
 * All operations within this servlet are strictly protected and require global
 * administrative permissions.
 * </p>
 */
public class LicenseServlet extends HttpServlet {

    /**
     * Escapes HTML special characters to prevent XSS attacks.
     *
     * @param input The raw input string.
     * @return The escaped HTML-safe string.
     */
    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    /**
     * Initializes and returns an instance of {@link LicenseManager}.
     * <p>
     * Retrieves the {@link PluginSettingsFactory} from Jira's OSGi component
     * accessor to supply the LicenseManager with the necessary persistence context.
     * </p>
     *
     * @return A ready-to-use {@link LicenseManager}.
     */
    private LicenseManager getLicenseManager() {
        PluginSettingsFactory psf = ComponentAccessor.getOSGiComponentInstanceOfType(PluginSettingsFactory.class);
        return new LicenseManager(psf);
    }

    /**
     * Handles HTTP GET requests to render the License Administration UI.
     * <p>
     * Before rendering, this method enforces authentication and authorization checks.
     * If the user is unauthenticated, they are redirected to the Jira login page.
     * If they lack administrative permissions, a 403 Forbidden error is returned.
     * </p>
     * <p>
     * The response consists of dynamically generated HTML containing the server ID,
     * license activation form, and current license status.
     * </p>
     *
     * @param request  The {@link HttpServletRequest} containing the client request.
     * @param response The {@link HttpServletResponse} where the HTML will be written.
     * @throws ServletException If a servlet-specific error occurs.
     * @throws IOException      If an input or output error is detected when the servlet handles the GET request.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // Check if user is logged in
        JiraAuthenticationContext authContext = ComponentAccessor.getJiraAuthenticationContext();
        ApplicationUser user = authContext.getLoggedInUser();

        if (user == null) {
            response.sendRedirect(request.getContextPath() + "/login.jsp");
            return;
        }

        if (!ComponentAccessor.getGlobalPermissionManager().hasPermission(GlobalPermissionKey.ADMINISTER, user)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Access Denied: Administrator permissions required.");
            return;
        }

        LicenseManager licenseManager = getLicenseManager();
        com.atlassian.jira.license.JiraLicenseManager jiraLicenseManager =
                ComponentAccessor.getComponent(com.atlassian.jira.license.JiraLicenseManager.class);
        String serverId = jiraLicenseManager != null ? jiraLicenseManager.getServerId() : "UNKNOWN";
        LicenseInfo licenseInfo = licenseManager.validateLicense();
        String message = request.getParameter("message");
        String messageType = request.getParameter("type");

        response.setContentType("text/html;charset=UTF-8");
        PrintWriter out = response.getWriter();

        out.println("<!DOCTYPE html>");
        out.println("<html dir='rtl' lang='fa'>");
        out.println("<head>");
        out.println("<meta charset='UTF-8'>");
        out.println("<title>مدیریت لایسنس - تقویم فارسی</title>");
        out.println("<style>");
        out.println(
                ".license-container { max-width: 600px; margin: 30px auto; padding: 25px; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); font-family: Tahoma, Arial, sans-serif; }");
        out.println(
                ".license-header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #f39c12; }");
        out.println(".license-header h1 { color: #333; font-size: 24px; margin: 0; }");
        out.println(
                ".section { margin-bottom: 25px; padding: 20px; background: #f9f9f9; border-radius: 6px; border-right: 4px solid #f39c12; }");
        out.println(".section-title { font-weight: bold; color: #333; margin-bottom: 12px; font-size: 16px; }");
        out.println(
                ".server-id { padding: 12px 15px; background: #fff; border: 2px solid #ddd; border-radius: 5px; font-family: monospace; font-size: 18px; font-weight: bold; color: #e67e22; letter-spacing: 2px; display: inline-block; }");
        out.println(
                ".license-input { width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px; font-family: monospace; margin-bottom: 15px; box-sizing: border-box; direction: ltr; text-align: left; }");
        out.println(
                ".activate-btn { width: 100%; padding: 14px; background: #27ae60; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 16px; }");
        out.println(".activate-btn:hover { background: #2ecc71; }");
        out.println(".status-box { padding: 15px; border-radius: 5px; text-align: center; }");
        out.println(".status-valid { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }");
        out.println(".status-invalid { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }");
        out.println(".status-none { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }");
        out.println(
                ".message-success { background: #d4edda; color: #155724; padding: 12px; border-radius: 5px; margin-bottom: 20px; text-align: center; }");
        out.println(
                ".message-error { background: #f8d7da; color: #721c24; padding: 12px; border-radius: 5px; margin-bottom: 20px; text-align: center; }");
        out.println(".hint { margin-top: 10px; color: #666; font-size: 13px; }");
        out.println(
                ".footer-link { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; }");
        out.println(".footer-link a { color: #f39c12; text-decoration: none; }");
        out.println("</style>");
        out.println("</head>");
        out.println("<body style='background: #f5f5f5;'>");
        out.println("<div class='license-container'>");
        out.println("<div class='license-header'>");
        out.println("<div style='font-size: 48px;'>📅</div>");
        out.println("<h1>تقویم فارسی - مدیریت لایسنس</h1>");
        out.println("</div>");

        // Message
        if (message != null && !message.isEmpty()) {
            out.println("<div class='message-" + escapeHtml(messageType != null ? messageType : "success") + "'>" + escapeHtml(message)
                    + "</div>");
        }

        // Server ID Section
        out.println("<div class='section'>");
        out.println("<div class='section-title'>🔑 شناسه سرور (Server ID)</div>");
        out.println("<div class='server-id'>" + serverId + "</div>");
        out.println("<div class='hint'>⚠️ این شناسه را برای دریافت لایسنس به فروشنده ارسال کنید</div>");
        out.println("</div>");

        // License Input Section
        XsrfTokenGenerator xsrfGenerator = ComponentAccessor.getComponent(XsrfTokenGenerator.class);
        String atlToken = xsrfGenerator.generateToken(request);
        
        out.println("<div class='section'>");
        out.println("<div class='section-title'>🔐 فعال‌سازی لایسنس</div>");
        out.println("<form method='POST'>");
        out.println("<input type='hidden' name='atl_token' value='" + escapeHtml(atlToken) + "'>");
        out.println(
                "<textarea name='licenseKey' class='license-input' rows='4' style='resize: vertical; font-family: monospace; font-size: 11px; word-break: break-all;' placeholder='کلید لایسنس (حاوی امضای رمزنگاری شده)'></textarea>");
        out.println("<button type='submit' class='activate-btn'>🔓 فعال‌سازی لایسنس</button>");
        out.println("</form>");
        out.println("</div>");

        // Status Section
        out.println("<div class='section'>");
        out.println("<div class='section-title'>📊 وضعیت لایسنس</div>");
        String statusClass = licenseInfo.isCalendarEnabled() ? "status-valid"
                : (licenseInfo.getStatus().name().equals("NOT_FOUND") ? "status-none" : "status-invalid");
        String statusIcon = licenseInfo.isCalendarEnabled() ? "✅"
                : (licenseInfo.getStatus().name().equals("NOT_FOUND") ? "⚪" : "❌");
        String statusText = licenseInfo.isCalendarEnabled() ? "فعال"
                : (licenseInfo.getStatus().name().equals("NOT_FOUND") ? "بدون لایسنس" : "غیرفعال");
        out.println("<div class='status-box " + statusClass + "'>");
        out.println("<div style='font-size: 24px;'>" + statusIcon + "</div>");
        out.println("<div style='font-weight: bold; font-size: 16px;'>" + statusText + "</div>");
        out.println("<div style='margin-top: 8px; font-size: 14px;'>" + licenseInfo.getMessage() + "</div>");
        out.println("</div>");
        out.println("</div>");

        // Footer
        out.println("<div class='footer-link'>");
        out.println("<a href='https://desktopcenter.ir/' target='_blank'>🌐 خرید لایسنس از DesktopCenter.ir</a>");
        out.println("</div>");
        out.println("</div>");
        out.println("</body>");
        out.println("</html>");
    }

    /**
     * Handles HTTP POST requests submitted via the license activation form.
     * <p>
     * Like the GET handler, this method strictly enforces authentication and
     * administrative authorization. It expects a {@code licenseKey} parameter
     * in the request body. The key is cleaned, stored via {@link LicenseManager},
     * and validated.
     * </p>
     * <p>
     * Upon completion, the client is redirected back to the GET endpoint with
     * a success or error message appended as query parameters.
     * </p>
     *
     * @param request  The {@link HttpServletRequest} containing the submitted form data.
     * @param response The {@link HttpServletResponse} used to issue a redirect.
     * @throws ServletException If a servlet-specific error occurs.
     * @throws IOException      If an input or output error is detected during the POST request.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // Check if user is logged in
        JiraAuthenticationContext authContext = ComponentAccessor.getJiraAuthenticationContext();
        ApplicationUser user = authContext.getLoggedInUser();

        if (user == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        if (!ComponentAccessor.getGlobalPermissionManager().hasPermission(GlobalPermissionKey.ADMINISTER, user)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Access Denied: Administrator permissions required.");
            return;
        }

        // CSRF Check
        XsrfTokenGenerator xsrfGenerator = ComponentAccessor.getComponent(XsrfTokenGenerator.class);
        String atlToken = request.getParameter("atl_token");
        if (atlToken == null || !atlToken.equals(xsrfGenerator.getToken(request))) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Access Denied: CSRF validation failed.");
            return;
        }

        String licenseKey = request.getParameter("licenseKey");
        String message;
        String messageType;

        LicenseManager licenseManager = getLicenseManager();

        if (licenseKey != null && !licenseKey.trim().isEmpty()) {
            licenseManager.setLicenseKey(licenseKey.trim());
            LicenseInfo info = licenseManager.validateLicense();

            if (info.isCalendarEnabled()) {
                message = "✅ لایسنس با موفقیت فعال شد!";
                messageType = "success";
            } else {
                message = "❌ " + info.getMessage();
                messageType = "error";
            }
        } else {
            message = "❌ لطفاً کلید لایسنس را وارد کنید";
            messageType = "error";
        }

        response.sendRedirect(request.getRequestURI() + "?message=" +
                java.net.URLEncoder.encode(message, "UTF-8") + "&type=" + java.net.URLEncoder.encode(messageType, "UTF-8"));
    }
}
