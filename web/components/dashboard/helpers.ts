// Derived profile helpers shared by the dashboard panels. Extracted verbatim
// from the former inline helpers in app/dashboard/page.tsx so Overview and
// My Profile compute completion / member-since / truncation identically.

/** Just the preference fields completion is derived from (decoupled from the
 * broader auth user type so both `User` and `UserResponse` shapes qualify). */
type StyleProfileInput = {
  styleAesthetics?: string[] | null;
  fitPreferences?: string[] | null;
  favoriteColors?: string[] | null;
  outfitGoals?: string[] | null;
  budgetRange?: string | null;
  avatarMode?: unknown;
};

/**
 * Style-profile completion from the buyer's real preference fields. Six equally
 * weighted signals — the same fields the registration wizard collects.
 */
export function getStyleProfileCompletion(user: StyleProfileInput): number {
  const checks = [
    (user.styleAesthetics?.length ?? 0) > 0,
    (user.fitPreferences?.length ?? 0) > 0,
    (user.favoriteColors?.length ?? 0) > 0,
    (user.outfitGoals?.length ?? 0) > 0,
    Boolean(user.budgetRange),
    Boolean(user.avatarMode),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

export function memberSince(createdAt?: string | null): string {
  if (!createdAt) return "today";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
