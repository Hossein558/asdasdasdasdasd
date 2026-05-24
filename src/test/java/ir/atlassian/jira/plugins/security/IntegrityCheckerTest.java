package ir.atlassian.jira.plugins.security;

import org.junit.Test;
import static org.junit.Assert.*;

public class IntegrityCheckerTest {

    @Test
    public void testCalculateResourceHash_ValidResource() {
        String hash = IntegrityChecker.calculateResourceHash("test-resource.txt");
        assertNotNull("Hash should not be null for existing resource", hash);
        assertEquals("Hash should be 64 characters long", 64, hash.length());

        // Exact SHA-256 for the test resource
        assertEquals("6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72", hash);
    }

    @Test
    public void testCalculateResourceHash_InvalidResource() {
        String hash = IntegrityChecker.calculateResourceHash("non-existent-resource.txt");
        assertNull("Hash should be null for non-existing resource", hash);
    }
}
