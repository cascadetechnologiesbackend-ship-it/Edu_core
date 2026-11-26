import React from "react";
import { sql, eq, and, desc, gte, lte, isNull } from "drizzle-orm";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import bcrypt from "bcryptjs";
import { withTenant } from "./tenant";
import { uploadBufferToS3, downloadBufferFromS3 } from "./storage";
import { decryptData, encryptData, computeSearchHash } from "./encryption";
import { generateRoleTempPassword } from "./tempPassword";
import { SchoolDocumentHeader, type SchoolInfo } from "./pdf/components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "./pdf/components/SchoolDocumentFooter";
import { SchoolPDFTable, type PDFTableColumn } from "./pdf/components/SchoolPDFTable";

let ExcelJS: typeof import("exceljs") | null = null;
async function getExcelJS() {
  if (!ExcelJS) {
    ExcelJS = (await import("exceljs")) as typeof import("exceljs");
  }
  return ExcelJS;
}

export const MAX_IMPORT_ROWS = 5000;

export interface ImportExportJobPayload {
  jobId: string;
  schoolId: string;
  userId: string;
  userEmail?: string | undefined;
  userRole?: string | undefined;
  jobType: "EXPORT" | "IMPORT";
  entityType: string;
  format?: "csv" | "xlsx" | "pdf" | "CSV" | "XLSX" | "PDF" | undefined;
  s3Key?: string | undefined;
  filters?: Record<string, unknown> | undefined;
}

export interface ImportExportExecutionResult {
  success: boolean;
  jobId: string;
  status: "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
  fileKey?: string | undefined;
  errorCsvKey?: string | undefined;
  recordCount: number;
  errorCount: number;
}

// ─── Formula-Injection & DPDP Sanitization ───────────────────────────────────

const SENSITIVE_FIELD_DENYLIST = [
  "password",
  "passwordhash",
  "salt",
  "pin",
  "totpsecret",
  "bankaccount",
  "bankaccountnumber",
  "ifsc",
  "ifsccode",
  "pan",
  "pannumber",
  "panencrypted",
  "aadhaar",
  "aadhaarnumber",
  "aadhaarlast4",
  "token",
  "secret",
  "encrypted",
];

/**
 * Prevents CSV/XLSX formula injection by prefixing values starting with
 * '=', '+', '-', '@', '\t', or '\r' with a single quote (').
 */
export function sanitizeForSpreadsheet(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!str) return "";
  const firstChar = str.charAt(0);
  if (
    firstChar === "=" ||
    firstChar === "+" ||
    firstChar === "-" ||
    firstChar === "@" ||
    firstChar === "\t" ||
    firstChar === "\r"
  ) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeExportRecord(
  record: Record<string, unknown>,
  allowedColumns?: string[]
): Record<string, unknown> {
  const keys =
    allowedColumns && allowedColumns.length > 0
      ? allowedColumns.filter((k) =>
          !SENSITIVE_FIELD_DENYLIST.some((deny) => k.toLowerCase().includes(deny))
        )
      : Object.keys(record).filter((k) =>
          !SENSITIVE_FIELD_DENYLIST.some((deny) => k.toLowerCase().includes(deny))
        );

  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (SENSITIVE_FIELD_DENYLIST.some((deny) => key.toLowerCase().includes(deny))) {
      out[key] = "REDACTED_CONFIDENTIAL";
    } else {
      out[key] = record[key] ?? "";
    }
  }
  return out;
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function getExcelCellString(cellValue: unknown): string {
  if (cellValue === null || cellValue === undefined) return "";
  if (cellValue instanceof Date) {
    return isNaN(cellValue.getTime()) ? "" : cellValue.toISOString().slice(0, 10);
  }
  if (typeof cellValue === "object") {
    const obj = cellValue as Record<string, any>;
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((t: any) => String(t?.text || "")).join("").trim();
    }
    if (obj.result !== undefined && obj.result !== null) {
      return String(obj.result).trim();
    }
    if (obj.text !== undefined && obj.text !== null) {
      return String(obj.text).trim();
    }
  }
  return String(cellValue).trim();
}

// ─── Job Status Helpers ──────────────────────────────────────────────────────

async function markProcessing(schoolId: string, jobId: string) {
  await withTenant(schoolId, async (tx) => {
    await tx.execute(sql`
      UPDATE import_export_jobs
      SET status = 'PROCESSING', updated_at = NOW()
      WHERE id = ${jobId} AND school_id = ${schoolId}
    `);
  });
}

async function markCompleted(
  schoolId: string,
  jobId: string,
  opts: {
    fileKey?: string;
    recordCount?: number;
    errorCount?: number;
    errorCsvKey?: string;
    metadataPatch?: Record<string, unknown>;
  } = {}
) {
  const finalStatus =
    opts.errorCount && opts.errorCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  const patchJson = JSON.stringify(opts.metadataPatch ?? {});

  await withTenant(schoolId, async (tx) => {
    await tx.execute(sql`
      UPDATE import_export_jobs
      SET
        status        = ${finalStatus},
        file_key      = COALESCE(${opts.fileKey ?? null}, file_key),
        record_count  = COALESCE(${opts.recordCount ?? null}, record_count),
        error_count   = COALESCE(${opts.errorCount ?? null}, error_count),
        error_csv_key = COALESCE(${opts.errorCsvKey ?? null}, error_csv_key),
        metadata      = COALESCE(metadata, '{}'::jsonb) || ${patchJson}::jsonb,
        expires_at    = NOW() + interval '7 days',
        updated_at    = NOW()
      WHERE id = ${jobId} AND school_id = ${schoolId}
    `);
  });

  return finalStatus as "COMPLETED" | "COMPLETED_WITH_ERRORS";
}

async function markFailed(
  schoolId: string,
  jobId: string,
  errorMessage: string,
  opts: { errorCount?: number; errorCsvKey?: string } = {}
) {
  const errJson = JSON.stringify(errorMessage);
  await withTenant(schoolId, async (tx) => {
    await tx.execute(sql`
      UPDATE import_export_jobs
      SET
        status        = 'FAILED',
        record_count  = COALESCE(record_count, 0),
        error_count   = COALESCE(${opts.errorCount ?? null}, error_count),
        error_csv_key = COALESCE(${opts.errorCsvKey ?? null}, error_csv_key),
        metadata      = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{errorMessage}', ${errJson}::jsonb),
        expires_at    = COALESCE(expires_at, NOW() + interval '7 days'),
        updated_at    = NOW()
      WHERE id = ${jobId} AND school_id = ${schoolId}
    `);
  });
}

// ─── Export Data Fetchers (Strict Tenant Isolation) ──────────────────────────

const DEFAULT_HEADERS_BY_DATASET: Record<string, string[]> = {
  STUDENTS: [
    "admissionNumber",
    "firstName",
    "lastName",
    "gender",
    "dob",
    "className",
    "sectionName",
    "parentName",
    "parentPhone",
    "parentEmail",
    "category",
    "status",
  ],
  STAFF: [
    "employeeCode",
    "firstName",
    "lastName",
    "email",
    "phone",
    "department",
    "designation",
    "role",
    "joiningDate",
    "status",
  ],
  TEACHERS: [
    "employeeCode",
    "firstName",
    "lastName",
    "email",
    "phone",
    "department",
    "designation",
    "qualification",
    "status",
  ],
  CLASSES: ["className", "gradeLevel", "sections", "sortOrder", "status"],
  SUBJECTS: ["code", "name", "nameHindi", "subjectType", "maxMarks", "passingMarks", "status"],
  FEE_HEADS: ["name", "code", "headType", "category", "priority", "isRefundable", "status"],
  FEE_STRUCTURES: [
    "academicYear",
    "className",
    "feeHead",
    "term",
    "amount",
    "dueDate",
    "lateFeeType",
    "lateFeeAmount",
  ],
  FEE_INVOICES: [
    "invoiceNumber",
    "admissionNumber",
    "studentName",
    "term",
    "grossAmount",
    "discountAmount",
    "lateFeeAmount",
    "netAmount",
    "paidAmount",
    "balanceAmount",
    "status",
    "dueDate",
  ],
  FEE_PAYMENTS: [
    "receiptNumber",
    "admissionNumber",
    "studentName",
    "invoiceNumber",
    "amountPaid",
    "paymentMethod",
    "paymentDate",
    "transactionReference",
    "status",
    "remarks",
  ],
  FEE_REFUNDS: [
    "refundId",
    "receiptNumber",
    "admissionNumber",
    "studentName",
    "refundAmount",
    "reason",
    "status",
    "createdAt",
  ],
  FINANCIAL_REPORTS: [
    "entryCode",
    "category",
    "accountHead",
    "entryDate",
    "creditAmount",
    "debitAmount",
    "paymentMode",
    "reference",
    "status",
  ],
  ATTENDANCE_OVERRIDE: [
    "recordKey",
    "admissionNumber",
    "studentName",
    "className",
    "sectionName",
    "date",
    "status",
    "reason",
  ],
  EXAM_MARKS: [
    "markKey",
    "examName",
    "admissionNumber",
    "studentName",
    "subjectCode",
    "subjectName",
    "marksObtained",
    "maxMarks",
    "isAbsent",
    "grade",
    "status",
  ],
  AUDIT_LOGS: [
    "createdAt",
    "action",
    "entityType",
    "entityId",
    "performerEmail",
    "performerRole",
    "reason",
  ],
};

