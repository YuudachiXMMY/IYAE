"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Status = "loading" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const token = searchParams.get("token");
  // A missing token is already decided before the first paint, so it belongs in
  // the initial state rather than in a correction from the effect below.
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "Verification token is missing.",
  );

  // The verification POST, kept across effect invocations.
  //
  // The token is single-use — the server clears it on the first success — so
  // firing the request twice means the second one comes back "Invalid
  // verification token" for an account that was in fact just verified, and it
  // is the surviving effect instance whose request loses that race. StrictMode
  // replays this effect in dev, which is exactly that scenario, so a replay has
  // to attach new handlers to the same in-flight POST rather than send another.
  const verification = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (!token) return;

    // The redirect is a 3s timer, so it can easily outlive the page that
    // scheduled it: a user who verifies and then clicks through to somewhere
    // else inside that window would be yanked to /dashboard out of nowhere.
    // Both the timer and the work leading up to it are tied to this effect.
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    let left = false;

    verification.current ??= api.post("/api/auth/verify-email", { token });

    verification.current
      .then(async () => {
        if (left) return;
        setStatus("success");
        toast.success("Email verified successfully");
        await refreshUser();
        // Re-checked after the await: `refreshUser` is a network round trip, so
        // the page can be gone by the time it resolves.
        if (left) return;
        redirectTimer = setTimeout(() => router.push("/dashboard"), 3000);
      })
      .catch((err: unknown) => {
        if (left) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Verification failed. The link may have expired.";
        setErrorMessage(message);
        setStatus("error");
      });

    return () => {
      left = true;
      clearTimeout(redirectTimer);
    };
    // Run once on mount — token from URL is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-soft rounded-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-3xl text-foreground">
            Email Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-brand" />
              <p className="text-muted-foreground">Verifying your email…</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-success" />
              <p className="text-center font-semibold text-foreground">
                Email verified!
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Redirecting you to your dashboard in a moment…
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center font-semibold text-foreground">
                Verification failed
              </p>
              <p className="text-center text-sm text-muted-foreground">
                {errorMessage}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
