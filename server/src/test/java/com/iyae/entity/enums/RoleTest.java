package com.iyae.entity.enums;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * B-11. Pins the catalogue-write role set that {@code SecurityConfig} and
 * {@link com.iyae.controller.DesignerUploadController} both read.
 *
 * <p>The point of these cases is the second one: the matcher in SecurityConfig and the in-controller
 * check used to each carry their own literal, and the controller's was strictly narrower. That made
 * it dead code while the matcher was the stricter of the two, and would have made it the thing
 * silently rejecting ADMIN the moment the matcher widened. Both now derive from
 * {@link Role#canManageCatalog()}, so a future role change cannot move one without the other.
 */
class RoleTest {

    @Test
    void canManageCatalog_isTrueForDesignerAndAdminOnly() {
        assertThat(Role.DESIGNER.canManageCatalog()).isTrue();
        assertThat(Role.ADMIN.canManageCatalog()).isTrue();
        assertThat(Role.BUYER.canManageCatalog()).isFalse();
    }

    @Test
    void catalogManagerRoleNames_isDerivedFromCanManageCatalog() {
        List<String> expected = Arrays.stream(Role.values())
                .filter(Role::canManageCatalog)
                .map(Role::name)
                .toList();

        assertThat(Role.catalogManagerRoleNames()).containsExactlyElementsOf(expected);
    }

    @Test
    void catalogManagerRoleNames_namesArePlainRoleNamesWithoutTheRolePrefix() {
        // Spring's hasAnyRole() prepends ROLE_ itself; handing it an already-prefixed name
        // would produce ROLE_ROLE_DESIGNER and deny everyone.
        assertThat(Role.catalogManagerRoleNames()).allSatisfy(name ->
                assertThat(name).doesNotStartWith("ROLE_"));
    }

    @Test
    void catalogManagerRoleNames_excludesBuyer() {
        assertThat(Role.catalogManagerRoleNames()).doesNotContain(Role.BUYER.name());
    }
}
