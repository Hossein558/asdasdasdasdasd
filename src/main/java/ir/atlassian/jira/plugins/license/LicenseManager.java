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
// Base64 import removed - was unused

/**
 * License Manager for the Persian Calendar Plugin.
 * <p>
 * This class is responsible for managing the plugin's licensing system.
 * It handles license validation, tracks expiration dates, and manages grace periods
 * for full licenses. The license string is stored globally using Jira's
 * {@link PluginSettingsFactory}.
 * </p>
 */
public class LicenseManager {

    /**
     * The core plugin key used as a prefix for storing settings.
     */
    private static final String PLUGIN_KEY = "ir.atlassian.jira.plugins.persian-calendar-plugin";

    /**
     * The key under which the license string is stored in plugin settings.
     */
    private static final String LICENSE_KEY_SETTING = PLUGIN_KEY + ".license.key";

    /**
     * The number of days a FULL license remains usable after its expiration date.
     */
    private static final int GRACE_PERIOD_DAYS = 10;

    /**
     * The expected date format for license expiration strings.
     */
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Retrieves the secret key used for HMAC signature generation and validation.
     * <p>
     * This method attempts to load a custom secret key from the system property
     * {@code persian.calendar.secret}. If no property is set, it falls back to an
     * XOR-deobfuscated default key to prevent simple static string extraction from the bytecode.
     * </p>
     * <p>
     * <b>WARNING:</b> For production deployments, always set a custom key via:
     * {@code -Dpersian.calendar.secret=YOUR_SECURE_KEY}
     * Relying on the embedded fallback key is NOT recommended for high-security environments.
     * </p>
     *
     * @return A {@link String} containing the secret key.
     */
    private static String getSecretKey() {
        String sysKey = System.getProperty("persian.calendar.secret");
        if (sysKey != null && !sysKey.trim().isEmpty()) {
            return sysKey.trim();
        }

        // XOR-deobfuscated fallback key — harder to extract than plain byte array
        byte[] encoded = new byte[] {117, 70, 31, 6, 24, 64, 27, 38, 66, 45, 70, 27, 35, 66, 51, 69, 95, 69, 93, 32, 70, 68, 51, 70, 43, 48, 70, 56, 112, 29, 100, 71};
        byte xorKey = 0x25;
        byte[] decoded = new byte[encoded.length];
        for (int i = 0; i < encoded.length; i++) {
            decoded[i] = (byte) (encoded[i] ^ xorKey ^ (i % 7));
        }
        return new String(decoded, StandardCharsets.UTF_8);
    }

    /**
     * Enumeration of supported license types.
     */
    public enum LicenseType {
        /**
         * Represents a paid, full license. Includes a grace period upon expiration.
         */
        FULL("F"),

        /**
         * Represents a temporary, trial license. Expires immediately with no grace period.
         */
        TRIAL("T");

        private final String code;
        private static final java.util.Map<String, LicenseType> CODE_MAP = new java.util.HashMap<>();

        static {
            for (LicenseType type : values()) {
                CODE_MAP.put(type.code, type);
            }
        }

        /**
         * Constructs a new LicenseType with the corresponding string code.
         *
         * @param code The string code representing the license type.
         */
        LicenseType(String code) {
            this.code = code;
        }

        /**
         * Gets the single-character string code associated with this license type.
         *
         * @return The license code (e.g., "F" or "T").
         */
        public String getCode() {
            return code;
        }

        /**
         * Looks up a {@link LicenseType} based on its string code.
         *
         * @param code The code to search for.
         * @return The corresponding {@link LicenseType}, or {@code null} if no match is found.
         */
        public static LicenseType fromCode(String code) {
            return CODE_MAP.get(code);
        }
    }

    /**
     * Enumeration representing the current validation state of a license.
     */
    public enum LicenseStatus {
        /** The license is valid and active. */
        VALID,
        /** The license has expired but is still within its allowed grace period. */
        EXPIRED_IN_GRACE,
        /** The license is fully expired and no longer provides access. */
        EXPIRED,
        /** The license key is structurally invalid, corrupt, or signature verification failed. */
        INVALID,
        /** No license key is currently stored or configured. */
        NOT_FOUND
    }

