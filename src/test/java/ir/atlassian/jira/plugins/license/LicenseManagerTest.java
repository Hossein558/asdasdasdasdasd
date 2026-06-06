package ir.atlassian.jira.plugins.license;

import org.junit.Test;
import java.time.LocalDate;
import static org.junit.Assert.*;

/**
 * Unit tests for {@link LicenseManager}.
 * <p>
 * This class specifically verifies the standalone license key generation logic
 * which is utilized by both internal checks and the external license generation tool.
 * </p>
 */
public class LicenseManagerTest {

    /**
     * Tests the generation of a FULL license key.
     * Verifies that the generated string follows the correct format,
     * uses the 'F' type code, and correctly embeds the server hash,
     * expiration date, and signature block.
     */
    @Test
    public void testGenerateLicenseKeyFull() {
        LicenseManager.LicenseType type = LicenseManager.LicenseType.FULL;
        String serverHash = "ABCD1234";
        LocalDate expiryDate = LocalDate.of(2025, 12, 31);

        String licenseKey = LicenseManager.generateLicenseKey(type, serverHash, expiryDate);

        assertNotNull(licenseKey);
        String[] parts = licenseKey.split("-");
        assertEquals(4, parts.length);
        assertEquals("F", parts[0]);
        assertEquals("ABCD1234", parts[1]);
        assertEquals("20251231", parts[2]);
        assertEquals(8, parts[3].length()); // Signature length
    }

    /**
     * Tests the generation of a TRIAL license key.
     * Verifies that the generated string uses the 'T' type code
     * and adheres to the expected formatting structure.
     */
    @Test
    public void testGenerateLicenseKeyTrial() {
        LicenseManager.LicenseType type = LicenseManager.LicenseType.TRIAL;
        String serverHash = "WXYZ9876";
        LocalDate expiryDate = LocalDate.of(2023, 1, 1);

        String licenseKey = LicenseManager.generateLicenseKey(type, serverHash, expiryDate);

        assertNotNull(licenseKey);
        String[] parts = licenseKey.split("-");
        assertEquals(4, parts.length);
        assertEquals("T", parts[0]);
        assertEquals("WXYZ9876", parts[1]);
        assertEquals("20230101", parts[2]);
        assertEquals(8, parts[3].length()); // Signature length
    }

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
