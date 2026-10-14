"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { configureResultSettings } from "@/app/(admin)/exams/actions/resultActions";
import {
  Lock,
  Unlock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Globe,
  Award,
  Clock,
  Sparkles,
} from "lucide-react";

export interface SetupOption {
  id: string;
  name: string;
}

export interface ResultSettingsData {
  setupId: string;
  withholdAll: boolean;
  releaseAt: string | null;
  feeLockMode: "OFF" | "SOFT" | "HARD";
  feeLockThresholdAmount: number;
  publicLookupEnabled: boolean;
  publicToppersEnabled: boolean;
}

interface ResultSettingsClientProps {
  setups: SetupOption[];
  selectedSetupId: string;
  initialSettings: ResultSettingsData | null;
}

export function ResultSettingsClient({
  setups,
  selectedSetupId,
  initialSettings,
}: ResultSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [setupId, setSetupId] = useState(selectedSetupId);
  const [withholdAll, setWithholdAll] = useState(initialSettings?.withholdAll ?? false);
  const [releaseAt, setReleaseAt] = useState(
    initialSettings?.releaseAt
      ? new Date(initialSettings.releaseAt).toISOString().slice(0, 16)
      : "",
  );
  const [feeLockMode, setFeeLockMode] = useState<"OFF" | "SOFT" | "HARD">(
    initialSettings?.feeLockMode ?? "OFF",
  );
  const [thresholdAmount, setThresholdAmount] = useState(
    initialSettings?.feeLockThresholdAmount ?? 0,
  );
  const [publicLookupEnabled, setPublicLookupEnabled] = useState(
    initialSettings?.publicLookupEnabled ?? false,
  );
  const [publicToppersEnabled, setPublicToppersEnabled] = useState(
    initialSettings?.publicToppersEnabled ?? false,
  );

  const [feedback, setFeedback] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const handleSetupChange = (newSetupId: string) => {
    setSetupId(newSetupId);
    router.push(`/exams/report-cards/settings?setupId=${newSetupId}`);
  };

  const handleSave = () => {
    if (!setupId) return;
    startTransition(async () => {
      setFeedback(null);
      const res = await configureResultSettings({
        setupId,
        withholdAll,
        releaseAt: releaseAt ? new Date(releaseAt).toISOString() : null,
        feeLockMode,
        feeLockThresholdAmount: Number(thresholdAmount) || 0,
        publicLookupEnabled,
        publicToppersEnabled,
      });

      if (res.success) {
        setFeedback({
          text: "✓ Result release gate & visibility policies saved successfully.",
          type: "success",
        });
        router.refresh();
      } else {
        setFeedback({
          text: "Failed to update result settings.",
          type: "error",
        });
      }
    });
  };

  // Compute status
  const isCurrentlyWithheld = withholdAll;
  const isScheduledInFuture =
    !withholdAll && releaseAt && new Date(releaseAt).getTime() > Date.now();
  const isLive = !isCurrentlyWithheld && !isScheduledInFuture;

  return (
    <div className="space-y-6">
      {/* ─── 1. Setup Selector & Live Status Banner ─────────────────────────────── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-5 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Framework Setup
            </label>
            <select
              value={setupId}
              onChange={(e) => handleSetupChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              {setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {isCurrentlyWithheld ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <Lock className="w-3.5 h-3.5" />
                <span>Results Withheld (Offline)</span>
              </span>
            ) : isScheduledInFuture ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Clock className="w-3.5 h-3.5" />
                <span>Scheduled Release</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Published &amp; Live</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ─── 2. Gate Settings Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Release Timing & Emergency Withhold */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Release Schedule &amp; Killswitch</h2>
              <p className="text-[11px] text-slate-400">
                Control global visibility across student portals and external portals
              </p>
            </div>
          </div>

          {/* Master Withhold Switch */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Emergency Withhold All
                </span>
                <span className="text-[11px] text-slate-400">
                  Immediately hide all report cards for this setup from students &amp; parents.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={withholdAll}
                  onChange={(e) => setWithholdAll(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
            {withholdAll && (
              <p className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                ⚠️ All report card views, lookups, and downloads are blocked until this is disabled.
              </p>
            )}
          </div>

          {/* Scheduled Release Date & Time */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Scheduled Release Timestamp (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={releaseAt}
                onChange={(e) => setReleaseAt(e.target.value)}
                disabled={withholdAll}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
              {releaseAt && (
                <button
                  type="button"
                  onClick={() => setReleaseAt("")}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                  title="Make immediately live"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Leave blank to make results instantly accessible once snapshots are generated.
            </p>
          </div>
        </div>

        {/* Card B: Financial Clearance Gate (Fee Defaulter Lock) */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Financial Clearance Gate</h2>
              <p className="text-[11px] text-slate-400">
                Automated enforcement for students with outstanding tuition dues
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Fee Lock Policy
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFeeLockMode("OFF")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                  feeLockMode === "OFF"
                    ? "bg-slate-800 text-white border-slate-600 shadow"
                    : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-white"
                }`}
              >
                Disabled (OFF)
              </button>

              <button
                type="button"
                onClick={() => setFeeLockMode("SOFT")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                  feeLockMode === "SOFT"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow"
                    : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-white"
                }`}
              >
                Soft Warning
              </button>

              <button
                type="button"
                onClick={() => setFeeLockMode("HARD")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                  feeLockMode === "HARD"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow"
                    : "bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-white"
                }`}
              >
                Hard Lock
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {feeLockMode === "OFF" &&
                "All students can view report cards regardless of fee balances."}
              {feeLockMode === "SOFT" &&
                "Shows a prominent notice with outstanding dues, but allows viewing & downloading."}
              {feeLockMode === "HARD" &&
                "Completely blocks viewing and downloading until dues are settled below the threshold."}
            </p>
          </div>

          {/* Threshold Amount */}
          {feeLockMode !== "OFF" && (
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <label className="block text-xs font-semibold text-slate-300">
                Outstanding Balance Threshold (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={thresholdAmount}
                  onChange={(e) => setThresholdAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Students with unpaid dues exceeding this amount trigger the fee gate.
              </p>
            </div>
          )}
        </div>

        {/* Card C: Public Result Portal Policies */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <span className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Globe className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Public Result Portal (/s/[slug]/results)</h2>
              <p className="text-[11px] text-slate-400">
                School-branded external portal for student &amp; parent lookup
              </p>
            </div>
          </div>

          {/* Public Lookup Switch */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">
                Enable Public Result Lookup
              </span>
              <span className="text-[11px] text-slate-400">
                Allow students to retrieve marks using admission number + date of birth.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={publicLookupEnabled}
                onChange={(e) => setPublicLookupEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Public Toppers Switch */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">
                Enable Public Topper Board
              </span>
              <span className="text-[11px] text-slate-400">
                Showcase Class Rank #1, #2, and #3 achievers on the public landing page.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={publicToppersEnabled}
                onChange={(e) => setPublicToppersEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Card D: Student Experience Simulation Preview */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <span className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Student Experience Preview</h2>
              <p className="text-[11px] text-slate-400">
                Simulated response for parents viewing `/portal/report-cards`
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
            {withholdAll ? (
              <div className="text-rose-400 flex items-start gap-2">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Status: Blocked (Withheld)</strong>
                  <span className="text-[11px] text-slate-400">
                    &quot;Term results are currently undergoing final administrative verification.&quot;
                  </span>
                </div>
              </div>
            ) : isScheduledInFuture ? (
              <div className="text-amber-400 flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Status: Countdown Scheduled</strong>
                  <span className="text-[11px] text-slate-400">
                    &quot;Results will be released on {new Date(releaseAt).toLocaleString("en-IN")}.&quot;
                  </span>
                </div>
              </div>
            ) : feeLockMode === "HARD" ? (
              <div className="text-rose-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Status: Hard Fee Defaulter Gate</strong>
                  <span className="text-[11px] text-slate-400">
                    Students with dues &gt; ₹{thresholdAmount} will see &quot;Outstanding Dues Pending — Please Clear to View Marks&quot;.
                  </span>
                </div>
              </div>
            ) : feeLockMode === "SOFT" ? (
              <div className="text-amber-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Status: Soft Warning Banner</strong>
                  <span className="text-[11px] text-slate-400">
                    Students can view &amp; download marksheets, with an urgent dues settlement notice.
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Status: Open &amp; Unrestricted</strong>
                  <span className="text-[11px] text-slate-400">
                    All enrolled students can immediately view and download report cards.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. Save Button Bar ────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-3">
        <button
          type="button"
          disabled={isPending || !setupId}
          onClick={handleSave}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isPending ? "Saving Policies..." : "Save Visibility Policies"}</span>
        </button>
      </div>
    </div>
  );
}
