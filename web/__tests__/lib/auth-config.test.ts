import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  requireEmailVerification,
  isVerificationPending,
  resolvePostRegisterRedirect,
} from "@/lib/auth-config";
import { __resetPublicConfigCache } from "@/lib/public-config";
import { publicConfig } from "@/lib/api";

// The flag is now read from the server at runtime rather than inlined from NEXT_PUBLIC_* at
// build time. The build-time version was unreachable in the production image (no build arg),
// so it could never be true and every new signup was bounced to an unusable dashboard.
vi.mock("@/lib/api", () => ({
  publicConfig: { get: vi.fn() },
}));

const mockGet = vi.mocked(publicConfig.get);

describe("auth-config", () => {
  beforeEach(() => {
    __resetPublicConfigCache();
    mockGet.mockReset();
  });

  describe("requireEmailVerification", () => {
    it("is true when the server requires verification", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: true });
      await expect(requireEmailVerification()).resolves.toBe(true);
    });

    it("is false when the server has the gate off", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: false });
      await expect(requireEmailVerification()).resolves.toBe(false);
    });

    it("fails closed when the config cannot be read", async () => {
      // Parking the user on "check your inbox" is recoverable; authenticating them
      // optimistically lands them on a dashboard where every call fails with no explanation.
      mockGet.mockRejectedValue(new Error("network"));
      await expect(requireEmailVerification()).resolves.toBe(true);
    });
  });

  describe("isVerificationPending", () => {
    it("is true for an unverified user when the gate is on", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: true });
      await expect(isVerificationPending({ emailVerified: false })).resolves.toBe(true);
    });

    it("is false for a verified user", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: true });
      await expect(isVerificationPending({ emailVerified: true })).resolves.toBe(false);
    });

    it("short-circuits for a verified user without reading the config at all", async () => {
      await expect(isVerificationPending({ emailVerified: true })).resolves.toBe(false);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("is false for an unverified user when the gate is off", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: false });
      await expect(isVerificationPending({ emailVerified: false })).resolves.toBe(false);
    });
  });

  describe("resolvePostRegisterRedirect", () => {
    it("routes to the dashboard when verification is not required", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: false });
      await expect(
        resolvePostRegisterRedirect({ emailVerified: false, email: "a@b.com" }),
      ).resolves.toBe("/dashboard");
    });

    it("routes to the pending page with the email encoded", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: true });
      await expect(
        resolvePostRegisterRedirect({ emailVerified: false, email: "a+x@b.com" }),
      ).resolves.toBe("/verify-email/pending?email=a%2Bx%40b.com");
    });

    it("routes a verified user to the dashboard even with the gate on", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: true });
      await expect(
        resolvePostRegisterRedirect({ emailVerified: true, email: "a@b.com" }),
      ).resolves.toBe("/dashboard");
    });

    it("sends the user to the pending page when the config read fails", async () => {
      mockGet.mockRejectedValue(new Error("network"));
      await expect(
        resolvePostRegisterRedirect({ emailVerified: false, email: "a@b.com" }),
      ).resolves.toBe("/verify-email/pending?email=a%40b.com");
    });
  });

  describe("caching", () => {
    it("reads the config once across many calls", async () => {
      mockGet.mockResolvedValue({ checkoutEnabled: false, requireEmailVerification: true });

      await requireEmailVerification();
      await isVerificationPending({ emailVerified: false });
      await resolvePostRegisterRedirect({ emailVerified: false, email: "a@b.com" });

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("does not cache a failure, so the next call retries", async () => {
      mockGet.mockRejectedValueOnce(new Error("network"));
      await expect(requireEmailVerification()).resolves.toBe(true);

      mockGet.mockResolvedValueOnce({ checkoutEnabled: false, requireEmailVerification: false });
      await expect(requireEmailVerification()).resolves.toBe(false);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
