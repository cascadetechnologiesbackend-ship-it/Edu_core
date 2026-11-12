import { UserRole } from "@schoolmitra/validators/roleConfig";
import { TourProgressState } from "./types";

const STORAGE_PREFIX = "schoolmitra_tour_";

export function getTourStorageKey(role: UserRole | string): string {
  const normalizedRole = (role || "SCHOOL_ADMIN").toLowerCase().replace(/_/g, "-");
  return `${STORAGE_PREFIX}${normalizedRole}`;
}

export function getSavedTourState(role: UserRole | string): TourProgressState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getTourStorageKey(role));
    if (!raw) return null;
    return JSON.parse(raw) as TourProgressState;
  } catch {
    return null;
  }
}

export function saveTourState(
  role: UserRole | string,
  state: Partial<TourProgressState> & { status: TourProgressState["status"] }
): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSavedTourState(role) || {
      status: "in_progress",
      level: 1,
      moduleIndex: 0,
      subIndex: 0,
      updatedAt: new Date().toISOString(),
    };
    const updated: TourProgressState = {
      ...current,
      ...state,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(getTourStorageKey(role), JSON.stringify(updated));
  } catch {
    // Ignore storage errors in restrictive environments
  }
}

export function clearTourState(role: UserRole | string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getTourStorageKey(role));
  } catch {
    // Ignore
  }
}

