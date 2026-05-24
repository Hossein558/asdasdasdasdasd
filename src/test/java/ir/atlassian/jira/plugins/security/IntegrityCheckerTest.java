package ir.atlassian.jira.plugins.security;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

import static org.junit.Assert.*;

public class IntegrityCheckerTest {

    @Before
    public void setUp() throws Exception {
        // Reset the static cached field before each test
        resetIntegrityValidField();
    }

    @After
    public void tearDown() throws Exception {
        // Reset the static cached field after each test
        resetIntegrityValidField();
    }

    private void resetIntegrityValidField() throws Exception {
        Field field = IntegrityChecker.class.getDeclaredField("integrityValid");
        field.setAccessible(true);
        field.set(null, null);
    }

    @Test
    public void testGetSelfVerificationCode() throws Exception {
        Method method = IntegrityChecker.class.getDeclaredMethod("getSelfVerificationCode");
        method.setAccessible(true);
        String result = (String) method.invoke(null);
        assertEquals("PC2024SEC", result);
    }

    @Test
    public void testVerifyIntegrity_CachedTrue() throws Exception {
        // Force the cached value to true
        Field field = IntegrityChecker.class.getDeclaredField("integrityValid");
        field.setAccessible(true);
        field.set(null, true);

        // Should return true without evaluating the rest of the logic
        assertTrue(IntegrityChecker.verifyIntegrity());
    }

    @Test
    public void testVerifyIntegrity_CachedFalse() throws Exception {
        // Force the cached value to false
        Field field = IntegrityChecker.class.getDeclaredField("integrityValid");
        field.setAccessible(true);
        field.set(null, false);

        // Should return false without evaluating the rest of the logic
        assertFalse(IntegrityChecker.verifyIntegrity());
    }

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
}
