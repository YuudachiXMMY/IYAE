/**
 * Role vocabulary and the one capability predicate the catalogue surfaces branch on.
 *
 * B-11. Before this, "may manage the catalogue" was written out as `role === "DESIGNER"` in seven
 * places — four `useRequireAuth("DESIGNER")` calls, two hand-rolled checks on
 * `app/designer/products`, and two nav components — and they had already drifted:
 * `app/dashboard/page.tsx` rendered a "Designer Studio" link for `DESIGNER || ADMIN` while the
 * page it linked to bounced ADMIN straight back, so the operator had a dead link in their own
 * sidebar. The server mirrors this with `Role.canManageCatalog()`.
 */

export type Role = "BUYER" | "DESIGNER" | "ADMIN";

/**
 * Roles permitted on the catalogue write surface: the designer studio, product CRUD and the
 * promotion slots. ADMIN is included because the operator has to be able to put content in the
 * shop — a fresh production instance has exactly one account, created by `AdminBootstrap` with
 * role ADMIN, and nothing else can author a listing.
 *
 * Mirrors the server's `Role.catalogManagerRoleNames()`. Permission to reach the surface is not
 * permission over a given row: ownership is still resolved server-side from the caller's own
 * designer profile.
 */
export const CATALOG_MANAGER_ROLES = ["DESIGNER", "ADMIN"] as const satisfies readonly Role[];

/** Whether `role` may reach the catalogue write surface. Tolerates null/undefined (loading, signed out). */
export function canManageCatalog(role: Role | null | undefined): boolean {
  return role != null && (CATALOG_MANAGER_ROLES as readonly Role[]).includes(role);
}
