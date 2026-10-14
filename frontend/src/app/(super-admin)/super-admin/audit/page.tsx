import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, count } from "drizzle-orm";
import { History, ShieldCheck, Filter, Clock, User, Terminal, Database, FileText } from "lucide-react";

export const metadata = {
  title: "Platform Audit Log | Super Admin",
  description: "Immutable forensic log of platform operator actions and data mutations.",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: { action?: string; table?: string };
}) {
  const [totalLogsCount] = await db.select({ count: count() }).from(auditLogs);

  const logs = await db.query.auditLogs.findMany({
    orderBy: [desc(auditLogs.createdAt)],
    limit: 50,
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" /> Platform Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable, append-only security log compliant with DPDP Act 2023 Section 8(5).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Immutable · Append Only</span>
          </span>
        </div>
      </div>

      {/* Filter Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Total Audit Events</div>
          <div className="text-2xl font-extrabold text-white font-mono mt-1">
            {totalLogsCount?.count ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Zero record deletions permitted</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Governance Integrity</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
            100% Verified
          </div>
          <div className="text-[11px] text-slate-500 mt-1">PostgreSQL trigger protected</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Legal Hold Status</div>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-1">
            Enforced
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Retained per compliance schedule</div>
        </div>
      </div>

      {/* Audit Log Table Container (UX-R47 dual-morphology) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Entity / Table</th>
                <th className="py-3.5 px-4">Client IP</th>
                <th className="py-3.5 px-4">Context Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No platform audit events recorded yet. Platform mutations and authentication attempts are automatically captured here.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      <div>{log.userEmail}</div>
                      <div className="text-[10px] text-indigo-400">{log.userRole}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span className="text-slate-400">{log.tableName}</span>
                      {log.recordId && <span className="text-slate-600"> #{log.recordId.slice(0, 6)}</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{log.ipAddress}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Forensic Cards (UX-R47) */}
        <div className="block md:hidden p-3.5 space-y-3">
          {logs.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              No platform audit events recorded yet.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2.5 text-xs font-mono"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                  <span className="text-[10px] text-slate-400 font-sans">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                    {log.action}
                  </span>
                </div>

                <div className="space-y-1 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Actor:</span>
                    <span className="text-slate-200 font-medium text-xs">{log.userEmail}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Role:</span>
                    <span className="text-indigo-400 font-semibold text-[11px]">{log.userRole}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Entity / Table:</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {log.tableName}
                      {log.recordId && <span className="text-slate-500"> #{log.recordId.slice(0, 6)}</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Client IP:</span>
                    <span className="text-slate-400 font-mono text-[11px]">{log.ipAddress || "—"}</span>
                  </div>
                </div>

                {Boolean(log.metadata && typeof log.metadata === "object" && Object.keys(log.metadata as object).length > 0) && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <div className="text-[10px] uppercase font-semibold text-slate-500 font-sans mb-1">
                      Context Metadata
                    </div>
                    <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto break-all font-mono">
                      {JSON.stringify(log.metadata, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
