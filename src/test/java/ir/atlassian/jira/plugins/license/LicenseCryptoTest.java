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

    @Test
    public void testSignatureIsConsistentWithLicenseManagerGenerateKey() {
        // LicenseManager.generateLicenseKey() delegates to LicenseCrypto internally.
        // Ensure the last segment (signature) of a generated key is exactly 8 chars.
        String key = LicenseManager.generateLicenseKey(
                LicenseManager.LicenseType.FULL, "ABCD1234",
                java.time.LocalDate.of(2025, 12, 31));
        assertNotNull(key);
        String[] parts = key.split("-");
        assertEquals(4, parts.length);
        assertEquals(8, parts[3].length());
    }
}
