package ir.atlassian.jira.plugins.license;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.sal.api.pluginsettings.PluginSettings;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

/**
 * License Manager for Persian Calendar Plugin
 * Handles license validation, expiration, and grace period
 */
public class LicenseManager {

    private static final String PLUGIN_KEY = "ir.atlassian.jira.plugins.persian-calendar-plugin";
    private static final String LICENSE_KEY_SETTING = PLUGIN_KEY + ".license.key";
    private static final int GRACE_PERIOD_DAYS = 10;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Secret key retrieval logic.
     * Uses system properties to securely load the secret key, falling back to an obfuscated default.
     * The environment variable can be set via Jira startup options:
     * -Dpersian.calendar.secret=YOUR_SECURE_KEY
     */
    private static String getSecretKey() {
        String sysKey = System.getProperty("persian.calendar.secret");
        if (sysKey != null && !sysKey.trim().isEmpty()) {
            return sysKey.trim();
        }

        // Obfuscated fallback key representation to prevent simple static string extraction
        byte[] k = new byte[] {80, 101, 114, 115, 105, 97, 110, 67, 97, 108, 101, 110, 100, 97, 114, 50, 48, 50, 52, 83, 101, 99, 114, 101, 116, 75, 101, 121, 33, 64, 35, 36};
        return new String(k, StandardCharsets.UTF_8);
    }

    public enum LicenseType {
        FULL("F"),
        TRIAL("T");

        private final String code;
        private static final java.util.Map<String, LicenseType> CODE_MAP = new java.util.HashMap<>();

        static {
            for (LicenseType type : values()) {
                CODE_MAP.put(type.code, type);
            }
        }

        LicenseType(String code) {
            this.code = code;
        }

        public String getCode() {
            return code;
        }

        public static LicenseType fromCode(String code) {
            return CODE_MAP.get(code);
        }
    }

    public enum LicenseStatus {
        VALID,
        EXPIRED_IN_GRACE,
        EXPIRED,
        INVALID,
        NOT_FOUND
    }

    public static class LicenseInfo {
        private LicenseStatus status;
        private LicenseType type;
        private LocalDate expiryDate;
        private long daysRemaining;
        private long graceDaysRemaining;
        private String message;

        public LicenseStatus getStatus() {
            return status;
        }

        public void setStatus(LicenseStatus status) {
            this.status = status;
        }

        public LicenseType getType() {
            return type;
        }

        public void setType(LicenseType type) {
            this.type = type;
        }

        public LocalDate getExpiryDate() {
            return expiryDate;
        }

        public void setExpiryDate(LocalDate expiryDate) {
            this.expiryDate = expiryDate;
        }

        public long getDaysRemaining() {
            return daysRemaining;
        }

        public void setDaysRemaining(long daysRemaining) {
            this.daysRemaining = daysRemaining;
        }

        public long getGraceDaysRemaining() {
            return graceDaysRemaining;
        }

        public void setGraceDaysRemaining(long graceDaysRemaining) {
            this.graceDaysRemaining = graceDaysRemaining;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public boolean isCalendarEnabled() {
            return status == LicenseStatus.VALID || status == LicenseStatus.EXPIRED_IN_GRACE;
        }
    }

    private final PluginSettingsFactory pluginSettingsFactory;

    public LicenseManager(PluginSettingsFactory pluginSettingsFactory) {
        this.pluginSettingsFactory = pluginSettingsFactory;
    }

    /**
     * Get the current Jira Server ID
     */
    public String getServerIdHash() {
        try {
            com.atlassian.jira.license.JiraLicenseManager jiraLicenseManager = ComponentAccessor.getComponent(com.atlassian.jira.license.JiraLicenseManager.class);
            String serverId = jiraLicenseManager.getServerId();
            if (serverId != null && !serverId.isEmpty()) {
                return serverId;
            }
            return "00000000";
        } catch (Exception e) {
            return "00000000";
        }
    }

