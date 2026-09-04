import { describe, it, expect } from "vitest";
import { MeshStandardMaterial } from "three";
import {
  LAYER_MAP,
  applyLayeredAntiPenetration,
  applyLayeredAntiPenetrationToScene,
} from "@/components/FittingHelper";

function createMockMesh(material?: MeshStandardMaterial | MeshStandardMaterial[]) {
  return {
    isMesh: true as const,
    material: material ?? new MeshStandardMaterial(),
  };
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
    applyLayeredAntiPenetration(mesh as any, "top");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-2);
    expect(mat.polygonOffsetUnits).toBe(-8);
  });

  it("applies factor=-1 and units=-4 for bottom slot (layer 1)", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    applyLayeredAntiPenetration(mesh as any, "bottom");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-1);
    expect(mat.polygonOffsetUnits).toBe(-4);
  });

  it("applies factor=-3 and units=-12 for accessory slot (layer 3)", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    applyLayeredAntiPenetration(mesh as any, "accessory");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-3);
    expect(mat.polygonOffsetUnits).toBe(-12);
  });

  it("uses default layer=1 for unknown slot", () => {
    const mat = new MeshStandardMaterial();
    const mesh = createMockMesh(mat);
    applyLayeredAntiPenetration(mesh as any, "unknown_slot");
    expect(mat.polygonOffset).toBe(true);
    expect(mat.polygonOffsetFactor).toBe(-1);
    expect(mat.polygonOffsetUnits).toBe(-4);
  });

  it("handles array of materials", () => {
    const mat1 = new MeshStandardMaterial();
    const mat2 = new MeshStandardMaterial();
    const mesh = createMockMesh([mat1, mat2]);
    applyLayeredAntiPenetration(mesh as any, "dress");
    expect(mat1.polygonOffsetFactor).toBe(-2);
    expect(mat2.polygonOffsetFactor).toBe(-2);
  });

  it("skips non-MeshStandardMaterial entries gracefully", () => {
    const mesh = { isMesh: true as const, material: null as any };
    expect(() => applyLayeredAntiPenetration(mesh as any, "top")).not.toThrow();
  });
});

describe("applyLayeredAntiPenetrationToScene", () => {
  it("applies layered offset to all mesh children", () => {
    const mat1 = new MeshStandardMaterial();
    const mat2 = new MeshStandardMaterial();
    const scene = {
      traverse: (cb: (child: any) => void) => {
        cb({ isMesh: true, material: mat1 });
        cb({ isMesh: true, material: mat2 });
        cb({ isMesh: false, material: new MeshStandardMaterial() }); // non-mesh, skipped
      },
    };
    applyLayeredAntiPenetrationToScene(scene as any, "shoes");
    expect(mat1.polygonOffset).toBe(true);
    expect(mat1.polygonOffsetFactor).toBe(-1);
    expect(mat2.polygonOffset).toBe(true);
    expect(mat2.polygonOffsetFactor).toBe(-1);
  });

  it("uses correct layer for top slot across entire scene", () => {
    const mat = new MeshStandardMaterial();
    const scene = {
      traverse: (cb: (child: any) => void) => {
        cb({ isMesh: true, material: mat });
      },
    };
    applyLayeredAntiPenetrationToScene(scene as any, "top");
    expect(mat.polygonOffsetFactor).toBe(-2);
    expect(mat.polygonOffsetUnits).toBe(-8);
  });
});
