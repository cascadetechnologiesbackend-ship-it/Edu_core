"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  generateConcessionSummaryReport,
  ConcessionSummaryReport,
} from "@schoolmitra/backend/lib/financialReportsEngine";
import ExcelJS from "exceljs";

/**
 * Retrieves the Concession & Waiver Summary Report.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL (read-only)
 */
export async function getConcessionSummaryReportAction(
  academicYearId?: string | null,
): Promise<{ success: boolean; data?: ConcessionSummaryReport; message?: string }> {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "ACCOUNTANT",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);

    const report = await generateConcessionSummaryReport(school.id, academicYearId);
    return { success: true, data: report };
  } catch (error: any) {
    console.error("getConcessionSummaryReportAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to generate concession summary report",
    };
  }
}

/**
 * Exports the Concession & Waiver Summary Report to Excel (.xlsx).
 * RBAC: STRICTLY SUPER_ADMIN and SCHOOL_ADMIN only.
 * ACCOUNTANT and PRINCIPAL receive 403 Unauthorized.
 */
export async function exportConcessionSummaryXlsxAction(
  academicYearId?: string | null,
): Promise<{ success: boolean; base64?: string; filename?: string; message?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const report = await generateConcessionSummaryReport(school.id, academicYearId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SchoolMitra Financial Engine";
    workbook.created = new Date();

    const timestamp = new Date().toISOString().split("T")[0];
    const sheet = workbook.addWorksheet("Concession & Waiver Summary");

    // Title Row
    sheet.mergeCells("A1:I1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `${report.schoolName.toUpperCase()} — CONCESSION & WAIVER SUMMARY REPORT`;
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 32;

    // Subtitle Row
    sheet.mergeCells("A2:I2");
    const subCell = sheet.getCell("A2");
    subCell.value = `Academic Session: ${report.academicYearName} | Generated: ${new Date(report.generatedAt).toLocaleString("en-IN")} | Source: Authoritative Fee Ledger`;
    subCell.font = { name: "Arial", size: 10, italic: true };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 20;

    // KPI Summary Block
    sheet.mergeCells("A4:C4");
    sheet.getCell("A4").value = "SUMMARY METRICS";
    sheet.getCell("A4").font = { bold: true, size: 11 };

    sheet.getRow(5).values = ["Gross Tuition Billed:", `₹${report.totalGross.toLocaleString("en-IN")}`];
    sheet.getRow(6).values = ["Total Concessions & Waivers:", `₹${report.totalConcessions.toLocaleString("en-IN")}`];
    sheet.getRow(7).values = ["Net Realized Revenue:", `₹${report.totalNetRealized.toLocaleString("en-IN")}`];
    sheet.getRow(8).values = ["Total Beneficiary Students:", report.totalBeneficiaries];
    sheet.getRow(9).values = ["Revenue Realization Rate:", `${report.overallRealizationRate.toFixed(1)}%`];

    // Table Header
    const tableHeaderRowNum = 11;
    sheet.getRow(tableHeaderRowNum).values = [
      "Policy Name",
      "Type",
      "Academic Term",
      "Class / Standard",
      "Beneficiaries",
      "Gross Billed (₹)",
      "Concession Granted (₹)",
      "Net Realized (₹)",
      "Realization %",
    ];

    const headerRow = sheet.getRow(tableHeaderRowNum);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
    headerRow.height = 25;

    sheet.columns = [
      { key: "policyName", width: 32 },
      { key: "concessionType", width: 16 },
      { key: "term", width: 16 },
      { key: "className", width: 22 },
      { key: "studentCount", width: 15, style: { alignment: { horizontal: "right" } } },
      { key: "grossAmount", width: 20, style: { numFmt: "₹#,##0.00" } },
      { key: "concessionAmount", width: 22, style: { numFmt: "₹#,##0.00" } },
      { key: "netRealized", width: 20, style: { numFmt: "₹#,##0.00" } },
      { key: "realizationRate", width: 16, style: { numFmt: "0.0%" } },
    ];

    let currentRowNum = tableHeaderRowNum + 1;
    for (const r of report.rows) {
      const row = sheet.getRow(currentRowNum);
      row.values = [
        r.policyName,
        r.concessionType,
        r.term,
        r.className,
        r.studentCount,
        r.grossAmount,
        r.concessionAmount,
        r.netRealized,
        r.realizationRate / 100, // Excel percentage requires decimal
      ];
      currentRowNum++;
    }

    // Totals Row
    const totalsRow = sheet.getRow(currentRowNum);
    totalsRow.values = [
      "TOTAL",
      "ALL POLICIES",
      "-",
      "ALL CLASSES",
      report.totalBeneficiaries,
      report.totalGross,
      report.totalConcessions,
      report.totalNetRealized,
      report.overallRealizationRate / 100,
    ];
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    totalsRow.height = 22;
    currentRowNum += 2;

    // Policy Breakdown Block
    sheet.getCell(`A${currentRowNum}`).value = "POLICY-WISE REVENUE FOREGONE BREAKDOWN";
    sheet.getCell(`A${currentRowNum}`).font = { bold: true, size: 11 };
    currentRowNum++;

    sheet.getRow(currentRowNum).values = ["Policy Name", "Type", "Concession Amount (₹)", "Students", "Share of Concessions (%)"];
    const pHeaderRow = sheet.getRow(currentRowNum);
    pHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    pHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B5563" } };
    currentRowNum++;

    for (const pb of report.policyBreakdown) {
      sheet.getRow(currentRowNum).values = [
        pb.policyName,
        pb.concessionType,
        pb.concessionAmount,
        pb.studentCount,
        pb.percentageOfTotal / 100,
      ];
      currentRowNum++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const safeSchoolName = school.name.replace(/[^a-zA-Z0-9]/g, "_");

    return {
      success: true,
      base64: Buffer.from(buffer).toString("base64"),
      filename: `Concession_Summary_${safeSchoolName}_${report.academicYearName.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.xlsx`,
    };
  } catch (error: any) {
    console.error("exportConcessionSummaryXlsxAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to export concession summary report",
    };
  }
}
