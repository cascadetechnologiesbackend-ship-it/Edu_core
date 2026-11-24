"use client";

import React, { useState } from "react";
import { Building2, Award } from "lucide-react";
import { DepartmentsTab } from "./DepartmentsTab";
import { DesignationsTab } from "./DesignationsTab";

interface StructureTabProps {
  departments: any[];
  designations: any[];
  isAuthorizedHR: boolean;
  onRefresh?: (() => void) | undefined;
}

type StructureSubTab = "departments" | "designations";

export function StructureTab({
  departments,
  designations,
  isAuthorizedHR,
  onRefresh,
}: StructureTabProps) {
  const [subTab, setSubTab] = useState<StructureSubTab>("departments");

  return (
    <div className="space-y-6">
      {/* Sub-tab selector */}
      <div className="flex border-b border-border/40 dark:border-border/40 gap-1">
        <button
          type="button"
          onClick={() => setSubTab("departments")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
            subTab === "departments"
              ? "border-[#B45309] text-[#B45309] dark:text-[#FFD60A] dark:border-[#FFD60A]"
              : "border-transparent text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-muted/50 text-muted-foreground dark:bg-muted/60 dark:text-muted-foreground">
            {departments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("designations")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
            subTab === "designations"
              ? "border-[#B45309] text-[#B45309] dark:text-[#FFD60A] dark:border-[#FFD60A]"
              : "border-transparent text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Designations</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-muted/50 text-muted-foreground dark:bg-muted/60 dark:text-muted-foreground">
            {designations.length}
          </span>
        </button>
      </div>

      {/* Sub-tab View */}
      {subTab === "departments" && (
        <DepartmentsTab
          departments={departments}
          isAuthorizedHR={isAuthorizedHR}
          onRefresh={onRefresh}
        />
      )}

      {subTab === "designations" && (
        <DesignationsTab
          designations={designations}
          departments={departments}
          isAuthorizedHR={isAuthorizedHR}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
