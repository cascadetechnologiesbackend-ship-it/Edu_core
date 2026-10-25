import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Deterministic palette for avatar initials per Law L12
const AVATAR_COLORS: readonly string[] = [
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-purple-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-indigo-600 text-white",
  "bg-teal-600 text-white",
  "bg-cyan-600 text-white",
];

const DEFAULT_AVATAR_COLOR = "bg-blue-600 text-white";

export function getAvatarColor(name: string = ""): string {
  if (!name) return DEFAULT_AVATAR_COLOR;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? DEFAULT_AVATAR_COLOR;
}

export function getInitials(name: string = ""): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.substring(0, 2).toUpperCase();
  const last = parts[parts.length - 1];
  const char1 = first[0] ?? "";
  const char2 = (last ? last[0] : "") ?? "";
  return (char1 + char2).toUpperCase() || "?";
}

/**
 * Assemble a full name cleanly, eliminating "null" / "undefined" string artifacts (AC6 / S19-F07).
 */
export function formatFullName(
  firstName?: string | null,
  lastName?: string | null,
  fallback: string = ""
): string {
  const clean = (val?: string | null): string => {
    if (!val) return "";
    const trimmed = String(val).trim();
    if (trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
      return "";
    }
    return trimmed;
  };
  const first = clean(firstName);
  const last = clean(lastName);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || fallback;
}

/**
 * De-duplicate fee labels, preventing "Annual Fee Fee" (AC6 / S19-F07).
 */
export function formatFeeTermName(termName?: string | null): string {
  if (!termName) return "School Fee";
  const trimmed = termName.trim();
  if (/\bfee$/i.test(trimmed)) {
    return trimmed.replace(/(\s+fee)+$/i, " Fee");
  }
  return `${trimmed} Fee`;
}

export interface AttendanceRateResult {
  totalDays: number;
  attendedDays: number;
  absentDays: number;
  lateDays: number;
  ratePercent: number; // 0 - 100
  rateRatio: number;   // 0.0 - 1.0
  formattedPercent: string; // e.g. "95.0%"
}

/**
 * Single source of truth for attendance computation (AC6 / S19-F07).
 * Consumed by both header and 30-day card so they cannot disagree.
 */
export function calculateAttendanceMetrics(
  attendanceRecords: Array<{ status: string }>
): AttendanceRateResult {
  const schoolDays = attendanceRecords.filter((r) => r.status !== "HOLIDAY");
  const totalDays = schoolDays.length;
  const attendedDays = schoolDays.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE"
  ).length;
  const absentDays = schoolDays.filter((r) => r.status === "ABSENT").length;
  const lateDays = schoolDays.filter((r) => r.status === "LATE").length;

  if (totalDays === 0) {
    return {
      totalDays: 0,
      attendedDays: 0,
      absentDays: 0,
      lateDays: 0,
      ratePercent: 100,
      rateRatio: 1.0,
      formattedPercent: "100.0%",
    };
  }

  const rateRatio = attendedDays / totalDays;
  const ratePercent = Math.round(rateRatio * 1000) / 10;

  return {
    totalDays,
    attendedDays,
    absentDays,
    lateDays,
    ratePercent,
    rateRatio,
    formattedPercent: `${ratePercent.toFixed(1)}%`,
  };
}

