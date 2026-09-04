import { describe, it, expect } from "vitest";
import {
  POSE_PRESETS,
  POSE_CATEGORIES,
  getPoseById,
  type PoseDef,
} from "@/lib/pose-config";

describe("pose-config", () => {
  describe("POSE_PRESETS", () => {
    it("contains 6 presets", () => {
      expect(POSE_PRESETS).toHaveLength(6);
    });

    it("each preset has required fields", () => {
      for (const pose of POSE_PRESETS) {
        expect(pose.id).toBeTruthy();
        expect(pose.label).toBeTruthy();
        expect(pose.labelZh).toBeTruthy();
        expect(pose.category).toBeTruthy();
        expect(pose.url).toBeTruthy();
      }
    });

    it("all URLs start with /models/poses/", () => {
      for (const pose of POSE_PRESETS) {
        expect(pose.url).toMatch(/^\/models\/poses\/.+\.glb$/);
      }
    });

    it("has exactly one default preset", () => {
      const defaults = POSE_PRESETS.filter((p) => p.isDefault === true);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe("a-pose");
    });

    it("has unique IDs", () => {
      const ids = POSE_PRESETS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("POSE_CATEGORIES", () => {
    it("contains 3 categories", () => {
      expect(POSE_CATEGORIES).toHaveLength(3);
    });

    it("covers all preset categories", () => {
      const categoryIds = new Set(POSE_CATEGORIES.map((c) => c.id));
      for (const pose of POSE_PRESETS) {
        expect(categoryIds.has(pose.category)).toBe(true);
      }
    });
  });

  describe("getPoseById", () => {
    it("returns correct preset for known ID", () => {
      const walking = getPoseById("walking");
      expect(walking).toBeDefined();
      expect(walking!.label).toBe("Walking");
      expect(walking!.url).toBe("/models/poses/walking.glb");
    });

    it("returns undefined for unknown ID", () => {
      expect(getPoseById("unknown")).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(getPoseById("")).toBeUndefined();
    });
  });

  describe("PoseDef extended fields", () => {
    it("static presets have no duration or loop", () => {
      const staticPoses = POSE_PRESETS.filter((p) => p.id !== "breathing-idle");
      for (const pose of staticPoses) {
        expect(pose.duration).toBeUndefined();
        expect(pose.loop).toBeUndefined();
      }
    });

    it("breathing-idle has duration and loop", () => {
      const breathing = getPoseById("breathing-idle");
      expect(breathing).toBeDefined();
      expect(breathing!.duration).toBe(0.13);
      expect(breathing!.loop).toBe(true);
    });

    it("PoseDef type accepts duration and loop fields", () => {
      const animated: PoseDef = {
        id: "test-anim",
        label: "Test",
        labelZh: "测试",
        category: "movement",
        url: "/models/poses/test.glb",
        duration: 2.0,
        loop: true,
      };
      expect(animated.duration).toBe(2.0);
      expect(animated.loop).toBe(true);
    });

    it("PoseDef type works without duration and loop (backward compat)", () => {
      const static_pose: PoseDef = {
        id: "test-static",
        label: "Test",
        labelZh: "测试",
        category: "stationary",
        url: "/models/poses/test.glb",
      };
      expect(static_pose.duration).toBeUndefined();
      expect(static_pose.loop).toBeUndefined();
    });
  });
});
