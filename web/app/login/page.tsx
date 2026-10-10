"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/hooks/useRedirectIfAuthenticated";
import { BRAND } from "@/lib/brand";
import { DarkPanel } from "@/components/design-system/DarkPanel";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { SectionKicker } from "@/components/design-system/SectionKicker";
import { UnderlineField } from "@/components/design-system/UnderlineField";
import { AbstractForm } from "@/components/design-system/AbstractForm";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"email" | "password" | "both" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useRedirectIfAuthenticated();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorField(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setErrorField("email");
      return;
    }
    if (!password) {
      setError("Password is required.");
      setErrorField("password");
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
      // Invalid credentials are ambiguous about which field is wrong — flag both.
      setErrorField("both");
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left editorial panel (desktop only) */}
      <DarkPanel className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-center xl:p-20">
        <AbstractForm
          tint={48}
          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 motion-safe:animate-[editorial-float_12s_ease-in-out_infinite]"
        />
        <AbstractForm
          tint={70}
          rounded="rounded-[80px]"
          className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 motion-safe:animate-[editorial-drift_16s_ease-in-out_infinite]"
        />
        <div className="relative z-10 max-w-md">
          <EditorialHeading as="h1" className="text-background">
            Come back to your form.
          </EditorialHeading>
          <p className="mt-6 font-body text-[15px] leading-relaxed text-background/70">
            Your wardrobe, recommendations and saved edits are waiting.
          </p>
        </div>
      </DarkPanel>

      {/* Right form column */}
      <div className="flex items-center justify-center bg-background px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          <SectionKicker>SIGN IN</SectionKicker>
          <EditorialHeading as="h1" className="mt-3">
            Welcome back.
          </EditorialHeading>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-card bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <UnderlineField
              label="Email address"
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={errorField === "email" || errorField === "both"}
              aria-describedby={
                errorField === "email" || errorField === "both"
                  ? "login-error"
                  : undefined
              }
            />

            <div>
              <UnderlineField
                label="Password"
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                aria-invalid={errorField === "password" || errorField === "both"}
                aria-describedby={
                  errorField === "password" || errorField === "both"
                    ? "login-error"
                    : undefined
                }
              />
              <div className="mt-2 text-right">
                <Link
                  href="/forgot-password"
                  className="text-[12px] text-brand hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="brand-pill"
              size="pill"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "SIGNING IN…" : "SIGN IN"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="font-body text-[11px] uppercase tracking-[0.12px] text-muted-foreground">
              or continue with
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* No OAuth provider is configured server-side yet, so these stay
              disabled and say so — previously they were clickable and silently
              did nothing. */}
          <div className="flex gap-3">
            <Button
              variant="outline-pill"
              size="pill"
              className="flex-1"
              disabled
              aria-describedby="social-login-note"
            >
              GOOGLE
            </Button>
            <Button
              variant="outline-pill"
              size="pill"
              className="flex-1"
              disabled
              aria-describedby="social-login-note"
            >
              APPLE
            </Button>
          </div>
          <p
            id="social-login-note"
            className="mt-3 text-center font-body text-[12px] text-muted-foreground"
          >
            Social sign-in is coming soon — use your email for now.
          </p>

          <p className="mt-8 text-center font-body text-[13px] text-muted-foreground">
            New to {BRAND.name}?{" "}
            <Link href="/register" className="text-brand hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
