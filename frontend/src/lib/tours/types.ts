import { UserRole } from "@schoolmitra/validators/roleConfig";
import React from "react";

export interface TourSubModule {
  id: string;
  title: string;
  summary: string;
  ctaHref: string;
  badge?: string;
}

export interface TourModule {
  id: string;
  tag: string;
  tagColor?: string;
  title: string;
  summary: string;
  whatItIs: string;
  whyItMatters: string;
  ctaHref: string;
  icon: React.ElementType;
  iconColor?: string;
  bgGradient?: string;
  subModules?: TourSubModule[];
}

export interface TourDeck {
  role: UserRole;
  roleDisplayName: string;
  modules: TourModule[];
  completionTitle?: string;
  completionMessage?: string;
}

export interface TourProgressState {
  status: "not_started" | "in_progress" | "module_done" | "completed" | "dismissed";
  level?: 1 | 2;
  moduleIndex?: number;
  subIndex?: number;
  completedModules?: string[];
  dismissedModules?: string[];
  currentModuleId?: string;
  updatedAt: string;
}

export type TourUsageEventName =
  | "tour_started"
  | "tour_completed"
  | "tour_skipped"
  | "tour_step_viewed"
  | "tour_module_completed";

export interface TourStep {
  anchorId: string;
  title: string;
  line: string;
  ctaLabel?: string;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
}

export interface PageTourDefinition {
  pagePath: string;
  moduleId: string;
  moduleTitle: string;
  steps: TourStep[];
}

