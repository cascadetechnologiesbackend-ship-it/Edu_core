"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { WebVitalsReporter } from "@/components/telemetry/WebVitalsReporter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <WebVitalsReporter />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
