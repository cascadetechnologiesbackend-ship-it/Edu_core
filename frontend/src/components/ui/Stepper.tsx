"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  id?: (string | number) | undefined;
  label: string;
  description?: string | undefined;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number; // 1-indexed (e.g. 1, 2, 3)
  onStepClick?: ((step: number) => void) | undefined;
  className?: string | undefined;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepperProps) {
  return (
    <div className={cn("w-full py-2", className)}>
      {/* Mobile view: "Step X of N: Label" */}
      <div className="flex sm:hidden items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold shadow-level-1">
            {currentStep}
          </span>
          <div className="text-xs">
            <span className="text-slate-400 font-medium">Step {currentStep} of {steps.length}:</span>{" "}
            <span className="font-bold text-white">
              {steps[currentStep - 1]?.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i + 1 === currentStep
                  ? "w-5 bg-blue-500"
                  : i + 1 < currentStep
                  ? "w-2 bg-emerald-500"
                  : "w-2 bg-white/20"
              )}
            />
          ))}
        </div>
      </div>

      {/* Desktop / Tablet view: horizontal numbered steps with connecting lines */}
      <div className="hidden sm:flex items-center justify-between relative">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = isCompleted && !!onStepClick;

          return (
            <React.Fragment key={step.id ?? index}>
              <div className="flex items-center gap-2.5 z-10">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(stepNumber)}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-150 min-h-[32px] min-w-[32px] focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                    isCompleted &&
                      "bg-emerald-600 text-white cursor-pointer hover:bg-emerald-500 shadow-level-1",
                    isCurrent &&
                      "bg-blue-600 text-white ring-4 ring-blue-500/25 shadow-level-1",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-white/[0.06] text-slate-400 border border-white/10 cursor-default"
                  )}
                  aria-label={`Step ${stepNumber}: ${step.label}`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : stepNumber}
                </button>
                <div className="text-left">
                  <p
                    className={cn(
                      "text-xs font-semibold leading-tight",
                      isCurrent && "text-blue-400",
                      isCompleted && "text-slate-200",
                      !isCurrent && !isCompleted && "text-slate-400"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-slate-400 mt-0.5 max-w-[120px] truncate">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connecting line between steps */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-3 h-0.5 bg-white/10 relative overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      stepNumber < currentStep ? "bg-emerald-500 w-full" : "w-0"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default Stepper;
