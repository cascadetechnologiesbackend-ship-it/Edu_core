/**
 * Bulk Import Resilience Engine (Phase D1-L3 / Charter BR4)
 *
 * Implements:
 * 1. Resilient parsing of messy school data (missing columns, mixed casing, phone variants, date formats, section variants)
 * 2. Fuzzy class and section name normalization ('10-A', '10 A', 'x-a', 'X A', 'Class 10 - A' -> classId + sectionId)
 * 3. Row-level resilience (valid rows persist, invalid rows yield detailed clerk reasons, zero all-or-nothing rollback)
 * 4. Idempotency (match on admissionNumber or name+class+guardian mobile; zero duplicates on re-upload)
 * 5. Downloadable clerk error report CSV with actionable fixes
 * 6. Finished state with real counts and next action deep-link
 */

import { db, type Db } from "@/db";
import {
  classes,
  sections,
  students,
  studentFamilyMembers,
  staff,
  departments,
  designations,
  users,
  roles,
  userRoles,
  persons,
  auditLogs,
  feeInvoices,
  academicYears,
} from "@schoolmitra/database";
import { eq, and, sql } from "drizzle-orm";
import { withTenant } from "./tenant";
import { encryptData, decryptData, computeSearchHash } from "./encryption";
import { StudentLifecycleEngine } from "./studentLifecycleEngine";
import { generateRoleTempPassword } from "./tempPassword";
import bcrypt from "bcryptjs";

// Maximum row cap
export const MAX_IMPORT_ROWS = 5000;

export interface ClerkRowReport {
  rowNumber: number;
  identifier: string; // admissionNumber, employeeCode, etc.
  displayName: string;
  classSection?: string | undefined;
  isValid: boolean;
  isDuplicate?: boolean | undefined;
  error?: string | undefined;
  actionableFix?: string | undefined;
  normalizedData?: Record<string, any> | undefined;
}

export interface DryRunValidationSummary {
  dataset: "STUDENTS" | "STAFF" | "FEES";
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicatesCount: number;
  rows: ClerkRowReport[];
  canCommit: boolean;
}

export interface ImportCommitSummary {
  success: boolean;
  dataset: "STUDENTS" | "STAFF" | "FEES";
  totalProcessed: number;
  createdCount: number;
  skippedCount: number;
  duplicatesMergedCount: number;
  errors: string[];
  rejectedRowsCsv: string;
  message: string;
  finishedState: {
    title: string;
    message: string;
    nextActionLabel: string;
    nextActionHref: string;
  };
}

// ─── 1. RESILIENT NORMALIZATION PRIMITIVES ─────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Normalizes any phone representation (+91, 91 prefix, spaces, dashes, parentheses) to 10 digits.
 * Resilient against: float artifacts (.0), multiple phone numbers separated by /, commas, etc.
 */
export function normalizePhone(rawPhone: unknown): { normalized: string | null; error?: string } {
  if (rawPhone === null || rawPhone === undefined) {
    return { normalized: null };
  }
  let str = String(rawPhone).trim();
  if (!str) return { normalized: null };

  // Strip Excel float artifact like 9876543210.0
  str = str.replace(/\.0+$/, "").trim();

  // If multiple phone numbers entered (e.g. "9876543210 / 9876543211" or "9876543210, 9876543211")
  const splitCandidate = str.split(/[/,&|]|\bor\b/i)[0]?.trim();
  if (splitCandidate) {
    str = splitCandidate;
  }

  let digits = str.replace(/\D/g, "");

  // Strip leading international / country code for India
  if (digits.length === 15 && digits.startsWith("00910")) {
    digits = digits.slice(5);
  } else if (digits.length === 14 && digits.startsWith("0091")) {
    digits = digits.slice(4);
  } else if (digits.length === 13 && digits.startsWith("910")) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    return { normalized: digits };
  }

  return {
    normalized: null,
    error: `Phone number '${str}' must be a 10-digit number (got ${digits.length} digits).`,
  };
}

/**
 * Normalizes date inputs from DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, YYYY-MM-DD, YYYY/MM/DD, or Excel serial numbers.
 */
export function normalizeDate(rawDate: unknown): { normalized: string | null; dateObj: Date | null; error?: string } {
  if (rawDate === null || rawDate === undefined) {
    return { normalized: null, dateObj: null };
  }

  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    const yyyy = rawDate.getUTCFullYear();
    const mm = String(rawDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(rawDate.getUTCDate()).padStart(2, "0");
    return { normalized: `${yyyy}-${mm}-${dd}`, dateObj: rawDate };
  }

  // Handle Excel serial date numbers (e.g. 41043 -> 2012-05-14)
  if (typeof rawDate === "number" || (!isNaN(Number(rawDate)) && !String(rawDate).includes("-") && !String(rawDate).includes("/"))) {
    const serial = Number(rawDate);
    if (serial > 20000 && serial < 60000) {
      const utcDays = Math.floor(serial - 25569);
      const utcMs = utcDays * 86400 * 1000;
      const dateObj = new Date(utcMs);
      const yyyy = dateObj.getUTCFullYear();
      const mm = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(dateObj.getUTCDate()).padStart(2, "0");
      return { normalized: `${yyyy}-${mm}-${dd}`, dateObj };
    }
  }

  const str = String(rawDate).trim();
  if (!str) return { normalized: null, dateObj: null };

  // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (allowing optional spaces around delimiters)
  const dmyMatch = str.match(/^(\d{1,2})\s*[/\-. ]\s*(\d{1,2})\s*[/\-. ]\s*(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]!, 10);
    const month = parseInt(dmyMatch[2]!, 10);
    const year = parseInt(dmyMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1940 && year <= 2035) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(`${iso}T00:00:00.000Z`);
      return { normalized: iso, dateObj };
    }
  }

  // 2. DD-MMM-YYYY or DD MMM YYYY (e.g. "14-May-2012", "14 May 2012", "15-Aug-2012")
  const dMmmYMatch = str.match(/^(\d{1,2})\s*[-/.\s]\s*([a-zA-Z]{3,9})\s*[-/.\s]\s*(\d{4})$/);
  if (dMmmYMatch) {
    const day = parseInt(dMmmYMatch[1]!, 10);
    const monthKey = dMmmYMatch[2]!.toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = parseInt(dMmmYMatch[3]!, 10);
    if (month && day >= 1 && day <= 31 && year >= 1940 && year <= 2035) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(`${iso}T00:00:00.000Z`);
      return { normalized: iso, dateObj };
    }
  }

  // 3. YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})\s*[/\-. ]\s*(\d{1,2})\s*[/\-. ]\s*(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1]!, 10);
    const month = parseInt(ymdMatch[2]!, 10);
    const day = parseInt(ymdMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1940 && year <= 2035) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(`${iso}T00:00:00.000Z`);
      return { normalized: iso, dateObj };
    }
  }

  // 4. Fallback date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1940 && parsed.getFullYear() <= 2035) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    return { normalized: iso, dateObj: parsed };
  }

  return {
    normalized: null,
    dateObj: null,
    error: `Invalid date '${str}'. Expected formats: DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD.`,
  };
}

