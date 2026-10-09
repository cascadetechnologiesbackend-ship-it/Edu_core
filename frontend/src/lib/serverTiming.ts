import pino from "pino";

export const serverTimingLogger = pino({
  level: process.env["LOG_LEVEL"] || "info",
  ...(process.env["NODE_ENV"] === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  }),
}).child({ context: "server-timing" });

export interface TimingRecord {
  route: string;
  operation: string;
  durationMs: number;
  timestamp: number;
  status: "PASS" | "WARN";
  metadata?: Record<string, unknown> | undefined;
}

export interface RoutePercentiles {
  route: string;
  count: number;
  min: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  max: number;
  status: "PASS" | "WARN";
}

// In-memory ring buffer (up to 200 samples per route)
const routeTimingsStore = new Map<string, TimingRecord[]>();
const MAX_SAMPLES_PER_ROUTE = 200;

/** Normative target for page data phase: <= 500ms p95 (carried from Spec 5.0.0; PF-R00) */
export const TARGET_DATA_PHASE_P95_MS = 500;

/**
 * Records a server timing measurement for a route.
 */
export function recordRouteTiming(
  route: string,
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown> | undefined
): TimingRecord {
  const roundedMs = Math.round(durationMs * 100) / 100;
  const status: "PASS" | "WARN" = roundedMs <= TARGET_DATA_PHASE_P95_MS ? "PASS" : "WARN";

  const record: TimingRecord = {
    route,
    operation,
    durationMs: roundedMs,
    timestamp: Date.now(),
    status,
    metadata,
  };

  const existing = routeTimingsStore.get(route) || [];
  if (existing.length >= MAX_SAMPLES_PER_ROUTE) {
    existing.shift();
  }
  existing.push(record);
  routeTimingsStore.set(route, existing);

  serverTimingLogger.info(
    {
      route,
      operation,
      durationMs: roundedMs,
      targetP95: TARGET_DATA_PHASE_P95_MS,
      status,
      ...metadata,
    },
    `[SERVER_TIMING] ${route} (${operation}): ${roundedMs}ms [${status}]`
  );

  return record;
}

/**
 * Starts a route timer and returns an end function.
 */
export function startRouteTimer(route: string, operation = "data_phase") {
  const start = performance.now();
  return {
    end(metadata?: Record<string, unknown> | undefined): number {
      const durationMs = performance.now() - start;
      recordRouteTiming(route, operation, durationMs, metadata);
      return durationMs;
    },
  };
}

/**
 * Wraps an async data-fetching block with server timing instrumentation.
 */
export async function measureDataPhase<T>(
  route: string,
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown> | undefined
): Promise<T> {
  const timer = startRouteTimer(route, operation);
  try {
    const result = await fn();
    timer.end(metadata);
    return result;
  } catch (error) {
    timer.end({ ...metadata, error: true });
    throw error;
  }
}

/**
 * Computes p50, p75, p95, p99 percentiles for a route.
 */
export function getRouteTimingPercentiles(route: string): RoutePercentiles | null {
  const records = routeTimingsStore.get(route);
  if (!records || records.length === 0) return null;

  const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
  const count = durations.length;

  const getPercentile = (pct: number): number => {
    const index = Math.ceil((pct / 100) * count) - 1;
    const val = durations[Math.max(0, Math.min(index, count - 1))];
    return val ?? 0;
  };

  const p95 = getPercentile(95);

  return {
    route,
    count,
    min: durations[0] ?? 0,
    p50: getPercentile(50),
    p75: getPercentile(75),
    p95,
    p99: getPercentile(99),
    max: durations[count - 1] ?? 0,
    status: p95 <= TARGET_DATA_PHASE_P95_MS ? "PASS" : "WARN",
  };
}

/**
 * Returns summary percentiles report for all recorded routes.
 */
export function getRouteTimingReport(): Record<string, RoutePercentiles> {
  const report: Record<string, RoutePercentiles> = {};
  for (const route of routeTimingsStore.keys()) {
    const stats = getRouteTimingPercentiles(route);
    if (stats) {
      report[route] = stats;
    }
  }
  return report;
}

/**
 * Clears recorded route timings.
 */
export function resetRouteTimings(): void {
  routeTimingsStore.clear();
}

/**
 * Formats metrics into a valid W3C Server-Timing header value.
 * Example: `app;dur=12.3;desc="Auth Check", db;dur=45.6;desc="Data Fetch"`
 */
export function formatServerTimingHeader(
  metrics: Record<string, number | { dur: number; desc?: string }>
): string {
  return Object.entries(metrics)
    .map(([name, val]) => {
      if (typeof val === "number") {
        return `${name};dur=${Math.round(val * 100) / 100}`;
      }
      const descPart = val.desc ? `;desc="${val.desc}"` : "";
      return `${name};dur=${Math.round(val.dur * 100) / 100}${descPart}`;
    })
    .join(", ");
}
