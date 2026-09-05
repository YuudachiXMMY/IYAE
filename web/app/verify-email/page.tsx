"use client";

import { Suspense, useEffect, useState } from "react";
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
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setErrorMessage("Verification token is missing.");
      setStatus("error");
      return;
    }

    api
      .post("/api/auth/verify-email", { token })
      .then(async () => {
        setStatus("success");
        toast.success("Email verified successfully");
        await refreshUser();
        setTimeout(() => router.push("/dashboard"), 3000);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError
            ? err.message
            : "Verification failed. The link may have expired.";
        setErrorMessage(message);
        setStatus("error");
      });
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