/**
 * Normalizes gender to standard 'MALE' | 'FEMALE' | 'OTHER'.
 */
export function normalizeGender(rawGender: unknown): "MALE" | "FEMALE" | "OTHER" {
  if (!rawGender) return "MALE";
  const str = String(rawGender).trim().toUpperCase();
  if (str === "M" || str === "MALE" || str === "BOY" || str === "B") return "MALE";
  if (str === "F" || str === "FEMALE" || str === "GIRL" || str === "G") return "FEMALE";
  if (str === "OTHER" || str === "O" || str === "TRANSGENDER" || str === "T") return "OTHER";
  return "MALE";
}

/**
 * Normalizes messy casing and excess whitespace into clean Title Case.
 */
export function normalizeName(rawName: unknown): string {
  if (!rawName) return "";
  const cleaned = String(rawName).trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  // Check if string is all-caps or all-lower or mixed-caps
  return cleaned
    .split(" ")
    .map((word) => {
      if (word.length <= 1) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Splits and parses names into first and last names.
 */
export function parseNames(firstName?: unknown, lastName?: unknown, fullName?: unknown): { firstName: string; lastName: string } {
  let fn = normalizeName(firstName);
  let ln = normalizeName(lastName);

  if (!fn && fullName) {
    const full = normalizeName(fullName);
    const parts = full.split(" ");
    fn = parts[0] || "";
    ln = parts.slice(1).join(" ");
  } else if (fn && !ln && fn.includes(" ")) {
    const parts = fn.split(" ");
    fn = parts[0] || "";
    ln = parts.slice(1).join(" ");
  }

  if (fn && !ln) {
    ln = ".";
  }

  return { firstName: fn, lastName: ln };
}

// ─── 2. FUZZY CLASS & SECTION NORMALIZATION ──────────────────────────────────────────

const ROMAN_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
};

function getCanonicalClassKey(nameStr: string): string {
  if (!nameStr) return "";
  let s = nameStr.toLowerCase().trim();

  // Strip section suffixes if embedded, e.g. "10-a", "x a"
  s = s.replace(/[-/|:]\s*[a-z]$/i, "");
  s = s.replace(/\s+(?:sec(?:tion)?\s*)?[a-z]$/i, "");

  // Strip common words
  s = s.replace(/\b(class|grade|standard|std)\b/gi, "").trim();
  s = s.replace(/\b(\d+)(?:st|nd|rd|th)\b/gi, "$1").trim();

  // Replace isolated roman numeral
  for (const [roman, num] of Object.entries(ROMAN_NUMERALS)) {
    const re = new RegExp(`^${roman}$|^${roman}\\b|\\b${roman}$`, "i");
    if (re.test(s)) {
      s = s.replace(re, String(num)).trim();
      break;
    }
  }

  return s.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * Fuzzy resolves messy class and section strings ('10-A', '10 A', 'x-a', 'X A', 'Class 10 - A')
 * to configured tenant class & section IDs.
 */
export function resolveClassAndSection(
  rawClassInput: string,
  rawSectionInput: string,
  tenantClasses: { id: string; name?: string; displayName?: string; gradeLevel?: string }[],
  tenantSections: { id: string; classId: string; name: string }[]
): { classId: string; sectionId: string; className: string; sectionName: string } | { error: string; fix: string } {
  const rawClass = (rawClassInput || "").trim();
  let rawSection = (rawSectionInput || "").trim();

  if (!rawClass) {
    return {
      error: "Class name is missing.",
      fix: "Provide the class name in the spreadsheet (e.g. 'Class 10' or '10-A').",
    };
  }

  // 1. Extract embedded section from class string if section is blank or redundant
  // Handles '10-A', '10 A', 'x-a', 'X A', 'Class 10 - A', 'Class 10th-B'
  let extractedSection = rawSection;
  const embeddedSectionMatch = rawClass.match(/[-/|:\s]+(?:sec(?:tion)?\s*)?([a-zA-Z])$/i);
  if (embeddedSectionMatch && (!extractedSection || extractedSection.toLowerCase() === embeddedSectionMatch[1]?.toLowerCase())) {
    extractedSection = embeddedSectionMatch[1]?.toUpperCase() || "";
  }

  // Normalize section if provided like "Sec A" or "Section-A" or "10-A"
  if (extractedSection) {
    const secClean = extractedSection.replace(/^(?:class\s*\d+|sec(?:tion)?|\d+)[-\s]*/i, "").trim();
    if (secClean) extractedSection = secClean.toUpperCase();
  }

  // 2. Compute canonical key for input class
  const inputClassKey = getCanonicalClassKey(rawClass);

  // 3. Match against tenant classes
  let matchedClass = tenantClasses.find((c) => {
    const dispName = c.displayName || c.name || "";
    if (dispName.toLowerCase().trim() === rawClass.toLowerCase().trim()) return true;
    const cKey = getCanonicalClassKey(dispName);
    if (cKey && cKey === inputClassKey) return true;
    if (c.gradeLevel) {
      const glKey = getCanonicalClassKey(c.gradeLevel.replace("CLASS_", ""));
      if (glKey && glKey === inputClassKey) return true;
    }
    return false;
  });

  if (!matchedClass) {
    const available = tenantClasses.map((c) => c.displayName || c.name).join(", ");
    return {
      error: `Class '${rawClass}' not found in active school curriculum.`,
      fix: `Change class name to match one of the configured classes: ${available || "None configured"}.`,
    };
  }

  // 4. Match Section within the matched class
  const classSections = tenantSections.filter((s) => s.classId === matchedClass!.id);

  let matchedSection = classSections.find((s) => {
    if (!extractedSection) return false;
    return (s.name || "").toLowerCase().trim() === extractedSection.toLowerCase().trim();
  });

  // If no section specified and class has only one section, auto-resolve
  if (!matchedSection && !extractedSection && classSections.length === 1) {
    matchedSection = classSections[0];
  }

  if (!matchedSection) {
    const available = classSections.map((s) => s.name).join(", ");
    return {
      error: `Section '${extractedSection || "Blank"}' not found in Class '${matchedClass.displayName || matchedClass.name}'.`,
      fix: `Assign a valid section for this class: ${available || "No sections configured"}.`,
    };
  }

  return {
    classId: matchedClass.id,
    sectionId: matchedSection.id,
    className: matchedClass.displayName || matchedClass.name || "",
    sectionName: matchedSection.name,
  };
}

// ─── 3. RESILIENT HEADER & COLUMN EXTRACTION ──────────────────────────────────────────

/**
 * Searches a row dictionary by case-insensitive key or common aliases.
 */
function findRowValue(row: Record<string, string>, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const target = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanKey === target) {
        const val = row[key];
        if (val !== undefined && val !== null) {
          return String(val).trim();
        }
      }
    }
  }
  return "";
}

