"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    setServerError("");

    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setValidationError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/api/auth/reset-password", { token, newPassword });
      toast.success("Password has been reset");
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Link expired or already used";
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-soft rounded-card">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Link expired or already used
            </p>
            <div className="flex flex-col items-center gap-2">
              <Link href="/forgot-password" className="text-sm text-brand hover:underline">
                Request a new link
              </Link>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-soft rounded-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-3xl text-foreground">
            Reset Password
          </CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(validationError || serverError) && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive space-y-2">
                <p>{validationError || serverError}</p>
                {serverError && (
                  <div className="flex flex-col items-start gap-1 pt-1">
                    <Link href="/forgot-password" className="text-brand hover:underline">
                      Request a new link
                    </Link>
                    <Link href="/login" className="text-muted-foreground hover:text-foreground">
                      Back to login
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full rounded-full bg-brand hover:bg-brand-hover"
              disabled={isLoading}
            >
              {isLoading ? "Resetting…" : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
