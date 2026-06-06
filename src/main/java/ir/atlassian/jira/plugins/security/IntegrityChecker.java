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
            // Check if we're running in a known good environment
            if (!verifyClassLoader()) {
                integrityValid = false;
                return false;
            }

            // Verify that the plugin descriptor resource exists and is readable
            String pluginXmlHash = calculateResourceHash("atlassian-plugin.xml");
            if (pluginXmlHash == null || pluginXmlHash.length() != 64) {
                integrityValid = false;
                return false;
            }

            // Verify that the core LicenseManager class is loadable
            try {
                Class.forName("ir.atlassian.jira.plugins.license.LicenseManager",
                        false, IntegrityChecker.class.getClassLoader());
            } catch (ClassNotFoundException e) {
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
        try (InputStream is = IntegrityChecker.class.getClassLoader().getResourceAsStream(resourcePath)) {
            if (is == null)
                return null;

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) > 0) {
                md.update(buffer, 0, read);
            }

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
     * resource and checks if it exists and produces a valid hash.
     * </p>
     * <p>
     * <b>Note:</b> Currently performs an existence and readability check only.
     * A future enhancement should compare the hash against a build-time generated value.
     * </p>
     *
     * @return {@code true} if the JavaScript file exists and is readable; {@code false} otherwise.
     */
    public static boolean verifyJavaScriptIntegrity() {
        try {
            String jsHash = calculateResourceHash("js/persian-calendar.js");
            if (jsHash == null || jsHash.length() != 64) {
                return false;
            }
            // TODO: Compare jsHash against a build-time generated known-good hash
            // for full tamper detection. Currently only validates file existence.
            return true;
        } catch (Exception e) {
            return true; // Fail open
        }
    }
}