export function extractStudentRow(row: Record<string, string>): {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  sectionName: string;
  dob: string;
  gender: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  category: string;
} {
  const admissionNumber = findRowValue(row, [
    "admissionNumber",
    "admission number",
    "admission_no",
    "adm no",
    "adm_no",
    "enrollment no",
    "scholar no",
    "sr no",
    "admn no",
  ]);

  const rawFirstName = findRowValue(row, ["firstName", "first name", "first_name", "student name", "name", "student_name"]);
  const rawLastName = findRowValue(row, ["lastName", "last name", "last_name", "surname"]);
  const { firstName, lastName } = parseNames(rawFirstName, rawLastName);

  const className = findRowValue(row, ["className", "class name", "class", "grade", "standard"]);
  const sectionName = findRowValue(row, ["sectionName", "section", "sec"]);
  const dob = findRowValue(row, ["dob", "date of birth", "date of birth (yyyy-mm-dd)", "birth date", "dob (dd/mm/yyyy)"]);
  const gender = findRowValue(row, ["gender", "sex"]);
  const parentName = findRowValue(row, ["parentName", "parent / guardian name", "guardian name", "father name", "father_name", "parent"]);
  const parentPhone = findRowValue(row, ["parentPhone", "parent phone", "parent_phone", "mobile", "phone", "contact", "guardian phone", "guardian mobile"]);
  const parentEmail = findRowValue(row, ["parentEmail", "parent email", "email"]);
  const category = findRowValue(row, ["category", "caste"]) || "GENERAL";

  return {
    admissionNumber,
    firstName,
    lastName,
    className,
    sectionName,
    dob,
    gender,
    parentName,
    parentPhone,
    parentEmail,
    category,
  };
}

export function extractStaffRow(row: Record<string, string>): {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  role: string;
  gender: string;
  dob: string;
} {
  const employeeCode = findRowValue(row, ["employeeCode", "employee code", "emp code", "emp_code", "code", "staff id"]);
  const rawFirstName = findRowValue(row, ["firstName", "first name", "first_name", "staff name", "name"]);
  const rawLastName = findRowValue(row, ["lastName", "last name", "last_name"]);
  const { firstName, lastName } = parseNames(rawFirstName, rawLastName);

  const email = findRowValue(row, ["email", "official email", "official_email", "work email"]);
  const phone = findRowValue(row, ["phone", "contact phone", "contact_phone", "mobile", "mobile number"]);
  const department = findRowValue(row, ["department", "dept"]) || "General";
  const designation = findRowValue(row, ["designation", "post", "role description"]) || "Staff";
  const role = findRowValue(row, ["role", "system role", "system_role", "user role"]).toUpperCase() || "STAFF";
  const gender = findRowValue(row, ["gender", "sex"]);
  const dob = findRowValue(row, ["dob", "date of birth"]);

  return {
    employeeCode,
    firstName,
    lastName,
    email,
    phone,
    department,
    designation,
    role,
    gender,
    dob,
  };
}

export function extractFeeRow(row: Record<string, string>): {
  admissionNumber: string;
  grossAmount: number;
  dueDate?: string | undefined;
} {
  const admissionNumber = findRowValue(row, ["admissionNumber", "admission number", "adm no", "admission_no", "student id"]);
  const rawAmount = findRowValue(row, ["grossAmount", "gross amount", "amount", "balance", "opening balance", "dues"]);
  const dueDate = findRowValue(row, ["dueDate", "due date", "due_date"]);

  const grossAmount = parseFloat(rawAmount.replace(/[^0-9.-]/g, ""));

  return {
    admissionNumber,
    grossAmount,
    dueDate: dueDate || undefined,
  };
}

// ─── 4. RAW TEXT / CSV / TSV PARSER ──────────────────────────────────────────────────

/**
 * Parses raw pasted text or CSV string, supporting both Comma-Separated and Tab-Separated (Excel copy-paste).
 */
export function parseRawTextToRows(rawText: string): Record<string, string>[] {
  const lines = rawText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const firstLine = lines[0]!;
  const isTsv = firstLine.includes("\t") && !firstLine.includes(",");
  const delimiter = isTsv ? "\t" : ",";

  const parseLine = (line: string): string[] => {
    if (isTsv) {
      return line.split("\t").map((c) => c.trim().replace(/^"|"$/g, ""));
    }
    const result: string[] = [];
    let current = "";
    let insideQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(firstLine);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]!);
    const rowObj: Record<string, string> = {};
    let hasData = false;
    for (let h = 0; h < headers.length; h++) {
      const header = headers[h] || `col_${h}`;
      const val = values[h] ?? "";
      if (val) hasData = true;
      rowObj[header] = val;
    }
    if (hasData) {
      rows.push(rowObj);
    }
  }

  return rows;
}

// ─── 5. CLERK-FRIENDLY REJECTED ROWS CSV EXPORTER ────────────────────────────────────

export function generateClerkRejectedRowsCsv(
  reports: ClerkRowReport[],
  originalRows: Record<string, string>[]
): string {
  const rejected = reports.filter((r) => !r.isValid);
  if (rejected.length === 0) return "";

  // Get all unique columns from original rows
  const allHeadersSet = new Set<string>();
  for (const row of originalRows) {
    Object.keys(row).forEach((k) => allHeadersSet.add(k));
  }
  const headers = Array.from(allHeadersSet);

  const csvHeaders = [...headers.map((h) => `"${h.replace(/"/g, '""')}"`), '"Error Reason"', '"How to Fix"'].join(",");

  const csvLines = rejected.map((r) => {
    const orig = originalRows[r.rowNumber - 2] || {};
    const rowValues = headers.map((h) => {
      const v = orig[h] ?? "";
      return `"${v.replace(/"/g, '""')}"`;
    });
    const err = `"${(r.error || "Validation error").replace(/"/g, '""')}"`;
    const fix = `"${(r.actionableFix || "Correct value").replace(/"/g, '""')}"`;
    return [...rowValues, err, fix].join(",");
  });

  return `${csvHeaders}\n${csvLines.join("\n")}\n`;
}