function parseDateFilter(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

async function fetchSchoolInfo(tx: any, schoolId: string): Promise<SchoolInfo> {
  const { schools } = await import("@/db/schema");
  const s = await tx.query.schools.findFirst({
    where: eq(schools.id, schoolId),
    columns: {
      name: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      email: true,
      website: true,
      board: true,
      logoS3Key: true,
    },
  });
  if (!s) {
    return { name: "SchoolMitra Institution" };
  }
  const fullAddress = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(", ");
  return {
    name: s.name,
    address: fullAddress || null,
    phone: s.phone || null,
    email: s.email || null,
    website: s.website || null,
    boardAffiliation: s.board || null,
    logoS3Key: s.logoS3Key || null,
  };
}

async function fetchEntityRows(
  tx: any,
  schoolId: string,
  entityType: string,
  filters: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const fromDate = parseDateFilter(filters.dateFrom ?? filters.fromDate);
  const toDate = parseDateFilter(filters.dateTo ?? filters.toDate);
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  switch (entityType) {
    case "STUDENTS": {
      const { students, classes, sections, studentFamilyMembers } = await import("@/db/schema");
      const conditions: any[] = [eq(students.schoolId, schoolId), isNull(students.deletedAt)];
      if (filters.classId) conditions.push(eq(students.currentClassId, String(filters.classId)));
      if (filters.sectionId) conditions.push(eq(students.currentSectionId, String(filters.sectionId)));
      if (fromDate) conditions.push(gte(students.createdAt, fromDate));
      if (toDate) conditions.push(lte(students.createdAt, toDate));

      const rows = await tx.query.students.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          admissionNumber: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
          gender: true,
          dateOfBirth: true,
          currentClassId: true,
          currentSectionId: true,
          category: true,
          isActive: true,
        },
        limit: 5000,
      });

      const [classRows, sectionRows, familyRows] = await Promise.all([
        tx.query.classes.findMany({
          where: eq(classes.schoolId, schoolId),
          columns: { id: true, displayName: true },
        }),
        tx.query.sections.findMany({
          where: eq(sections.schoolId, schoolId),
          columns: { id: true, name: true },
        }),
        tx.query.studentFamilyMembers.findMany({
          where: and(
            eq(studentFamilyMembers.schoolId, schoolId),
            eq(studentFamilyMembers.isPrimaryContact, true)
          ),
          columns: {
            studentId: true,
            nameEncrypted: true,
            mobileEncrypted: true,
            emailEncrypted: true,
          },
        }),
      ]);

      const classMap = new Map(classRows.map((c: any) => [c.id, c.displayName]));
      const sectionMap = new Map(sectionRows.map((s: any) => [s.id, s.name]));
      const familyMap = new Map<string, any>(familyRows.map((f: any) => [f.studentId, f]));

      return rows.map((s: any) => {
        const fam = familyMap.get(s.id);
        return {
          admissionNumber: s.admissionNumber,
          firstName: decryptData(s.firstNameEncrypted) || "",
          lastName: decryptData(s.lastNameEncrypted) || "",
          gender: s.gender || "",
          dob: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString().slice(0, 10) : "",
          className: s.currentClassId ? classMap.get(s.currentClassId) || "" : "",
          sectionName: s.currentSectionId ? sectionMap.get(s.currentSectionId) || "" : "",
          parentName: fam?.nameEncrypted ? decryptData(fam.nameEncrypted) || "" : "",
          parentPhone: fam?.mobileEncrypted ? decryptData(fam.mobileEncrypted) || "" : "",
          parentEmail: fam?.emailEncrypted ? decryptData(fam.emailEncrypted) || "" : "",
          category: s.category || "GENERAL",
          status: s.isActive ? "ACTIVE" : "INACTIVE",
        };
      });
    }

    case "STAFF":
    case "TEACHERS": {
      const { staff, departments, designations } = await import("@/db/schema");
      const conditions: any[] = [eq(staff.schoolId, schoolId), isNull(staff.deletedAt)];
      if (fromDate) conditions.push(gte(staff.joiningDate, fromDate));
      if (toDate) conditions.push(lte(staff.joiningDate, toDate));

      const [staffRows, deptRows, desigRows] = await Promise.all([
        tx.query.staff.findMany({
          where: and(...conditions),
          columns: {
            id: true,
            employeeCode: true,
            departmentId: true,
            designationId: true,
            firstNameEncrypted: true,
            lastNameEncrypted: true,
            emailEncrypted: true,
            mobileEncrypted: true,
            qualification: true,
            joiningDate: true,
            isActive: true,
          },
          limit: 5000,
        }),
        tx.query.departments.findMany({
          where: eq(departments.schoolId, schoolId),
          columns: { id: true, name: true },
        }),
        tx.query.designations.findMany({
          where: eq(designations.schoolId, schoolId),
          columns: { id: true, name: true, mappedRole: true, isTeaching: true },
        }),
      ]);

      const deptMap = new Map<string, string>(deptRows.map((d: any) => [d.id, d.name]));
      const desigMap = new Map<string, any>(desigRows.map((d: any) => [d.id, d]));

      const filtered =
        entityType === "TEACHERS"
          ? staffRows.filter((st: any) => {
              const desig = desigMap.get(st.designationId);
              return Boolean(desig?.isTeaching || desig?.mappedRole === "TEACHER");
            })
          : staffRows;

      return filtered.map((st: any) => {
        const desig = desigMap.get(st.designationId);
        const base: Record<string, unknown> = {
          employeeCode: st.employeeCode,
          firstName: decryptData(st.firstNameEncrypted) || "",
          lastName: decryptData(st.lastNameEncrypted) || "",
          email: decryptData(st.emailEncrypted) || "",
          phone: decryptData(st.mobileEncrypted) || "",
          department: deptMap.get(st.departmentId) || "",
          designation: desig?.name || "",
        };
        if (entityType === "TEACHERS") {
          base.qualification = st.qualification || "";
        } else {
          base.role = desig?.mappedRole || "STAFF";
          base.joiningDate = st.joiningDate ? new Date(st.joiningDate).toISOString().slice(0, 10) : "";
        }
        base.status = st.isActive ? "ACTIVE" : "INACTIVE";
        return base;
      });
    }

    case "CLASSES": {
      const { classes, sections } = await import("@/db/schema");
      const [classRows, sectionRows] = await Promise.all([
        tx.query.classes.findMany({
          where: and(eq(classes.schoolId, schoolId), isNull(classes.deletedAt)),
          orderBy: (c: any, { asc }: any) => [asc(c.sortOrder)],
        }),
        tx.query.sections.findMany({
          where: and(eq(sections.schoolId, schoolId), isNull(sections.deletedAt)),
          columns: { classId: true, name: true, isActive: true },
        }),
      ]);

      const secMap = new Map<string, string[]>();
      for (const s of sectionRows) {
        if (!s.isActive) continue;
        const arr = secMap.get(s.classId) || [];
        arr.push(s.name);
        secMap.set(s.classId, arr);
      }

      return classRows.map((c: any) => ({
        className: c.displayName,
        gradeLevel: c.gradeLevel,
        sections: (secMap.get(c.id) || []).sort().join(", "),
        sortOrder: c.sortOrder,
        status: c.isActive ? "ACTIVE" : "INACTIVE",
      }));
    }

    case "SUBJECTS": {
      const { subjects } = await import("@/db/schema");
      const rows = await tx.query.subjects.findMany({
        where: and(eq(subjects.schoolId, schoolId), isNull(subjects.deletedAt)),
        limit: 5000,
      });

      return rows.map((sub: any) => ({
        code: sub.code,
        name: sub.name,
        nameHindi: sub.nameHindi || "",
        subjectType: sub.subjectType,
        maxMarks: sub.maxMarks,
        passingMarks: sub.passingMarks,
        status: sub.isActive ? "ACTIVE" : "INACTIVE",
      }));
    }

    case "FEE_HEADS": {
      const { feeHeads } = await import("@/db/schema");
      const rows = await tx.query.feeHeads.findMany({
        where: and(eq(feeHeads.schoolId, schoolId), isNull(feeHeads.deletedAt)),
        orderBy: (fh: any, { asc }: any) => [asc(fh.priority)],
        limit: 1000,
      });

      return rows.map((fh: any) => ({
        name: fh.name,
        code: fh.code || "",
        headType: fh.headType,
        category: fh.category,
        priority: fh.priority,
        isRefundable: fh.isRefundable ? "TRUE" : "FALSE",
        status: fh.isActive ? "ACTIVE" : "INACTIVE",
      }));
    }

    case "FEE_STRUCTURES": {
      const { feeStructures, classes, feeHeads, academicYears } = await import("@/db/schema");
      const conditions: any[] = [eq(feeStructures.schoolId, schoolId), isNull(feeStructures.deletedAt)];
      if (filters.academicYearId) {
        conditions.push(eq(feeStructures.academicYearId, String(filters.academicYearId)));
      }
      if (filters.classId) {
        conditions.push(eq(feeStructures.classId, String(filters.classId)));
      }

      const [rows, classRows, headRows, ayRows] = await Promise.all([
        tx.query.feeStructures.findMany({ where: and(...conditions), limit: 5000 }),
        tx.query.classes.findMany({ where: eq(classes.schoolId, schoolId), columns: { id: true, displayName: true } }),
        tx.query.feeHeads.findMany({ where: eq(feeHeads.schoolId, schoolId), columns: { id: true, name: true } }),
        tx.query.academicYears.findMany({ where: eq(academicYears.schoolId, schoolId), columns: { id: true, label: true } }),
      ]);

      const classMap = new Map(classRows.map((c: any) => [c.id, c.displayName]));
      const headMap = new Map(headRows.map((h: any) => [h.id, h.name]));
      const ayMap = new Map(ayRows.map((a: any) => [a.id, a.label]));

      return rows.map((fs: any) => ({
        academicYear: ayMap.get(fs.academicYearId) || "",
        className: classMap.get(fs.classId) || "",
        feeHead: headMap.get(fs.feeHeadId) || "",
        term: fs.term,
        amount: fs.amount,
        dueDate: fs.dueDate ? new Date(fs.dueDate).toISOString().slice(0, 10) : "",
        lateFeeType: fs.lateFeeType || "",
        lateFeeAmount: fs.lateFeeAmount || "0",
      }));
    }

    case "FEE_INVOICES": {
      const { feeInvoices, students } = await import("@/db/schema");
      const conditions: any[] = [eq(feeInvoices.schoolId, schoolId), isNull(feeInvoices.deletedAt)];
      if (filters.academicYearId) {
        conditions.push(eq(feeInvoices.academicYearId, String(filters.academicYearId)));
      }
      if (fromDate) conditions.push(gte(feeInvoices.dueDate, fromDate));
      if (toDate) conditions.push(lte(feeInvoices.dueDate, toDate));

      const [rows, studentRows] = await Promise.all([
        tx.query.feeInvoices.findMany({
          where: and(...conditions),
          orderBy: [desc(feeInvoices.createdAt)],
          limit: 10000,
        }),
        tx.query.students.findMany({
          where: eq(students.schoolId, schoolId),
          columns: { id: true, admissionNumber: true, firstNameEncrypted: true, lastNameEncrypted: true },
        }),
      ]);

      const studentMap = new Map<string, any>(studentRows.map((s: any) => [s.id, s]));

      return rows.map((inv: any) => {
        const st = studentMap.get(inv.studentId);
        const studentName = st
          ? `${decryptData(st.firstNameEncrypted) || ""} ${decryptData(st.lastNameEncrypted) || ""}`.trim()
          : "";
        return {
          invoiceNumber: inv.invoiceNumber,
          admissionNumber: st?.admissionNumber || "",
          studentName,
          term: inv.term,
          grossAmount: inv.grossAmount,
          discountAmount: inv.discountAmount,
          lateFeeAmount: inv.lateFeeAmount,
          netAmount: inv.netAmount,
          paidAmount: inv.paidAmount,
          balanceAmount: inv.balanceAmount,
          status: inv.status,
          dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "",
        };
      });
    }

    case "FEE_PAYMENTS": {
      const { feePayments, feeInvoices, students } = await import("@/db/schema");
      const conditions: any[] = [
        eq(feePayments.schoolId, schoolId),
        eq(feePayments.isCancelled, false),
      ];
      if (fromDate) conditions.push(gte(feePayments.paymentDate, fromDate));
      if (toDate) conditions.push(lte(feePayments.paymentDate, toDate));

      const [rows, studentRows, invoiceRows] = await Promise.all([
        tx.query.feePayments.findMany({
          where: and(...conditions),
          orderBy: [desc(feePayments.paymentDate)],
          limit: 10000,
        }),
        tx.query.students.findMany({
          where: eq(students.schoolId, schoolId),
          columns: { id: true, admissionNumber: true, firstNameEncrypted: true, lastNameEncrypted: true },
        }),
        tx.query.feeInvoices.findMany({
          where: eq(feeInvoices.schoolId, schoolId),
          columns: { id: true, invoiceNumber: true },
        }),
      ]);

      const studentMap = new Map<string, any>(studentRows.map((s: any) => [s.id, s]));
      const invoiceMap = new Map<string, string>(invoiceRows.map((i: any) => [i.id, i.invoiceNumber]));

      return rows.map((p: any) => {
        const st = studentMap.get(p.studentId);
        const studentName = st
          ? `${decryptData(st.firstNameEncrypted) || ""} ${decryptData(st.lastNameEncrypted) || ""}`.trim()
          : "";
        return {
          receiptNumber: p.receiptNumber,
          admissionNumber: st?.admissionNumber || "",
          studentName,
          invoiceNumber: invoiceMap.get(p.feeInvoiceId) || "",
          amountPaid: p.amountPaid,
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : "",
          transactionReference: p.transactionReference || "",
          status: p.isCancelled ? "CANCELLED" : p.status || "ACTIVE",
          remarks: p.remarks || "",
        };
      });
    }

    case "FEE_REFUNDS": {
      const { feeRefunds, feePayments, students } = await import("@/db/schema");
      const conditions: any[] = [eq(feeRefunds.schoolId, schoolId)];
      if (fromDate) conditions.push(gte(feeRefunds.createdAt, fromDate));
      if (toDate) conditions.push(lte(feeRefunds.createdAt, toDate));

      const [refundRows, paymentRows, studentRows] = await Promise.all([
        tx.query.feeRefunds.findMany({
          where: and(...conditions),
          orderBy: [desc(feeRefunds.createdAt)],
          limit: 5000,
        }),
        tx.query.feePayments.findMany({
          where: eq(feePayments.schoolId, schoolId),
          columns: { id: true, receiptNumber: true, studentId: true },
        }),
        tx.query.students.findMany({
          where: eq(students.schoolId, schoolId),
          columns: { id: true, admissionNumber: true, firstNameEncrypted: true, lastNameEncrypted: true },
        }),
      ]);

      const paymentMap = new Map<string, any>(paymentRows.map((p: any) => [p.id, p]));
      const studentMap = new Map<string, any>(studentRows.map((s: any) => [s.id, s]));

      return refundRows.map((r: any) => {
        const pay = paymentMap.get(r.feePaymentId);
        const st = pay ? studentMap.get(pay.studentId) : null;
        const studentName = st
          ? `${decryptData(st.firstNameEncrypted) || ""} ${decryptData(st.lastNameEncrypted) || ""}`.trim()
          : "";
        return {
          refundId: r.id,
          receiptNumber: pay?.receiptNumber || "",
          admissionNumber: st?.admissionNumber || "",
          studentName,
          refundAmount: r.refundAmount,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "",
        };
      });
    }

    case "FINANCIAL_REPORTS": {
      const {
        feePayments,
        feeRefunds,
        incomeVouchers,
        incomeHeads,
        expenseVouchers,
        expenseHeads,
      } = await import("@/db/schema");

      const payConds: any[] = [eq(feePayments.schoolId, schoolId), eq(feePayments.isCancelled, false)];
      if (fromDate) payConds.push(gte(feePayments.paymentDate, fromDate));
      if (toDate) payConds.push(lte(feePayments.paymentDate, toDate));

      const refConds: any[] = [eq(feeRefunds.schoolId, schoolId)];
      if (fromDate) refConds.push(gte(feeRefunds.createdAt, fromDate));
      if (toDate) refConds.push(lte(feeRefunds.createdAt, toDate));

      const incConds: any[] = [eq(incomeVouchers.schoolId, schoolId)];
      if (fromDate) incConds.push(gte(incomeVouchers.entryDate, fromDate));
      if (toDate) incConds.push(lte(incomeVouchers.entryDate, toDate));

      const expConds: any[] = [eq(expenseVouchers.schoolId, schoolId)];
      if (fromDate) expConds.push(gte(expenseVouchers.entryDate, fromDate));
      if (toDate) expConds.push(lte(expenseVouchers.entryDate, toDate));

      const [payments, refunds, incomes, incHeads, expenses, expHeads] = await Promise.all([
        tx.query.feePayments.findMany({ where: and(...payConds), limit: 5000 }),
        tx.query.feeRefunds.findMany({ where: and(...refConds), limit: 2000 }),
        tx.query.incomeVouchers.findMany({ where: and(...incConds), limit: 2000 }),
        tx.query.incomeHeads.findMany({ where: eq(incomeHeads.schoolId, schoolId), columns: { id: true, name: true } }),
        tx.query.expenseVouchers.findMany({ where: and(...expConds), limit: 2000 }),
        tx.query.expenseHeads.findMany({ where: eq(expenseHeads.schoolId, schoolId), columns: { id: true, name: true } }),
      ]);

      const incHeadMap = new Map(incHeads.map((h: any) => [h.id, h.name]));
      const expHeadMap = new Map(expHeads.map((h: any) => [h.id, h.name]));

      const reportRows: Record<string, unknown>[] = [];
      for (const p of payments) {
        reportRows.push({
          entryCode: p.receiptNumber,
          category: "FEE_COLLECTION",
          accountHead: "Student Fee Receipts",
          entryDate: p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : "",
          creditAmount: p.amountPaid,
          debitAmount: "0.00",
          paymentMode: p.paymentMethod,
          reference: p.transactionReference || p.receiptNumber,
          status: p.status || "ACTIVE",
        });
      }
      for (const r of refunds) {
        reportRows.push({
          entryCode: `REF-${String(r.id).slice(0, 8)}`,
          category: "FEE_REFUND",
          accountHead: "Fee Refunds",
          entryDate: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "",
          creditAmount: "0.00",
          debitAmount: r.refundAmount,
          paymentMode: "REFUND",
          reference: r.reason,
          status: r.status,
        });
      }
      for (const inc of incomes) {
        reportRows.push({
          entryCode: inc.voucherNumber,
          category: "INCOME_VOUCHER",
          accountHead: incHeadMap.get(inc.incomeHeadId) || "Other Income",
          entryDate: inc.entryDate ? new Date(inc.entryDate).toISOString().slice(0, 10) : "",
          creditAmount: inc.amount,
          debitAmount: "0.00",
          paymentMode: inc.paymentMode,
          reference: inc.transactionReference || inc.voucherNumber,
          status: "POSTED",
        });
      }
      for (const exp of expenses) {
        reportRows.push({
          entryCode: exp.voucherNumber,
          category: "EXPENSE_VOUCHER",
          accountHead: expHeadMap.get(exp.expenseHeadId) || "Operating Expense",
          entryDate: exp.entryDate ? new Date(exp.entryDate).toISOString().slice(0, 10) : "",
          creditAmount: "0.00",
          debitAmount: exp.amount,
          paymentMode: exp.paymentMode,
          reference: exp.transactionReference || exp.voucherNumber,
          status: exp.status,
        });
      }

      return reportRows;
    }

    case "ATTENDANCE_OVERRIDE": {
      const { studentAttendance, students, sections, classes } = await import("@/db/schema");
      const conditions: any[] = [eq(studentAttendance.schoolId, schoolId)];
      if (fromDate) conditions.push(gte(studentAttendance.attendanceDate, fromDate));
      if (toDate) conditions.push(lte(studentAttendance.attendanceDate, toDate));

      const [attRows, studentRows, sectionRows, classRows] = await Promise.all([
        tx.query.studentAttendance.findMany({
          where: and(...conditions),
          orderBy: [desc(studentAttendance.attendanceDate)],
          limit: 10000,
        }),
        tx.query.students.findMany({
          where: eq(students.schoolId, schoolId),
          columns: { id: true, admissionNumber: true, firstNameEncrypted: true, lastNameEncrypted: true },
        }),
        tx.query.sections.findMany({
          where: eq(sections.schoolId, schoolId),
          columns: { id: true, classId: true, name: true },
        }),
        tx.query.classes.findMany({
          where: eq(classes.schoolId, schoolId),
          columns: { id: true, displayName: true },
        }),
      ]);

      const studentMap = new Map<string, any>(studentRows.map((s: any) => [s.id, s]));
      const sectionMap = new Map<string, any>(sectionRows.map((s: any) => [s.id, s]));
      const classMap = new Map<string, string>(classRows.map((c: any) => [c.id, c.displayName]));

      return attRows.map((a: any) => {
        const st = studentMap.get(a.studentId);
        const sec = sectionMap.get(a.sectionId);
        const clsName = sec ? classMap.get(sec.classId) || "" : "";
        const dateStr = a.attendanceDate ? new Date(a.attendanceDate).toISOString().slice(0, 10) : "";
        const studentName = st
          ? `${decryptData(st.firstNameEncrypted) || ""} ${decryptData(st.lastNameEncrypted) || ""}`.trim()
          : "";
        return {
          recordKey: `${st?.admissionNumber || a.studentId}_${dateStr}`,
          admissionNumber: st?.admissionNumber || "",
          studentName,
          className: clsName,
          sectionName: sec?.name || "",
          date: dateStr,
          status: a.status,
          reason: a.remarks || "",
        };
      });
    }

    case "EXAM_MARKS": {
      const { markEntries, exams, students, subjects } = await import("@/db/schema");
      const [markRows, examRows, studentRows, subjectRows] = await Promise.all([
        tx.query.markEntries.findMany({
          where: eq(markEntries.schoolId, schoolId),
          orderBy: [desc(markEntries.enteredAt)],
          limit: 10000,
        }),
        tx.query.exams.findMany({
          where: eq(exams.schoolId, schoolId),
          columns: { id: true, name: true },
        }),
        tx.query.students.findMany({
          where: eq(students.schoolId, schoolId),
          columns: { id: true, admissionNumber: true, firstNameEncrypted: true, lastNameEncrypted: true },
        }),
        tx.query.subjects.findMany({
          where: eq(subjects.schoolId, schoolId),
          columns: { id: true, code: true, name: true },
        }),
      ]);

      const examMap = new Map<string, string>(examRows.map((e: any) => [e.id, e.name]));
      const studentMap = new Map<string, any>(studentRows.map((s: any) => [s.id, s]));
      const subjectMap = new Map<string, any>(subjectRows.map((s: any) => [s.id, s]));

      return markRows.map((m: any) => {
        const st = studentMap.get(m.studentId);
        const sub = subjectMap.get(m.subjectId);
        const examName = examMap.get(m.examId) || "";
        const studentName = st
          ? `${decryptData(st.firstNameEncrypted) || ""} ${decryptData(st.lastNameEncrypted) || ""}`.trim()
          : "";
        return {
          markKey: `${examName}-${st?.admissionNumber || m.studentId}-${sub?.code || m.subjectId}`,
          examName,
          admissionNumber: st?.admissionNumber || "",
          studentName,
          subjectCode: sub?.code || "",
          subjectName: sub?.name || "",
          marksObtained: m.marksObtained ?? (m.isAbsent ? "0" : ""),
          maxMarks: m.maxMarks,
          isAbsent: m.isAbsent ? "TRUE" : "FALSE",
          grade: m.grade || "",
          status: m.status,
        };
      });
    }

    case "AUDIT_LOGS": {
      const { auditLogs } = await import("@/db/schema");
      const conditions: any[] = [eq(auditLogs.schoolId, schoolId)];
      if (fromDate) conditions.push(gte(auditLogs.createdAt, fromDate));
      if (toDate) conditions.push(lte(auditLogs.createdAt, toDate));

      const rows = await tx.query.auditLogs.findMany({
        where: and(...conditions),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 10000,
      });

      return rows.map((log: any) => ({
        createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : "",
        action: log.action,
        entityType: log.tableName,
        entityId: log.recordId || "",
        performerEmail: log.userEmail,
        performerRole: log.userRole,
        reason: log.purposeId || "",
      }));
    }

    case "HOLIDAYS": {
      const { academicCalendarEvents } = await import("@/db/schema");
      const rows = await tx.query.academicCalendarEvents.findMany({
        where: and(
          eq(academicCalendarEvents.schoolId, schoolId),
          isNull(academicCalendarEvents.deletedAt)
        ),
        limit: 1000,
      });
      return rows.map((ev: any) => ({
        title: ev.title,
        date: ev.startDate,
        holidayType: ev.eventType,
        description: ev.description || "",
      }));
    }

    case "SALARY_TEMPLATES": {
      const { salaryTemplates } = await import("@/db/schema");
      const rows = await tx.query.salaryTemplates.findMany({
        where: eq(salaryTemplates.schoolId, schoolId),
        limit: 500,
      });
      return rows.map((t: any) => ({
        gradeName: t.name,
        basicPercent: t.basicPercent,
        daPercent: t.daPercent,
        hraPercent: t.hraPercent,
        pfPercent: t.pfEmployeePercent,
      }));
    }

    default:
      throw new Error(`Unsupported datasetKey for EXPORT: "${entityType}".`);
  }
}

