"use client";

import React, { useState } from "react";
import {
  ListOrdered,
  Table,
  Clock,
  Percent,
  Receipt,
  Sparkles,
} from "lucide-react";
import { FeeHeadsMaster } from "./FeeHeadsMaster";
import { ClassFeePricingMatrix } from "./ClassFeePricingMatrix";
import Link from "next/link";

interface ClassItem {
  id: string;
  displayName: string;
  gradeLevel: string;
  sortOrder: number;
}

interface FeeHeadItem {
  id: string;
  name: string;
  code: string | null;
  priority: number;
  description: string | null;
  category: string;
  headType: string;
  discountEligible: boolean;
  lateFineEligible: boolean;
  isRefundable: boolean;
  isTaxable: boolean;
  gstPercentage: string | null;
  isActive: boolean;
}

interface ExistingStructureItem {
  id: string;
  classId: string;
  feeHeadId: string;
  term: "ANNUAL" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ONE_TIME";
  amount: string;
  dueDate: string | Date;
}

interface AcademicYearItem {
  id: string;
  label: string;
  isActive: boolean;
}

interface FeeSetupWorkspaceProps {
  activeYear: AcademicYearItem;
  allAcademicYears: AcademicYearItem[];
  classes: ClassItem[];
  feeHeads: FeeHeadItem[];
  existingStructures: ExistingStructureItem[];
}

export function FeeSetupWorkspace({
  activeYear,
  allAcademicYears,
  classes,
  feeHeads,
  existingStructures,
}: FeeSetupWorkspaceProps) {
  // If heads are already populated, default to Tab 2 (Pricing Matrix), else Tab 1 (Fee Heads Master)
  const [activeTab, setActiveTab] = useState<"heads" | "matrix" | "lateFine" | "concessions" | "tax">(
    feeHeads.length > 0 ? "matrix" : "heads"
  );

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs matching Screenshot 2 */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto pb-px" aria-label="Tabs">
          {/* Tab 1 */}
          <button
            type="button"
            onClick={() => setActiveTab("heads")}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "heads"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            Fee Heads Master & Allocation Priorities ({feeHeads.length})
          </button>

          {/* Tab 2 */}
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "matrix"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <Table className="w-4 h-4" />
            Class-Wise Fee Pricing Matrix ({classes.length} Grades)
          </button>

          {/* Tab 3: Late Fine Engine */}
          <button
            type="button"
            onClick={() => setActiveTab("lateFine")}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "lateFine"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            Late Fine Engine & Simulator
          </button>

          {/* Tab 4: Concessions */}
          <button
            type="button"
            onClick={() => setActiveTab("concessions")}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "concessions"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <Percent className="w-4 h-4" />
            Concession & Sibling Rules
          </button>

          {/* Tab 5: Tax & GST */}
          <button
            type="button"
            onClick={() => setActiveTab("tax")}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === "tax"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Tax Statutory & GST Claims
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === "heads" && <FeeHeadsMaster feeHeads={feeHeads} />}

      {activeTab === "matrix" && (
        <ClassFeePricingMatrix
          activeYear={activeYear}
          allAcademicYears={allAcademicYears}
          classes={classes}
          feeHeads={feeHeads}
          existingStructures={existingStructures}
        />
      )}

      {activeTab === "lateFine" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center space-y-4">
          <Clock className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Late Fine Compounding Engine
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Configured fee heads marked as &quot;Late Fine Eligible&quot; automatically incur penalties when invoices cross their due date plus grace days. The compounding engine executes via daily automated cron.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setActiveTab("matrix")}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Configure due dates in Class-Wise Pricing Matrix &rarr;
            </button>
          </div>
        </div>
      )}

      {activeTab === "concessions" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center space-y-4">
          <Percent className="w-12 h-12 text-purple-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Student Concessions & Scholarships
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Fee concessions (Staff Ward, Sibling, RTE 100%, Merit Scholarships) apply discounts against fee heads marked as &quot;Discount Eligible&quot;.
          </p>
          <div className="pt-2">
            <Link
              href="/fees/concessions"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
            >
              Open Concessions & Scholarships Manager &rarr;
            </Link>
          </div>
        </div>
      )}

      {activeTab === "tax" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center space-y-4">
          <Receipt className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Tax Statutory & GST Claims
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Indian GST Act exempts primary & secondary education (Tuition, Admission), while taxable commercial activities (Transport, Uniforms, Books) can have GST percentages configured in the Fee Heads Master.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setActiveTab("heads")}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              View taxable heads in Fee Heads Master &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