// ─── 6. STUDENTS BATCH VALIDATION & DRY-RUN ──────────────────────────────────────────

export async function validateStudentImportRows(
  schoolId: string,
  rows: Record<string, string>[],
  dbExecutor: any = db
): Promise<DryRunValidationSummary> {
  const runValidation = async (executor: any) => {
    const tenantClasses = await executor.query.classes.findMany({
      where: and(eq(classes.schoolId, schoolId), eq(classes.isActive, true)),
    });
    const tenantSections = await executor.query.sections.findMany({
      where: and(eq(sections.schoolId, schoolId), eq(sections.isActive, true)),
    });

    const reports: ClerkRowReport[] = [];
    const seenAdmissionNumbers = new Set<string>();
    const seenNameClassPhones = new Map<string, string>(); // ncpKey -> admissionNumber

    for (let idx = 0; idx < rows.length; idx++) {
      const rawRow = rows[idx]!;
      const rowNumber = idx + 2;
      const extracted = extractStudentRow(rawRow);

      const errors: string[] = [];
      const fixes: string[] = [];

      // 1. Admission Number
      if (!extracted.admissionNumber) {
        errors.push("Missing admission number.");
        fixes.push("Provide student's unique admission number in 'Admission Number' column.");
      }

      // 2. Name
      if (!extracted.firstName) {
        errors.push("Missing first name.");
        fixes.push("Provide student's name in 'First Name' column.");
      }

      // 3. Class & Section
      const classRes = resolveClassAndSection(
        extracted.className,
        extracted.sectionName,
        tenantClasses,
        tenantSections
      );
      let resolvedClassSectionStr = "";
      if ("error" in classRes) {
        errors.push(classRes.error);
        fixes.push(classRes.fix);
      } else {
        resolvedClassSectionStr = `${classRes.className} - ${classRes.sectionName}`;
      }

      // 4. Date of Birth
      const dobRes = normalizeDate(extracted.dob);
      if (!dobRes.normalized) {
        errors.push(dobRes.error || "Missing or invalid Date of Birth.");
        fixes.push("Provide date of birth in DD/MM/YYYY or YYYY-MM-DD format.");
      }

      // 5. Parent Phone
      const phoneRes = normalizePhone(extracted.parentPhone);
      if (!phoneRes.normalized) {
        errors.push(phoneRes.error || "Missing or invalid Parent Phone.");
        fixes.push("Provide a valid 10-digit mobile number for guardian.");
      }

      // Duplicate & Conflict check within batch
      let isDuplicate = false;
      let duplicateReason = "";
      const admKey = extracted.admissionNumber.toLowerCase();
      if (admKey && seenAdmissionNumbers.has(admKey)) {
        isDuplicate = true;
        duplicateReason = `Admission number '${extracted.admissionNumber}' is repeated within this file.`;
      } else if (admKey) {
        seenAdmissionNumbers.add(admKey);
      }

      const ncpKey = `${extracted.firstName.toLowerCase()}_${resolvedClassSectionStr.toLowerCase()}_${phoneRes.normalized || ""}`;
      if (phoneRes.normalized && extracted.firstName && "classId" in classRes) {
        if (seenNameClassPhones.has(ncpKey)) {
          const priorAdm = seenNameClassPhones.get(ncpKey)!;
          if (priorAdm.toLowerCase() !== admKey) {
            errors.push(
              `Conflicting student match: Student '${extracted.firstName}' in ${resolvedClassSectionStr} with guardian mobile '${phoneRes.normalized}' has conflicting admission numbers ('${priorAdm}' vs '${extracted.admissionNumber}').`
            );
            fixes.push("Action required: resolve conflicting admission number for this student.");
          } else if (!isDuplicate) {
            isDuplicate = true;
            duplicateReason = `Duplicate student '${extracted.firstName}' in ${resolvedClassSectionStr} with guardian mobile ${phoneRes.normalized} found in this file.`;
          }
        } else {
          seenNameClassPhones.set(ncpKey, extracted.admissionNumber);
        }
      }

      // Check against database for duplicates and conflicts if no fatal format errors
      if (errors.length === 0 && admKey) {
        const existingStudent = await executor.query.students.findFirst({
          where: and(
            eq(students.schoolId, schoolId),
            eq(students.admissionNumber, extracted.admissionNumber)
          ),
        });
        if (existingStudent) {
          isDuplicate = true;
          duplicateReason = `Student with admission number '${extracted.admissionNumber}' already enrolled in school (will be safely skipped/merged).`;
        }
      }

      // Secondary idempotency conflict check against DB
      if (errors.length === 0 && !isDuplicate && "classId" in classRes && phoneRes.normalized && extracted.firstName) {
        const fnHash = computeSearchHash(extracted.firstName);
        const ln = extracted.lastName || ".";
        const lnHash = computeSearchHash(ln);
        const phoneHash = computeSearchHash(phoneRes.normalized);

        const candidateMatches = await executor.query.students.findMany({
          where: and(
            eq(students.schoolId, schoolId),
            eq(students.currentClassId, classRes.classId),
            eq(students.firstNameSearchHash, fnHash),
            eq(students.lastNameSearchHash, lnHash)
          ),
        });

        for (const candidate of candidateMatches) {
          const familyMatch = await executor.query.studentFamilyMembers.findFirst({
            where: and(
              eq(studentFamilyMembers.studentId, candidate.id),
              eq(studentFamilyMembers.schoolId, schoolId),
              eq(studentFamilyMembers.mobileSearchHash, phoneHash)
            ),
          });
          if (familyMatch) {
            if (candidate.admissionNumber.toLowerCase() !== admKey) {
              errors.push(
                `Conflicting student match: Student '${extracted.firstName} ${extracted.lastName}' in this class with guardian mobile '${phoneRes.normalized}' matches existing student with admission number '${candidate.admissionNumber}' (provided: '${extracted.admissionNumber}').`
              );
              fixes.push(`Action required: resolve conflicting admission number with existing student '${candidate.admissionNumber}'.`);
            } else {
              isDuplicate = true;
              duplicateReason = `Student with admission number '${extracted.admissionNumber}' already enrolled in school (will be safely skipped/merged).`;
            }
            break;
          }
        }
      }

      const isValid = errors.length === 0;

      reports.push({
        rowNumber,
        identifier: extracted.admissionNumber || `Row #${rowNumber}`,
        displayName: `${extracted.firstName} ${extracted.lastName}`.trim() || "Student",
        classSection: resolvedClassSectionStr || `${extracted.className} ${extracted.sectionName}`.trim(),
        isValid,
        isDuplicate,
        error: errors.length > 0 ? errors.join(" ") : isDuplicate ? duplicateReason : undefined,
        actionableFix: fixes.length > 0 ? fixes.join(" ") : undefined,
        normalizedData: isValid
          ? {
              admissionNumber: extracted.admissionNumber,
              firstName: extracted.firstName,
              lastName: extracted.lastName,
              dob: dobRes.normalized,
              gender: normalizeGender(extracted.gender),
              classId: "classId" in classRes ? classRes.classId : null,
              sectionId: "sectionId" in classRes ? classRes.sectionId : null,
              parentName: normalizeName(extracted.parentName) || "Guardian",
              parentPhone: phoneRes.normalized,
              parentEmail: extracted.parentEmail || null,
              category: extracted.category || "GENERAL",
            }
          : undefined,
      });
    }

    const validRowsCount = reports.filter((r) => r.isValid).length;
    const invalidRowsCount = reports.length - validRowsCount;
    const duplicatesCount = reports.filter((r) => r.isDuplicate).length;

    return {
      dataset: "STUDENTS" as const,
      totalRows: reports.length,
      validRowsCount,
      invalidRowsCount,
      duplicatesCount,
      rows: reports,
      canCommit: validRowsCount > 0,
    };
  };

  if (dbExecutor && typeof dbExecutor.transaction === "function" && dbExecutor !== db) {
    return await runValidation(dbExecutor);
  }
  return await withTenant(schoolId, runValidation);
}

