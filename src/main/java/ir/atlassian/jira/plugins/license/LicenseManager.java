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
    private static final String SECRET_KEY = "PersianCalendar2024SecretKey!@#$"; // Change this in production!
    private static final int GRACE_PERIOD_DAYS = 10;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    public enum LicenseType {
        FULL("F"),
        TRIAL("T");

        private final String code;

        LicenseType(String code) {
            this.code = code;
        }

        public String getCode() {
            return code;
        }

        public static LicenseType fromCode(String code) {
            for (LicenseType type : values()) {
                if (type.code.equals(code)) {
                    return type;
                }
            }
            return null;
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

        public LicenseStatus getStatus() { return status; }
        public void setStatus(LicenseStatus status) { this.status = status; }
        public LicenseType getType() { return type; }
        public void setType(LicenseType type) { this.type = type; }
        public LocalDate getExpiryDate() { return expiryDate; }
        public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
        public long getDaysRemaining() { return daysRemaining; }
        public void setDaysRemaining(long daysRemaining) { this.daysRemaining = daysRemaining; }
        public long getGraceDaysRemaining() { return graceDaysRemaining; }
        public void setGraceDaysRemaining(long graceDaysRemaining) { this.graceDaysRemaining = graceDaysRemaining; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public boolean isCalendarEnabled() {
            return status == LicenseStatus.VALID || status == LicenseStatus.EXPIRED_IN_GRACE;
        }
    }

    private final PluginSettingsFactory pluginSettingsFactory;

    public LicenseManager(PluginSettingsFactory pluginSettingsFactory) {
        this.pluginSettingsFactory = pluginSettingsFactory;
    }

    /**
     * Get the current Server ID hash (custom method, not Atlassian's)
     */
    public String getServerIdHash() {
        try {
            // Use multiple server-specific values to create a unique ID
            String jiraHome = System.getProperty("jira.home", "");
            String hostname = java.net.InetAddress.getLocalHost().getHostName();
            String osInfo = System.getProperty("os.name") + System.getProperty("os.arch");
            
            String combined = jiraHome + "|" + hostname + "|" + osInfo;
            
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(combined.getBytes(StandardCharsets.UTF_8));
            
            // Return first 8 characters of hex string
            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            return "00000000";
        }
    }

    /**
     * Validate and get license info
     */
    public LicenseInfo validateLicense() {
        LicenseInfo info = new LicenseInfo();
        
        String licenseKey = getLicenseKey();
        if (licenseKey == null || licenseKey.trim().isEmpty()) {
            info.setStatus(LicenseStatus.NOT_FOUND);
            info.setMessage("لایسنس وارد نشده است");
            return info;
        }

        // Parse license: TYPE-SERVERID-EXPIRY-SIGNATURE
        String[] parts = licenseKey.split("-");
        if (parts.length != 4) {
            info.setStatus(LicenseStatus.INVALID);
            info.setMessage("فرمت لایسنس نامعتبر است");
            return info;
        }

        String typeCode = parts[0];
        String serverHash = parts[1];
        String expiryStr = parts[2];
        String signature = parts[3];

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
            info.setMessage(type == LicenseType.TRIAL ? 
                "لایسنس آزمایشی - " + daysUntilExpiry + " روز باقیمانده" :
                "لایسنس معتبر - " + daysUntilExpiry + " روز باقیمانده");
        } else {
            long daysSinceExpiry = Math.abs(daysUntilExpiry);
            long graceDaysRemaining = GRACE_PERIOD_DAYS - daysSinceExpiry;
            info.setGraceDaysRemaining(graceDaysRemaining);

            if (graceDaysRemaining > 0) {
                info.setStatus(LicenseStatus.EXPIRED_IN_GRACE);
                info.setMessage("لایسنس منقضی شده - " + graceDaysRemaining + " روز مهلت باقیمانده");
            } else {
                info.setStatus(LicenseStatus.EXPIRED);
                info.setMessage("لایسنس منقضی شده است. لطفاً تمدید کنید.");
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
            SecretKeySpec keySpec = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            
            // Return first 8 characters of hex
            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1) hexString.append('0');
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
            SecretKeySpec keySpec = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            
            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            String signature = hexString.toString().toUpperCase();
            
            return typeCode + "-" + serverHash + "-" + expiryStr + "-" + signature;
        } catch (Exception e) {
            return null;
        }
    }
}