// ─── PDF Generator using SchoolDocumentHeader + SchoolPDFTable + Footer ──────

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 24,
    fontFamily: "Helvetica",
  },
  emptyNotice: {
    marginTop: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "solid",
    fontSize: 10,
    color: "#475569",
    textAlign: "center",
  },
});

async function generateBrandedPdfBuffer(opts: {
  school: SchoolInfo;
  entityType: string;
  headers: string[];
  rows: Record<string, unknown>[];
  scope?: string;
}): Promise<Buffer> {
  const { school, entityType, headers, rows, scope } = opts;
  const maxPdfCols = Math.min(headers.length, 8);
  const visibleHeaders = headers.slice(0, maxPdfCols);
  const colWidthPct = `${(100 / Math.max(visibleHeaders.length, 1)).toFixed(2)}%`;

  const columns: PDFTableColumn[] = visibleHeaders.map((h) => ({
    key: h,
    label: h,
    width: colWidthPct,
    align: /amount|marks|balance|paid|credit|debit|fee|count|order/i.test(h) ? "right" : "left",
  }));

  const orientation = visibleHeaders.length >= 6 ? "landscape" : "portrait";
  const reportTitle = `${entityType.replace(/_/g, " ")} Export`;
  const generatedAt = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const safeRows = rows.slice(0, 1000).map((row) => {
    const clean: Record<string, unknown> = {};
    for (const h of visibleHeaders) {
      clean[h] = row[h] ?? "";
    }
    return clean;
  });

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation, style: pdfStyles.page },
      React.createElement(SchoolDocumentHeader, {
        school,
        reportTitle,
        subtitle: `Total Records: ${rows.length}`,
        scope,
        generatedAt,
      }),
      safeRows.length > 0
        ? React.createElement(SchoolPDFTable, {
            columns,
            rows: safeRows,
            striped: true,
          })
        : React.createElement(
            View,
            { style: pdfStyles.emptyNotice },
            React.createElement(Text, null, "No records matched the selected export criteria.")
          ),
      React.createElement(SchoolDocumentFooter, {
        pageLabel: `${entityType} (${rows.length} rows)`,
      })
    )
  );

  return Buffer.from(await renderToBuffer(doc));
}