// ─── 7. RESILIENT STUDENTS IMPORT COMMIT (Charter BR4: Row-Level Resilience) ─────────

export async function withRowTransaction<T>(
  schoolId: string,
  dbExecutor: any,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  if (dbExecutor && typeof dbExecutor.transaction === "function" && dbExecutor !== db) {
    return await dbExecutor.transaction(async (sp: any) => callback(sp));
  }
  return await withTenant(schoolId, async (tx: any) => callback(tx));
}

export async function executeStudentImportBatch(
  schoolId: string,
  rows: Record<string, string>[],
  context: {
    userId: string;
    userEmail?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
  },
  dbExecutor: any = db
): Promise<ImportCommitSummary> {
  const validation = await validateStudentImportRows(schoolId, rows, dbExecutor);

  let createdCount = 0;
  let skippedCount = 0;
  let duplicatesMergedCount = 0;
  const errors: string[] = [];
  const rejectedReports: ClerkRowReport[] = [];

  for (let idx = 0; idx < validation.rows.length; idx++) {
    const report = validation.rows[idx]!;

    if (!report.isValid) {
      skippedCount++;
      errors.push(`Row #${report.rowNumber}: ${report.error}`);
      rejectedReports.push(report);
      continue;
    }

    const norm = report.normalizedData!;

    try {
      const result = await withRowTransaction(schoolId, dbExecutor, async (tx) => {
        return await StudentLifecycleEngine.createImportedStudent(
          schoolId,
          {
            classId: norm.classId,
            sectionId: norm.sectionId,
            admissionNumber: norm.admissionNumber,
            firstName: norm.firstName,
            lastName: norm.lastName,
            dob: norm.dob,
            gender: norm.gender,
            parentName: norm.parentName,
            parentPhone: norm.parentPhone,
            parentEmail: norm.parentEmail,
            category: norm.category,
            performedByUserId: context.userId,
            performedByUserEmail: context.userEmail || "admin@schoolmitra.internal",
            performedByUserRole: context.userRole || "SCHOOL_ADMIN",
            requestIp: context.ipAddress || "0.0.0.0",
            userAgent: context.userAgent || "SchoolMitra Importer",
          },
          tx
        );
      });

      if (result.isNew) {
        createdCount++;
      } else {
        duplicatesMergedCount++;
      }
    } catch (err: any) {
      skippedCount++;
      const errMsg = err.message || "Failed to persist student record";
      errors.push(`Row #${report.rowNumber}: ${errMsg}`);
      rejectedReports.push({
        ...report,
        isValid: false,
        error: errMsg,
        actionableFix: "Verify student records and retry",
      });
    }
  }

  const rejectedRowsCsv = generateClerkRejectedRowsCsv(rejectedReports, rows);

  return {
    success: createdCount > 0 || duplicatesMergedCount > 0,
    dataset: "STUDENTS",
    totalProcessed: rows.length,
    createdCount,
    skippedCount,
    duplicatesMergedCount,
    errors,
    rejectedRowsCsv,
    message: `Imported ${createdCount} students, ${skippedCount} skipped with reasons, ${duplicatesMergedCount} duplicates merged. Next: assign fee structures.`,
    finishedState: {
      title: "Students Bulk Import Finished",
      message: `Imported ${createdCount} students, ${skippedCount} skipped with reasons, ${duplicatesMergedCount} duplicates merged. Next: assign fee structures.`,
      nextActionLabel: "Assign Fee Structures",
      nextActionHref: "/school/fees",
    },
  };
}

// ─── 8. STAFF BATCH VALIDATION & DRY-RUN ─────────────────────────────────────────────

const PERMITTED_STAFF_ROLES = new Set(["TEACHER", "STAFF", "ACCOUNTANT"]);

