"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import { usePathname } from "next/navigation";
import { UserRole } from "@schoolmitra/validators/roleConfig";
import { PageTourDefinition, TourStep } from "@/lib/tours/types";
import {
  getSavedTourState,
  isTourDismissed,
  isModuleDone,
  markModuleDone,
  dismissModule,
  dismissEntireTour,
} from "@/lib/tours/storage";
import { recordTourUsageAction } from "@/app/actions/tourTelemetry";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { CoachMarkCard, ModuleProgressTrailItem } from "./CoachMarkCard";

export interface TourHostProps {
  role: UserRole | string;
  tours: PageTourDefinition[];
  allModuleIds?: string[];
  forceOpen?: boolean;
}

export function TourHost({
  role,
  tours = [],
  allModuleIds = [],
  forceOpen = false,
}: TourHostProps) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [activeTour, setActiveTour] = useState<PageTourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Normalize path without query or hash
  const cleanPath = pathname?.split(/[?#]/)[0] || "";

  // Helper to find matching tour definition for current route
  const getMatchingTour = useCallback(() => {
    return tours.find((t) => {
      const tourPath = t.pagePath.split(/[?#]/)[0];
      return tourPath === cleanPath;
    }) || null;
  }, [tours, cleanPath]);

  // Check and initialize tour for current page
  const initTour = useCallback(
    (overrideForce = false) => {
      const match = getMatchingTour();
      if (!match || match.steps.length === 0) {
        setIsOpen(false);
        setActiveTour(null);
        setTargetElement(null);
        return;
      }

      // Check storage dismissals
      if (!overrideForce && !forceOpen) {
        if (isTourDismissed(role)) {
          setIsOpen(false);
          return;
        }
        if (isModuleDone(role, match.moduleId)) {
          setIsOpen(false);
          return;
        }
      }

      setActiveTour(match);
      setStepIndex(0);
      setIsOpen(true);

      // Record telemetry for starting module tour
      startTransition(() => {
        recordTourUsageAction("tour_started", role, {
          pagePath: match.pagePath,
          moduleId: match.moduleId,
        });
      });
    },
    [getMatchingTour, forceOpen, role]
  );

  // Auto-trigger on route change or mount
  useEffect(() => {
    initTour();
  }, [cleanPath, initTour]);

  // Listen to manual open custom events
  useEffect(() => {
    const handleManualOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ role?: string; pagePath?: string }>;
      const targetRole = customEvent.detail?.role;
      if (!targetRole || targetRole.toUpperCase() === String(role).toUpperCase()) {
        initTour(true);
      }
    };

    window.addEventListener("open-contextual-tour", handleManualOpen);
    return () => {
      window.removeEventListener("open-contextual-tour", handleManualOpen);
    };
  }, [initTour, role]);

  // Resolve target DOM element for active step with retry
  useEffect(() => {
    if (!isOpen || !activeTour || !activeTour.steps[stepIndex]) {
      setTargetElement(null);
      return;
    }

    const currentStep = activeTour.steps[stepIndex]!;
    const anchorSelector = `[data-tour~="${currentStep.anchorId}"], [data-tour="${currentStep.anchorId}"]`;

    let element = document.querySelector<HTMLElement>(anchorSelector);

    if (element) {
      setTargetElement(element);
      startTransition(() => {
        recordTourUsageAction("tour_step_viewed", role, {
          pagePath: activeTour.pagePath,
          moduleId: activeTour.moduleId,
          stepId: currentStep.anchorId,
        });
      });
      return;
    }

    // Short retry loop for dynamically rendered elements (Law 2: no ghost popups if truly missing)
    let attempts = 0;
    const maxAttempts = 12;
    const interval = setInterval(() => {
      attempts++;
      element = document.querySelector<HTMLElement>(anchorSelector);
      if (element) {
        setTargetElement(element);
        clearInterval(interval);
        startTransition(() => {
          recordTourUsageAction("tour_step_viewed", role, {
            pagePath: activeTour.pagePath,
            moduleId: activeTour.moduleId,
            stepId: currentStep.anchorId,
          });
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn(
          `[ContextualTour] Anchor not found on page: [${currentStep.anchorId}] on ${activeTour.pagePath}. Popup suppressed per Law 2.`
        );
        setTargetElement(null);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, activeTour, stepIndex, role]);

  if (!isOpen || !activeTour || !targetElement || !activeTour.steps[stepIndex]) {
    return null;
  }

  const currentStep = activeTour.steps[stepIndex]!;

  const handleNext = () => {
    if (stepIndex < activeTour.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      // Completed last step of module
      markModuleDone(role, activeTour.moduleId, allModuleIds);
      setIsOpen(false);
      startTransition(() => {
        recordTourUsageAction("tour_module_completed", role, {
          pagePath: activeTour.pagePath,
          moduleId: activeTour.moduleId,
        });
      });
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleSkipModule = () => {
    dismissModule(role, activeTour.moduleId);
    setIsOpen(false);
    startTransition(() => {
      recordTourUsageAction("tour_skipped", role, {
        pagePath: activeTour.pagePath,
        moduleId: activeTour.moduleId,
      });
    });
  };

  const handleSkipTour = () => {
    dismissEntireTour(role);
    setIsOpen(false);
    startTransition(() => {
      recordTourUsageAction("tour_skipped", role, {
        pagePath: activeTour.pagePath,
      });
    });
  };

  // Build game-style progress trail
  const trail: ModuleProgressTrailItem[] = allModuleIds.map((id) => {
    const isDone = isModuleDone(role, id);
    const isCurrent = id === activeTour.moduleId;
    return {
      id,
      title: id,
      status: isDone ? "done" : isCurrent ? "current" : "not_visited",
    };
  });

  return (
    <>
      <SpotlightOverlay targetElement={targetElement} />
      <CoachMarkCard
        step={currentStep}
        stepIndex={stepIndex}
        totalSteps={activeTour.steps.length}
        moduleTitle={activeTour.moduleTitle}
        targetElement={targetElement}
        onNext={handleNext}
        onBack={handleBack}
        onSkipModule={handleSkipModule}
        onSkipTour={handleSkipTour}
        trail={trail}
      />
    </>
  );
}

