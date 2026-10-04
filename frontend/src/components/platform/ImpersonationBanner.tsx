"use client";

import { useState } from "react";
import { Eye, LogOut, ShieldAlert, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

interface ImpersonationBannerProps {
  schoolName?: string;
  impersonatingRole?: string;
  expiresInMinutes?: number;
}

export function ImpersonationBanner({
  schoolName = "School Instance",
  impersonatingRole = "School Administrator",
  expiresInMinutes = 58,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  // In a real environment, this calls the superadmin.impersonation.end procedure or clears the cookie
  const handleExit = async () => {
    setIsExiting(true);
    try {
      // Clear impersonation context and return to platform schools directory
      document.cookie = "sm_impersonation=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = "/super-admin/schools";
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs shadow-md backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold tracking-wide uppercase text-[10px]">
            <Eye className="w-3 h-3 text-amber-400 animate-pulse" />
            Superadmin Impersonation Mode
          </span>
          <span className="text-slate-300">
            Currently viewing as <strong className="text-white font-semibold">{schoolName}</strong> ({impersonatingRole})
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 border-l border-slate-700 pl-2">
            <Clock className="w-3 h-3 text-amber-400" />
            Session expires in ~{expiresInMinutes}m
          </span>
        </div>

        <button
          onClick={handleExit}
          disabled={isExiting}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-medium text-xs transition active:scale-95 disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          {isExiting ? "Exiting Session..." : "Exit Impersonation"}
        </button>
      </div>
    </div>
  );
}
