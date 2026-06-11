package ir.atlassian.jira.plugins.license;

import org.junit.Test;

import static org.junit.Assert.*;

/**
 * Unit tests for {@link LicenseCrypto} — the single source of truth for
 * license key generation and validation cryptography.
 *
 * These tests act as a canary: if the signature length, key, or algorithm
 * changes in LicenseCrypto, these tests will fail immediately, forcing a
 * conscious decision to also update the standalone tools in tools/.
 */
public class LicenseCryptoTest {

    // --- getSecretKey() ---

    @Test
    public void testGetSecretKey_returnsNonNullNonEmpty() {
        String key = LicenseCrypto.getSecretKey();
        assertNotNull("Secret key must not be null", key);
        assertFalse("Secret key must not be empty", key.isEmpty());
    }

    @Test
    public void testGetSecretKey_systemPropertyOverridesTakePrecedence() {
        System.setProperty("persian.calendar.secret", "test-override-key");
        try {
            assertEquals("test-override-key", LicenseCrypto.getSecretKey());
        } finally {
            System.clearProperty("persian.calendar.secret");
        }
    }

    @Test
    public void testGetSecretKey_fallbackUsedWhenPropertyAbsent() {
        System.clearProperty("persian.calendar.secret");
        String key = LicenseCrypto.getSecretKey();
        // Fallback decodes to "PersianCalendar2024SecretKey!@#$"
        assertEquals("PersianCalendar2024SecretKey!@#$", key);
    }

    // --- generateSignature() ---

    @Test
    public void testGenerateSignature_lengthIsExactlyEightChars() {
        String sig = LicenseCrypto.generateSignature("F", "ABCD1234", "20251231");
        assertEquals("Signature must be exactly 8 hex characters (4 bytes)", 8, sig.length());
    }

    @Test
    public void testGenerateSignature_isUppercase() {
        String sig = LicenseCrypto.generateSignature("F", "ABCD1234", "20251231");
        assertEquals("Signature must be uppercase", sig.toUpperCase(), sig);
    }

    @Test
    public void testGenerateSignature_isDeterministic() {
        String sig1 = LicenseCrypto.generateSignature("T", "WXYZ9876", "20230101");
        String sig2 = LicenseCrypto.generateSignature("T", "WXYZ9876", "20230101");
        assertEquals("Same inputs must always produce the same signature", sig1, sig2);
    }

    @Test
    public void testGenerateSignature_differentInputsProduceDifferentOutput() {
        String sigFull  = LicenseCrypto.generateSignature("F", "ABCD1234", "20251231");
        String sigTrial = LicenseCrypto.generateSignature("T", "ABCD1234", "20251231");
        assertNotEquals("Different license types must yield different signatures", sigFull, sigTrial);
    }

    @Test
    public void testGenerateSignature_onlyHexChars() {
        String sig = LicenseCrypto.generateSignature("F", "ABCD1234", "20251231");
        assertTrue("Signature must contain only hex characters [0-9A-F]",
                sig.matches("[0-9A-F]{8}"));
    }

    // --- round-trip consistency with LicenseManager ---

    /**
     * Verifies that the signature appended by {@link LicenseManager#generateLicenseKey}
     * is exactly 8 uppercase hex characters for a dash-free server ID.
     * Uses anchor-from-end parsing (same strategy as validateLicense()) instead
     * of {@code split("-").length} which breaks for dashed server IDs.
     */
    @Test
    public void testSignatureIsConsistentWithLicenseManagerGenerateKey_dashFreeId() {
        String key = LicenseManager.generateLicenseKey(
                LicenseManager.LicenseType.FULL, "ABCD1234",
                java.time.LocalDate.of(2025, 12, 31));
        assertNotNull("Generated key must not be null", key);

        // Anchor from the END — mirrors the production parsing in validateLicense()
        String signature = key.substring(key.lastIndexOf('-') + 1);
        assertEquals("Signature must be exactly 8 hex chars", 8, signature.length());
        assertTrue("Signature must be uppercase hex [0-9A-F]",
                signature.matches("[0-9A-F]{8}"));
    }

    /**
     * Same round-trip check but with a <em>realistic</em> dashed Jira Server ID
     * (e.g., {@code BPT3-4S1P-7QGE-5M9S}). A naive {@code split("-").length == 4}
     * assertion would fail here even though the key is correctly formed.
     */
    @Test
    public void testSignatureIsConsistentWithLicenseManagerGenerateKey_dashedId() {
        String dashedServerId = "BPT3-4S1P-7QGE-5M9S";   // real Jira Server ID format
        String key = LicenseManager.generateLicenseKey(
                LicenseManager.LicenseType.FULL, dashedServerId,
                java.time.LocalDate.of(2026, 6, 30));
        assertNotNull("Generated key must not be null", key);

        // Anchor from the END
        int lastDash       = key.lastIndexOf('-');
        int secondLastDash = key.lastIndexOf('-', lastDash - 1);
        int firstDash      = key.indexOf('-');

        String typeCode  = key.substring(0, firstDash);
        String serverId  = key.substring(firstDash + 1, secondLastDash);
        String expiry    = key.substring(secondLastDash + 1, lastDash);
        String signature = key.substring(lastDash + 1);

        assertEquals("Type code must be F",                       "F",            typeCode);
        assertEquals("Dashed server ID must be preserved as-is",  dashedServerId, serverId);
        assertEquals("Expiry must be formatted yyyyMMdd",         "20260630",     expiry);
        assertEquals("Signature must be exactly 8 hex chars",     8,              signature.length());
        assertTrue("Signature must be uppercase hex [0-9A-F]",
                signature.matches("[0-9A-F]{8}"));

        // The signature produced by LicenseCrypto must equal what generateSignature() returns directly
        String expectedSig = LicenseCrypto.generateSignature("F", dashedServerId, "20260630");
        assertEquals("LicenseManager and LicenseCrypto must agree on the signature",
                expectedSig, signature);
    }
}
