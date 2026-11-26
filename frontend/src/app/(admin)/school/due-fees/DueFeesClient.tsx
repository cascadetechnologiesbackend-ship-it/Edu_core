"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Send,
  Eye,
  AlertTriangle,
  Clock,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { MoneyKpi } from "@/components/finance/MoneyKpi";
import { FilterBar } from "@/components/finance/FilterBar";
import { DataTable, ColumnDef } from "@/components/finance/DataTable";
import { AgingBadge, StatusBadge } from "@/components/finance/StatusBadge";
import { StudentLedgerDrawer } from "@/components/finance/StudentLedgerDrawer";
import { sendDueReminder } from "./actions";

export interface DueFeeRow {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  classId: string;
  feeHeadName: string;
  dueDate: string;
  balanceAmount: number;
  lateFeeAmount: number;
  daysOverdue: number;
  ageBracket: "0-30" | "31-60" | "60+";
  status?: string;
  term?: string;
  reminderSent: boolean;
}

export interface DueFeesActiveFilters {
  ayId?: string | undefined;
  classId?: string | undefined;
  sectionId?: string | undefined;
  feeHeadId?: string | undefined;
  term?: string | undefined;
  status?: string | undefined;
  bracket?: string | undefined;
  dueDateFrom?: string | undefined;
  dueDateTo?: string | undefined;
  minDue?: string | undefined;
  maxDue?: string | undefined;
  q?: string | undefined;
}

