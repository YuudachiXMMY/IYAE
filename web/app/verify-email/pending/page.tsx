"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MailCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth, ApiError } from "@/lib/api";

/**
 * "Check your inbox" landing shown after registration when email verification is
 * required (prod). This page is intentionally auth-free — no token is stored for an
 * unverified registrant (see auth-context), so it must render from the `email` query
 * param alone and never issue a protected request.
 */
function VerifyEmailPendingContent() {
  const email = useSearchParams().get("email") ?? "";
  const [sending, setSending] = useState(false);

  function handleResend() {
    if (!email || sending) return;
    setSending(true);
    auth
      .resendVerification(email)
      .then(() => toast.success("Verification email sent"))
      .catch((err: unknown) =>
        toast.error(err instanceof ApiError ? err.message : "Couldn't resend right now"),
      )
      .finally(() => setSending(false));
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-soft rounded-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-3xl text-foreground">
            Check your inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <MailCheck className="h-12 w-12 text-brand" />
          <p className="text-center text-sm text-muted-foreground">
            We sent a verification link to{" "}
            <span className="font-semibold text-foreground">{email || "your email"}</span>.
            Click it to activate your account.
          </p>

          <Button
            type="button"
            variant="brand-pill"
            size="pill"
            onClick={handleResend}
            disabled={sending || !email}
            className="mt-2"
          >
            {sending ? "SENDING…" : "RESEND EMAIL"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already verified?{" "}
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
