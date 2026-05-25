package ir.atlassian.jira.plugins.license;

import org.junit.Test;
import java.time.LocalDate;
import static org.junit.Assert.*;

public class LicenseManagerTest {

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
