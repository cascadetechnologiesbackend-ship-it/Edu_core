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

export function isTourDismissed(role: UserRole | string): boolean {
  const state = getSavedTourState(role);
  return state?.status === "dismissed";
}

export function isModuleDone(role: UserRole | string, moduleId: string): boolean {
  const state = getSavedTourState(role);
  if (!state) return false;
  return (
    state.status === "completed" ||
    (state.completedModules?.includes(moduleId) ?? false) ||
    (state.dismissedModules?.includes(moduleId) ?? false)
  );
}

export function markModuleDone(
  role: UserRole | string,
  moduleId: string,
  allModuleIds: string[] = []
): TourProgressState {
  const current = getSavedTourState(role) || {
    status: "in_progress",
    updatedAt: new Date().toISOString(),
  };

  const completed = Array.from(new Set([...(current.completedModules || []), moduleId]));
  const isAllComplete =
    allModuleIds.length > 0 && allModuleIds.every((id) => completed.includes(id));

  const updated: TourProgressState = {
    ...current,
    status: isAllComplete ? "completed" : "in_progress",
    completedModules: completed,
    currentModuleId: moduleId,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getTourStorageKey(role), JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }

  return updated;
}

export function dismissModule(
  role: UserRole | string,
  moduleId: string
): TourProgressState {
  const current = getSavedTourState(role) || {
    status: "in_progress",
    updatedAt: new Date().toISOString(),
  };

  const dismissed = Array.from(new Set([...(current.dismissedModules || []), moduleId]));
  const updated: TourProgressState = {
    ...current,
    dismissedModules: dismissed,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getTourStorageKey(role), JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }

  return updated;
}

export function dismissEntireTour(role: UserRole | string): TourProgressState {
  const updated: TourProgressState = {
    status: "dismissed",
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getTourStorageKey(role), JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }

  return updated;
}

export function resetTourState(role: UserRole | string): TourProgressState {
  const updated: TourProgressState = {
    status: "not_started",
    completedModules: [],
    dismissedModules: [],
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getTourStorageKey(role), JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }

  return updated;
}