// ─── Export Runner ───────────────────────────────────────────────────────────

async function handleExport(payload: ImportExportJobPayload): Promise<{
  fileKey: string;
  recordCount: number;
  contentType: string;
}> {
  const { schoolId, entityType, filters = {} } = payload;
  const format = String(payload.format || "csv").toLowerCase();
  const requestedColumns = Array.isArray(filters.columns) ? filters.columns.map(String) : undefined;

  const { schoolInfo, rawRows } = await withTenant(schoolId, async (tx) => {
    const [sInfo, rows] = await Promise.all([
      fetchSchoolInfo(tx, schoolId),
      fetchEntityRows(tx, schoolId, entityType, filters),
    ]);
    return { schoolInfo: sInfo, rawRows: rows };
  });

  const defaultHeaders = DEFAULT_HEADERS_BY_DATASET[entityType] || [];
  const candidateHeaders =
    rawRows.length > 0 ? Object.keys(rawRows[0]!) : defaultHeaders;

  const selectedHeaders =
    requestedColumns && requestedColumns.length > 0
      ? requestedColumns.filter((c) => candidateHeaders.includes(c) || defaultHeaders.includes(c))
      : candidateHeaders;

  const safeHeaders = (selectedHeaders.length > 0 ? selectedHeaders : candidateHeaders).filter(
    (h) => !SENSITIVE_FIELD_DENYLIST.some((deny) => h.toLowerCase().includes(deny))
  );

  const sanitizedRows = rawRows.map((row) => sanitizeExportRecord(row, safeHeaders));

  let buffer: Buffer;
  let contentType: string;
  let ext: string;

  if (format === "xlsx") {
    const xl = await getExcelJS();
    const workbook = new xl.Workbook();
    workbook.creator = "SchoolMitra ERP";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(entityType.slice(0, 31));
    sheet.addRow(safeHeaders);
    sheet.getRow(1).font = { bold: true };
    for (const row of sanitizedRows) {
      sheet.addRow(safeHeaders.map((h) => sanitizeForSpreadsheet(row[h] ?? "")));
    }
    buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  } else if (format === "pdf") {
    buffer = await generateBrandedPdfBuffer({
      school: schoolInfo,
      entityType,
      headers: safeHeaders,
      rows: sanitizedRows,
      ...(typeof filters.scope === "string" ? { scope: `Scope: ${filters.scope}` } : {}),
    });
    contentType = "application/pdf";
    ext = "pdf";
  } else {
    const lines = [
      safeHeaders.map((h) => csvEscape(sanitizeForSpreadsheet(h))).join(","),
      ...sanitizedRows.map((r) =>
        safeHeaders.map((h) => csvEscape(sanitizeForSpreadsheet(r[h] ?? ""))).join(",")
      ),
    ];
    buffer = Buffer.from(lines.join("\n") + "\n", "utf-8");
    contentType = "text/csv; charset=utf-8";
    ext = "csv";
  }

  const key = `schools/${schoolId}/exports/${payload.jobId}.${ext}`;
  const uploadResult = await uploadBufferToS3(key, buffer, contentType);
  if (!uploadResult.success) {
    throw new Error(uploadResult.error || "Failed to store generated export artifact.");
  }

  return { fileKey: key, recordCount: sanitizedRows.length, contentType };
}

