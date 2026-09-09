import { describe, it, expect, afterEach, vi } from "vitest";
import {
  requireEmailVerification,
  isVerificationPending,
  resolvePostRegisterRedirect,
} from "@/lib/auth-config";

// vi.stubEnv writes process.env, which requireEmailVerification() reads at call
// time — so stubbing per-test works even though NEXT_PUBLIC_* is build-inlined in
// a real Next.js bundle.
afterEach(() => vi.unstubAllEnvs());

describe("auth-config", () => {
  describe("requireEmailVerification", () => {
    it('is true only for the exact string "true"', () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "true");
      expect(requireEmailVerification()).toBe(true);
    });

    it("is false when unset", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "");
      expect(requireEmailVerification()).toBe(false);
    });

    it('is false for other truthy-looking values ("1")', () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "1");
      expect(requireEmailVerification()).toBe(false);
    });
  });

  describe("isVerificationPending", () => {
    it("is true when gate on and email unverified", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "true");
      expect(isVerificationPending({ emailVerified: false })).toBe(true);
    });

    it("is false when gate on but email verified", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "true");
      expect(isVerificationPending({ emailVerified: false })).toBe(true);
      expect(isVerificationPending({ emailVerified: true })).toBe(false);
    });

    it("is false when gate off regardless of verification", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "false");
      expect(isVerificationPending({ emailVerified: false })).toBe(false);
    });
  });

  describe("resolvePostRegisterRedirect", () => {
    it("gate off → dashboard even if unverified", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "false");
      expect(
        resolvePostRegisterRedirect({ emailVerified: false, email: "a@b.com" }),
      ).toBe("/dashboard");
    });

    it("gate on + unverified → pending with URL-encoded email", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "true");
      expect(
        resolvePostRegisterRedirect({ emailVerified: false, email: "a+x@b.com" }),
      ).toBe("/verify-email/pending?email=a%2Bx%40b.com");
    });

    it("gate on + verified → dashboard", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "true");
      expect(
        resolvePostRegisterRedirect({ emailVerified: true, email: "a@b.com" }),
      ).toBe("/dashboard");
    });
  });
});
