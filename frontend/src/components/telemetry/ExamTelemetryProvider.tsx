"use client";

import React from "react";
import { useExamUxTracker } from "@/hooks/useExamUxTracker";

/**
 * Client provider that activates declarative UX telemetry tracking on mount.
 * Captures clicks on all child elements carrying data-ux-id attributes and buffers
 * them for transmission to /api/ux-events.
 */
export function ExamTelemetryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useExamUxTracker();
  return <>{children}</>;
}