// ─── Import Parsing, Validation & Upserts ────────────────────────────────────

const GRADE_SORT_ORDER: Record<string, number> = {
  NURSERY: 1,
  LKG: 2,
  UKG: 3,
  CLASS_1: 4,
  CLASS_2: 5,
  CLASS_3: 6,
  CLASS_4: 7,
  CLASS_5: 8,
  CLASS_6: 9,
  CLASS_7: 10,
  CLASS_8: 11,
  CLASS_9: 12,
  CLASS_10: 13,
  CLASS_11: 14,
  CLASS_12: 15,
};

const VALID_GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);
const VALID_CATEGORIES = new Set(["GENERAL", "SC", "ST", "OBC", "EWS"]);
const VALID_SUBJECT_TYPES = new Set(["THEORY", "PRACTICAL", "CO_SCHOLASTIC", "LANGUAGE", "ACTIVITY"]);
const VALID_FEE_HEAD_TYPES = new Set([
  "TUITION",
  "TRANSPORT",
  "LIBRARY",
  "LAB",
  "SPORTS",
  "HOSTEL",
  "ACTIVITY",
  "ADMISSION",
  "EXAM",
  "MISCELLANEOUS",
]);
const PERMITTED_STAFF_ROLES = new Set(["TEACHER", "STAFF", "ACCOUNTANT"]);

function pickField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
    const lowerKey = k.toLowerCase();
    for (const [rk, rv] of Object.entries(row)) {
      if (rk.trim().toLowerCase() === lowerKey && String(rv ?? "").trim() !== "") {
        return String(rv).trim();
      }
    }
  }
  return "";
}

