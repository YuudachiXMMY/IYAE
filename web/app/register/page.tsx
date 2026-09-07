"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError, type RegisterRequest } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/hooks/useRedirectIfAuthenticated";
import { BRAND } from "@/lib/brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardProgress } from "@/components/register/WizardProgress";
import { StepBasics } from "@/components/register/StepBasics";
import { StepStylePrefs } from "@/components/register/StepStylePrefs";
import { StepColors } from "@/components/register/StepColors";
import { StepMeasurements } from "@/components/register/StepMeasurements";
import { StepAvatar } from "@/components/register/StepAvatar";
import { StepComplete } from "@/components/register/StepComplete";

const TOTAL_STEPS = 6;

const DEFAULT_FORM: Partial<RegisterRequest> = {
  role: "BUYER",
};

export default function RegisterPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<RegisterRequest>>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { register } = useAuth();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useRedirectIfAuthenticated();

  function handleChange(updates: Partial<RegisterRequest>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  function canAdvance(): boolean {
    if (currentStep === 0) {
      return !!(
        formData.email &&
        formData.password &&
        formData.password.length >= 8 &&
        formData.role
      );
    }
    return true;
  }

  function handleNext() {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }

  async function handleSubmit() {
    setError("");
    if (!formData.email || !formData.password || !formData.role) {
      setError("Please complete all required fields");
      return;
    }
    setIsLoading(true);
    try {
      // Strip empty strings to avoid server validation failures on optional fields
      const { email, password, role, ...rest } = formData;
      const optionalFields = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== "")
      );
      await register({ email, password, role, ...optionalFields } as RegisterRequest);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const showCompleteLater = currentStep >= 3 && currentStep < TOTAL_STEPS - 1;

  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-foreground">Join {BRAND.name}</h1>
          <p className="text-muted-foreground mt-2 text-sm">Create your style profile</p>
        </div>

        <WizardProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        <Card className="shadow-soft rounded-card bg-card">
          <CardContent className="p-6 sm:p-8">
            {currentStep === 0 && <StepBasics data={formData} onChange={handleChange} />}
            {currentStep === 1 && <StepStylePrefs data={formData} onChange={handleChange} />}
            {currentStep === 2 && <StepColors data={formData} onChange={handleChange} />}
            {currentStep === 3 && <StepMeasurements data={formData} onChange={handleChange} />}
            {currentStep === 4 && <StepAvatar data={formData} onChange={handleChange} />}
            {currentStep === 5 && (
              <StepComplete
                data={formData}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                error={error}
              />
            )}

            {!isLastStep && (
              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="rounded-full text-muted-foreground"
                >
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  {showCompleteLater && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="rounded-full text-muted-foreground border-border"
                    >
                      {isLoading ? "Saving..." : "Complete Later"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvance()}
                    className="rounded-full bg-brand hover:bg-brand-hover text-primary-foreground"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {error && !isLastStep && (
              <div
                id="register-error"
                role="alert"
                className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
