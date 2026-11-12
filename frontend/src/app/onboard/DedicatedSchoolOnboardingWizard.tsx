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
    mode,
    activeStep,
    setActiveStep,
    loading,
    setLoading,
    error,
    setError,
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
          schoolId: (result as any).schoolId,
        });
        setActiveStep(8);

        // Auto-signIn with created admin credentials ONLY for public self-service onboarding
        if (mode !== "superadmin" && payload.adminEmail && payload.adminPassword) {
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
    <div className={mode === "superadmin" ? "text-slate-100 font-sans flex flex-col selection:bg-primary selection:text-white space-y-4" : "min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-primary selection:text-white"}>
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      {mode !== "superadmin" ? (
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black tracking-tight text-white">
                SchoolMitra ERP
              </span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Tenant Onboarding
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="text-xs font-bold text-slate-400 hover:text-white transition"
          >
            Sign in to existing school →
          </Link>
        </header>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Super Admin Provisioning
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Provision New School Instance
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Unified multi-tenant school onboarding wizard with statutory board matrix, fee structures, and credentials.
            </p>
          </div>

          <Link
            href="/super-admin/schools"
            className="self-start sm:self-auto text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800"
          >
            ← Back to Schools Directory
          </Link>
        </div>
      )}

      {/* ── Main Container ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Stepper (hidden on completion) */}
        {activeStep <= 7 && (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <Stepper
              steps={ONBOARDING_STEPS}
              currentStep={activeStep}
              onStepClick={(s) => setActiveStep(s)}
            />
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Step Views */}
        <div className="bg-slate-900/30 border border-slate-800/60 rounded-3xl p-6 sm:p-8 shadow-sm">
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
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:pointer-events-none inline-flex items-center gap-1.5 min-h-[40px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={validateAndNext}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/95 text-white transition inline-flex items-center gap-1.5 shadow-xs min-h-[40px]"
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

export function DedicatedSchoolOnboardingWizard({
  mode = "public",
}: {
  mode?: "public" | "superadmin";
}) {
  return (
    <OnboardingProvider mode={mode}>
      <OnboardingWizardContent />
    </OnboardingProvider>
  );
}

export default DedicatedSchoolOnboardingWizard;

