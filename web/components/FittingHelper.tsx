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
