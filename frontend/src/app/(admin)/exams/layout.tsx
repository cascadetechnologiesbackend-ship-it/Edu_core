import React from "react";
import { ExamTelemetryProvider } from "@/components/telemetry/ExamTelemetryProvider";

export default function ExamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ExamTelemetryProvider>{children}</ExamTelemetryProvider>;
}