async function parseImportBuffer(
  fileBuffer: Buffer,
  format: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const rows: Record<string, string>[] = [];

  if (format === "xlsx") {
    const xl = await getExcelJS();
    const workbook = new xl.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const sheet =
      workbook.worksheets.find((ws) => (ws.actualRowCount || ws.rowCount) > 1) ||
      workbook.worksheets[0];
    if (!sheet) throw new Error("XLSX file has no worksheets.");

    const headers: string[] = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = getExcelCellString(cell.value);
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      let hasData = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (!header) return;
        const val = getExcelCellString(cell.value);
        if (val) hasData = true;
        record[header] = val;
      });
      if (hasData) rows.push(record);
    });

    return { headers: headers.filter(Boolean), rows };
  }

  const text = fileBuffer.toString("utf-8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV file is empty or has no data rows.");
  }

  const headers = parseCsvLine(lines[0]!);
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const record: Record<string, string> = {};
    let hasData = false;
    headers.forEach((h, idx) => {
      const val = values[idx] ?? "";
      if (val) hasData = true;
      record[h] = val;
    });
    if (hasData) rows.push(record);
  }

  return { headers, rows };
}

async function handleImport(payload: ImportExportJobPayload): Promise<{
  recordCount: number;
  errorCount: number;
  errorCsvKey?: string | undefined;
  fatalErrorMessage?: string | undefined;
}> {
  const { schoolId, entityType, s3Key, userId, userEmail, userRole } = payload;
  const format = String(payload.format || "csv").toLowerCase();

  if (!s3Key) {
    throw new Error("IMPORT job requires s3Key pointing to the uploaded file.");
  }

  const supportedImportEntities = new Set(["STUDENTS", "FEE_HEADS", "CLASSES", "SUBJECTS", "STAFF", "TEACHERS"]);
  if (!supportedImportEntities.has(entityType)) {
    throw new Error(
      `Unsupported entityType for IMPORT: "${entityType}". Supported: STUDENTS, FEE_HEADS, CLASSES, SUBJECTS, STAFF, TEACHERS.`
    );
  }

  const fileBuffer = await downloadBufferFromS3(s3Key, schoolId);
  const { headers, rows } = await parseImportBuffer(fileBuffer, format);

  if (rows.length === 0) {
    throw new Error("No data rows supplied for import.");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import file exceeds maximum allowed limit of ${MAX_IMPORT_ROWS} rows (received ${rows.length} rows).`
    );
  }

  const errors: Array<{ rowNumber: number; row: Record<string, string>; error: string }> = [];
  let successCount = 0;

  await withTenant(schoolId, async (tx) => {
    const {
      academicYears,
      classes,
      sections,
      students,
      studentClassHistory,
      studentFamilyMembers,
      subjects,
      feeHeads,
      staff,
      departments,
      designations,
      users,
      roles,
      userRoles,
      persons,
      auditLogs,
      domainEvents,
    } = await import("@/db/schema");

    // Resolve active academic year once for entities requiring it
    const activeAy =
      (await tx.query.academicYears.findFirst({
        where: and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)),
      })) ||
      (await tx.query.academicYears.findFirst({
        where: eq(academicYears.schoolId, schoolId),
        orderBy: [desc(academicYears.startDate)],
      }));

    const seenKeys = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const row = rows[i]!;

      try {
        await tx.transaction(async (sp) => {
          switch (entityType) {
            case "STUDENTS": {
              const admissionNumber = pickField(row, "admissionNumber", "Admission Number");
              const firstName = pickField(row, "firstName", "First Name");
              const lastName = pickField(row, "lastName", "Last Name");
              const genderRaw = pickField(row, "gender", "Gender").toUpperCase() || "MALE";
              const dobRaw = pickField(row, "dob", "Date of Birth (YYYY-MM-DD)", "Date of Birth");
              const className = pickField(row, "className", "Class Name");
              const sectionName = pickField(row, "sectionName", "Section");
              const categoryRaw = pickField(row, "category", "Category (Optional)", "Category").toUpperCase() || "GENERAL";
              const parentName = pickField(row, "parentName", "Parent / Guardian Name");
              const parentPhone = pickField(row, "parentPhone", "Parent Phone");
              const parentEmail = pickField(row, "parentEmail", "Parent Email");

              if (!admissionNumber) throw new Error("admissionNumber is required");
              if (!firstName) throw new Error("firstName is required");
              if (!VALID_GENDERS.has(genderRaw)) {
                throw new Error(`Invalid gender '${genderRaw}'. Allowed: MALE, FEMALE, OTHER`);
              }
              if (!VALID_CATEGORIES.has(categoryRaw)) {
                throw new Error(`Invalid category '${categoryRaw}'. Allowed: GENERAL, SC, ST, OBC, EWS`);
              }

              const dedupKey = admissionNumber.toLowerCase();
              if (seenKeys.has(dedupKey)) {
                throw new Error(`Duplicate admissionNumber '${admissionNumber}' in batch`);
              }
              seenKeys.add(dedupKey);

              let dob = new Date("2012-01-01");
              if (dobRaw) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw) || isNaN(Date.parse(dobRaw))) {
                  throw new Error(`Invalid dob '${dobRaw}'. Expected YYYY-MM-DD`);
                }
                dob = new Date(dobRaw);
              }

              let matchedClassId: string | null = null;
              let matchedSectionId: string | null = null;
              if (className) {
                const schoolClasses = await sp.query.classes.findMany({
                  where: and(eq(classes.schoolId, schoolId), eq(classes.isActive, true)),
                });
                const matchedClass = schoolClasses.find(
                  (c: any) =>
                    c.displayName.trim().toLowerCase() === className.toLowerCase() ||
                    c.gradeLevel.trim().toLowerCase() === className.toLowerCase()
                );
                if (!matchedClass) {
                  throw new Error(`Class '${className}' not found`);
                }
                matchedClassId = matchedClass.id;
                if (sectionName) {
                  const classSections = await sp.query.sections.findMany({
                    where: and(eq(sections.schoolId, schoolId), eq(sections.classId, matchedClass.id)),
                  });
                  const matchedSection = classSections.find(
                    (s: any) => s.name.trim().toLowerCase() === sectionName.toLowerCase()
                  );
                  if (!matchedSection) {
                    throw new Error(`Section '${sectionName}' not found in '${className}'`);
                  }
                  matchedSectionId = matchedSection.id;
                }
              }

              const firstNameEncrypted = encryptData(firstName);
              const lastNameEncrypted = encryptData(lastName || "");
              const firstNameSearchHash = computeSearchHash(firstName);
              const lastNameSearchHash = computeSearchHash(lastName || "");

              const existing = await sp.query.students.findFirst({
                where: and(
                  eq(students.schoolId, schoolId),
                  eq(students.admissionNumber, admissionNumber)
                ),
                columns: { id: true, currentClassId: true, currentSectionId: true },
              });

              if (existing) {
                await sp
                  .update(students)
                  .set({
                    firstNameEncrypted,
                    lastNameEncrypted,
                    firstNameSearchHash,
                    lastNameSearchHash,
                    gender: genderRaw as any,
                    category: categoryRaw as any,
                    ...(dobRaw ? { dateOfBirth: dob } : {}),
                    ...(matchedClassId ? { currentClassId: matchedClassId } : {}),
                    ...(matchedSectionId ? { currentSectionId: matchedSectionId } : {}),
                    updatedAt: new Date(),
                  })
                  .where(and(eq(students.id, existing.id), eq(students.schoolId, schoolId)));
              } else {
                if (!activeAy) {
                  throw new Error("No active academic year found for new student enrollment.");
                }
                if (!matchedClassId || !matchedSectionId) {
                  throw new Error("className and sectionName are required to enroll new student.");
                }

                const [inserted] = await sp
                  .insert(students)
                  .values({
                    schoolId,
                    academicYearId: activeAy.id,
                    admissionNumber,
                    firstNameEncrypted,
                    lastNameEncrypted,
                    firstNameSearchHash,
                    lastNameSearchHash,
                    dateOfBirth: dob,
                    gender: genderRaw as any,
                    category: categoryRaw as any,
                    currentClassId: matchedClassId,
                    currentSectionId: matchedSectionId,
                    admissionDate: new Date(),
                    isActive: true,
                  })
                  .returning({ id: students.id });

                if (inserted?.id) {
                  await sp.insert(studentClassHistory).values({
                    schoolId,
                    studentId: inserted.id,
                    academicYearId: activeAy.id,
                    classId: matchedClassId,
                    sectionId: matchedSectionId,
                  });

                  if (parentName) {
                    const cleanPhone = parentPhone.replace(/\D/g, "").slice(-10);
                    await sp.insert(studentFamilyMembers).values({
                      schoolId,
                      studentId: inserted.id,
                      relation: "FATHER",
                      nameEncrypted: encryptData(parentName),
                      mobileEncrypted: cleanPhone ? encryptData(cleanPhone) : null,
                      emailEncrypted: parentEmail ? encryptData(parentEmail) : null,
                      mobileSearchHash: cleanPhone ? computeSearchHash(cleanPhone) : null,
                      emailSearchHash: parentEmail ? computeSearchHash(parentEmail) : null,
                      isPrimaryContact: true,
                      isEmergencyContact: true,
                      hasConsentAuthority: true,
                    });
                  }
                }
              }
              break;
            }

            case "FEE_HEADS": {
              const name = pickField(row, "name", "Fee Head Name");
              let headTypeRaw = pickField(row, "headType", "Head Type").toUpperCase();
              if (headTypeRaw === "EXAMINATION") headTypeRaw = "EXAM";
              const frequencyRaw = pickField(row, "frequency", "Frequency").toUpperCase() || "QUARTERLY";
              const code = pickField(row, "code", "ledgerAccountCode", "Chart of Accounts Code") || null;

              if (!name) throw new Error("Fee Head Name is required");
              if (!VALID_FEE_HEAD_TYPES.has(headTypeRaw)) {
                throw new Error(`Invalid headType '${headTypeRaw}'`);
              }

              const dedupKey = name.toLowerCase();
              if (seenKeys.has(dedupKey)) throw new Error(`Duplicate fee head '${name}' in batch`);
              seenKeys.add(dedupKey);

              const category = frequencyRaw === "ONE_TIME" ? "ONE_TIME" : "RECURRING";
              const existing = await sp.query.feeHeads.findFirst({
                where: and(eq(feeHeads.schoolId, schoolId), eq(feeHeads.name, name)),
                columns: { id: true },
              });

              if (existing) {
                await sp
                  .update(feeHeads)
                  .set({
                    headType: headTypeRaw as any,
                    category,
                    ...(code ? { code: code.slice(0, 10) } : {}),
                    isActive: true,
                    updatedAt: new Date(),
                  })
                  .where(and(eq(feeHeads.id, existing.id), eq(feeHeads.schoolId, schoolId)));
              } else {
                await sp.insert(feeHeads).values({
                  schoolId,
                  name,
                  code: code ? code.slice(0, 10) : null,
                  headType: headTypeRaw as any,
                  category,
                  isActive: true,
                });
              }
              break;
            }

            case "CLASSES": {
              const className = pickField(row, "className", "Class Name");
              const gradeLevel = pickField(row, "gradeLevel", "Grade Level").toUpperCase();
              const sectionsRaw = pickField(row, "sections", "Sections (Comma-Separated)", "Sections");

              if (!className) throw new Error("className is required");
              if (!GRADE_SORT_ORDER[gradeLevel]) {
                throw new Error(`Invalid gradeLevel '${gradeLevel}'`);
              }
              if (!activeAy) throw new Error("No active academic year found.");

              const dedupKey = gradeLevel;
              if (seenKeys.has(dedupKey)) throw new Error(`Duplicate gradeLevel '${gradeLevel}' in batch`);
              seenKeys.add(dedupKey);

              let cls = await sp.query.classes.findFirst({
                where: and(
                  eq(classes.schoolId, schoolId),
                  eq(classes.academicYearId, activeAy.id),
                  eq(classes.gradeLevel, gradeLevel as any)
                ),
              });

              if (cls) {
                await sp
                  .update(classes)
                  .set({ displayName: className, isActive: true, updatedAt: new Date() })
                  .where(and(eq(classes.id, cls.id), eq(classes.schoolId, schoolId)));
              } else {
                const [insertedClass] = await sp
                  .insert(classes)
                  .values({
                    schoolId,
                    academicYearId: activeAy.id,
                    gradeLevel: gradeLevel as any,
                    displayName: className,
                    sortOrder: GRADE_SORT_ORDER[gradeLevel]!,
                    isActive: true,
                  })
                  .returning();
                cls = insertedClass;
              }

              if (cls && sectionsRaw) {
                const sectionNames = sectionsRaw
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                for (const secName of sectionNames) {
                  const existingSec = await sp.query.sections.findFirst({
                    where: and(
                      eq(sections.schoolId, schoolId),
                      eq(sections.classId, cls.id),
                      eq(sections.name, secName)
                    ),
                  });
                  if (!existingSec) {
                    await sp.insert(sections).values({
                      schoolId,
                      classId: cls.id,
                      name: secName,
                      capacity: 40,
                      isActive: true,
                    });
                  }
                }
              }
              break;
            }

            case "SUBJECTS": {
              const name = pickField(row, "name", "Subject Name");
              const code = pickField(row, "code", "Subject Code");
              const subjectTypeRaw = pickField(row, "subjectType", "Subject Type").toUpperCase() || "THEORY";
              const maxMarksRaw = pickField(row, "maxMarks", "Max Marks");
              const passingMarksRaw = pickField(row, "passingMarks", "Passing Marks");

              if (!name) throw new Error("Subject Name is required");
              if (!code) throw new Error("Subject Code is required");
              if (!VALID_SUBJECT_TYPES.has(subjectTypeRaw)) {
                throw new Error(`Invalid subjectType '${subjectTypeRaw}'`);
              }

              const dedupKey = code.toLowerCase();
              if (seenKeys.has(dedupKey)) throw new Error(`Duplicate subject code '${code}' in batch`);
              seenKeys.add(dedupKey);

              const maxMarks = maxMarksRaw && !isNaN(Number(maxMarksRaw)) ? Number(maxMarksRaw) : 100;
              const passingMarks =
                passingMarksRaw && !isNaN(Number(passingMarksRaw)) ? Number(passingMarksRaw) : 33;

              const existing = await sp.query.subjects.findFirst({
                where: and(eq(subjects.schoolId, schoolId), eq(subjects.code, code)),
                columns: { id: true },
              });

              if (existing) {
                await sp
                  .update(subjects)
                  .set({
                    name,
                    subjectType: subjectTypeRaw as any,
                    maxMarks,
                    passingMarks,
                    isActive: true,
                    updatedAt: new Date(),
                  })
                  .where(and(eq(subjects.id, existing.id), eq(subjects.schoolId, schoolId)));
              } else {
                await sp.insert(subjects).values({
                  schoolId,
                  code,
                  name,
                  subjectType: subjectTypeRaw as any,
                  maxMarks,
                  passingMarks,
                  isActive: true,
                });
              }
              break;
            }

            case "TEACHERS":
            case "STAFF": {
              const employeeCode = pickField(row, "employeeCode", "Employee Code");
              const firstName = pickField(row, "firstName", "First Name");
              const lastName = pickField(row, "lastName", "Last Name");
              const email = pickField(row, "email", "Official Email").toLowerCase();
              const phone = pickField(row, "phone", "Contact Phone");
              const deptName = pickField(row, "department", "Department") || "General";
              const desigName = pickField(row, "designation", "Designation") || (entityType === "TEACHERS" ? "Teacher" : "Staff");
              const roleRaw = entityType === "TEACHERS"
                ? "TEACHER"
                : (pickField(row, "role", "System Role").toUpperCase() || "STAFF");

              if (!employeeCode) throw new Error("employeeCode is required");
              if (!firstName) throw new Error("firstName is required");
              if (!email) throw new Error("email is required");
              if (!PERMITTED_STAFF_ROLES.has(roleRaw)) {
                throw new Error(
                  `Role '${roleRaw}' is not permitted for bulk import. Allowed: TEACHER, STAFF, ACCOUNTANT.`
                );
              }

              const dedupKey = employeeCode.toLowerCase();
              if (seenKeys.has(dedupKey)) throw new Error(`Duplicate employeeCode '${employeeCode}' in batch`);
              seenKeys.add(dedupKey);

              let dept = await sp.query.departments.findFirst({
                where: and(eq(departments.schoolId, schoolId), eq(departments.name, deptName)),
              });
              if (!dept) {
                const [createdDept] = await sp
                  .insert(departments)
                  .values({ schoolId, name: deptName, isActive: true })
                  .returning();
                dept = createdDept;
              }

              let desig = await sp.query.designations.findFirst({
                where: and(eq(designations.schoolId, schoolId), eq(designations.name, desigName)),
              });
              if (!desig) {
                const [createdDesig] = await sp
                  .insert(designations)
                  .values({
                    schoolId,
                    departmentId: dept!.id,
                    name: desigName,
                    mappedRole: roleRaw,
                    isTeaching: roleRaw === "TEACHER",
                    isActive: true,
                  })
                  .returning();
                desig = createdDesig;
              }

              const cleanPhone = phone.replace(/\D/g, "").slice(-10) || "0000000000";
              const existingStaff = await sp.query.staff.findFirst({
                where: and(eq(staff.schoolId, schoolId), eq(staff.employeeCode, employeeCode)),
              });

              if (existingStaff) {
                await sp
                  .update(staff)
                  .set({
                    departmentId: dept!.id,
                    designationId: desig!.id,
                    firstNameEncrypted: encryptData(firstName),
                    lastNameEncrypted: encryptData(lastName || ""),
                    mobileEncrypted: encryptData(cleanPhone),
                    isActive: true,
                    updatedAt: new Date(),
                  })
                  .where(and(eq(staff.id, existingStaff.id), eq(staff.schoolId, schoolId)));
              } else {
                let user = await sp.query.users.findFirst({
                  where: and(eq(users.schoolId, schoolId), eq(users.email, email)),
                });
                if (!user) {
                  const tempPw = generateRoleTempPassword(
                    roleRaw === "TEACHER" || roleRaw === "ACCOUNTANT" ? roleRaw : "STAFF",
                    cleanPhone
                  );
                  const passwordHash = await bcrypt.hash(tempPw, 10);
                  const [createdUser] = await sp
                    .insert(users)
                    .values({
                      schoolId,
                      email,
                      mobileEncrypted: encryptData(cleanPhone),
                      passwordHash,
                      mustChangePassword: true,
                      isActive: true,
                      isEmailVerified: true,
                    })
                    .returning();
                  user = createdUser;
                }

                await sp.insert(persons).values({
                  schoolId,
                  userId: user!.id,
                  primaryType: "STAFF",
                  firstNameEncrypted: encryptData(firstName),
                  lastNameEncrypted: encryptData(lastName || ""),
                  firstNameSearchHash: computeSearchHash(firstName),
                  lastNameSearchHash: computeSearchHash(lastName || ""),
                  gender: "OTHER",
                  dateOfBirth: new Date("1990-01-01"),
                  primaryEmailEncrypted: encryptData(email),
                  primaryMobileEncrypted: encryptData(cleanPhone),
                  isActive: true,
                });

                if (roleRaw === "TEACHER" || roleRaw === "ACCOUNTANT") {
                  let roleRow = await sp.query.roles.findFirst({
                    where: and(eq(roles.schoolId, schoolId), eq(roles.name, roleRaw as any)),
                  });
                  if (!roleRow) {
                    const [createdRole] = await sp
                      .insert(roles)
                      .values({
                        schoolId,
                        name: roleRaw as any,
                        displayName: roleRaw,
                        isSystemRole: true,
                      })
                      .returning();
                    roleRow = createdRole;
                  }
                  if (roleRow) {
                    const existingUr = await sp.query.userRoles.findFirst({
                      where: and(
                        eq(userRoles.userId, user!.id),
                        eq(userRoles.roleId, roleRow.id),
                        eq(userRoles.schoolId, schoolId)
                      ),
                    });
                    if (!existingUr) {
                      await sp.insert(userRoles).values({
                        schoolId,
                        userId: user!.id,
                        roleId: roleRow.id,
                      });
                    }
                  }
                }

                await sp.insert(staff).values({
                  schoolId,
                  userId: user!.id,
                  employeeCode,
                  departmentId: dept!.id,
                  designationId: desig!.id,
                  contractType: "PERMANENT",
                  joiningDate: new Date(),
                  firstNameEncrypted: encryptData(firstName),
                  lastNameEncrypted: encryptData(lastName || ""),
                  dateOfBirthEncrypted: encryptData("1990-01-01"),
                  genderEncrypted: encryptData("OTHER"),
                  mobileEncrypted: encryptData(cleanPhone),
                  emailEncrypted: encryptData(email),
                  isActive: true,
                });
              }
              break;
            }
          }
        });

        successCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Validation error";
        errors.push({ rowNumber, row, error: message });
      }
    }

    // Emit durable domain events & audit logs when any rows were imported
    if (successCount > 0) {
      if (entityType === "STUDENTS") {
        await tx.insert(domainEvents).values({
          schoolId,
          aggregateId: payload.jobId,
          eventType: "StudentImportedEvent",
          payload: {
            jobId: payload.jobId,
            recordCount: successCount,
            errorCount: errors.length,
            importedByUserId: userId,
          },
          status: "PENDING",
        });
      }

      await tx.insert(domainEvents).values({
        schoolId,
        aggregateId: payload.jobId,
        eventType: "ImportCompletedEvent",
        payload: {
          jobId: payload.jobId,
          datasetKey: entityType,
          recordCount: successCount,
          errorCount: errors.length,
          importedByUserId: userId,
        },
        status: "PENDING",
      });
    }

    await tx.insert(auditLogs).values({
      schoolId,
      userId,
      userEmail: userEmail || "system@schoolmitra.internal",
      userRole: userRole || "SCHOOL_ADMIN",
      action: "WRITE",
      tableName: "import_export_jobs",
      recordId: payload.jobId,
      purposeId: "bulk_data_import",
      ipAddress: "0.0.0.0",
      userAgent: "ImportExportProcessor",
      metadata: {
        datasetKey: entityType,
        recordCount: successCount,
        errorCount: errors.length,
      },
    });
  });

  // Generate rejected-rows CSV with formula sanitization if any errors occurred
  let errorCsvKey: string | undefined;
  if (errors.length > 0) {
    const errorHeaders = ["Row Number", ...headers, "Validation Errors"];
    const errorLines = [
      errorHeaders.map((h) => csvEscape(sanitizeForSpreadsheet(h))).join(","),
      ...errors.map((e) =>
        [
          String(e.rowNumber),
          ...headers.map((h) => csvEscape(sanitizeForSpreadsheet(e.row[h] ?? ""))),
          csvEscape(sanitizeForSpreadsheet(`Line ${e.rowNumber}: ${e.error}`)),
        ].join(",")
      ),
    ];
    const errorBuffer = Buffer.from(errorLines.join("\n") + "\n", "utf-8");
    errorCsvKey = `schools/${schoolId}/imports/errors/${payload.jobId}_errors.csv`;
    const errUpload = await uploadBufferToS3(errorCsvKey, errorBuffer, "text/csv; charset=utf-8");
    if (!errUpload.success) {
      throw new Error(errUpload.error || "Failed to upload import error CSV.");
    }
  }

  return {
    recordCount: successCount,
    errorCount: errors.length,
    errorCsvKey,
    fatalErrorMessage:
      successCount === 0 && errors.length > 0
        ? `All ${errors.length} row(s) failed validation. Download the rejected rows CSV for details.`
        : undefined,
  };
}

// ─── Main Pure Entry Point ───────────────────────────────────────────────────

export async function executeImportExportJob(
  payload: ImportExportJobPayload
): Promise<ImportExportExecutionResult> {
  const { jobId, schoolId, jobType } = payload;

  await markProcessing(schoolId, jobId);

  try {
    if (jobType === "EXPORT") {
      const { fileKey, recordCount, contentType } = await handleExport(payload);
      const status = await markCompleted(schoolId, jobId, {
        fileKey,
        recordCount,
        errorCount: 0,
        metadataPatch: { contentType },
      });
      return {
        success: true,
        jobId,
        status,
        fileKey,
        recordCount,
        errorCount: 0,
      };
    }

    if (jobType === "IMPORT") {
      const { recordCount, errorCount, errorCsvKey, fatalErrorMessage } =
        await handleImport(payload);

      if (fatalErrorMessage) {
        await markFailed(schoolId, jobId, fatalErrorMessage, {
          errorCount,
          ...(errorCsvKey ? { errorCsvKey } : {}),
        });
        return {
          success: false,
          jobId,
          status: "FAILED",
          errorCsvKey,
          recordCount: 0,
          errorCount,
        };
      }

      const status = await markCompleted(schoolId, jobId, {
        recordCount,
        errorCount,
        ...(errorCsvKey ? { errorCsvKey } : {}),
      });

      return {
        success: true,
        jobId,
        status,
        errorCsvKey,
        recordCount,
        errorCount,
      };
    }

    throw new Error(`Unsupported jobType: ${String(jobType)}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown import/export error";
    await markFailed(schoolId, jobId, message);
    throw err;
  }
}
