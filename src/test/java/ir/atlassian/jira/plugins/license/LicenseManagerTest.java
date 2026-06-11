package ir.atlassian.jira.plugins.license;

import org.junit.Test;
import java.time.LocalDate;
import static org.junit.Assert.*;

/**
 * Unit tests for {@link LicenseManager}.
 * <p>
 * This class verifies the standalone license key generation logic used by
 * both internal checks and the external license generation tool.
 * </p>
 * <p>
 * <strong>Parsing strategy note:</strong> A generated license key has the
 * form {@code TYPE-SERVERID-EXPIRY-SIGNATURE}. Because a real Jira Server ID
 * contains dashes (e.g., {@code BPT3-4S1P-7QGE-5M9S}), the total number of
 * dash-separated segments is <em>not</em> a reliable assertion. Tests instead
 * anchor from the <strong>end</strong> of the string — exactly as
 * {@link LicenseManager#validateLicense()} does in production — and verify
 * the concrete type-code, expiry-date, and signature values directly.
 * </p>
 */
public class LicenseManagerTest {

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Extracts the type code (everything before the first dash).
     */
    private static String parseType(String key) {
        return key.substring(0, key.indexOf('-'));
    }

    /**
     * Extracts the expiry string (the segment immediately before the
     * last dash, i.e. the second-to-last token when anchoring from the end).
     */
    private static String parseExpiry(String key) {
        int lastDash       = key.lastIndexOf('-');
        int secondLastDash = key.lastIndexOf('-', lastDash - 1);
        return key.substring(secondLastDash + 1, lastDash);
    }

    /**
     * Extracts the signature (everything after the last dash).
     */
    private static String parseSignature(String key) {
        return key.substring(key.lastIndexOf('-') + 1);
    }

    /**
     * Extracts the Server ID (everything between the first and second-to-last
     * dash), which may itself contain dashes for real Jira Server IDs.
     */
    private static String parseServerId(String key) {
        int firstDash      = key.indexOf('-');
        int lastDash       = key.lastIndexOf('-');
        int secondLastDash = key.lastIndexOf('-', lastDash - 1);
        return key.substring(firstDash + 1, secondLastDash);
    }

    // -----------------------------------------------------------------------
    // FULL license — dash-free server ID (legacy / simple scenario)
    // -----------------------------------------------------------------------

    /**
     * Tests generation of a FULL license key with a simple 8-char, dash-free
     * server ID. Assertions parse fields by anchoring from the ends of the
     * string rather than counting {@code split("-")} segments.
     */
    @Test
    public void testGenerateLicenseKeyFull_dashFreeServerId() {
        String serverHash  = "ABCD1234";
        LocalDate expiry   = LocalDate.of(2025, 12, 31);

        String key = LicenseManager.generateLicenseKey(
                LicenseManager.LicenseType.FULL, serverHash, expiry);

        assertNotNull("Generated key must not be null", key);
        assertEquals("Type code must be F",          "F",        parseType(key));
        assertEquals("Server ID must be preserved",  serverHash, parseServerId(key));
        assertEquals("Expiry date must be yyyyMMdd", "20251231", parseExpiry(key));
        assertEquals("Signature must be 8 hex chars", 8,         parseSignature(key).length());
        assertTrue("Signature must be uppercase hex",
                parseSignature(key).matches("[0-9A-F]{8}"));
    }

    // -----------------------------------------------------------------------
    // TRIAL license — dash-free server ID
    // -----------------------------------------------------------------------

    /**
     * Tests generation of a TRIAL license key with a dash-free server ID.
     */
    @Test
    public void testGenerateLicenseKeyTrial_dashFreeServerId() {
        String serverHash  = "WXYZ9876";
        LocalDate expiry   = LocalDate.of(2023, 1, 1);

        String key = LicenseManager.generateLicenseKey(
                LicenseManager.LicenseType.TRIAL, serverHash, expiry);

        assertNotNull("Generated key must not be null", key);
        assertEquals("Type code must be T",          "T",        parseType(key));
        assertEquals("Server ID must be preserved",  serverHash, parseServerId(key));
        assertEquals("Expiry date must be yyyyMMdd", "20230101", parseExpiry(key));
        assertEquals("Signature must be 8 hex chars", 8,         parseSignature(key).length());
        assertTrue("Signature must be uppercase hex",
                parseSignature(key).matches("[0-9A-F]{8}"));
    }

    // -----------------------------------------------------------------------
    // FULL license — realistic dashed Jira Server ID (19-char XXXX-XXXX-XXXX-XXXX)
    // -----------------------------------------------------------------------

    /**
     * Tests generation of a FULL license key using a <em>real</em> Jira
     * Server ID that contains dashes (e.g., {@code BPT3-4S1P-7QGE-5M9S}).
     * <p>
     * This is the production-realistic scenario. {@code split("-")} would yield
     * 7 segments for such a key, which is why that assertion was removed.
     * This test verifies the parse-by-anchor approach works correctly.
     * </p>
     */
    @Test
    public void testGenerateLicenseKeyFull_dashedServerId() {
        String serverHash  = "BPT3-4S1P-7QGE-5M9S";   // real Jira Server ID format
        LocalDate expiry   = LocalDate.of(2026, 6, 30);

        String key = LicenseManager.generateLicenseKey(
                LicenseManager.LicenseType.FULL, serverHash, expiry);

        assertNotNull("Generated key must not be null", key);
        assertEquals("Type code must be F",          "F",        parseType(key));
        assertEquals("Dashed Server ID must be preserved verbatim",
                serverHash, parseServerId(key));
        assertEquals("Expiry date must be yyyyMMdd", "20260630", parseExpiry(key));
        assertEquals("Signature must be 8 hex chars", 8,         parseSignature(key).length());
        assertTrue("Signature must be uppercase hex",
                parseSignature(key).matches("[0-9A-F]{8}"));
    }

    /**
     * Tests generation of a TRIAL license key using a realistic dashed
     * Jira Server ID.
     */
    @Test
    public void testGenerateLicenseKeyTrial_dashedServerId() {
        String serverHash  = "BPT3-4S1P-7QGE-5M9S";
        LocalDate expiry   = LocalDate.of(2024, 3, 15);

        String key = LicenseManager.generateLicenseKey(
                LicenseManager.LicenseType.TRIAL, serverHash, expiry);

        assertNotNull("Generated key must not be null", key);
        assertEquals("Type code must be T",          "T",        parseType(key));
        assertEquals("Dashed Server ID must be preserved verbatim",
                serverHash, parseServerId(key));
        assertEquals("Expiry date must be yyyyMMdd", "20240315", parseExpiry(key));
        assertEquals("Signature must be 8 hex chars", 8,         parseSignature(key).length());
        assertTrue("Signature must be uppercase hex",
                parseSignature(key).matches("[0-9A-F]{8}"));
    }

    // -----------------------------------------------------------------------
    // Null / edge-case input
    // -----------------------------------------------------------------------

    /**
     * Tests the behavior of the license generator when provided with null inputs.
     * Verifies that a {@link NullPointerException} is appropriately thrown.
     */
    @Test
    public void testGenerateLicenseKeyNullValues() {
        try {
            LicenseManager.generateLicenseKey(null, "ABCD", LocalDate.now());
            fail("Expected NullPointerException");
        } catch (NullPointerException e) {
            // expected
        }
    }
}
