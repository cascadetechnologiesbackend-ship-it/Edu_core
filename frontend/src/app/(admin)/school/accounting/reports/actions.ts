"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  generateTrialBalanceReport,
  generateIncomeExpenditureReport,
  generateBalanceSheetReport,
  TrialBalanceReport,
  IncomeExpenditureReport,
  BalanceSheetReport,
} from "@schoolmitra/backend/lib/financialReportsEngine";
import ExcelJS from "exceljs";

export interface ReportFilterInput {
  startDate?: string | undefined;
  endDate?: string | undefined;
  asOfDate?: string | undefined;
}

/**
 * Retrieves the Trial Balance report.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL (read-only)
 */
export async function getTrialBalanceAction(
  filters?: ReportFilterInput,
): Promise<{ success: boolean; data?: TrialBalanceReport; message?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const report = await generateTrialBalanceReport(school.id, {
      startDate: filters?.startDate || null,
      endDate: filters?.endDate || null,
    });

    return { success: true, data: report };
  } catch (error: any) {
    console.error("getTrialBalanceAction error:", error);
    return { success: false, message: error.message || "Failed to generate Trial Balance" };
  }
}

/**
 * Retrieves the Income & Expenditure statement.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL (read-only)
 */
export async function getIncomeExpenditureAction(
  filters?: ReportFilterInput,
): Promise<{ success: boolean; data?: IncomeExpenditureReport; message?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const report = await generateIncomeExpenditureReport(school.id, {
      startDate: filters?.startDate || null,
      endDate: filters?.endDate || null,
    });

    return { success: true, data: report };
  } catch (error: any) {
    console.error("getIncomeExpenditureAction error:", error);
    return { success: false, message: error.message || "Failed to generate Income & Expenditure statement" };
  }
}

/**
 * Retrieves the Balance Sheet report.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL (read-only)
 */
export async function getBalanceSheetAction(
  filters?: ReportFilterInput,
): Promise<{ success: boolean; data?: BalanceSheetReport; message?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const report = await generateBalanceSheetReport(school.id, {
      asOfDate: filters?.asOfDate || filters?.endDate || null,
    });

    return { success: true, data: report };
  } catch (error: any) {
    console.error("getBalanceSheetAction error:", error);
    return { success: false, message: error.message || "Failed to generate Balance Sheet" };
  }
}

export interface ExportReportParams {
  reportType: "TRIAL_BALANCE" | "INCOME_EXPENDITURE" | "BALANCE_SHEET";
  startDate?: string | undefined;
  endDate?: string | undefined;
  asOfDate?: string | undefined;
}

/**
 * Generates an Excel workbook (.xlsx) for the requested financial statement.
 * RBAC: Admins only (SUPER_ADMIN, SCHOOL_ADMIN).
 */
