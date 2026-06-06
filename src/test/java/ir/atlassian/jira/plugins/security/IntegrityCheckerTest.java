package ir.atlassian.jira.plugins.security;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

import static org.junit.Assert.*;

/**
 * Unit tests for {@link IntegrityChecker}.
 * <p>
 * This class uses Java Reflection to test private methods and manipulate
 * static state (e.g., cached verification results) ensuring thorough coverage
 * of the plugin's self-verification and security mechanics.
 * </p>
 */
public class IntegrityCheckerTest {

    /**
     * Prepares the test environment before each test method execution.
     * Resets the static integrity cache to ensure test isolation.
     *
     * @throws Exception If reflection fails to access or modify the field.
     */
    @Before
    public void setUp() throws Exception {
        // Reset the static cached field before each test
        resetIntegrityValidField();
    }

    /**
     * Cleans up the test environment after each test method execution.
     * Resets the static integrity cache.
     *
     * @throws Exception If reflection fails to access or modify the field.
     */
    @After
    public void tearDown() throws Exception {
        // Reset the static cached field after each test
        resetIntegrityValidField();
    }

    /**
     * Helper method to reset the internal {@code integrityValid} static cache via reflection.
     *
     * @throws Exception If reflection fails.
     */
    private void resetIntegrityValidField() throws Exception {
        Field field = IntegrityChecker.class.getDeclaredField("integrityValid");
        field.setAccessible(true);
        field.set(null, null);
    }

    /**
     * Tests the private {@code getSelfVerificationCode} method.
     * Verifies that the obfuscated key string is correctly assembled.
     *
     * @throws Exception If reflection fails or invocation errors occur.
     */
    @Test
    public void testGetSelfVerificationCode() throws Exception {
        Method method = IntegrityChecker.class.getDeclaredMethod("getSelfVerificationCode");
        method.setAccessible(true);
        String result = (String) method.invoke(null);
        assertEquals("PC2024SEC", result);
    }

    /**
     * Tests the fast path of {@link IntegrityChecker#verifyIntegrity()} when
     * the result has already been cached as {@code true}.
     *
     * @throws Exception If reflection fails.
     */
    @Test
    public void testVerifyIntegrity_CachedTrue() throws Exception {
        // Force the cached value to true
        Field field = IntegrityChecker.class.getDeclaredField("integrityValid");
        field.setAccessible(true);
        field.set(null, true);

        // Should return true without evaluating the rest of the logic
        assertTrue(IntegrityChecker.verifyIntegrity());
    }

    /**
     * Tests the fast path of {@link IntegrityChecker#verifyIntegrity()} when
     * the result has already been cached as {@code false}.
     *
     * @throws Exception If reflection fails.
     */
    @Test
    public void testVerifyIntegrity_CachedFalse() throws Exception {
        // Force the cached value to false
        Field field = IntegrityChecker.class.getDeclaredField("integrityValid");
        field.setAccessible(true);
        field.set(null, false);

        // Should return false without evaluating the rest of the logic
        assertFalse(IntegrityChecker.verifyIntegrity());
    }

    /**
     * Tests the full execution of {@link IntegrityChecker#verifyIntegrity()}
     * without bypassing the cache. Simulates standard test runner conditions
     * to check class loader name validation logic.
     *
     * @throws Exception If reflection fails or underlying errors occur.
     */
    @Test
    public void testVerifyIntegrity_DefaultClassLoader() throws Exception {
        // Without mocking the class loader, it should default to false in a standard test environment
        // because "atlassian", "plugin", "osgi", "felix" are not in the standard AppClassLoader name.
        ClassLoader cl = IntegrityChecker.class.getClassLoader();
        String clName = cl.getClass().getName();

        boolean expectedResult = clName.contains("atlassian") ||
                                 clName.contains("plugin") ||
                                 clName.contains("osgi") ||
                                 clName.contains("felix");

        assertEquals(expectedResult, IntegrityChecker.verifyIntegrity());
    }

    /**
     * Tests the private {@code verifyClassLoader} method specifically using reflection.
     *
     * @throws Exception If reflection fails.
     */
    @Test
    public void testVerifyClassLoader() throws Exception {
        Method method = IntegrityChecker.class.getDeclaredMethod("verifyClassLoader");
        method.setAccessible(true);

        ClassLoader cl = IntegrityChecker.class.getClassLoader();
        String clName = cl.getClass().getName();

        boolean expectedResult = clName.contains("atlassian") ||
                                 clName.contains("plugin") ||
                                 clName.contains("osgi") ||
                                 clName.contains("felix");

        boolean result = (boolean) method.invoke(null);
        assertEquals(expectedResult, result);
    }

    /**
     * Tests the SHA-256 resource hashing functionality using a known test file.
     * Verifies that the generated hash is not null, has a length of 64 characters,
     * and strictly matches the expected hash sum.
     */
    @Test
    public void testCalculateResourceHash_ValidResource() {
        String hash = IntegrityChecker.calculateResourceHash("test-resource.txt");
        assertNotNull("Hash should not be null for existing resource", hash);
        assertEquals("Hash should be 64 characters long", 64, hash.length());

        // Exact SHA-256 for the test resource
        assertEquals("6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72", hash);
    }

    /**
     * Tests the resource hashing function against a non-existent file.
     * Verifies that it safely catches the exception and returns {@code null}
     * instead of propagating an error.
     */
    @Test
    public void testCalculateResourceHash_InvalidResource() {
        String hash = IntegrityChecker.calculateResourceHash("non-existent-resource.txt");
        assertNull("Hash should be null for non-existing resource", hash);
    }
}