export function DueFeesClient({
  items,
  totalDue,
  bracket0to30,
  bracket31to60,
  bracket60plus,
  totalCount,
  pageSize = 50,
  nextCursor,
  activeCursor,
  academicYearsList,
  classesList,
  sectionsList,
  feeHeadsList,
  activeFilters,
}: {
  items: DueFeeRow[];
  totalDue: number;
  bracket0to30: number;
  bracket31to60: number;
  bracket60plus: number;
  totalCount: number;
  pageSize?: number;
  nextCursor: string | null;
  activeCursor?: string | undefined;
  academicYearsList: Array<{ id: string; label: string; isActive?: boolean }>;
  classesList: Array<{ id: string; label: string }>;
  sectionsList: Array<{ id: string; label: string; classId: string }>;
  feeHeadsList: Array<{ id: string; label: string }>;
  activeFilters: DueFeesActiveFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    className: string;
  } | null>(null);

  const [minDueInput, setMinDueInput] = useState(activeFilters.minDue || "");
  const [maxDueInput, setMaxDueInput] = useState(activeFilters.maxDue || "");

  const updateUrlParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "ALL") {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    }
    if (!("cursor" in updates)) {
      params.delete("cursor");
    }
    const qs = params.toString();
    router.push((qs ? `${pathname}?${qs}` : pathname) as any);
  };

  const filteredSections = activeFilters.classId
    ? sectionsList.filter((s) => s.classId === activeFilters.classId)
    : sectionsList;

  const handleReminderClick = async (invoiceId: string) => {
    const res = await sendDueReminder(invoiceId);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message || "Failed to trigger reminder");
    }
  };

  const columns: ColumnDef<DueFeeRow>[] = [
    {
      id: "student",
      header: "Student",
      accessorKey: "studentName",
      sortable: true,
      cell: (row) => (
        <div>
          <button
            type="button"
            onClick={() =>
              setSelectedStudentForDrawer({
                studentId: row.studentId,
                studentName: row.studentName,
                admissionNumber: row.admissionNumber,
                className: row.className,
              })
            }
            className="font-bold text-foreground hover:text-[#248A3D] dark:text-[#30D158] dark:hover:text-[#30D158] text-left transition"
          >
            {row.studentName}
          </button>
          <p className="text-xs text-muted-foreground font-mono">Adm #{row.admissionNumber}</p>
        </div>
      ),
    },
    {
      id: "className",
      header: "Class",
      accessorKey: "className",
      sortable: true,
      cell: (row) => <span className="font-medium text-xs">{row.className}</span>,
    },
    {
      id: "feeHead",
      header: "Fee Type",
      accessorKey: "feeHeadName",
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-semibold text-xs text-foreground">{row.feeHeadName}</span>
          <p className="text-[11px] text-muted-foreground font-mono">
            #{row.invoiceNumber} {row.term ? `• ${row.term}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "dueDate",
      header: "Due Date",
      accessorKey: "dueDate",
      sortable: true,
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="text-xs font-mono text-muted-foreground block">
            {new Date(row.dueDate).toLocaleDateString("en-IN")}
          </span>
          {row.status && <StatusBadge status={row.status} />}
        </div>
      ),
    },
    {
      id: "ageBracket",
      header: "Aging Status",
      accessorKey: "daysOverdue",
      sortable: true,
      cell: (row) => <AgingBadge daysOverdue={row.daysOverdue} bracket={row.ageBracket} />,
    },
    {
      id: "balanceAmount",
      header: "Due Balance",
      accessorKey: "balanceAmount",
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-bold font-mono text-rose-600 dark:text-rose-400 text-sm">
            ₹{row.balanceAmount.toLocaleString("en-IN")}
          </span>
          {row.lateFeeAmount > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
              (incl. ₹{row.lateFeeAmount.toLocaleString("en-IN")} fine)
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Band 1: Full-Dataset SQL Overdue Age Tracking Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MoneyKpi
          title="Total Outstanding"
          amount={totalDue}
          subtitle={`${totalCount} Matching Invoices`}
          icon={AlertTriangle}
          variant="danger"
          href="/school/due-fees"
        />

        <MoneyKpi
          title="Current Dues (0-30 Days)"
          amount={bracket0to30}
          subtitle="Recent / upcoming billings"
          icon={Clock}
          variant="primary"
          href="/school/due-fees?bracket=0-30"
        />

        <MoneyKpi
          title="Overdue (31-60 Days)"
          amount={bracket31to60}
          subtitle="First reminder window"
          icon={Clock}
          variant="warning"
          href="/school/due-fees?bracket=31-60"
        />

        <MoneyKpi
          title="Critical (60+ Days)"
          amount={bracket60plus}
          subtitle="Requires immediate follow-up"
          icon={AlertTriangle}
          variant="danger"
          href="/school/due-fees?bracket=60%2B"
        />
      </div>

      {/* Band 2: Priority Work List with URL-persistent Filters & Cursor Pagination */}
      <div className="bg-card p-5 rounded-3xl border border-border/40 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">
            Outstanding Fee Dues Ledger ({totalCount} matching • showing {items.length})
          </h2>
        </div>

        {/* FilterBar syncs q, ayId, classId, sectionId, bracket to URL searchParams */}
        <FilterBar
          searchPlaceholder="Search by student name, admission no, or invoice #..."
          filters={[
            {
              key: "ayId",
              label: "Session",
              options: academicYearsList.map((ay) => ({
                label: ay.isActive ? `${ay.label} (Active)` : ay.label,
                value: ay.id,
              })),
            },
            {
              key: "classId",
              label: "Class",
              options: classesList.map((c) => ({ label: c.label, value: c.id })),
            },
            {
              key: "sectionId",
              label: "Section",
              options: filteredSections.map((s) => ({ label: s.label, value: s.id })),
            },
            {
              key: "bracket",
              label: "Aging Bracket",
              options: [
                { label: "0-30 Days (Current)", value: "0-30" },
                { label: "31-60 Days (Overdue)", value: "31-60" },
                { label: "60+ Days (Critical)", value: "60+" },
              ],
            },
          ]}
        />

        {/* Advanced Work-List Filters (Fee Head, Term, Status, Due Date Range, Amount Range) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-1">
          <select
            value={activeFilters.feeHeadId || "ALL"}
            onChange={(e) => updateUrlParams({ feeHeadId: e.target.value })}
            aria-label="Fee Head Filter"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-border/40 bg-card text-foreground"
          >
            <option value="ALL">All Fee Heads</option>
            {feeHeadsList.map((fh) => (
              <option key={fh.id} value={fh.id}>
                {fh.label}
              </option>
            ))}
          </select>

          <select
            value={activeFilters.term || "ALL"}
            onChange={(e) => updateUrlParams({ term: e.target.value })}
            aria-label="Term Filter"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-border/40 bg-card text-foreground"
          >
            <option value="ALL">All Terms</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="HALF_YEARLY">Half Yearly</option>
            <option value="ANNUAL">Annual</option>
            <option value="ONE_TIME">One Time</option>
          </select>

          <select
            value={activeFilters.status || "ALL"}
            onChange={(e) => updateUrlParams({ status: e.target.value })}
            aria-label="Invoice Status Filter"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-border/40 bg-card text-foreground"
          >
            <option value="ALL">All Open Dues</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="DUE_TODAY">Due Today</option>
            <option value="OVERDUE">Overdue</option>
            <option value="PARTIAL">Partial</option>
            <option value="PENDING">Pending</option>
            <option value="WAIVED">Waived</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <input
            type="date"
            value={activeFilters.dueDateFrom || ""}
            onChange={(e) => updateUrlParams({ dueDateFrom: e.target.value || undefined })}
            title="Due Date From"
            aria-label="Due Date From"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-border/40 bg-card text-foreground"
          />

          <input
            type="date"
            value={activeFilters.dueDateTo || ""}
            onChange={(e) => updateUrlParams({ dueDateTo: e.target.value || undefined })}
            title="Due Date To"
            aria-label="Due Date To"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-border/40 bg-card text-foreground"
          />

          <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1 lg:col-span-2">
            <input
              type="number"
              min="0"
              placeholder="Min ₹"
              value={minDueInput}
              onChange={(e) => setMinDueInput(e.target.value)}
              onBlur={() => updateUrlParams({ minDue: minDueInput || undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateUrlParams({ minDue: minDueInput || undefined });
              }}
              className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-border/40 bg-card text-foreground"
            />
            <input
              type="number"
              min="0"
              placeholder="Max ₹"
              value={maxDueInput}
              onChange={(e) => setMaxDueInput(e.target.value)}
              onBlur={() => updateUrlParams({ maxDue: maxDueInput || undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateUrlParams({ maxDue: maxDueInput || undefined });
              }}
              className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-border/40 bg-card text-foreground"
            />
          </div>
        </div>

        {/* TanStack DataTable */}
        <DataTable
          data={items}
          columns={columns}
          selectable={true}
          searchKey=""
          onRowClick={(row) =>
            setSelectedStudentForDrawer({
              studentId: row.studentId,
              studentName: row.studentName,
              admissionNumber: row.admissionNumber,
              className: row.className,
            })
          }
          actions={(row) => (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() =>
                  setSelectedStudentForDrawer({
                    studentId: row.studentId,
                    studentName: row.studentName,
                    admissionNumber: row.admissionNumber,
                    className: row.className,
                  })
                }
                className="p-1.5 rounded-lg text-gray-500 hover:text-[#248A3D] dark:text-[#30D158] hover:bg-[#248A3D]/10 dark:hover:bg-muted/60 transition"
                title="View Full Student Ledger Drawer"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleReminderClick(row.id)}
                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-muted/60 transition"
                title="Dispatch Payment Reminder"
              >
                <Send className="w-4 h-4" />
              </button>

              <Link
                href="/school/collect-fees"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:text-black text-white transition active:scale-95 shadow-sm"
              >
                <CreditCard className="w-3 h-3" />
                <span>Collect</span>
              </Link>
            </div>
          )}
          emptyState={{
            title: "No Outstanding Dues Found",
            description: "No fee records match the selected aging bracket or filters.",
            actionLabel: "Clear Filters",
            actionHref: "/school/due-fees",
          }}
        />

        {/* Server Cursor Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
          <span>
            Showing {items.length} of {totalCount} matching invoices (page size {pageSize})
          </span>
          <div className="flex items-center gap-2">
            {activeCursor && (
              <button
                type="button"
                onClick={() => updateUrlParams({ cursor: undefined })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-card hover:bg-muted text-foreground font-semibold transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                First Page
              </button>
            )}
            {nextCursor && (
              <button
                type="button"
                onClick={() => updateUrlParams({ cursor: nextCursor })}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:text-black text-white font-semibold transition"
              >
                Next {pageSize}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Student Ledger Drawer Drill-down */}
      <StudentLedgerDrawer
        open={!!selectedStudentForDrawer}
        onOpenChange={(open) => !open && setSelectedStudentForDrawer(null)}
        studentId={selectedStudentForDrawer?.studentId || null}
        studentName={selectedStudentForDrawer?.studentName || ""}
        admissionNumber={selectedStudentForDrawer?.admissionNumber || ""}
        className={selectedStudentForDrawer?.className || ""}
      />
    </div>
  );
}
