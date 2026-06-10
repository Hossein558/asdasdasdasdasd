package ir.atlassian.jira.plugins.license;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Shared cryptographic utilities for license generation and validation.
 *
 * <p>This is the <strong>single source of truth</strong> for:
 * <ul>
 *   <li>Secret key retrieval</li>
 *   <li>HMAC-SHA256 signature generation</li>
 * </ul>
 *
 * <p><strong>IMPORTANT — Standalone tools:</strong> {@code tools/LicenseCrypto.java} is a
 * package-free mirror of this class used by the standalone generator tools.
 * Any change made here MUST be applied there identically, and vice versa.
 * The signature length (8 hex chars / 4 bytes) and the key retrieval logic
 * must always stay in sync across both files.
 */
public final class LicenseCrypto {

    private LicenseCrypto() {
        // utility class
    }

    /**
     * Retrieve the HMAC secret key.
     *
     * <p>Priority order:
     * <ol>
     *   <li>System property {@code persian.calendar.secret}
     *       (set via Jira startup: {@code -Dpersian.calendar.secret=YOUR_SECURE_KEY})</li>
     *   <li>Obfuscated compile-time fallback (development / unset environments)</li>
     * </ol>
     *
     * @return the secret key string; never null
     */
    public static String getSecretKey() {
        String sysKey = System.getProperty("persian.calendar.secret");
        if (sysKey != null && !sysKey.trim().isEmpty()) {
            return sysKey.trim();
        }
        // Obfuscated fallback — avoids plain-text extraction from bytecode.
        // Decodes to: PersianCalendar2024SecretKey!@#$
        byte[] k = new byte[]{
            80, 101, 114, 115, 105, 97, 110, 67, 97, 108, 101, 110, 100, 97, 114,
            50, 48, 50, 52, 83, 101, 99, 114, 101, 116, 75, 101, 121, 33, 64, 35, 36
        };
        return new String(k, StandardCharsets.UTF_8);
    }

    /**
     * Generate an 8-character (4-byte) uppercase HMAC-SHA256 hex signature.
     *
     * <p>The signed payload is: {@code type + "-" + serverHash + "-" + expiry}
     *
     * @param type       license type code ("F" or "T")
     * @param serverHash server ID hash
     * @param expiry     expiry date in {@code yyyyMMdd} format
     * @return 8-character uppercase hex string, or {@code ""} on error
     */
    public static String generateSignature(String type, String serverHash, String expiry) {
        try {
            String data = type + "-" + serverHash + "-" + expiry;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                    getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder(8);
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
}
