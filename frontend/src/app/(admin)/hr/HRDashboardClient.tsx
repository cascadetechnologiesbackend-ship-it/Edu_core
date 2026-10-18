"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Users,
  Building2,
  Award,
  FileText,
  CalendarDays,
  DollarSign,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { StaffTab } from "./tabs/StaffTab";
import { DepartmentsTab } from "./tabs/DepartmentsTab";
import { DesignationsTab } from "./tabs/DesignationsTab";
import { TemplatesTab } from "./tabs/TemplatesTab";
import { LeavesTab } from "./tabs/LeavesTab";
import { PayrollTab } from "./tabs/PayrollTab";

type HRTabKey = "staff" | "departments" | "designations" | "templates" | "leaves" | "payroll";

interface HRDashboardClientProps {
  session: any;
  activeYear: any;
  school: any;
  staffList: any[];
  departments: any[];
  designations: any[];
  leaveTypes: any[];
  leaveRequests: any[];
  salaryTemplates: any[];
  payrollRuns: any[];
}

export default function HRDashboardClient({
  session,
  activeYear,
  school,
  staffList,
  departments,
  designations,
  leaveTypes,
  leaveRequests,
  salaryTemplates,
  payrollRuns,
}: HRDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Read initial tab from search param or default to 'staff'
  const initialTab = (searchParams.get("tab") as HRTabKey) || "staff";
  const [activeTab, setActiveTab] = useState<HRTabKey>(
    ["staff", "departments", "designations", "templates", "leaves", "payroll"].includes(initialTab)
      ? initialTab
      : "staff"
  );

  // Sync state if URL changes externally
  useEffect(() => {
    const tabParam = searchParams.get("tab") as HRTabKey;
    if (
      tabParam &&
      tabParam !== activeTab &&
      ["staff", "departments", "designations", "templates", "leaves", "payroll"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Authorization checks
  const isAuthorizedHR =
    session?.user?.role === "HR_MANAGER" ||
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "SCHOOL_ADMIN";

  const isAuthorizedLock =
    session?.user?.role === "PRINCIPAL" ||
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "SCHOOL_ADMIN";

  const handleTabChange = (tab: HRTabKey) => {
    setActiveTab(tab);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const pendingLeavesCount = leaveRequests.filter((r) => r.status === "PENDING").length;

  const tabs: Array<{
    id: HRTabKey;
    label: string;
    icon: LucideIcon;
    count?: number | undefined;
    badgeColor?: string | undefined;
  }> = [
    {
      id: "staff",
      label: "Staff Directory",
      icon: Users,
      count: staffList.length,
    },
    {
      id: "departments",
      label: "Departments",
      icon: Building2,
      count: departments.length,
    },
    {
      id: "designations",
      label: "Designations",
      icon: Award,
      count: designations.length,
    },
    {
      id: "templates",
      label: "Salary Templates",
      icon: FileText,
      count: salaryTemplates.length,
    },
    {
      id: "leaves",
      label: "Leave Approvals",
      icon: CalendarDays,
      count: pendingLeavesCount,
      badgeColor: pendingLeavesCount > 0 ? "bg-amber-500 text-white" : undefined,
    },
    {
      id: "payroll",
      label: "Payroll & Disbursals",
      icon: DollarSign,
      count: payrollRuns.length,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Human Resources & Staff Operations
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {school?.name || "SchoolMitra ERP"}
                {activeYear?.label ? ` • Academic Year ${activeYear.label}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modular Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pb-px" aria-label="HR Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 border-b-2 text-xs font-semibold whitespace-nowrap transition-all outline-none min-h-[44px] ${
                  isActive
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-t-xl"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      tab.badgeColor
                        ? tab.badgeColor
                        : isActive
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab View */}
      <div className="pt-2">
        {activeTab === "staff" && (
          <StaffTab
            staffList={staffList}
            departments={departments}
            designations={designations}
            isAuthorizedHR={isAuthorizedHR}
            school={school}
            onRefresh={() => router.refresh()}
          />
        )}

        {activeTab === "departments" && (
          <DepartmentsTab
            departments={departments}
            isAuthorizedHR={isAuthorizedHR}
            onRefresh={() => router.refresh()}
          />
        )}

        {activeTab === "designations" && (
          <DesignationsTab
            designations={designations}
            departments={departments}
            isAuthorizedHR={isAuthorizedHR}
            onRefresh={() => router.refresh()}
          />
        )}

        {activeTab === "templates" && (
          <TemplatesTab
            salaryTemplates={salaryTemplates}
            staffList={staffList}
            isAuthorizedHR={isAuthorizedHR}
            onRefresh={() => router.refresh()}
          />
        )}

        {activeTab === "leaves" && (
          <LeavesTab
            leaveRequests={leaveRequests}
            leaveTypes={leaveTypes}
            staffList={staffList}
            isAuthorizedHR={isAuthorizedHR}
            onRefresh={() => router.refresh()}
          />
        )}

        {activeTab === "payroll" && (
          <PayrollTab
            payrollRuns={payrollRuns}
            staffList={staffList}
            isAuthorizedHR={isAuthorizedHR}
            isAuthorizedLock={isAuthorizedLock}
            onRefresh={() => router.refresh()}
          />
        )}
      </div>
    </div>
  );
}
