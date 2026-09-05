"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/hooks/useRedirectIfAuthenticated";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { isAuthenticated, loading: authLoading } = useRedirectIfAuthenticated();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      await api.post("/api/auth/forgot-password", { email });
    } catch {
      // Intentionally swallowed — always show the same response to prevent
      // email enumeration attacks
    } finally {
      setIsLoading(false);
      setSubmitted(true);
      toast.success("Reset link sent if account exists");
    }
  }

  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-soft rounded-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-3xl text-foreground">
            Forgot Password
          </CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="rounded-lg bg-success/10 p-4 text-sm text-success text-center">
              If an account exists with that email, we&apos;ve sent a password
              reset link.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded-full bg-brand hover:bg-brand-hover"
                disabled={isLoading}
              >
                {isLoading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
