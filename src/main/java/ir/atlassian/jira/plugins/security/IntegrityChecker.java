package ir.atlassian.jira.plugins.security;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Security Integrity Checker.
 * <p>
 * This class provides utility methods to verify that the core plugin files
 * and resources have not been tampered with. It employs self-verification
 * and class loader checks to prevent simple decompile-modify-recompile attacks.
 * </p>
 * <p>
 * <strong>Active security layers (all enforced inside {@link #verifyIntegrity()}):</strong>
 * <ol>
 *   <li>Class-loader environment check — rejects non-OSGi/Atlassian runtimes.</li>
 *   <li>SHA-256 hash of {@code atlassian-plugin.xml} — detects descriptor tampering.</li>
 *   <li>SHA-256 hash of {@code js/persian-calendar.js} — detects client-side code tampering.</li>
 *   <li>Loadability check of {@code LicenseManager} — ensures core classes are present.</li>
 * </ol>
 * </p>
 * <p>
 * <strong>Hash management:</strong> SHA-256 hashes for {@code atlassian-plugin.xml}
 * and {@code js/persian-calendar.js} are <em>not</em> hard-coded in source.
 * Instead, they are written into {@code integrity.properties} by the Maven build
 * (via {@code maven-antrun-plugin}) after the JS-obfuscation step so that they
 * always reflect the exact bytes that will be shipped inside the JAR.
 * If the properties file is absent (e.g., running directly from source without
 * a full Maven build) the checks are skipped and the method returns {@code true}
 * to avoid blocking development workflows.
 * </p>
 */
public class IntegrityChecker {

    private static final Logger log = LoggerFactory.getLogger(IntegrityChecker.class);

    /** Path (on classpath) to the build-time generated hash properties file. */
    private static final String INTEGRITY_PROPS_PATH = "integrity.properties";

    /** Property key for the atlassian-plugin.xml SHA-256 hash. */
    private static final String PROP_XML_HASH = "integrity.xml.sha256";

    /** Property key for the js/persian-calendar.js SHA-256 hash. */
    private static final String PROP_JS_HASH  = "integrity.js.sha256";

    /**
     * Array of hexadecimal characters used for byte-to-hex string conversion.
     */
    private static final char[] HEX_ARRAY = "0123456789abcdef".toCharArray();

    /**
     * Cached result of the integrity validation to avoid redundant checks.
     */
    private static Boolean integrityValid = null;

    /**
     * SHA-256 hashes loaded once from {@code integrity.properties} at class-load time.
     * A {@code null} value means the properties file was not found — the build was
     * not run or the file was stripped; in that case all hash checks are skipped
     * (fail-open for development, but the JAR produced by {@code atlas-package}
     * will always contain the file).
     */
    private static final String EXPECTED_XML_HASH;
    private static final String EXPECTED_JS_HASH;

    static {
        String xmlHash = null;
        String jsHash  = null;
        try (InputStream is = IntegrityChecker.class.getClassLoader()
                .getResourceAsStream(INTEGRITY_PROPS_PATH)) {
            if (is != null) {
                Properties props = new Properties();
                props.load(is);
                xmlHash = props.getProperty(PROP_XML_HASH);
                jsHash  = props.getProperty(PROP_JS_HASH);
            } else {
                // FIX #5: warn loudly when integrity.properties is missing
                log.warn("[PersianCalendar] integrity.properties NOT FOUND on classpath. "
                        + "SHA-256 integrity checks (Layers 2 & 3) are DISABLED. "
                        + "Build with atlas-package to generate this file.");
            }
        } catch (IOException e) {
            log.warn("[PersianCalendar] Failed to load integrity.properties: {}", e.getMessage());
        }
        EXPECTED_XML_HASH = xmlHash;
        EXPECTED_JS_HASH  = jsHash;
    }

    /**
     * Verifies whether the core plugin files remain intact and untampered.
     * <p>
     * Performs all four active security layers in sequence:
     * </p>
     * <ol>
     *   <li>Class-loader environment check.</li>
     *   <li>SHA-256 hash of {@code atlassian-plugin.xml}.</li>
     *   <li>SHA-256 hash of {@code js/persian-calendar.js} (previously dead code — now active).</li>
     *   <li>Loadability of {@code LicenseManager}.</li>
     * </ol>
     * <p>
     * The result is cached after the first evaluation to avoid redundant checks
     * on every license validation call.
     * </p>
     *
     * @return {@code true} if all integrity checks pass or fail-open conditions apply; {@code false} otherwise.
     */
    public static boolean verifyIntegrity() {
        if (integrityValid != null) {
            return integrityValid;
        }

        try {
            // Layer 1: Class-loader environment check
            if (!verifyClassLoader()) {
                integrityValid = false;
                return false;
            }

            // Layer 2: Verify atlassian-plugin.xml has not been tampered with.
            // Skipped if integrity.properties was not bundled (development build).
            if (EXPECTED_XML_HASH != null) {
                String pluginXmlHash = calculateResourceHash("atlassian-plugin.xml");
                if (pluginXmlHash == null || !pluginXmlHash.equals(EXPECTED_XML_HASH)) {
                    integrityValid = false;
                    return false;
                }
            }

            // Layer 3: Verify js/persian-calendar.js has not been tampered with.
            // Skipped if integrity.properties was not bundled (development build).
            if (EXPECTED_JS_HASH != null) {
                String jsHash = calculateResourceHash("js/persian-calendar.js");
                if (jsHash == null || !jsHash.equals(EXPECTED_JS_HASH)) {
                    integrityValid = false;
                    return false;
                }
            }

            // Layer 4: Verify that the core LicenseManager class is loadable
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
            // FIX #3: log classloader check failure instead of silently passing
            log.warn("[PersianCalendar] ClassLoader verification threw exception: {}", e.getMessage());
            return true; // Fail open for class loader check only — logged for visibility
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
     * This is a convenience wrapper that re-evaluates the JS hash check independently
     * of the cached {@link #verifyIntegrity()} result — useful for on-demand spot
     * checks (e.g., diagnostics endpoints). The authoritative enforcement of this
     * check during license validation happens inside {@link #verifyIntegrity()},
     * which includes the JS hash as Layer 3.
     * </p>
     *
     * @return {@code true} if the JavaScript file matches the expected hash, or if
     *         the hash is not available (development build without atlas-package);
     *         {@code false} if the file is missing or the hash does not match.
     */
    public static boolean verifyJavaScriptIntegrity() {
        try {
            // If EXPECTED_JS_HASH is null the build-time properties were not generated
            // (development run without atlas-package). Skip check and return true.
            if (EXPECTED_JS_HASH == null) {
                return true;
            }
            String jsHash = calculateResourceHash("js/persian-calendar.js");
            return jsHash != null && jsHash.equals(EXPECTED_JS_HASH);
        } catch (Exception e) {
            return false; // Fail CLOSED: if JS can't be read, integrity is broken
        }
    }
}
