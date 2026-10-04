"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Sun, Moon, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface PwaHeaderProps {
  role: "TEACHER" | "PARENT" | "DRIVER";
  roleLabel: string;
  accentColor?: "emerald" | "indigo" | "amber";
  schoolName?: string;
  icon?: React.ReactNode;
}

export default function PwaHeader({
  role,
  roleLabel,
  accentColor = "emerald",
  schoolName = "SchoolMitra ERP",
  icon,
}: PwaHeaderProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const accentStyles = {
    emerald: {
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      pwa: "bg-emerald-500/20 text-emerald-300",
      iconBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    indigo: {
      badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
      pwa: "bg-indigo-500/20 text-indigo-300",
      iconBg: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    },
    amber: {
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      pwa: "bg-amber-500/20 text-amber-300",
      iconBg: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
  }[accentColor];

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between transition-colors">
      {/* Brand & Role Identification */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold shrink-0 ${accentStyles.iconBg}`}
        >
          {icon || <Sparkles className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold tracking-tight text-white truncate">
              {roleLabel}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${accentStyles.pwa}`}
            >
              PWA
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
            <span className="font-medium text-slate-300 capitalize">{userName}</span>
            <span>•</span>
            <span className="truncate">{schoolName}</span>
          </div>
        </div>
      </div>

      {/* Header Actions (Theme Toggle, Logout) */}
      <div className="flex items-center gap-1 shrink-0">
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
