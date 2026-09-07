"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError, type RegisterRequest } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/hooks/useRedirectIfAuthenticated";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/design-system/SiteHeader";
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

// Primary-CTA label per step (steps map onto the 3 display groups in the header).
const CTA_LABEL = [
  "CONTINUE",
  "BUILD MY PROFILE",
  "CONTINUE",
  "CONTINUE",
  "CONTINUE",
];

// Display group (1-based, out of 3) for the "N of 3" progress caption.
function displayGroup(step: number): number {
  if (step <= 0) return 1;
  if (step <= 2) return 2;
  return 3;
}

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
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
        <WizardProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        <div className="rounded-card bg-card p-6 shadow-soft sm:p-10">
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
            <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="rounded-button text-muted-foreground"
                >
                  Back
                </Button>
                <span className="font-body text-[12px] uppercase tracking-[0.12px] text-muted-foreground">
                  {displayGroup(currentStep)} of 3
                </span>
              </div>

              <div className="flex items-center gap-3">
                {showCompleteLater && (
                  <Button
                    type="button"
                    variant="outline-pill"
                    size="pill"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? "SAVING…" : "COMPLETE LATER"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="brand-pill"
                  size="pill"
                  onClick={handleNext}
                  disabled={!canAdvance()}
                >
                  {CTA_LABEL[currentStep] ?? "CONTINUE"}
                </Button>
              </div>
            </div>
          )}

          {error && !isLastStep && (
            <div
              id="register-error"
              role="alert"
              className="mt-4 rounded-card border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
        </div>

        <p className="mt-8 text-center font-body text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
