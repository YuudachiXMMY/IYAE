"use client";

import {
  type Mesh,
  MeshStandardMaterial,
  type Object3D,
  RepeatWrapping,
  type Texture,
  TextureLoader,
  Vector2,
} from "three";
import { getFabricNormalConfig } from "@/lib/fabric-textures";

/**
 * Apply anti-penetration settings to a garment mesh to prevent
 * z-fighting/clipping with the avatar body mesh underneath.
 *
 * Uses polygonOffset to push the garment slightly forward in the
 * depth buffer, making it always render "on top of" the body.
 */
function applyAntiPenetration(mesh: Mesh): void {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  for (const mat of materials) {
    if (mat && mat instanceof MeshStandardMaterial) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -4;
    }
  }
}

/**
 * Traverse a loaded GLTF scene and apply anti-penetration to all meshes.
 */
export function applyAntiPenetrationToScene(scene: Object3D): void {
  scene.traverse((child) => {
    if ((child as Mesh).isMesh) {
      applyAntiPenetration(child as Mesh);
    }
  });
}

/**
 * Maps garment slots to render layer priority levels.
 * Higher values render on top of lower values.
 */
export const LAYER_MAP: Record<string, number> = {
  shoes: 1,
  bottom: 1,
  top: 2,
  dress: 2,
  accessory: 3,
};

/**
 * Apply layered anti-penetration to a single mesh based on its slot.
 * Garments in higher-priority slots (e.g. accessory) receive stronger
 * polygon offsets so they render on top of lower-priority layers.
 */
export function applyLayeredAntiPenetration(mesh: Mesh, slot: string): void {
  const layer = LAYER_MAP[slot] ?? 1;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (mat && mat instanceof MeshStandardMaterial) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1 * layer;
      mat.polygonOffsetUnits = -4 * layer;
    }
  }
}

/**
 * Traverse a loaded GLTF scene and apply layered anti-penetration to all meshes.
 */
export function applyLayeredAntiPenetrationToScene(scene: Object3D, slot: string): void {
  scene.traverse((child) => {
    if ((child as Mesh).isMesh) {
      applyLayeredAntiPenetration(child as Mesh, slot);
    }
  });
}

/**
 * Apply a neutral matte-fabric fallback to a garment mesh.
 *
 * The glTF default material is metalness=1/roughness=1 (a grey-white plastic
 * shell). For any untextured MeshStandardMaterial (no baseColor `.map`) this
 * forces a fabric-like PBR response (metalness=0, roughness=0.85), killing the
 * plastic specular look. Textured garments (those carrying a `.map` from the
 * B1 rigging pipeline) are left untouched so their authored material survives.
 *
 * Always enables cast/receive shadow so the mesh participates in the viewer's
 * contact + directional shadows. Materials are mutated in place — never
 * replaced — so SkinnedMesh binding is preserved.
 */
export function fabricizeMaterial(mesh: Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (mat && mat instanceof MeshStandardMaterial && !mat.map) {
      mat.metalness = 0;
      mat.roughness = 0.85;
    }
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

/**
 * Traverse a loaded GLTF scene and apply the fabric fallback to all meshes.
 */
export function fabricizeScene(scene: Object3D): void {
  scene.traverse((child) => {
    if ((child as Mesh).isMesh) {
      fabricizeMaterial(child as Mesh);
    }
  });
}

/**
 * Module-level texture cache so each normal-map file loads once and is shared
 * across every mesh/render, rather than reloading per mesh. Keyed by URL + repeat
 * (RepeatWrapping/repeat live on the Texture, so a different tiling needs its own).
 */
const _normalMapCache = new Map<string, Texture>();
let _loader: TextureLoader | null = null;

function getNormalMap(url: string, repeat: number): Texture {
  const key = `${url}@${repeat}`;
  const cached = _normalMapCache.get(key);
  if (cached) return cached;
  if (!_loader) _loader = new TextureLoader();
  const texture = _loader.load(url);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  _normalMapCache.set(key, texture);
  return texture;
}

/**
 * Apply a slot-keyed tiled normal map to a garment mesh (drape-realism Phase 2 / C2).
 *
 * Fakes fabric weave/wrinkle relief with zero cloth simulation. For each
 * `MeshStandardMaterial` **without an existing `normalMap`** (so a Meshy-PBR normal
 * map from C1 is never overwritten), assigns a tiled tangent-space normal map keyed
 * off the garment slot and a subtle `normalScale`. Materials are mutated in place —
 * never replaced — so SkinnedMesh binding is preserved. The relief is only visible
 * on meshes that carry UVs (B1 garments + Meshy GLBs do); a UV-less mesh silently
 * shows no relief (no crash).
 */
export function applyGarmentNormalMap(mesh: Mesh, slot?: string | null): void {
  const config = getFabricNormalConfig(slot);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (mat && mat instanceof MeshStandardMaterial && !mat.normalMap) {
      mat.normalMap = getNormalMap(config.url, config.repeat);
      mat.normalScale = new Vector2(config.normalScale, config.normalScale);
      mat.needsUpdate = true;
    }
  }
}

/**
 * Traverse a loaded GLTF scene and apply the slot-keyed normal map to all meshes.
 */
export function applyGarmentNormalMapToScene(scene: Object3D, slot?: string | null): void {
  scene.traverse((child) => {
    if ((child as Mesh).isMesh) {
      applyGarmentNormalMap(child as Mesh, slot);
    }
  });
}
