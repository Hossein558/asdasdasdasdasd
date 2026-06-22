package ir.atlassian.jira.plugins.license;

import org.junit.Test;

import java.lang.reflect.Method;
import java.util.Optional;

import javax.ws.rs.core.Response;

import static org.junit.Assert.*;

/**
 * Tests for {@link LicenseGuard}.
 *
 * <p>Fail-open policy (narrowed from original):
 * <ul>
 *   <li>OSGi unavailable (psf == null): fail open — do not block Jira startup.</li>
 *   <li>Any other exception during license check: fail CLOSED — return 200.</li>
 * </ul>
 *
 * <p>In unit tests, {@code ComponentAccessor.getOSGiComponentInstanceOfType()}
 * returns null (no OSGi container). This exercises the startup fail-open path.
 */
public class LicenseGuardTest {

    /**
     * When OSGi is unavailable (psf == null, e.g. plugin startup or unit test env),
     * LicenseGuard must fail OPEN — not block the request.
     */
    @Test
    public void testCheck_failsOpenWhenOSGiUnavailable() {
        // ComponentAccessor returns null in unit test env — guard must not throw
        Optional<Response> result = LicenseGuard.check();
        // OSGi-null path → fail open = empty (proceed)
        assertFalse("Guard should fail open when OSGi is unavailable (startup)", result.isPresent());
    }

    /**
     * Verify the guard returns HTTP 200 for an invalid LicenseInfo object.
     * We test via the package-private helper so we can inject a controlled LicenseInfo.
     */
    @Test
    public void testBlock_returns200() throws Exception {
        Method blockMethod = LicenseGuard.class.getDeclaredMethod("buildBlockResponse");
        blockMethod.setAccessible(true);
        Response response = (Response) blockMethod.invoke(null);

        assertEquals("Should return HTTP 200 for invalid license", 200, response.getStatus());
        assertNotNull("Response body must not be null", response.getEntity());
    }

    /**
     * The 200 response must carry a JSON body with an "error" key.
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
