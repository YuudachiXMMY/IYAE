// Dashboard section model — shared by the desktop rail, the mobile pill strip,
// and the URL (`?section=`) so the active tab never drifts across surfaces.

export type DashboardSection =
  | "overview"
  | "profile"
  | "saved"
  | "orders"
  | "measurements";

export const DASHBOARD_SECTIONS: ReadonlyArray<{
  id: DashboardSection;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "My Profile" },
  { id: "saved", label: "Saved Pieces" },
  { id: "orders", label: "Orders" },
  { id: "measurements", label: "Measurements" },
];

/** Narrow an untrusted string (e.g. a URL query value) to a known section. */
export function isDashboardSection(
  value: string | null | undefined
): value is DashboardSection {
  return DASHBOARD_SECTIONS.some((s) => s.id === value);
}
