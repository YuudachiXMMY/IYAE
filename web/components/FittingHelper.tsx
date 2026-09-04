"use client";

import { type Mesh, MeshStandardMaterial, type Object3D } from "three";

/**
 * Apply anti-penetration settings to a garment mesh to prevent
 * z-fighting/clipping with the avatar body mesh underneath.
 *
 * Uses polygonOffset to push the garment slightly forward in the
 * depth buffer, making it always render "on top of" the body.
 */
export function applyAntiPenetration(mesh: Mesh): void {
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
