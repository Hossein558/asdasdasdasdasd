package ir.atlassian.jira.plugins.license;

import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

/**
 * Shared cryptographic utilities for license validation.
 *
 * <p>This class uses asymmetric RSA cryptography.
 * <ul>
 *   <li>The <strong>Public Key</strong> is embedded here and used to verify signatures.</li>
 *   <li>The <strong>Private Key</strong> is kept externally and used by the standalone generator.</li>
 * </ul>
 */
public final class LicenseCrypto {

    // The Base64 encoded RSA-2048 public key
    private static final String PUBLIC_KEY_BASE64 = 
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlPn5WhZ5Vvywapn+mL3p" +
        "/Ut3rbjCu9Y8JoC9mswVTI+XUVmUI8DGCKqi4qXVZ9FgVLlN30CZamZM/wh/Ajzv" +
        "Yuyt1/aObI71+a2i64yrC/W75a+K39yG0O0tAI747/Gpn38mVVIL4Bergz0U0K6H" +
        "bS6a7smbgaABhsy4X5Ng/VmpsMDwP/3MLHjHwwjMQnx4C5DnY9VxLrBiWWf+2rnC" +
        "dKXHgUmr04IIrut3G3435m42Ud7Gj6di9Yuakw91T9queFSUhgbZ0k1uOKQcaT9I" +
        "Gh7eOXIaVFaPsIQ+hZQp3Wn/vxTaoUNOiFjSM0yVx/DJd2NE9esdItyBfy1Bq9gD" +
        "uQIDAQAB";

    private static PublicKey publicKey;

    static {
        try {
            byte[] keyBytes = Base64.getDecoder().decode(PUBLIC_KEY_BASE64);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            publicKey = kf.generatePublic(spec);
        } catch (Exception e) {
            // Should never happen unless the hardcoded key is corrupted
            publicKey = null;
        }
    }

    private LicenseCrypto() {
        // utility class
    }

    /**
     * Verifies an RSA signature encoded as a Hex string.
     *
     * @param payload      the signed string (e.g. "F-SERVERID-20261231")
     * @param hexSignature the 512-character hex signature
     * @return true if the signature is valid
     */
    public static boolean verifySignature(String payload, String hexSignature) {
        if (publicKey == null || hexSignature == null || hexSignature.isEmpty()) {
            return false;
        }

        try {
            byte[] signatureBytes = hexStringToByteArray(hexSignature);
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(payload.getBytes(StandardCharsets.UTF_8));
            return sig.verify(signatureBytes);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Helper to convert Hex string to byte array.
     */
    private static byte[] hexStringToByteArray(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                                 + Character.digit(s.charAt(i+1), 16));
        }
        return data;
    }
}
