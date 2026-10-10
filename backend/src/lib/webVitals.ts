import { z } from "zod";
import pino from "pino";

export const vitalsLogger = pino({
  level: process.env["LOG_LEVEL"] || "info",
  ...(process.env["NODE_ENV"] === "development" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
}).child({ context: "web-vitals" });

export const metricItemSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.enum(["LCP", "INP", "CLS", "TTFB", "FCP"]),
  value: z.number().nonnegative(),
  route: z.string().min(1).max(200),
  timestamp: z.number().positive(),
  attribution: z.any().optional(),
});

export const batchSchema = z.object({
  appVersion: z.string().min(1).max(50),
  deviceTier: z.enum(["low", "mid", "high", "unknown"]),
  connectionType: z.string().min(1).max(50),
  role: z.string().min(1).max(50),
  schoolId: z.string().nullable().optional(),
  metrics: z.array(metricItemSchema).min(1).max(20),
});

export const webVitalsBatchSchema = batchSchema;

export type WebVitalsBatchPayload = z.infer<typeof batchSchema>;

/**
 * Checks for prohibited student identifiers or PII per PF-R111.
 * Returns true if sensitive student data is found.
 */
export function containsProhibitedPii(data: unknown): boolean {
  const serialized = JSON.stringify(data).toLowerCase();
  return (
    serialized.includes("studentid") ||
    serialized.includes("student_id") ||
    serialized.includes("aadhaar") ||
    serialized.includes("studentname") ||
    serialized.includes("admissionnumber")
  );
}

// In-memory rolling metrics store for field monitoring
interface MetricAggregate {
  count: number;
  values: number[];
}
const fieldMetricsStore = new Map<string, MetricAggregate>();

export function recordFieldMetric(route: string, metricName: string, value: number): void {
  const key = `${route}:${metricName}`;
  const existing = fieldMetricsStore.get(key) || { count: 0, values: [] };
  if (existing.values.length >= 200) existing.values.shift();
  existing.values.push(value);
  existing.count++;
  fieldMetricsStore.set(key, existing);
}

export function getFieldMetricStats(route: string, metricName: string) {
  const key = `${route}:${metricName}`;
  const agg = fieldMetricsStore.get(key);
  if (!agg || agg.values.length === 0) return null;

  const sorted = [...agg.values].sort((a, b) => a - b);
  const count = sorted.length;
  const p75Index = Math.ceil(0.75 * count) - 1;
  const p95Index = Math.ceil(0.95 * count) - 1;

  return {
    count,
    p75: sorted[Math.max(0, p75Index)] ?? 0,
    p95: sorted[Math.max(0, p95Index)] ?? 0,
    min: sorted[0] ?? 0,
    max: sorted[count - 1] ?? 0,
  };
}

export function resetFieldMetrics(): void {
  fieldMetricsStore.clear();
}
