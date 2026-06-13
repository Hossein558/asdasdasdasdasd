package com.atlassian.plugins.rest.api.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Dummy annotation for Jira 10+ REST API compatibility.
 * <p>
 * This ensures the plugin compiles without needing the atlassian-rest-v2-api dependency.
 * At runtime, the OSGi container and REST scanner will match the annotation by fully-qualified name.
 * Since the package is marked resolution:=optional in the manifest, no bundle resolution error will occur.
 * </p>
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface AnonymousAllowed {
}