export async function validateStaffImportRows(
  schoolId: string,
  rows: Record<string, string>[],
  dbExecutor: any = db
): Promise<DryRunValidationSummary> {
  const runValidation = async (executor: any) => {
    const reports: ClerkRowReport[] = [];
    const seenEmployeeCodes = new Set<string>();
    const seenEmails = new Map<string, string>(); // email -> employeeCode

    for (let idx = 0; idx < rows.length; idx++) {
      const rawRow = rows[idx]!;
      const rowNumber = idx + 2;
      const extracted = extractStaffRow(rawRow);

      const errors: string[] = [];
      const fixes: string[] = [];

      // 1. Employee Code
      if (!extracted.employeeCode) {
        errors.push("Missing employee code.");
        fixes.push("Provide unique employee code (e.g. EMP-101) in 'Employee Code' column.");
      }

      // 2. Name
      if (!extracted.firstName) {
        errors.push("Missing staff first name.");
        fixes.push("Provide staff name in 'First Name' column.");
      }

      // 3. Email
      if (!extracted.email || !extracted.email.includes("@")) {
        errors.push(`Invalid official email '${extracted.email}'.`);
        fixes.push("Provide a valid staff email address (e.g. name@school.in).");
      }

      // 4. Phone
      const phoneRes = normalizePhone(extracted.phone);
      if (!phoneRes.normalized) {
        errors.push(phoneRes.error || "Missing or invalid phone number.");
        fixes.push("Provide a 10-digit mobile number for staff.");
      }

      // 5. System Role Clamping Guard
      const upperRole = extracted.role.toUpperCase().trim();
      if (!PERMITTED_STAFF_ROLES.has(upperRole)) {
        errors.push(
          `Role '${extracted.role}' is not permitted for bulk staff import. Permitted roles are: TEACHER, STAFF, ACCOUNTANT.`
        );
        fixes.push("Set System Role to TEACHER, STAFF, or ACCOUNTANT. Admin roles must be created via Super Admin console.");
      }

      // Duplicate & Conflict check
      let isDuplicate = false;
      let duplicateReason = "";
      const codeKey = extracted.employeeCode.toLowerCase();
      const emailKey = extracted.email.toLowerCase();

      if (codeKey && seenEmployeeCodes.has(codeKey)) {
        isDuplicate = true;
        duplicateReason = `Employee code '${extracted.employeeCode}' is repeated within this file.`;
      } else if (codeKey) {
        seenEmployeeCodes.add(codeKey);
      }

      if (emailKey) {
        if (seenEmails.has(emailKey)) {
          const priorCode = seenEmails.get(emailKey)!;
          if (priorCode.toLowerCase() !== codeKey) {
            errors.push(
              `Email '${extracted.email}' is repeated within this file with different employee code '${priorCode}' (provided: '${extracted.employeeCode}').`
            );
            fixes.push("Ensure each staff member has a distinct email address.");
          } else if (!isDuplicate) {
            isDuplicate = true;
            duplicateReason = `Email '${extracted.email}' is repeated within this file.`;
          }
        } else {
          seenEmails.set(emailKey, extracted.employeeCode);
        }
      }

      // Check DB for existing staff by code
      if (!isDuplicate && codeKey && errors.length === 0) {
        const existingStaff = await executor.query.staff.findFirst({
          where: and(eq(staff.schoolId, schoolId), eq(staff.employeeCode, extracted.employeeCode)),
        });
        if (existingStaff) {
          isDuplicate = true;
          duplicateReason = `Staff with employee code '${extracted.employeeCode}' already exists in institution.`;
        }
      }

      // Check DB for existing staff by user email conflict
      if (!isDuplicate && emailKey && errors.length === 0) {
        const existingUser = await executor.query.users.findFirst({
          where: and(eq(users.schoolId, schoolId), eq(users.email, emailKey)),
        });
        if (existingUser) {
          const existingStaffWithUser = await executor.query.staff.findFirst({
            where: and(eq(staff.schoolId, schoolId), eq(staff.userId, existingUser.id)),
          });
          if (existingStaffWithUser) {
            if (existingStaffWithUser.employeeCode.toLowerCase() === codeKey) {
              isDuplicate = true;
              duplicateReason = `Staff member with employee code '${extracted.employeeCode}' already registered in institution.`;
            } else {
              errors.push(
                `Email '${extracted.email}' is already associated with staff member having employee code '${existingStaffWithUser.employeeCode}' (provided: '${extracted.employeeCode}').`
              );
              fixes.push("Resolve conflicting employee code or email address.");
            }
          }
        }
      }

      const isValid = errors.length === 0;

      reports.push({
        rowNumber,
        identifier: extracted.employeeCode || `Row #${rowNumber}`,
        displayName: `${extracted.firstName} ${extracted.lastName}`.trim() || "Staff Member",
        classSection: `${extracted.department} / ${extracted.designation}`,
        isValid,
        isDuplicate,
        error: errors.length > 0 ? errors.join(" ") : isDuplicate ? duplicateReason : undefined,
        actionableFix: fixes.length > 0 ? fixes.join(" ") : undefined,
        normalizedData: isValid
          ? {
              employeeCode: extracted.employeeCode,
              firstName: extracted.firstName,
              lastName: extracted.lastName,
              email: emailKey,
              phone: phoneRes.normalized,
              department: extracted.department,
              designation: extracted.designation,
              role: upperRole,
              gender: normalizeGender(extracted.gender),
              dob: normalizeDate(extracted.dob).normalized || "1990-01-01",
            }
          : undefined,
      });
    }

    const validRowsCount = reports.filter((r) => r.isValid).length;
    const invalidRowsCount = reports.length - validRowsCount;
    const duplicatesCount = reports.filter((r) => r.isDuplicate).length;

    return {
      dataset: "STAFF" as const,
      totalRows: reports.length,
      validRowsCount,
      invalidRowsCount,
      duplicatesCount,
      rows: reports,
      canCommit: validRowsCount > 0,
    };
  };

  if (dbExecutor && typeof dbExecutor.transaction === "function" && dbExecutor !== db) {
    return await runValidation(dbExecutor);
  }
  return await withTenant(schoolId, runValidation);
}

// ─── 9. RESILIENT STAFF IMPORT COMMIT (Charter BR4) ──────────────────────────────────

