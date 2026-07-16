// ─── Report Card PDF Entry Point ─────────────────────────────────────────────
// Reads classGroup from the student's class and renders the correct template.

import React from "react";
import type { ClassGroup } from "../gradeEngine";
import { NurseryTemplate, type NurseryReportCardData } from "./templates/NurseryTemplate";
import { Class1to5Template, type Class1to5ReportData } from "./templates/Class1to5Template";
import { Class6to8Template, type Class6to8ReportData } from "./templates/Class6to8Template";
import { Class9to10Template, type Class9to10ReportData } from "./templates/Class9to10Template";

export type ReportCardData =
  | { classGroup: "NURSERY_UKG"; data: NurseryReportCardData }
  | { classGroup: "CLASS_1_5"; data: Class1to5ReportData }
  | { classGroup: "CLASS_6_8"; data: Class6to8ReportData }
  | { classGroup: "CLASS_9_10"; data: Class9to10ReportData };

export function ReportCardPDF({ payload }: { payload: ReportCardData }) {
  switch (payload.classGroup) {
    case "NURSERY_UKG":
      return <NurseryTemplate data={payload.data} />;
    case "CLASS_1_5":
      return <Class1to5Template data={payload.data} />;
    case "CLASS_6_8":
      return <Class6to8Template data={payload.data} />;
    case "CLASS_9_10":
      return <Class9to10Template data={payload.data} />;
    default: {
      throw new Error(`Unknown class group`);
    }
  }
}

/**
 * Maps a grade level string (from the database) to the correct class group.
 */
export function gradeToClassGroup(gradeLevel: string): ClassGroup {
  if (["NURSERY", "LKG", "UKG"].includes(gradeLevel)) return "NURSERY_UKG";
  if (["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5"].includes(gradeLevel)) return "CLASS_1_5";
  if (["CLASS_6", "CLASS_7", "CLASS_8"].includes(gradeLevel)) return "CLASS_6_8";
  if (["CLASS_9", "CLASS_10"].includes(gradeLevel)) return "CLASS_9_10";
  throw new Error(`Unknown grade level: ${gradeLevel}`);
}
