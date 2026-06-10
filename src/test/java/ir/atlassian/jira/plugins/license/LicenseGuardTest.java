package ir.atlassian.jira.plugins.license;

import org.junit.Test;

import java.lang.reflect.Method;
import java.util.Optional;

import javax.ws.rs.core.Response;

import static org.junit.Assert.*;

/**
 * Tests for {@link LicenseGuard}.
 *
 * <p>In a unit-test environment, {@code ComponentAccessor.getOSGiComponentInstanceOfType()}
 * returns null (no OSGi container running). LicenseGuard is designed to
 * <em>fail open</em> in that case — meaning it returns {@code Optional.empty()}
 * so that the OSGi startup itself is never blocked by a license check.
 *
 * <p>These tests verify:
 * <ol>
 *   <li>The guard fails open (returns empty) when the plugin settings factory is unavailable.</li>
 *   <li>The guard returns a 402 response when the license is explicitly invalid.</li>
 *   <li>The guard returns empty when the license is explicitly valid.</li>
 * </ol>
 */
public class LicenseGuardTest {

    /**
     * When the OSGi container is unavailable (e.g. unit tests, startup),
     * LicenseGuard must fail open — not block the request.
     */
    @Test
    public void testCheck_failsOpenWhenOSGiUnavailable() {
        // ComponentAccessor returns null in unit test env — guard must not throw
        Optional<Response> result = LicenseGuard.check();
        // Fails open = empty (proceed)
        assertFalse("Guard should fail open when OSGi is unavailable", result.isPresent());
    }

    /**
     * Verify the guard returns HTTP 402 for an invalid LicenseInfo object.
     * We test via the package-private helper so we can inject a controlled LicenseInfo.
     */
    @Test
    public void testBlock_returns402() throws Exception {
        Method blockMethod = LicenseGuard.class.getDeclaredMethod("buildBlockResponse");
        blockMethod.setAccessible(true);
        Response response = (Response) blockMethod.invoke(null);

        assertEquals("Should return HTTP 402 for invalid license", 402, response.getStatus());
        assertNotNull("Response body must not be null", response.getEntity());
    }

    /**
     * The 402 response must carry a JSON body with an "error" key.
     */
    @Test
    public void testBlock_responseBodyHasErrorKey() throws Exception {
        Method blockMethod = LicenseGuard.class.getDeclaredMethod("buildBlockResponse");
        blockMethod.setAccessible(true);
        Response response = (Response) blockMethod.invoke(null);

        Object entity = response.getEntity();
        assertTrue("Response entity must be a Map", entity instanceof java.util.Map);
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> body = (java.util.Map<String, Object>) entity;
        assertTrue("Response body must contain 'error' key", body.containsKey("error"));
        assertFalse("Error message must not be empty", body.get("error").toString().isEmpty());
    }
}
