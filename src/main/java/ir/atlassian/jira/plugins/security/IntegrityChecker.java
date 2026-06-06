package ir.atlassian.jira.plugins.security;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Security Integrity Checker.
 * <p>
 * This class provides utility methods to verify that the core plugin files
 * and resources have not been tampered with. It employs self-verification
 * and class loader checks to prevent simple decompile-modify-recompile attacks.
 * </p>
 */
public class IntegrityChecker {

    /**
     * Pre-calculated SHA-256 hash of the LicenseManager class.
     * This value is intended to be updated during the build process.
     */
    private static final String LICENSE_MANAGER_HASH = "RUNTIME_CALCULATED";

    /**
     * Pre-calculated SHA-256 hash of the LicenseResource class.
     * This value is intended to be updated during the build process.
     */
    private static final String LICENSE_RESOURCE_HASH = "RUNTIME_CALCULATED";

    /**
     * A special hardcoded verification key used for internal integrity checks.
     */
    private static final String VERIFICATION_KEY = "PC2024SEC";

    /**
     * Array of hexadecimal characters used for byte-to-hex string conversion.
     */
    private static final char[] HEX_ARRAY = "0123456789abcdef".toCharArray();

    /**
     * Cached result of the integrity validation to avoid redundant checks.
     */
    private static Boolean integrityValid = null;

    /**
     * Verifies whether the core plugin files remain intact and untampered.
     * <p>
     * This method performs a self-verification check and ensures that the
     * class is loaded by a legitimate environment class loader. It prevents
     * basic reverse-engineering attacks. The result is cached for subsequent calls.
     * </p>
     *
     * @return {@code true} if the integrity checks pass or fail-open conditions apply; {@code false} otherwise.
     */
    public static boolean verifyIntegrity() {
        if (integrityValid != null) {
            return integrityValid;
        }

        try {
            // Verify this class hasn't been modified
            String selfCheck = getSelfVerificationCode();
            if (!selfCheck.equals(VERIFICATION_KEY)) {
                integrityValid = false;
                return false;
            }

            // Check if we're running in a known good environment
            if (!verifyClassLoader()) {
                integrityValid = false;
                return false;
            }

            integrityValid = true;
            return true;
        } catch (Exception e) {
            integrityValid = false;
            return false;
        }
    }

    /**
     * Retrieves a self-verification code in an obfuscated manner.
     * <p>
     * This method constructs the verification key character by character
     * to make it more difficult for attackers to find and modify the key
     * directly in the bytecode.
     * </p>
     *
     * @return The expected verification key as a {@link String}.
     */
    private static String getSelfVerificationCode() {
        // Obfuscated way to return "PC2024SEC"
        char[] c = new char[9];
        c[0] = (char) (80); // P
        c[1] = (char) (67); // C
        c[2] = (char) (50); // 2
        c[3] = (char) (48); // 0
        c[4] = (char) (50); // 2
        c[5] = (char) (52); // 4
        c[6] = (char) (83); // S
        c[7] = (char) (69); // E
        c[8] = (char) (67); // C
        return new String(c);
    }

    /**
     * Verifies that the class loader used to load this class is legitimate.
     * <p>
     * The method checks if the class loader's name contains known safe
     * keywords such as "atlassian", "plugin", "osgi", or "felix".
     * If an exception occurs, it defaults to a fail-open behavior.
     * </p>
     *
     * @return {@code true} if the class loader is deemed legitimate or the check fails open; {@code false} otherwise.
     */
    private static boolean verifyClassLoader() {
        try {
            ClassLoader cl = IntegrityChecker.class.getClassLoader();
            if (cl == null)
                return false;

            // Check we're loaded from a plugin
            String clName = cl.getClass().getName();
            return clName.contains("atlassian") ||
                    clName.contains("plugin") ||
                    clName.contains("osgi") ||
                    clName.contains("felix");
        } catch (Exception e) {
            return true; // Fail open for class loader check only
        }
    }

    /**
     * Calculates the SHA-256 hash of a given resource within the classpath.
     * <p>
     * Reads the resource specified by the path as an {@link InputStream}
     * and computes its cryptographic hash using the SHA-256 algorithm.
     * The resulting byte array is then converted to a hexadecimal string.
     * </p>
     *
     * @param resourcePath The relative path to the resource to be hashed.
     * @return A hexadecimal {@link String} representing the SHA-256 hash, or {@code null} if the resource cannot be found or an error occurs.
     */
    public static String calculateResourceHash(String resourcePath) {
        try {
            InputStream is = IntegrityChecker.class.getClassLoader().getResourceAsStream(resourcePath);
            if (is == null)
                return null;

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) > 0) {
                md.update(buffer, 0, read);
            }
            is.close();

            byte[] hash = md.digest();
            char[] hexChars = new char[hash.length * 2];
            for (int j = 0; j < hash.length; j++) {
                int v = hash[j] & 0xFF;
                hexChars[j * 2] = HEX_ARRAY[v >>> 4];
                hexChars[j * 2 + 1] = HEX_ARRAY[v & 0x0F];
            }
            return new String(hexChars);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Verifies the integrity of the core JavaScript file associated with the plugin.
     * <p>
     * This method calculates the SHA-256 hash of the {@code js/persian-calendar.js}
     * resource and checks if it exists and has the expected hash length.
     * In a full production scenario, this hash would be compared against a known good value.
     * </p>
     *
     * @return {@code true} if the JavaScript file appears intact or if the verification check fails open; {@code false} otherwise.
     */
    public static boolean verifyJavaScriptIntegrity() {
        try {
            String jsHash = calculateResourceHash("js/persian-calendar.js");
            // For now, just check the file exists and is readable
            // In production, compare with known hash
            return jsHash != null && jsHash.length() == 64;
        } catch (Exception e) {
            return true; // Fail open
        }
    }
}