export async function executeStaffImportBatch(
  schoolId: string,
  rows: Record<string, string>[],
  context: {
    userId: string;
    userEmail?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
  },
  dbExecutor: any = db
): Promise<ImportCommitSummary> {
  const validation = await validateStaffImportRows(schoolId, rows, dbExecutor);

  let createdCount = 0;
  let skippedCount = 0;
  let duplicatesMergedCount = 0;
  const errors: string[] = [];
  const rejectedReports: ClerkRowReport[] = [];

  // Pre-fetch departments and designations inside tenant context
  const fetchTenantMetadata = async (executor: any) => {
    const depts = await executor.query.departments.findMany({
      where: eq(departments.schoolId, schoolId),
    });
    const desigs = await executor.query.designations.findMany({
      where: eq(designations.schoolId, schoolId),
    });
    return { depts, desigs };
  };

  const { depts: existingDepts, desigs: existingDesigs } =
    dbExecutor && typeof dbExecutor.transaction === "function" && dbExecutor !== db
      ? await fetchTenantMetadata(dbExecutor)
      : await withTenant(schoolId, fetchTenantMetadata);

  const deptMap = new Map<string, string>();
  for (const d of existingDepts) {
    deptMap.set(d.name.toLowerCase().trim(), d.id);
  }

  const desigMap = new Map<string, string>();
  for (const d of existingDesigs) {
    desigMap.set(d.name.toLowerCase().trim(), d.id);
  }

  for (let idx = 0; idx < validation.rows.length; idx++) {
    const report = validation.rows[idx]!;

    if (!report.isValid) {
      skippedCount++;
      errors.push(`Row #${report.rowNumber}: ${report.error}`);
      rejectedReports.push(report);
      continue;
    }

    if (report.isDuplicate) {
      duplicatesMergedCount++;
      continue;
    }

    const norm = report.normalizedData!;

    try {
      await withRowTransaction(schoolId, dbExecutor, async (tx: any) => {
        // 1. Resolve Department
        const deptKey = norm.department.toLowerCase().trim();
        let targetDeptId = deptMap.get(deptKey);
        if (!targetDeptId) {
          const [newDept] = await tx
            .insert(departments)
            .values({
              schoolId,
              name: norm.department,
              isActive: true,
            })
            .returning();
          if (!newDept?.id) throw new Error(`Failed to create department '${norm.department}'`);
          targetDeptId = newDept.id as string;
          deptMap.set(deptKey, targetDeptId);
        }

        // 2. Resolve Designation
        const desigKey = norm.designation.toLowerCase().trim();
        let targetDesigId = desigMap.get(desigKey);
        if (!targetDesigId) {
          const isTeaching = norm.role === "TEACHER";
          const [newDesig] = await tx
            .insert(designations)
            .values({
              schoolId,
              departmentId: targetDeptId,
              name: norm.designation,
              mappedRole: norm.role,
              isTeaching,
              isActive: true,
            })
            .returning();
          if (!newDesig?.id) throw new Error(`Failed to create designation '${norm.designation}'`);
          targetDesigId = newDesig.id as string;
          desigMap.set(desigKey, targetDesigId);
        }

        // 3. User Account & Password
        const defaultPassword = generateRoleTempPassword(
          norm.role === "TEACHER" || norm.role === "ACCOUNTANT" ? norm.role : "STAFF",
          norm.phone
        );
        const passwordHash = await bcrypt.hash(defaultPassword, 12);

        let user = await tx.query.users.findFirst({
          where: and(eq(users.schoolId, schoolId), eq(users.email, norm.email)),
        });
        if (!user) {
          const [createdUser] = await tx
            .insert(users)
            .values({
              schoolId,
              email: norm.email,
              mobileEncrypted: encryptData(norm.phone),
              passwordHash,
              mustChangePassword: true,
              isActive: true,
              isEmailVerified: true,
            })
            .returning();
          if (!createdUser?.id) throw new Error(`Failed to create user credential for '${norm.email}'`);
          user = createdUser;
        }

        // 4. Person Record
        await tx.insert(persons).values({
          schoolId,
          userId: user.id,
          primaryType: "STAFF",
          firstNameEncrypted: encryptData(norm.firstName),
          lastNameEncrypted: encryptData(norm.lastName),
          firstNameSearchHash: computeSearchHash(norm.firstName),
          lastNameSearchHash: computeSearchHash(norm.lastName),
          gender: norm.gender,
          dateOfBirth: new Date(norm.dob),
          primaryEmailEncrypted: encryptData(norm.email),
          primaryMobileEncrypted: encryptData(norm.phone),
          isActive: true,
        });

        // 5. Role Assignment
        if (norm.role === "TEACHER" || norm.role === "ACCOUNTANT") {
          let targetRole = await tx.query.roles.findFirst({
            where: and(eq(roles.schoolId, schoolId), eq(roles.name, norm.role as any)),
          });
          if (!targetRole) {
            const [createdRole] = await tx
              .insert(roles)
              .values({
                schoolId,
                name: norm.role as any,
                displayName: norm.role,
                description: `System role for ${norm.role}`,
                isSystemRole: true,
              })
              .returning();
            targetRole = createdRole;
          }

          if (targetRole) {
            const existingUr = await tx.query.userRoles.findFirst({
              where: and(
                eq(userRoles.userId, user.id),
                eq(userRoles.roleId, targetRole.id),
                eq(userRoles.schoolId, schoolId)
              ),
            });
            if (!existingUr) {
              await tx.insert(userRoles).values({
                userId: user.id,
                roleId: targetRole.id,
                schoolId,
              });
            }
          }
        }

        // 6. Staff Profile Record
        const [newStaff] = await tx
          .insert(staff)
          .values({
            schoolId,
            userId: user.id,
            employeeCode: norm.employeeCode,
            departmentId: targetDeptId,
            designationId: targetDesigId,
            contractType: "PERMANENT",
            joiningDate: new Date(),
            firstNameEncrypted: encryptData(norm.firstName),
            lastNameEncrypted: encryptData(norm.lastName),
            dateOfBirthEncrypted: encryptData(norm.dob),
            genderEncrypted: encryptData(norm.gender),
            mobileEncrypted: encryptData(norm.phone),
            emailEncrypted: encryptData(norm.email),
            isActive: true,
            legalHold: false,
          })
          .returning();

        if (!newStaff?.id) {
          throw new Error(`Failed to create staff record for employee code '${norm.employeeCode}'`);
        }

        // 7. Audit Log
        await tx.insert(auditLogs).values({
          schoolId,
          userId: context.userId,
          userEmail: context.userEmail || "[audit-system]",
          userRole: (context.userRole as any) || "SCHOOL_ADMIN",
          action: "WRITE",
          tableName: "staff",
          recordId: newStaff.id,
          purposeId: "staff_import",
          ipAddress: context.ipAddress || "0.0.0.0",
          userAgent: context.userAgent || "SchoolMitra Importer",
          metadata: {
            employeeCode: norm.employeeCode,
            departmentId: targetDeptId,
            designationId: targetDesigId,
            role: norm.role,
            source: "bulk_import",
          },
        });
      });

      createdCount++;
    } catch (err: any) {
      skippedCount++;
      const errMsg = err.message || "Failed to persist staff record";
      errors.push(`Row #${report.rowNumber}: ${errMsg}`);
      rejectedReports.push({
        ...report,
        isValid: false,
        error: errMsg,
        actionableFix: "Correct data and retry",
      });
    }
  }

  const rejectedRowsCsv = generateClerkRejectedRowsCsv(rejectedReports, rows);

  return {
    success: createdCount > 0 || duplicatesMergedCount > 0,
    dataset: "STAFF",
    totalProcessed: rows.length,
    createdCount,
    skippedCount,
    duplicatesMergedCount,
    errors,
    rejectedRowsCsv,
    message: `Imported ${createdCount} staff, ${skippedCount} skipped with reasons, ${duplicatesMergedCount} duplicates merged. Next: review timetable.`,
    finishedState: {
      title: "Staff Bulk Import Finished",
      message: `Imported ${createdCount} staff, ${skippedCount} skipped with reasons, ${duplicatesMergedCount} duplicates merged. Next: review timetable.`,
      nextActionLabel: "Review Timetable",
      nextActionHref: "/school/timetable",
    },
  };
}

