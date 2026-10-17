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
