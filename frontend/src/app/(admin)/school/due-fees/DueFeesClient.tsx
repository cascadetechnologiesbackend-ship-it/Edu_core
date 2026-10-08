"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Send,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  CheckCircle2,
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
  daysOverdue: number;
  ageBracket: "0-30" | "31-60" | "60+";
  reminderSent: boolean;
}

export function DueFeesClient({
  items,
  totalDue,
  bracket0to30,
  bracket31to60,
  bracket60plus,
  classesList,
  activeClassId,
  activeBracket,
}: {
  items: DueFeeRow[];
  totalDue: number;
  bracket0to30: number;
  bracket31to60: number;
  bracket60plus: number;
  classesList: Array<{ id: string; label: string }>;
  activeClassId?: string | undefined;
  activeBracket?: string | undefined;
}) {
  const router = useRouter();

  // Drawer State
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    className: string;
  } | null>(null);

  // Client search term for instant filtering
  const [clientSearch, setClientSearch] = useState("");

  const filteredItems = useMemo(() => {
    if (!clientSearch.trim()) return items;
    const query = clientSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.studentName.toLowerCase().includes(query) ||
        item.admissionNumber.toLowerCase().includes(query) ||
        item.invoiceNumber.toLowerCase().includes(query) ||
        item.className.toLowerCase().includes(query)
    );
  }, [items, clientSearch]);

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
            className="font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition"
          >
            {row.studentName}
          </button>
          <p className="text-xs text-gray-400 font-mono">Adm #{row.admissionNumber}</p>
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
          <span className="font-semibold text-xs text-gray-900 dark:text-white">{row.feeHeadName}</span>
          <p className="text-[11px] text-gray-400 font-mono">#{row.invoiceNumber}</p>
        </div>
      ),
    },
    {
      id: "dueDate",
      header: "Due Date",
      accessorKey: "dueDate",
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-mono text-gray-600 dark:text-slate-300">
          {new Date(row.dueDate).toLocaleDateString("en-IN")}
        </span>
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
        <span className="font-bold font-mono text-rose-600 dark:text-rose-400 text-sm">
          ₹{row.balanceAmount.toLocaleString("en-IN")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Band 1: Overdue Age Tracking Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MoneyKpi
          title="Total Outstanding"
          amount={totalDue}
          subtitle={`${items.length} Pending Invoices`}
          icon={AlertTriangle}
          variant="danger"
          href="/school/due-fees"
        />

        <MoneyKpi
          title="Current Dues (0-30 Days)"
          amount={bracket0to30}
          subtitle="Recent term billings"
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
          href="/school/due-fees?bracket=60+"
        />
      </div>

      {/* Band 2: Priority Work List with URL-persistent Filters & DataTable */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Outstanding Fee Dues Ledger ({filteredItems.length})
          </h2>
        </div>

        {/* FilterBar with URL query sync and debounced search */}
        <FilterBar
          searchPlaceholder="Filter by student name, admission no, or invoice..."
          onSearchChange={setClientSearch}
          filters={[
            {
              key: "classId",
              label: "Class",
              options: classesList.map((c) => ({ label: c.label, value: c.id })),
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

        {/* TanStack DataTable */}
        <DataTable
          data={filteredItems}
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
                className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                title="View Full Student Ledger Drawer"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleReminderClick(row.id)}
                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition"
                title="Dispatch Payment Reminder"
              >
                <Send className="w-4 h-4" />
              </button>

              <Link
                href="/school/collect-fees"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 shadow-sm"
              >
                <CreditCard className="w-3 h-3" />
                <span>Collect</span>
              </Link>
            </div>
          )}
          emptyState={{
            title: "No Outstanding Dues Found",
            description: "No fee records match the selected aging bracket or class filters.",
            actionLabel: "Clear Filters",
            actionHref: "/school/due-fees",
          }}
        />
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
