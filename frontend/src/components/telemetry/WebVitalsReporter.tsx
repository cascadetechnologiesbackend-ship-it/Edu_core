"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useReportWebVitals } from "next/web-vitals";

export type DeviceTier = "low" | "mid" | "high";

export function getDeviceTier(): DeviceTier {
  if (typeof window === "undefined") return "mid";
  const nav = navigator as any;
  const memory = nav.deviceMemory; // RAM in GB
  const cores = nav.hardwareConcurrency; // Logical cores

  if ((memory !== undefined && memory < 4) || (cores !== undefined && cores <= 4)) {
    return "low";
  }
  if (memory !== undefined && memory >= 8 && cores !== undefined && cores >= 8) {
    return "high";
  }
  return "mid";
}

export function getConnectionType(): string {
  if (typeof window === "undefined") return "unknown";
  const nav = navigator as any;
  return nav.connection?.effectiveType || "unknown";
}

export interface MetricPayload {
  id: string;
  name: string;
  value: number;
  route: string;
  timestamp: number;
  attribution?: any;
}

export interface WebVitalsBatch {
  appVersion: string;
  deviceTier: DeviceTier;
  connectionType: string;
  role: string;
  schoolId: string;
  metrics: MetricPayload[];
}

export function WebVitalsReporter() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const bufferRef = useRef<MetricPayload[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const role = (session?.user as any)?.role || "ANONYMOUS";
  const schoolId = (session?.user as any)?.schoolId || "PUBLIC";
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "6.0.0";

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;

    const payload: WebVitalsBatch = {
      appVersion,
      deviceTier: getDeviceTier(),
      connectionType: getConnectionType(),
      role,
      schoolId,
      metrics: [...bufferRef.current],
    };

    bufferRef.current = [];

    const data = JSON.stringify(payload);
    const endpoint = "/api/telemetry/vitals";

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([data], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (!sent) {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: data,
          keepalive: true,
        }).catch(() => {});
      }
    } else {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data,
        keepalive: true,
      }).catch(() => {});
    }
  }, [appVersion, role, schoolId]);

  useReportWebVitals((metric) => {
    // Collect Core Web Vitals: LCP, INP, CLS, TTFB, FCP, FID
    const payload: MetricPayload = {
      id: metric.id,
      name: metric.name,
      value: Math.round(metric.value * 100) / 100,
      route: pathname,
      timestamp: Date.now(),
      attribution: (metric as any).attribution,
    };

    bufferRef.current.push(payload);

    // If buffer exceeds threshold, flush on idle
    if (bufferRef.current.length >= 8) {
      flushBuffer();
      return;
    }

    // Schedule idle flush
    if (!timeoutRef.current) {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        (window as any).requestIdleCallback(() => {
          flushBuffer();
          timeoutRef.current = null;
        }, { timeout: 4000 });
      } else {
        timeoutRef.current = setTimeout(() => {
          flushBuffer();
          timeoutRef.current = null;
        }, 4000);
      }
    }
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushBuffer();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushBuffer);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushBuffer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      flushBuffer();
    };
  }, [flushBuffer]);

  return null;
}
