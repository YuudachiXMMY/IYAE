import { describe, it, expect } from "vitest";
import { MeshStandardMaterial, type Mesh, type Object3D } from "three";
import {
  LAYER_MAP,
  applyLayeredAntiPenetration,
  applyLayeredAntiPenetrationToScene,
  fabricizeMaterial,
  fabricizeScene,
} from "@/components/FittingHelper";

function createMockMesh(
  material?: MeshStandardMaterial | MeshStandardMaterial[]
): Mesh {
  return {
    isMesh: true as const,
    material: material ?? new MeshStandardMaterial(),
  } as unknown as Mesh;
}

describe("LAYER_MAP", () => {
  it("maps shoes to layer 1", () => {
    expect(LAYER_MAP.shoes).toBe(1);
  });

  it("maps bottom to layer 1", () => {
    expect(LAYER_MAP.bottom).toBe(1);
  });

  it("maps top to layer 2", () => {
    expect(LAYER_MAP.top).toBe(2);
  });

  it("maps dress to layer 2", () => {
    expect(LAYER_MAP.dress).toBe(2);
  });

  it("maps accessory to layer 3", () => {
    expect(LAYER_MAP.accessory).toBe(3);
  });
});

describe("applyLayeredAntiPenetration", () => {
  it("applies factor=-2 and units=-8 for top slot (layer 2)", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    applyLayeredAntiPenetration(mesh, "top");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-2);
    expect(mat.polygonOffsetUnits).toBe(-8);
  });

  it("applies factor=-1 and units=-4 for bottom slot (layer 1)", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    applyLayeredAntiPenetration(mesh, "bottom");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-1);
    expect(mat.polygonOffsetUnits).toBe(-4);
  });

  it("applies factor=-3 and units=-12 for accessory slot (layer 3)", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    applyLayeredAntiPenetration(mesh, "accessory");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-3);
    expect(mat.polygonOffsetUnits).toBe(-12);
  });

  it("uses default layer=1 for unknown slot", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    applyLayeredAntiPenetration(mesh, "unknown_slot");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-1);
    expect(mat.polygonOffsetUnits).toBe(-4);
  });

  it("handles array of materials", () => {
    const mat1 = new MeshStandardMaterial();
    const mat2 = new MeshStandardMaterial();
    const mesh = createMockMesh([mat1, mat2]);
    applyLayeredAntiPenetration(mesh, "dress");
    expect(mat1.polygonOffsetFactor).toBe(-2);
    expect(mat2.polygonOffsetFactor).toBe(-2);
  });

  it("skips non-MeshStandardMaterial entries gracefully", () => {
    const mesh = { isMesh: true as const, material: null } as unknown as Mesh;
    expect(() => applyLayeredAntiPenetration(mesh, "top")).not.toThrow();
  });
});

describe("applyLayeredAntiPenetrationToScene", () => {
  it("applies layered offset to all mesh children", () => {
    const mat1 = new MeshStandardMaterial();
    const mat2 = new MeshStandardMaterial();
    const scene = {
      traverse: (cb: (child: Mesh) => void) => {
        cb({ isMesh: true, material: mat1 } as unknown as Mesh);
        cb({ isMesh: true, material: mat2 } as unknown as Mesh);
        cb({ isMesh: false, material: new MeshStandardMaterial() } as unknown as Mesh); // non-mesh, skipped
      },
    } as unknown as Object3D;
    applyLayeredAntiPenetrationToScene(scene, "shoes");
    expect(mat1.polygonOffset).toBe(true);
    expect(mat1.polygonOffsetFactor).toBe(-1);
    expect(mat2.polygonOffset).toBe(true);
    expect(mat2.polygonOffsetFactor).toBe(-1);
  });

  it("uses correct layer for top slot across entire scene", () => {
    const mat = new MeshStandardMaterial();
    const scene = {
      traverse: (cb: (child: Mesh) => void) => {
        cb({ isMesh: true, material: mat } as unknown as Mesh);
      },
    } as unknown as Object3D;
    applyLayeredAntiPenetrationToScene(scene, "top");
    expect(mat.polygonOffsetFactor).toBe(-2);
    expect(mat.polygonOffsetUnits).toBe(-8);
  });
});

describe("fabricizeMaterial", () => {
  it("forces metalness=0 and roughness=0.85 on an untextured MeshStandardMaterial", () => {
    const mat = new MeshStandardMaterial({ metalness: 1, roughness: 0.2 });
    expect(mat.map).toBeNull();
    const mesh = createMockMesh(mat);
    fabricizeMaterial(mesh);
    expect(mat.metalness).toBe(0);
    expect(mat.roughness).toBe(0.85);
  });

  it("enables castShadow and receiveShadow on the mesh", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    fabricizeMaterial(mesh);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it("leaves metalness unchanged when the material has a texture map", () => {
    const mat = new MeshStandardMaterial({ metalness: 1, roughness: 0.2 });
    // Truthy stub standing in for a loaded baseColor texture (B1 pipeline).
    mat.map = { isTexture: true } as unknown as MeshStandardMaterial["map"];
    const mesh = createMockMesh(mat);
    fabricizeMaterial(mesh);
    expect(mat.metalness).toBe(1);
    expect(mat.roughness).toBe(0.2);
    // castShadow is still applied regardless of texture presence.
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it("handles an array of materials", () => {
    const mat1 = new MeshStandardMaterial({ metalness: 1 });
    const mat2 = new MeshStandardMaterial({ metalness: 1 });
    const mesh = createMockMesh([mat1, mat2]);
    fabricizeMaterial(mesh);
    expect(mat1.metalness).toBe(0);
    expect(mat2.metalness).toBe(0);
  });

  it("does not throw on a non-MeshStandardMaterial entry", () => {
    const mesh = { isMesh: true as const, material: null } as unknown as Mesh;
    expect(() => fabricizeMaterial(mesh)).not.toThrow();
    expect(mesh.castShadow).toBe(true);
  });
});

describe("fabricizeScene", () => {
  it("fabricizes all mesh children in the scene", () => {
    const mat1 = new MeshStandardMaterial({ metalness: 1 });
    const mat2 = new MeshStandardMaterial({ metalness: 1 });
    const mesh1 = { isMesh: true, material: mat1, castShadow: false, receiveShadow: false };
    const mesh2 = { isMesh: true, material: mat2, castShadow: false, receiveShadow: false };
    const nonMesh = { isMesh: false, material: new MeshStandardMaterial({ metalness: 1 }) };
    const scene = {
      traverse: (cb: (child: Mesh) => void) => {
        cb(mesh1 as unknown as Mesh);
        cb(mesh2 as unknown as Mesh);
        cb(nonMesh as unknown as Mesh); // skipped
      },
    } as unknown as Object3D;
    fabricizeScene(scene);
    expect(mat1.metalness).toBe(0);
    expect(mat2.metalness).toBe(0);
    expect(mesh1.castShadow).toBe(true);
    expect(mesh2.receiveShadow).toBe(true);
  });
});
