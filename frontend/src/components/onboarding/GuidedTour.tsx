"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from "lucide-react";
import { GlassCard } from "@/components/ui/apple/GlassCard";
import { AppleButton } from "@/components/ui/apple/AppleButton";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

export interface GuidedTourProps {
  tourId: string;
  steps: TourStep[];
  isOpen: boolean;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  tourId,
  steps,
  isOpen,
  onComplete,
  onDismiss,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [active, setActive] = useState(isOpen);

  useEffect(() => {
    // Check if tour was already completed
    const isCompleted = localStorage.getItem(`tour_completed_${tourId}`);
    if (isCompleted === "true") {
      setActive(false);
    } else {
      setActive(isOpen);
    }
  }, [tourId, isOpen]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      localStorage.setItem(`tour_completed_${tourId}`, "true");
      setActive(false);
      onComplete?.();
    }
  }, [currentStepIndex, steps.length, tourId, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(`tour_completed_${tourId}`, "dismissed");
    setActive(false);
    onDismiss?.();
  }, [tourId, onDismiss]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "Escape") handleDismiss();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, handleDismiss, handleNext, handlePrev]);

  if (!active || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  if (!currentStep) return null;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Soft translucent backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleDismiss}
      />

      {/* Floating Guided Card */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <GlassCard variant="elevated" padding="lg" className="border-apple-blue/30 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-apple-blue/10 text-apple-blue flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-apple-blue uppercase tracking-wider">
                Guided Tour • Step {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {currentStep.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Stepper Progress Dots */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              {steps.map((s, idx) => (
                <div
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStepIndex
                      ? "w-6 bg-apple-blue"
                      : idx < currentStepIndex
                      ? "w-2 bg-apple-blue/40"
                      : "w-2 bg-zinc-200 dark:bg-zinc-800"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <AppleButton
                  variant="secondary"
                  size="sm"
                  onClick={handlePrev}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Back
                </AppleButton>
              )}
              <AppleButton
                variant="primary"
                size="sm"
                moduleColor="blue"
                onClick={handleNext}
                rightIcon={
                  isLastStep ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )
                }
              >
                {isLastStep ? "Got it" : "Next"}
              </AppleButton>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