export async function exportFinancialReportExcelAction(
  params: ExportReportParams,
): Promise<{ success: boolean; base64?: string; filename?: string; message?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SchoolMitra Financial Engine";
    workbook.created = new Date();

    const timestamp = new Date().toISOString().split("T")[0];

    if (params.reportType === "TRIAL_BALANCE") {
      const data = await generateTrialBalanceReport(school.id, {
        startDate: params.startDate || null,
        endDate: params.endDate || null,
      });

      const sheet = workbook.addWorksheet("Trial Balance");

      // Title & School Header
      sheet.mergeCells("A1:E1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = `${data.schoolName.toUpperCase()} — TRIAL BALANCE`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 30;

      sheet.mergeCells("A2:E2");
      const subCell = sheet.getCell("A2");
      const periodStr = data.startDate || data.endDate
        ? `Period: ${data.startDate?.split("T")[0] || "Inception"} to ${data.endDate?.split("T")[0] || "Present"}`
        : "All Historic Periods";
      subCell.value = `${periodStr} | Generated: ${new Date(data.generatedAt).toLocaleString("en-IN")}`;
      subCell.font = { name: "Arial", size: 10, italic: true };
      subCell.alignment = { horizontal: "center" };
      sheet.getRow(2).height = 20;

      // Table Header
      sheet.getRow(4).values = ["Account Code", "Account Name", "Classification", "Debit (₹)", "Credit (₹)"];
      const headerRow = sheet.getRow(4);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
      headerRow.height = 24;

      sheet.columns = [
        { key: "code", width: 16 },
        { key: "name", width: 38 },
        { key: "type", width: 18 },
        { key: "debit", width: 18, style: { numFmt: "₹#,##0.00" } },
        { key: "credit", width: 18, style: { numFmt: "₹#,##0.00" } },
      ];

      data.rows.forEach((row) => {
        sheet.addRow({
          code: row.code,
          name: row.name,
          type: row.type,
          debit: row.netDebit,
          credit: row.netCredit,
        });
      });

      // Total Row
      const totalRow = sheet.addRow({
        code: "TOTAL",
        name: "Sum of Balances",
        type: data.isBalanced ? "BALANCED" : "DISCREPANCY",
        debit: data.totalDebits,
        credit: data.totalCredits,
      });
      totalRow.font = { bold: true };
      totalRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: data.isBalanced ? "FFE5E7EB" : "FFFECACA" },
      };

      // Discrepancy Alert Row if out of balance
      if (!data.isBalanced) {
        const discRow = sheet.addRow({
          code: "ALERT",
          name: "UNBALANCED TRIAL BALANCE DISCREPANCY",
          type: "OUT OF EQUILIBRIUM",
          debit: data.discrepancy,
          credit: 0,
        });
        discRow.font = { bold: true, color: { argb: "FF991B1B" } };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        success: true,
        base64: Buffer.from(buffer).toString("base64"),
        filename: `Trial_Balance_${school.name.replace(/\s+/g, "_")}_${timestamp}.xlsx`,
      };
    }

    if (params.reportType === "INCOME_EXPENDITURE") {
      const data = await generateIncomeExpenditureReport(school.id, {
        startDate: params.startDate || null,
        endDate: params.endDate || null,
      });

      const sheet = workbook.addWorksheet("Income & Expenditure");

      // Title
      sheet.mergeCells("A1:C1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = `${data.schoolName.toUpperCase()} — INCOME & EXPENDITURE STATEMENT`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 30;

      sheet.columns = [
        { key: "code", width: 18 },
        { key: "name", width: 44 },
        { key: "amount", width: 22, style: { numFmt: "₹#,##0.00" } },
      ];

      // Income Section
      sheet.addRow([]);
      const incHeader = sheet.addRow(["", "A. INCOME & REVENUE HEADS", ""]);
      incHeader.font = { bold: true, size: 12, color: { argb: "FF065F46" } };

      data.incomeRows.forEach((r) => {
        sheet.addRow([r.code, r.name, r.netCredit > 0 ? r.netCredit : -r.netDebit]);
      });
      const totalIncRow = sheet.addRow(["", "Total Revenue (A)", data.totalIncome]);
      totalIncRow.font = { bold: true };

      // Expenditure Section
      sheet.addRow([]);
      const expHeader = sheet.addRow(["", "B. EXPENDITURE & OPERATING EXPENSES", ""]);
      expHeader.font = { bold: true, size: 12, color: { argb: "FF991B1B" } };

      data.expenditureRows.forEach((r) => {
        sheet.addRow([r.code, r.name, r.netDebit > 0 ? r.netDebit : -r.netCredit]);
      });
      const totalExpRow = sheet.addRow(["", "Total Expenditure (B)", data.totalExpenditure]);
      totalExpRow.font = { bold: true };

      // Net Surplus / Deficit
      sheet.addRow([]);
      const netRow = sheet.addRow([
        "",
        data.isSurplus ? "NET OPERATING SURPLUS (A - B)" : "NET OPERATING DEFICIT (A - B)",
        data.netSurplus,
      ]);
      netRow.font = { bold: true, size: 12, color: { argb: data.isSurplus ? "FF065F46" : "FF991B1B" } };
      netRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: data.isSurplus ? "FFD1FAE5" : "FFFEE2E2" },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        success: true,
        base64: Buffer.from(buffer).toString("base64"),
        filename: `Income_Expenditure_${school.name.replace(/\s+/g, "_")}_${timestamp}.xlsx`,
      };
    }

    if (params.reportType === "BALANCE_SHEET") {
      const data = await generateBalanceSheetReport(school.id, {
        asOfDate: params.asOfDate || params.endDate || null,
      });

      const sheet = workbook.addWorksheet("Balance Sheet");

      sheet.mergeCells("A1:C1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = `${data.schoolName.toUpperCase()} — BALANCE SHEET`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 30;

      sheet.columns = [
        { key: "code", width: 18 },
        { key: "name", width: 44 },
        { key: "amount", width: 22, style: { numFmt: "₹#,##0.00" } },
      ];

      // Assets
      sheet.addRow([]);
      const assetHeader = sheet.addRow(["", "1. ASSETS & RECEIVABLES", ""]);
      assetHeader.font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };

      data.assetRows.forEach((r) => {
        sheet.addRow([r.code, r.name, r.netDebit > 0 ? r.netDebit : -r.netCredit]);
      });
      const totalAssetRow = sheet.addRow(["", "TOTAL ASSETS (1)", data.totalAssets]);
      totalAssetRow.font = { bold: true };
      totalAssetRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };

      // Liabilities
      sheet.addRow([]);
      const liabHeader = sheet.addRow(["", "2. LIABILITIES & DEPOSITS", ""]);
      liabHeader.font = { bold: true, size: 12, color: { argb: "FF9A3412" } };

      data.liabilityRows.forEach((r) => {
        sheet.addRow([r.code, r.name, r.netCredit > 0 ? r.netCredit : -r.netDebit]);
      });
      const totalLiabRow = sheet.addRow(["", "Total Liabilities (2A)", data.totalLiabilities]);
      totalLiabRow.font = { bold: true };

      // Equity
      sheet.addRow([]);
      const eqHeader = sheet.addRow(["", "3. EQUITY & ACCUMULATED RESERVES", ""]);
      eqHeader.font = { bold: true, size: 12, color: { argb: "FF4C1D95" } };

      data.equityRows.forEach((r) => {
        sheet.addRow([r.code, r.name, r.netCredit > 0 ? r.netCredit : -r.netDebit]);
      });
      sheet.addRow(["3999", "Current Period Operating Surplus/(Deficit)", data.currentPeriodSurplus]);
      const totalEqRow = sheet.addRow(["", "Total Equity & Reserves (2B)", data.totalEquityAndSurplus]);
      totalEqRow.font = { bold: true };

      // Total Liabilities + Equity
      sheet.addRow([]);
      const totalLiabEqRow = sheet.addRow([
        "",
        "TOTAL LIABILITIES & EQUITY (2A + 2B)",
        data.totalLiabilitiesAndEquity,
      ]);
      totalLiabEqRow.font = { bold: true, size: 11 };
      totalLiabEqRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FF" } };

      // Tie Out Check
      sheet.addRow([]);
      const tieRow = sheet.addRow([
        "EQUILIBRIUM",
        data.isTiedOut ? "BALANCE SHEET TIED OUT (Assets == Liab + Equity)" : "TIE-OUT IMBALANCE DETECTED",
        data.tieOutDifference,
      ]);
      tieRow.font = { bold: true, color: { argb: data.isTiedOut ? "FF065F46" : "FF991B1B" } };
      tieRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: data.isTiedOut ? "FFD1FAE5" : "FFFEE2E2" },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        success: true,
        base64: Buffer.from(buffer).toString("base64"),
        filename: `Balance_Sheet_${school.name.replace(/\s+/g, "_")}_${timestamp}.xlsx`,
      };
    }

    return { success: false, message: "Invalid report type specified" };
  } catch (error: any) {
    console.error("exportFinancialReportExcelAction error:", error);
    return { success: false, message: error.message || "Failed to export report" };
  }
}
