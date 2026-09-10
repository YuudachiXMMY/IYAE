/**
 * Slot-keyed fabric normal-map configuration (drape-realism Phase 2 / C2).
 *
 * "Fakes" fabric weave/wrinkle relief with zero cloth simulation by applying a
 * tiled tangent-space normal map to garment materials on the frontend. Only the
 * garment slot (top/bottom/dress/…) is available on the client — there is no
 * fabric/material field on Product or GarmentAsset — so the map is keyed off slot.
 *
 * Pure data + lookup (no three.js imports) so it unit-tests without WebGL/jsdom.
 * Normal-map assets live under `web/public/textures/fabric/` and are referenced
 * as `/textures/fabric/...`.
 */

export interface FabricNormalConfig {
  /** Public URL of a tileable, tangent-space normal map. */
  url: string;
  /** RepeatWrapping tiling factor applied on both axes. */
  repeat: number;
  /** Normal-map intensity (Vector2 x=y). Kept subtle to avoid over-embossing prints. */
  normalScale: number;
}

const WEAVE = "/textures/fabric/weave-normal.png";
const DENIM = "/textures/fabric/denim-normal.png";

/**
 * Default config for unknown/absent slots — a subtle generic plain-weave so every
 * garment gets *some* relief rather than a dead-smooth surface.
 */
const DEFAULT_CONFIG: FabricNormalConfig = {
  url: WEAVE,
  repeat: 8,
  normalScale: 0.4,
};

/** Slot → fabric normal-map config. Keys are lowercase frontend slot names. */
const SLOT_CONFIG: Record<string, FabricNormalConfig> = {
  top: { url: WEAVE, repeat: 8, normalScale: 0.6 },
  dress: { url: WEAVE, repeat: 8, normalScale: 0.6 },
  bottom: { url: DENIM, repeat: 6, normalScale: 0.8 },
};

/**
 * Resolve the fabric normal-map config for a garment slot.
 *
 * Slot strings arriving from `riggedGarmentSlots` may be mixed-case or undefined;
 * they are normalized to lowercase and fall back to a neutral weave. Always returns
 * a config (never null) so every garment receives some fabric relief.
 */
export function getFabricNormalConfig(slot?: string | null): FabricNormalConfig {
  if (!slot) return DEFAULT_CONFIG;
  return SLOT_CONFIG[slot.toLowerCase()] ?? DEFAULT_CONFIG;
}
