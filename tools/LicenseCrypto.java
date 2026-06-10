import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Shared cryptographic utilities for the standalone license generator tools.
 *
 * <p>This file is a <strong>package-free mirror</strong> of
 * {@code src/main/java/ir/atlassian/jira/plugins/license/LicenseCrypto.java}.
 * It exists here so the tools can be compiled and run without the full plugin
 * on the classpath.
 *
 * <p><strong>IMPORTANT:</strong> Any change to key retrieval or signature logic
 * MUST be applied identically in the plugin's {@code LicenseCrypto.java} and here.
 * The signature length (8 hex chars / 4 bytes) and the default key must always match.
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
     *       (e.g. {@code java -Dpersian.calendar.secret=YOUR_KEY LicenseGenerator})</li>
     *   <li>Obfuscated compile-time fallback</li>
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
        // SYNC: Must match LicenseCrypto.java in the plugin source tree.
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
