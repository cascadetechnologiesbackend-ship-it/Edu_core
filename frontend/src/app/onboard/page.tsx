"use client";

import React from "react";
import Link from "next/link";
import {
  OnboardingProvider,
  useOnboarding,
} from "./onboardContext";
import { registerSchoolTenant } from "@/app/actions/onboard";
import { Stepper } from "@/components/ui/Stepper";
import { Step1Board } from "./steps/Step1Board";
import { Step2Profile } from "./steps/Step2Profile";
import { Step3Classes } from "./steps/Step3Classes";
import { Step4ReviewDrawer } from "./steps/Step4ReviewDrawer";
import { Step5Fees } from "./steps/Step5Fees";
import { Step6Admin } from "./steps/Step6Admin";
import { Step7Review } from "./steps/Step7Review";
import { Step8Completion } from "./steps/Step8Completion";
import { signIn } from "next-auth/react";
import {
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
} from "lucide-react";

const ONBOARDING_STEPS = [
  { label: "Board" },
  { label: "Profile" },
  { label: "Classes" },
  { label: "Curriculum" },
  { label: "Fee Heads" },
  { label: "Security" },
  { label: "Review" },
];

function OnboardingWizardContent() {
  const {
    activeStep,
    setActiveStep,
    loading,
    setLoading,
    error,
    setError,
    successResult,
    setSuccessResult,
    compilePayload,
    validateAndNext,
  } = useOnboarding();

  const handleFinalProvision = async () => {
    setError("");
    setLoading(true);

    try {
      const payload = compilePayload();
      const result = await registerSchoolTenant(payload);
      setLoading(false);

      if (result.success) {
        setSuccessResult({
          message: result.message,
          email: (result as any).adminEmail || payload.adminEmail,
        });
        setActiveStep(8);

        // Auto-signIn with created admin credentials for seamless auto-handoff to /admin/day-one
        if (payload.adminEmail && payload.adminPassword) {
          try {
            await signIn("credentials", {
              email: payload.adminEmail,
              password: payload.adminPassword,
              redirect: false,
            });
          } catch (signInErr) {
            console.warn("Auto-signin error after provisioning:", signInErr);
          }
        }
      } else {
        setError(result.message || "Onboarding provisioning failed.");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An unexpected system error occurred during tenant registration.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col selection:bg-semantic-interactive/20 selection:text-semantic-interactive">
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <header className="h-16 border-b border-border/40 bg-card/80 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-semantic-interactive/12 border border-semantic-interactive/25 flex items-center justify-center text-semantic-interactive shadow-xs">
            <GraduationCap className="w-5 h-5 text-semantic-interactive" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              SchoolMitra ERP
            </span>
            <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20">
              Tenant Onboarding
            </span>
          </div>
        </div>

        <Link
          href="/login"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          Sign in to existing school →
        </Link>
      </header>

      {/* ── Main Container ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Stepper (hidden on completion) */}
        {activeStep <= 7 && (
          <div className="bg-card backdrop-blur-xl border border-border/40 rounded-2xl p-4 sm:p-5 shadow-xs">
            <Stepper
              steps={ONBOARDING_STEPS}
              currentStep={activeStep}
              onStepClick={(s) => setActiveStep(s)}
            />
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-semantic-money-owed/10 border border-semantic-money-owed/25 text-semantic-money-owed text-xs flex items-center gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 text-semantic-money-owed shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Step Views */}
        <div className="bg-card backdrop-blur-xl border border-border/40 rounded-3xl p-6 sm:p-8 shadow-xs">
          {activeStep === 1 && <Step1Board />}
          {activeStep === 2 && <Step2Profile />}
          {activeStep === 3 && <Step3Classes />}
          {activeStep === 4 && <Step4ReviewDrawer />}
          {activeStep === 5 && <Step5Fees />}
          {activeStep === 6 && <Step6Admin />}
          {activeStep === 7 && <Step7Review onProvision={handleFinalProvision} />}
          {activeStep === 8 && <Step8Completion />}
        </div>

        {/* Navigation Footer (for steps 1-6) */}
        {activeStep <= 6 && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={activeStep === 1}
              onClick={() => setActiveStep(activeStep - 1)}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl border border-border/40 bg-muted hover:bg-muted/80 text-foreground transition disabled:opacity-30 disabled:pointer-events-none inline-flex items-center gap-2 min-h-[44px] active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={validateAndNext}
              className="px-6 py-2.5 text-xs font-semibold rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white transition inline-flex items-center gap-2 shadow-xs min-h-[44px]"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DedicatedSchoolOnboardingWizard() {
  return (
    <OnboardingProvider>
      <OnboardingWizardContent />
    </OnboardingProvider>
  );
}
