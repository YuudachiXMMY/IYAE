import { describe, it, expect } from "vitest";
import { getFabricNormalConfig } from "@/lib/fabric-textures";

describe("getFabricNormalConfig", () => {
  it("returns a weave config for the top slot", () => {
    const cfg = getFabricNormalConfig("top");
    expect(cfg.url).toContain("/textures/fabric/");
    expect(cfg.url).toContain("weave");
    expect(cfg.repeat).toBeGreaterThan(0);
    expect(cfg.normalScale).toBeGreaterThan(0);
  });

  it("returns a denim config for the bottom slot", () => {
    const cfg = getFabricNormalConfig("bottom");
    expect(cfg.url).toContain("denim");
  });

  it("maps dress to the same weave family as top", () => {
    expect(getFabricNormalConfig("dress").url).toBe(getFabricNormalConfig("top").url);
  });

  it("normalizes mixed-case slot strings", () => {
    expect(getFabricNormalConfig("TOP")).toEqual(getFabricNormalConfig("top"));
    expect(getFabricNormalConfig("Bottom")).toEqual(getFabricNormalConfig("bottom"));
  });

  it("falls back to a default config for an unknown slot", () => {
    const cfg = getFabricNormalConfig("hat");
    expect(cfg.url).toContain("/textures/fabric/");
    expect(cfg.repeat).toBeGreaterThan(0);
    expect(cfg.normalScale).toBeGreaterThan(0);
  });

  it("falls back to a default config for undefined/null", () => {
    expect(getFabricNormalConfig(undefined).url).toContain("/textures/fabric/");
    expect(getFabricNormalConfig(null).url).toContain("/textures/fabric/");
  });

  it("always returns a config with a valid shape", () => {
    for (const slot of ["top", "bottom", "dress", "shoes", "accessory", undefined]) {
      const cfg = getFabricNormalConfig(slot);
      expect(typeof cfg.url).toBe("string");
      expect(typeof cfg.repeat).toBe("number");
      expect(typeof cfg.normalScale).toBe("number");
    }
  });
});