    /**
     * A Data Transfer Object (DTO) containing detailed information about
     * the current state, type, and expiration details of a license.
     */
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

        /**
         * Determines if the Persian Calendar features should remain enabled based
         * on the current license status.
         *
         * @return {@code true} if the status is {@link LicenseStatus#VALID} or {@link LicenseStatus#EXPIRED_IN_GRACE}; {@code false} otherwise.
         */
        public boolean isCalendarEnabled() {
            return status == LicenseStatus.VALID || status == LicenseStatus.EXPIRED_IN_GRACE;
        }
    }

    /**
     * Factory used for retrieving global plugin settings.
     */
    private final PluginSettingsFactory pluginSettingsFactory;

    /**
     * Constructs a new {@link LicenseManager} instance.
     *
     * @param pluginSettingsFactory The {@link PluginSettingsFactory} injected by Jira.
     */
    public LicenseManager(PluginSettingsFactory pluginSettingsFactory) {
        this.pluginSettingsFactory = pluginSettingsFactory;
    }

    /**
     * Retrieves the current Jira Server ID.
     * <p>
     * This method fetches the server ID from the Jira License Manager.
     * If an error occurs or the ID is missing, it returns a default "00000000" string.
     * </p>
     *
     * @return The Jira Server ID as a {@link String}.
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
     * Validates the currently stored license key and returns comprehensive license information.
     * <p>
     * The validation process includes:
     * <ol>
     *   <li>Performing an integrity check on the core plugin files.</li>
     *   <li>Retrieving the stored license key.</li>
     *   <li>Parsing the license string components (Type, Server Hash, Expiry, Signature).</li>
     *   <li>Verifying the signature using HMAC-SHA256.</li>
     *   <li>Calculating remaining days and applying grace periods if applicable.</li>
     * </ol>
     * </p>
     *
     * @return A populated {@link LicenseInfo} object reflecting the current license state.
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
                info.setGraceDaysRemaining(Math.max(0, graceDaysRemaining));

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
     * Generates an HMAC-SHA256 signature for a set of license parameters.
     * <p>
     * The signature is derived from combining the license type code, server hash,
     * and expiration date string, and hashing it with the secret key.
     * </p>
     *
     * @param type       The single-character license type code (e.g., "F" or "T").
     * @param serverHash The Server ID associated with the license.
     * @param expiry     The expiration date string formatted as "yyyyMMdd".
     * @return The first 8 uppercase hexadecimal characters of the generated signature, or an empty string on error.
     */
    private String generateSignature(String type, String serverHash, String expiry) {
        try {
            String data = type + "-" + serverHash + "-" + expiry;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            // Return first 16 characters of hex (64-bit signature)
            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 8; i++) {
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
     * Retrieves the stored license key from the global plugin settings.
     *
     * @return The stored license key string, or {@code null} if no key exists.
     */
    public String getLicenseKey() {
        PluginSettings settings = pluginSettingsFactory.createGlobalSettings();
        Object value = settings.get(LICENSE_KEY_SETTING);
        return value != null ? value.toString() : null;
    }

    /**
     * Saves a new license key into the global plugin settings.
     *
     * @param licenseKey The raw license key string to store.
     */
    public void setLicenseKey(String licenseKey) {
        PluginSettings settings = pluginSettingsFactory.createGlobalSettings();
        settings.put(LICENSE_KEY_SETTING, licenseKey);
    }

    /**
     * Generates a complete, new license key.
     * <p>
     * This method is primarily intended for use in an external or separate
     * license generator tool. It constructs the full license string formatted as:
     * {@code [TYPE]-[SERVER_ID]-[EXPIRY_DATE]-[SIGNATURE]}.
     * </p>
     *
     * @param type       The {@link LicenseType} (e.g., FULL or TRIAL).
     * @param serverHash The target Jira Server ID.
     * @param expiryDate The {@link LocalDate} when the license should expire.
     * @return The newly generated license key string, or {@code null} if an error occurs.
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
            for (int i = 0; i < 8; i++) {
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