// ─── 10. OPENING FEE BALANCES VALIDATION & RESILIENT COMMIT ──────────────────────────

export async function validateFeeImportRows(
  schoolId: string,
  rows: Record<string, string>[],
  academicYearId: string,
  dbExecutor: any = db
): Promise<DryRunValidationSummary> {
  const runValidation = async (executor: any) => {
    const reports: ClerkRowReport[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const rawRow = rows[idx]!;
      const rowNumber = idx + 2;
      const extracted = extractFeeRow(rawRow);

      const errors: string[] = [];
      const fixes: string[] = [];

      if (!extracted.admissionNumber) {
        errors.push("Missing admission number.");
        fixes.push("Provide student admission number in 'Admission Number' column.");
      }

      if (isNaN(extracted.grossAmount) || extracted.grossAmount <= 0) {
        errors.push(`Invalid amount '${rawRow["grossAmount"] || rawRow["amount"] || rawRow["opening balance"] || rawRow["balance"] || rawRow["dues"] || ""}'. Must be a positive number.`);
        fixes.push("Enter a valid numerical amount (e.g. 4500).");
      }

      let studentName = "";
      if (extracted.admissionNumber) {
        const student = await executor.query.students.findFirst({
          where: and(
            eq(students.schoolId, schoolId),
            eq(students.admissionNumber, extracted.admissionNumber)
          ),
        });
        if (!student) {
          errors.push(`Student with Admission No '${extracted.admissionNumber}' is not enrolled in this school.`);
          fixes.push("Ensure student is imported or enrolled first before importing opening fee balances.");
        } else {
          const fn = decryptData(student.firstNameEncrypted) || "";
          const ln = decryptData(student.lastNameEncrypted) || "";
          studentName = `${fn} ${ln}`.trim() || "Student";
        }
      }

      const isValid = errors.length === 0;

      reports.push({
        rowNumber,
        identifier: extracted.admissionNumber || `Row #${rowNumber}`,
        displayName: studentName || "Student",
        classSection: `₹${extracted.grossAmount ? extracted.grossAmount.toLocaleString("en-IN") : 0}`,
        isValid,
        error: errors.length > 0 ? errors.join(" ") : undefined,
        actionableFix: fixes.length > 0 ? fixes.join(" ") : undefined,
        normalizedData: isValid
          ? {
              admissionNumber: extracted.admissionNumber,
              grossAmount: extracted.grossAmount,
              dueDate: normalizeDate(extracted.dueDate).normalized || undefined,
            }
          : undefined,
      });
    }

    const validRowsCount = reports.filter((r) => r.isValid).length;
    const invalidRowsCount = reports.length - validRowsCount;

    return {
      dataset: "FEES" as const,
      totalRows: reports.length,
      validRowsCount,
      invalidRowsCount,
      duplicatesCount: 0,
      rows: reports,
      canCommit: validRowsCount > 0,
    };
  };

  if (dbExecutor && typeof dbExecutor.transaction === "function" && dbExecutor !== db) {
    return await runValidation(dbExecutor);
  }
  return await withTenant(schoolId, runValidation);
}

export async function executeFeeImportBatch(
  schoolId: string,
  academicYearId: string,
  rows: Record<string, string>[],
  context: { userId: string; userEmail?: string },
  dbExecutor: any = db
): Promise<ImportCommitSummary> {
  const validation = await validateFeeImportRows(schoolId, rows, academicYearId, dbExecutor);

  let createdCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  const rejectedReports: ClerkRowReport[] = [];

  for (let idx = 0; idx < validation.rows.length; idx++) {
    const report = validation.rows[idx]!;

    if (!report.isValid) {
      skippedCount++;
      errors.push(`Row #${report.rowNumber}: ${report.error}`);
      rejectedReports.push(report);
      continue;
    }

    const norm = report.normalizedData!;

    try {
      await withRowTransaction(schoolId, dbExecutor, async (tx: any) => {
        const student = await tx.query.students.findFirst({
          where: and(
            eq(students.schoolId, schoolId),
            eq(students.admissionNumber, norm.admissionNumber)
          ),
        });

        if (!student) {
          throw new Error(`Student '${norm.admissionNumber}' not found.`);
        }

        const gross = norm.grossAmount;
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        const invoiceNumber = `IMP-${Date.now().toString().slice(-6)}-${randSuffix}`;
        const dueDate = norm.dueDate ? new Date(norm.dueDate) : new Date(Date.now() + 30 * 86400000);

        await tx.insert(feeInvoices).values({
          schoolId,
          studentId: student.id,
          academicYearId,
          invoiceNumber,
          term: "ANNUAL",
          grossAmount: gross.toFixed(2),
          discountAmount: "0",
          lateFeeAmount: "0",
          taxAmount: "0",
          netAmount: gross.toFixed(2),
          paidAmount: "0",
          balanceAmount: gross.toFixed(2),
          dueDate,
          status: "PENDING",
        });
      });

      createdCount++;
    } catch (err: any) {
      skippedCount++;
      const errMsg = err.message || "Failed to insert opening balance invoice";
      errors.push(`Row #${report.rowNumber}: ${errMsg}`);
      rejectedReports.push({
        ...report,
        isValid: false,
        error: errMsg,
        actionableFix: "Verify student and amount, then retry",
      });
    }
  }

  const rejectedRowsCsv = generateClerkRejectedRowsCsv(rejectedReports, rows);

  return {
    success: createdCount > 0,
    dataset: "FEES",
    totalProcessed: rows.length,
    createdCount,
    skippedCount,
    duplicatesMergedCount: 0,
    errors,
    rejectedRowsCsv,
    message: `Imported ${createdCount} opening fee balances, ${skippedCount} skipped with reasons. Next: view fee dues.`,
    finishedState: {
      title: "Opening Fee Balances Import Finished",
      message: `Imported ${createdCount} opening fee balances, ${skippedCount} skipped with reasons. Next: view fee dues.`,
      nextActionLabel: "View Fee Dues",
      nextActionHref: "/school/due-fees",
    },
  };
}

/**
 * Canonical action aliases matching the spec / journey test contract:
 * commitStaffImportAction -> executeStaffImportBatch
 * commitStudentImportAction -> executeStudentImportBatch
 */
export const commitStaffImportAction = executeStaffImportBatch;
export const commitStudentImportAction = executeStudentImportBatch;

