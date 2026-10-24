"use client";

import React, { createContext, useContext, useState } from "react";
import type { TeacherWorkspaceScopeResult } from "@/app/(teacher)/teacher/classes/classesActions";

export type WorkspaceMode = "homeroom" | "subject";

interface TeacherScopeContextValue {
  workspaceScope: TeacherWorkspaceScopeResult | null;
  activeWorkspace: WorkspaceMode;
  setActiveWorkspace: (mode: WorkspaceMode) => void;
  selectedAllocation: TeacherWorkspaceScopeResult["subjectAllocations"][0] | null;
  setSelectedAllocation: (
    alloc: TeacherWorkspaceScopeResult["subjectAllocations"][0] | null
  ) => void;
}

const TeacherScopeContext = createContext<TeacherScopeContextValue | null>(null);

export function TeacherScopeProvider({
  children,
  initialScope,
  initialMode,
}: {
  children: React.ReactNode;
  initialScope: TeacherWorkspaceScopeResult | null;
  initialMode?: WorkspaceMode | undefined;
}) {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>(
    initialMode || (initialScope?.homeroomSection ? "homeroom" : "subject")
  );

  const [selectedAllocation, setSelectedAllocation] = useState<
    TeacherWorkspaceScopeResult["subjectAllocations"][0] | null
  >(initialScope?.subjectAllocations[0] || null);

  return (
    <TeacherScopeContext.Provider
      value={{
        workspaceScope: initialScope,
        activeWorkspace,
        setActiveWorkspace,
        selectedAllocation,
        setSelectedAllocation,
      }}
    >
      {children}
    </TeacherScopeContext.Provider>
  );
}

export function useTeacherScope(): TeacherScopeContextValue {
  const context = useContext(TeacherScopeContext);
  if (!context) {
    throw new Error("useTeacherScope must be used within a TeacherScopeProvider");
  }
  return context;
}
