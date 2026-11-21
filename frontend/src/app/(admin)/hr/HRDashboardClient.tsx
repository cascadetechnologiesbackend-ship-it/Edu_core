"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  DollarSign,
  GraduationCap,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { OverviewTab } from "./tabs/OverviewTab";
import { StaffTab } from "./tabs/StaffTab";
import { AllocationsTab } from "./tabs/AllocationsTab";
import { StructureTab } from "./tabs/StructureTab";
import { LeavesTab } from "./tabs/LeavesTab";
import { PayrollTab } from "./tabs/PayrollTab";
import { SettingsTab } from "./tabs/SettingsTab";

export type HRTabKey =
  | "overview"
  | "directory"
  | "allocations"
  | "structure"
  | "leaves"
  | "payroll"
  | "settings";

const VALID_TABS: HRTabKey[] = [
  "overview",
  "directory",
  "allocations",
  "structure",
  "leaves",
  "payroll",
  "settings",
];

// Map legacy tab keys to new hub spokes
function normalizeTab(raw: string | null): HRTabKey {
  if (!raw) return "overview";
  if (raw === "staff") return "directory";
  if (raw === "departments" || raw === "designations") return "structure";
  if (raw === "templates") return "settings";
  if (VALID_TABS.includes(raw as HRTabKey)) return raw as HRTabKey;
  return "overview";
}

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
  allocStats?: {
    totalSections: number;
    sectionsWithClassTeacher: number;
    sectionsWithoutClassTeacher: number;
    uniqueSubjectAllocatedTeachers: number;
  };
  teacherAllocSummary?: Record<string, { classTeacherOf: string[]; subjectCount: number }>;
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
  allocStats = {
    totalSections: 0,
    sectionsWithClassTeacher: 0,
    sectionsWithoutClassTeacher: 0,
    uniqueSubjectAllocatedTeachers: 0,
  },
  teacherAllocSummary = {},
}: HRDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const userRole = session?.user?.role;

  // Defensive client guard: TEACHER role should never see HR hub
  if (userRole === "TEACHER") {
    return null;
  }

  // Authorization checks
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isSchoolAdmin = userRole === "SCHOOL_ADMIN";
  const isHRManager = userRole === "HR_MANAGER";
  const isPrincipal = userRole === "PRINCIPAL";

  const isAuthorizedHR = isSuperAdmin || isSchoolAdmin || isHRManager;
  const isAuthorizedLock = isPrincipal || isSuperAdmin || isSchoolAdmin;

  // Role permissions per OD2
  const canViewPayroll = isSuperAdmin || isSchoolAdmin || isHRManager;
  const canViewSettings = isSuperAdmin || isSchoolAdmin;

  // Read initial tab from search param or default to 'overview' (OD4)
  const initialTab = normalizeTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<HRTabKey>(initialTab);

  // Sync state if URL changes externally
  useEffect(() => {
    const normalized = normalizeTab(searchParams.get("tab"));
    if (normalized !== activeTab) {
      setActiveTab(normalized);
    }
  }, [searchParams]);

  const handleTabChange = (tab: HRTabKey) => {
    setActiveTab(tab);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const pendingLeavesCount = leaveRequests.filter((r) => r.status === "PENDING").length;

  // Build tabs dynamically based on OD2 role visibility matrix
  const allTabs: Array<{
    id: HRTabKey;
    label: string;
    icon: LucideIcon;
    count?: number | undefined;
    badgeColor?: string | undefined;
    visible: boolean;
  }> = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: "directory",
      label: "Staff Directory",
      icon: Users,
      count: staffList.length,
      visible: true,
    },
    {
      id: "allocations",
      label: "Allocations",
      icon: GraduationCap,
      count: allocStats.sectionsWithoutClassTeacher > 0 ? allocStats.sectionsWithoutClassTeacher : undefined,
      badgeColor: allocStats.sectionsWithoutClassTeacher > 0 ? "bg-amber-500 text-white" : undefined,
      visible: true,
    },
    {
      id: "structure",
      label: "Structure",
      icon: Building2,
      count: departments.length,
      visible: true,
    },
    {
      id: "leaves",
      label: "Leave Approvals",
      icon: CalendarDays,
      count: pendingLeavesCount > 0 ? pendingLeavesCount : undefined,
      badgeColor: pendingLeavesCount > 0 ? "bg-amber-500 text-white" : undefined,
      visible: true,
    },
    {
      id: "payroll",
      label: "Payroll & Disbursals",
      icon: DollarSign,
      count: payrollRuns.length,
      visible: canViewPayroll,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      count: salaryTemplates.length,
      visible: canViewSettings,
    },
  ];

  const visibleTabs = allTabs.filter((t) => t.visible);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Human Resources & Staff Operations
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {school?.name || "SchoolMitra ERP"}
                {activeYear?.label ? ` • Academic Year ${activeYear.label}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hub Spokes Navigation Bar (Apple Segmented Bar) */}
      <div className="bg-muted/40 p-1.5 rounded-2xl border border-border/40 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1" aria-label="HR Hub Spokes">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-2 px-3.5 sm:px-4 text-xs font-semibold whitespace-nowrap transition-all outline-none rounded-xl min-h-[44px] ${
                  isActive
                    ? "bg-card text-foreground shadow-level-1 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                      tab.badgeColor
                        ? tab.badgeColor
                        : isActive
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        : "bg-muted text-muted-foreground"
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

      {/* Active Spoke Content */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <OverviewTab
            staffList={staffList}
            departments={departments}
            leaveRequests={leaveRequests}
            allocStats={allocStats}
            school={school}
            activeYear={activeYear}
            onTabChange={(tab) => handleTabChange(tab as HRTabKey)}
          />
        )}

        {activeTab === "directory" && (
          <StaffTab
            staffList={staffList}
            departments={departments}
            designations={designations}
            isAuthorizedHR={isAuthorizedHR}
            school={school}
            teacherAllocSummary={teacherAllocSummary}
            onRefresh={() => router.refresh()}
          />
        )}

        {activeTab === "allocations" && (
          <AllocationsTab
            teacherAllocSummary={teacherAllocSummary}
            isAuthorizedHR={isAuthorizedHR}
            schoolId={school?.id || ""}
          />
        )}

        {activeTab === "structure" && (
          <StructureTab
            departments={departments}
            designations={designations}
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

        {activeTab === "payroll" && canViewPayroll && (
          <PayrollTab
            payrollRuns={payrollRuns}
            staffList={staffList}
            isAuthorizedHR={isAuthorizedHR}
            isAuthorizedLock={isAuthorizedLock}
            onRefresh={() => router.refresh()}
          />
        )}

        {activeTab === "settings" && canViewSettings && (
          <SettingsTab
            salaryTemplates={salaryTemplates}
            staffList={staffList}
            isAuthorizedHR={isAuthorizedHR}
            onRefresh={() => router.refresh()}
          />
        )}
      </div>
    </div>
  );
}
