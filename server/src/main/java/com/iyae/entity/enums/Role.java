package com.iyae.entity.enums;

import java.util.Arrays;

public enum Role {
    BUYER, DESIGNER, ADMIN;

    /**
     * Whether this role may write to the catalogue surface: the designer product CRUD and image
     * upload under {@code /api/designer/**}, and the promotion slots under {@code /api/promotions/**}.
     *
     * <p>B-11. ADMIN is included because the operator has to be able to put content in the shop.
     * Before this, the catalogue write surface was reserved to DESIGNER and the admin surface had
     * no create endpoints at all, so a fresh production instance — whose only administrator comes
     * from {@link com.iyae.config.AdminBootstrap} with role ADMIN — could not create a product, a
     * promotion or anything else. Launch hour one was a dead storefront with no way out except
     * self-registering a second account under a different email.
     *
     * <p>This predicate is the single source of truth for that rule. {@code SecurityConfig}'s
     * matcher reads it through {@link #catalogManagerRoleNames()} and
     * {@link com.iyae.controller.DesignerUploadController} reads it directly, because those two
     * layers previously each carried their own literal and the controller's was the narrower —
     * which made it dead code (the matcher rejected BUYER first) right up until the matcher
     * widened, at which point it would have become the one thing quietly rejecting ADMIN.
     *
     * <p>Note that permitting the role is not the same as granting access to a specific row:
     * ownership is still resolved per request from the principal's own {@code DesignerProfile}
     * (see {@code ProductService.resolveDesignerProfile} and
     * {@code PromotionService.resolveOwnedProduct}), so an ADMIN can only edit its own listings
     * here. Acting on another designer's content stays on {@code /api/admin/**}.
     */
    public boolean canManageCatalog() {
        return this == DESIGNER || this == ADMIN;
    }

    /**
     * The names of every role for which {@link #canManageCatalog()} holds, for Spring Security's
     * {@code hasAnyRole(String...)}.
     *
     * <p>Derived from the predicate rather than written out again, so the matcher cannot fall out
     * of step with the check. Names are unprefixed: {@code hasAnyRole} prepends {@code ROLE_}
     * itself, and handing it an already-prefixed name yields {@code ROLE_ROLE_DESIGNER}, which
     * denies everyone.
     */
    public static String[] catalogManagerRoleNames() {
        return Arrays.stream(values())
                .filter(Role::canManageCatalog)
                .map(Role::name)
                .toArray(String[]::new);
    }
}