    /**
     * Validate and get license info
     */
    public LicenseInfo validateLicense() {
        LicenseInfo info = new LicenseInfo();

        // Security: Check plugin integrity first
        if (!ir.atlassian.jira.plugins.security.IntegrityChecker.verifyIntegrity()) {
            info.setStatus(LicenseStatus.INVALID);
            info.setMessage("خطای امنیتی: فایل‌های پلاگین دستکاری شده‌اند");
            return info;
        }

        String licenseKey = getLicenseKey();
        if (licenseKey == null || licenseKey.trim().isEmpty()) {
            info.setStatus(LicenseStatus.NOT_FOUND);
            info.setMessage("لایسنس وارد نشده است");
            return info;
        }

        // Parse license: TYPE-SERVERID-EXPIRY-SIGNATURE
        int firstDash = licenseKey.indexOf("-");
        int lastDash = licenseKey.lastIndexOf("-");
        int secondLastDash = licenseKey.lastIndexOf("-", lastDash - 1);

        if (firstDash == -1 || lastDash == -1 || secondLastDash == -1 || firstDash >= secondLastDash) {
            info.setStatus(LicenseStatus.INVALID);
            info.setMessage("فرمت لایسنس نامعتبر است");
            return info;
        }

        String typeCode = licenseKey.substring(0, firstDash);
        String serverHash = licenseKey.substring(firstDash + 1, secondLastDash);
        String expiryStr = licenseKey.substring(secondLastDash + 1, lastDash);
        String signature = licenseKey.substring(lastDash + 1);

        // Validate type
        LicenseType type = LicenseType.fromCode(typeCode);
        if (type == null) {
            info.setStatus(LicenseStatus.INVALID);
            info.setMessage("نوع لایسنس نامعتبر است");
            return info;
        }
        info.setType(type);

        // Validate Server ID
        String currentServerHash = getServerIdHash();
        if (!serverHash.equalsIgnoreCase(currentServerHash)) {
            info.setStatus(LicenseStatus.INVALID);
            info.setMessage("لایسنس برای این سرور معتبر نیست");
            return info;
        }

        // Validate signature
        String expectedSignature = generateSignature(typeCode, serverHash, expiryStr);
        if (!signature.equalsIgnoreCase(expectedSignature)) {
            info.setStatus(LicenseStatus.INVALID);
            info.setMessage("امضای لایسنس نامعتبر است");
            return info;
        }

        // Parse and check expiry date
        LocalDate expiryDate;
        try {
            expiryDate = LocalDate.parse(expiryStr, DATE_FORMAT);
        } catch (Exception e) {
            info.setStatus(LicenseStatus.INVALID);
            info.setMessage("تاریخ انقضا نامعتبر است");
            return info;
        }
        info.setExpiryDate(expiryDate);

        LocalDate today = LocalDate.now();
        long daysUntilExpiry = ChronoUnit.DAYS.between(today, expiryDate);
        info.setDaysRemaining(daysUntilExpiry);

        if (daysUntilExpiry >= 0) {
            info.setStatus(LicenseStatus.VALID);
            info.setMessage(type == LicenseType.TRIAL ? "لایسنس آزمایشی - " + daysUntilExpiry + " روز باقیمانده"
                    : "لایسنس معتبر - " + daysUntilExpiry + " روز باقیمانده");
        } else {
            // License has expired
            long daysSinceExpiry = Math.abs(daysUntilExpiry);

            // Grace period ONLY for FULL licenses, NOT for Trial
            if (type == LicenseType.FULL) {
                long graceDaysRemaining = GRACE_PERIOD_DAYS - daysSinceExpiry;
                info.setGraceDaysRemaining(graceDaysRemaining);

                if (graceDaysRemaining > 0) {
                    info.setStatus(LicenseStatus.EXPIRED_IN_GRACE);
                    info.setMessage("لایسنس منقضی شده - " + graceDaysRemaining + " روز مهلت باقیمانده");
                } else {
                    info.setStatus(LicenseStatus.EXPIRED);
                    info.setMessage("لایسنس منقضی شده است. لطفاً تمدید کنید.");
                }
            } else {
                // Trial license - NO grace period
                info.setGraceDaysRemaining(0);
                info.setStatus(LicenseStatus.EXPIRED);
                info.setMessage("لایسنس آزمایشی منقضی شده است. لطفاً لایسنس کامل تهیه کنید.");
            }
        }

        return info;
    }

    /**
     * Generate HMAC signature for license validation
     */
    private String generateSignature(String type, String serverHash, String expiry) {
        try {
            String data = type + "-" + serverHash + "-" + expiry;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            // Return first 8 characters of hex
            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1)
                    hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Get stored license key
     */
    public String getLicenseKey() {
        PluginSettings settings = pluginSettingsFactory.createGlobalSettings();
        Object value = settings.get(LICENSE_KEY_SETTING);
        return value != null ? value.toString() : null;
    }

    /**
     * Store license key
     */
    public void setLicenseKey(String licenseKey) {
        PluginSettings settings = pluginSettingsFactory.createGlobalSettings();
        settings.put(LICENSE_KEY_SETTING, licenseKey);
    }

    /**
     * Generate a new license key (for use in separate generator tool)
     */
    public static String generateLicenseKey(LicenseType type, String serverHash, LocalDate expiryDate) {
        String typeCode = type.getCode();
        String expiryStr = expiryDate.format(DATE_FORMAT);

        // Generate signature
        try {
            String data = typeCode + "-" + serverHash + "-" + expiryStr;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1)
                    hexString.append('0');
                hexString.append(hex);
            }
            String signature = hexString.toString().toUpperCase();

            return typeCode + "-" + serverHash + "-" + expiryStr + "-" + signature;
        } catch (Exception e) {
            return null;
        }
    }
}
