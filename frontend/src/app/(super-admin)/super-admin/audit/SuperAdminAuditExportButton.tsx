"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ExportDialog, type ExportRequestPayload } from "@/components/import-export";
import { DATASET_SCHEMAS } from "@/lib/importExportEngine";
import { downloadExportRows } from "@/lib/exportDownload";

export interface SuperAdminAuditRow {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  performerEmail: string;
  reason: string | null;
}

export function SuperAdminAuditExportButton({ logs }: { logs: SuperAdminAuditRow[] }) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setExportOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Export</span>
      </button>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        datasetKey="AUDIT_LOGS"
        filteredCount={logs.length}
        totalCount={logs.length}
        onConfirm={async (payload: ExportRequestPayload) => {
          const rows = logs
            .filter((l) => {
              if (payload.scope !== "dateRange") return true;
              const d = l.createdAt.slice(0, 10);
              if (payload.dateFrom && d < payload.dateFrom) return false;
              if (payload.dateTo && d > payload.dateTo) return false;
              return true;
            })
            .map((l) => ({
              createdAt: new Date(l.createdAt).toLocaleString("en-IN"),
              action: l.action,
              entityType: l.entityType,
              entityId: l.entityId,
              performerEmail: l.performerEmail,
              reason: l.reason || "N/A",
            }));

          const schema = DATASET_SCHEMAS.AUDIT_LOGS;
          const cols = payload.columns.map((key) => ({
            key,
            label: schema.columns.find((c) => c.key === key)?.label || key,
          }));
          await downloadExportRows({
            rows,
            columns: cols,
            format: payload.format,
            fileName: `platform-audit-logs-${new Date().toISOString().slice(0, 10)}`,
            sheetName: "Platform Audit Logs",
            title: "Platform Audit Trail Export",
          });
          toast.success(`Exported ${rows.length} audit log records (${payload.format})`);
        }}
      />
    </>
  );
}
