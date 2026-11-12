"use client";

import React from "react";
import { Lightbulb } from "lucide-react";
import { UserRole } from "@schoolmitra/validators/roleConfig";

export interface TutorialLauncherButtonProps {
  className?: string;
  label?: string;
  role?: UserRole | string;
  restart?: boolean;
}

export function TutorialLauncherButton({
  className = "",
  label = "Quick Tutorial",
  role = "SCHOOL_ADMIN",
  restart = false,
}: TutorialLauncherButtonProps) {
  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-tutorial-flashcards", {
          detail: { role, restart },
        })
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Open ${label}`}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-semibold text-xs transition shadow-xs active:scale-95 ${className}`}
    >
      <Lightbulb className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}
