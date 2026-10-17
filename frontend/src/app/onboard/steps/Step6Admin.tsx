"use client";

import React from "react";
import { useOnboarding } from "../onboardContext";
import { ShieldCheck, Lock, Mail, UserCheck, ShieldAlert } from "lucide-react";

export function Step6Admin() {
  const {
    adminName,
    setAdminName,
    adminEmail,
    setAdminEmail,
    adminPassword,
    setAdminPassword,
    confirmPassword,
    setConfirmPassword,
    captchaAnswer,
    setCaptchaAnswer,
    captchaNum1,
    captchaNum2,
  } = useOnboarding();

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Step 6: Security & Administration
        </span>
        <h2 className="text-2xl font-black text-white mt-1">
          Administrator Account Credentials
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          The Master Administrator account will hold highest authorization privileges (SUPER_ADMIN / SCHOOL_ADMIN),
          with tenant isolation key ownership.
        </p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Administrator Full Name *
            </label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="e.g. Ramesh Chandra"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Admin Login Email *
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@school.edu.in"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Master Password *
            </label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Confirm Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
            />
          </div>
        </div>

        {/* Security Captcha Challenge */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300 font-semibold">
              Security verification: What is {captchaNum1} + {captchaNum2}? *
            </span>
          </div>
          <input
            type="number"
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            placeholder="Answer"
            className="w-24 px-3 py-1.5 text-xs text-center font-mono rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
          />
        </div>
      </div>
    </div>
  );
}
