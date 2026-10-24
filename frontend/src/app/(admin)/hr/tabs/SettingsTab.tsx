"use client";

import React from "react";
import { TemplatesTab } from "./TemplatesTab";

interface SettingsTabProps {
  salaryTemplates: any[];
  staffList: any[];
  isAuthorizedHR: boolean;
  onRefresh?: (() => void) | undefined;
}

export function SettingsTab({
  salaryTemplates,
  staffList,
  isAuthorizedHR,
  onRefresh,
}: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
          HR Configuration & Salary Templates
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage salary structure templates, statutory deduction percentages, and default allowances.
        </p>
      </div>

      <TemplatesTab
        salaryTemplates={salaryTemplates}
        staffList={staffList}
        isAuthorizedHR={isAuthorizedHR}
        onRefresh={onRefresh}
      />
    </div>
  );
}
