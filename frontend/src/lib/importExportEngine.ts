/**
 * Universal Import / Export Pipeline Engine (Sprint S20)
 *
 * Implements:
 * 1. Schema-driven Dataset Definitions (Students, Staff, Classes, Subjects, Fees, Salary, Holidays)
 * 2. Downloadable CSV Template Generation with sample data
 * 3. Dry-Run Validation with Line Number Error Reporting
 * 4. Error-Row CSV Exporter for One-Click Correction
 * 5. DPDP & Security Compliant Export Sanitizer (Explicit Column Allowlisting & Secret Redaction)
 */

export type ImportDatasetKey =
  | "STUDENTS"
  | "STAFF"
  | "CLASSES"
  | "SUBJECTS"
  | "FEE_HEADS"
  | "SALARY_TEMPLATES"
  | "HOLIDAYS";

export interface ColumnDefinition {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "number" | "date" | "enum";
  allowedEnums?: string[] | undefined;
  sampleValue: string;
  isSensitive?: boolean | undefined; // Must be redacted on export unless authorized
}

export interface DatasetSchema {
  key: ImportDatasetKey;
  displayName: string;
  description: string;
  uniqueKeyField: string;
  columns: ColumnDefinition[];
}

export const DATASET_SCHEMAS: Record<ImportDatasetKey, DatasetSchema> = {
  STUDENTS: {
    key: "STUDENTS",
    displayName: "Students Directory",
    description: "Import enrolled students, class/section placement, and primary parent contacts.",
    uniqueKeyField: "admissionNumber",
    columns: [
      { key: "admissionNumber", label: "Admission Number", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "firstName", label: "First Name", required: true, type: "string", sampleValue: "Aarav" },
      { key: "lastName", label: "Last Name", required: true, type: "string", sampleValue: "Sharma" },
      { key: "gender", label: "Gender", required: true, type: "enum", allowedEnums: ["MALE", "FEMALE", "OTHER"], sampleValue: "MALE" },
      { key: "dob", label: "Date of Birth (YYYY-MM-DD)", required: true, type: "date", sampleValue: "2012-05-14" },
      { key: "className", label: "Class Name", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "parentName", label: "Parent / Guardian Name", required: true, type: "string", sampleValue: "Rajesh Sharma" },
      { key: "parentPhone", label: "Parent Phone", required: true, type: "string", sampleValue: "+919876543210" },
      { key: "parentEmail", label: "Parent Email", required: false, type: "string", sampleValue: "rajesh.sharma@example.com" },
      { key: "category", label: "Category (Optional)", required: false, type: "enum", allowedEnums: ["GENERAL", "SC", "ST", "OBC", "EWS"], sampleValue: "GENERAL" },
    ],
  },
  STAFF: {
    key: "STAFF",
    displayName: "Teaching & Non-Teaching Staff",
    description: "Import employee records, departments, designations, and system roles.",
    uniqueKeyField: "employeeCode",
    columns: [
      { key: "employeeCode", label: "Employee Code", required: true, type: "string", sampleValue: "EMP-101" },
      { key: "firstName", label: "First Name", required: true, type: "string", sampleValue: "Priya" },
      { key: "lastName", label: "Last Name", required: true, type: "string", sampleValue: "Verma" },
      { key: "email", label: "Official Email", required: true, type: "string", sampleValue: "priya.verma@schoolmitra.in" },
      { key: "phone", label: "Contact Phone", required: true, type: "string", sampleValue: "+919876543211" },
      { key: "department", label: "Department", required: true, type: "string", sampleValue: "Mathematics" },
      { key: "designation", label: "Designation", required: true, type: "string", sampleValue: "Senior TGT Teacher" },
      { key: "role", label: "System Role", required: true, type: "enum", allowedEnums: ["TEACHER", "STAFF", "ACCOUNTANT"], sampleValue: "TEACHER" },
    ],
  },
  CLASSES: {
    key: "CLASSES",
    displayName: "Classes & Sections",
    description: "Import school class hierarchy, grade levels, and section divisions.",
    uniqueKeyField: "className",
    columns: [
      { key: "className", label: "Class Name", required: true, type: "string", sampleValue: "Class 9" },
      { key: "gradeLevel", label: "Grade Level", required: true, type: "enum", allowedEnums: ["NURSERY", "LKG", "UKG", "CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5", "CLASS_6", "CLASS_7", "CLASS_8", "CLASS_9", "CLASS_10", "CLASS_11", "CLASS_12"], sampleValue: "CLASS_9" },
      { key: "stream", label: "Stream (Optional)", required: false, type: "enum", allowedEnums: ["SCIENCE", "COMMERCE", "ARTS", "HUMANITIES", "VOCATIONAL"], sampleValue: "" },
      { key: "sections", label: "Sections (Comma-Separated)", required: true, type: "string", sampleValue: "A, B, C" },
    ],
  },
  SUBJECTS: {
    key: "SUBJECTS",
    displayName: "Curriculum Subjects",
    description: "Import subject catalogues, codes, categories, and period requirements.",
    uniqueKeyField: "code",
    columns: [
      { key: "name", label: "Subject Name", required: true, type: "string", sampleValue: "Mathematics" },
      { key: "code", label: "Subject Code", required: true, type: "string", sampleValue: "MATH-041" },
      { key: "subjectType", label: "Subject Type", required: true, type: "enum", allowedEnums: ["THEORY", "PRACTICAL", "LANGUAGE", "ACTIVITY", "CO_SCHOLASTIC"], sampleValue: "THEORY" },
      { key: "weeklyPeriods", label: "Weekly Periods", required: true, type: "number", sampleValue: "6" },
      { key: "isOptional", label: "Is Optional (TRUE/FALSE)", required: false, type: "string", sampleValue: "FALSE" },
    ],
  },
  FEE_HEADS: {
    key: "FEE_HEADS",
    displayName: "Fee Structure Heads",
    description: "Import institutional fee heads, payment frequencies, and accounting ledger categories.",
    uniqueKeyField: "name",
    columns: [
      { key: "name", label: "Fee Head Name", required: true, type: "string", sampleValue: "Tuition Fee Q1" },
      { key: "headType", label: "Head Type", required: true, type: "enum", allowedEnums: ["TUITION", "ADMISSION", "TRANSPORT", "HOSTEL", "LAB", "LIBRARY", "EXAM", "EXAMINATION", "SPORTS", "ACTIVITY", "MISCELLANEOUS"], sampleValue: "TUITION" },
      { key: "frequency", label: "Frequency", required: true, type: "enum", allowedEnums: ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "ONE_TIME"], sampleValue: "QUARTERLY" },
      { key: "isMandatory", label: "Is Mandatory (TRUE/FALSE)", required: true, type: "string", sampleValue: "TRUE" },
      { key: "ledgerAccountCode", label: "Chart of Accounts Code", required: false, type: "string", sampleValue: "4100" },
    ],
  },
  SALARY_TEMPLATES: {
    key: "SALARY_TEMPLATES",
    displayName: "HR Salary Templates",
    description: "Import salary component rules, allowances, and statutory deduction percentages.",
    uniqueKeyField: "gradeName",
    columns: [
      { key: "gradeName", label: "Grade Name", required: true, type: "string", sampleValue: "TGT Teacher Scale 1" },
      { key: "basicSalary", label: "Basic Monthly Salary (₹)", required: true, type: "number", sampleValue: "45000" },
      { key: "hraPercent", label: "HRA Percentage", required: true, type: "number", sampleValue: "20" },
      { key: "daPercent", label: "DA Percentage", required: true, type: "number", sampleValue: "10" },
      { key: "pfPercent", label: "PF Percentage", required: true, type: "number", sampleValue: "12" },
    ],
  },
  HOLIDAYS: {
    key: "HOLIDAYS",
    displayName: "Academic Calendar Holidays",
    description: "Import national, gazetted, and school-specific holiday schedule.",
    uniqueKeyField: "title",
    columns: [
      { key: "title", label: "Holiday Title", required: true, type: "string", sampleValue: "Republic Day" },
      { key: "date", label: "Date (YYYY-MM-DD)", required: true, type: "date", sampleValue: "2027-01-26" },
      { key: "holidayType", label: "Type", required: true, type: "enum", allowedEnums: ["NATIONAL", "REGIONAL", "FESTIVAL"], sampleValue: "NATIONAL" },
      { key: "description", label: "Description (Optional)", required: false, type: "string", sampleValue: "National gazetted holiday" },
    ],
  },
};

export interface RowValidationResult {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
}

export interface BatchValidationSummary {
  datasetKey: ImportDatasetKey;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: RowValidationResult[];
  canCommit: boolean;
}

/**
 * Generates CSV template string with headers and a formatted sample row.
 */
export function generateCsvTemplate(datasetKey: ImportDatasetKey): string {
  const schema = DATASET_SCHEMAS[datasetKey];
  if (!schema) return "";

  const headers = schema.columns.map((c) => `"${c.label}"`).join(",");
  const sampleRow = schema.columns.map((c) => `"${c.sampleValue}"`).join(",");

  return `${headers}\n${sampleRow}\n`;
}

/**
 * Parses raw CSV text into array of object rows.
 */
export function parseCsvText(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let insideQuote = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === "," && !insideQuote) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0] || "");
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawValues = parseLine(lines[i] || "");
    const rowObj: Record<string, string> = {};
    for (let h = 0; h < rawHeaders.length; h++) {
      const header = rawHeaders[h] || `col_${h}`;
      rowObj[header] = rawValues[h] || "";
    }
    rows.push(rowObj);
  }

  return { headers: rawHeaders, rows };
}

export const MAX_IMPORT_ROWS = 5000;

/**
 * Enforces institutional 5,000-row cap per import file.
 * Throws typed guidance error if boundary is exceeded.
 */
export function enforceImportRowLimit(rows: unknown[] | number): void {
  const count = typeof rows === "number" ? rows : rows?.length || 0;
  if (count <= 0) {
    throw new Error("No data rows supplied for import.");
  }
  if (count > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import file exceeds maximum allowed limit of ${MAX_IMPORT_ROWS} rows (received ${count} rows). Please split your file into smaller batches.`
    );
  }
}

/**
 * Validates parsed CSV rows against dataset schema with row-level error reporting.
 */
export function validateImportBatch(
  datasetKey: ImportDatasetKey,
  rows: Record<string, string>[]
): BatchValidationSummary {
  if (rows && rows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import file exceeds maximum allowed limit of ${MAX_IMPORT_ROWS} rows (received ${rows.length} rows). Please split your file into smaller batches.`
    );
  }

  const schema = DATASET_SCHEMAS[datasetKey];
  if (!schema) {
    throw new Error(`Unknown dataset key '${datasetKey}'.`);
  }

  const validatedRows: RowValidationResult[] = [];
  const seenUniqueKeys = new Set<string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const rawRow = rows[idx] || {};
    const rowNumber = idx + 2; // +1 for 0-index, +1 for CSV header line
    const errors: string[] = [];

    // Map column labels or keys
    for (const col of schema.columns) {
      const val = (rawRow[col.label] ?? rawRow[col.key] ?? "").trim();

      // Required check
      if (col.required && (!val || val.length === 0)) {
        errors.push(`Missing required field '${col.label}'.`);
        continue;
      }

      if (val.length > 0) {
        // Number check
        if (col.type === "number") {
          const num = Number(val);
          if (isNaN(num)) {
            errors.push(`Field '${col.label}' must be a valid number (got '${val}').`);
          }
        }

        // Date check
        if (col.type === "date") {
          const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
          if (!isValidDate) {
            errors.push(`Field '${col.label}' must be a valid YYYY-MM-DD date (got '${val}').`);
          }
        }

        // Enum check
        if (col.type === "enum" && col.allowedEnums) {
          if (!col.allowedEnums.includes(val.toUpperCase())) {
            errors.push(
              `Field '${col.label}' must be one of [${col.allowedEnums.join(", ")}] (got '${val}').`
            );
          }
        }
      }
    }

    // Duplicate key check within the same batch
    const uniqueVal = (rawRow[schema.uniqueKeyField] ?? rawRow[schema.columns.find((c) => c.key === schema.uniqueKeyField)?.label ?? ""] ?? "").trim();
    if (uniqueVal) {
      if (seenUniqueKeys.has(uniqueVal.toLowerCase())) {
        errors.push(`Duplicate key '${uniqueVal}' found within the import file.`);
      } else {
        seenUniqueKeys.add(uniqueVal.toLowerCase());
      }
    }

    validatedRows.push({
      rowNumber,
      data: rawRow,
      isValid: errors.length === 0,
      errors,
    });
  }

  const validRowsCount = validatedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = validatedRows.length - validRowsCount;

  return {
    datasetKey,
    totalRows: validatedRows.length,
    validRowsCount,
    invalidRowsCount,
    rows: validatedRows,
    canCommit: validatedRows.length > 0 && invalidRowsCount === 0,
  };
}

/**
 * Generates an error-report CSV containing only the rejected rows with their exact validation failure reasons and line numbers.
 */
export function generateRejectedRowsCsv(validation: BatchValidationSummary): string {
  const schema = DATASET_SCHEMAS[validation.datasetKey];
  const rejected = validation.rows.filter((r) => !r.isValid);
  if (rejected.length === 0) return "";

  const headers = [...schema.columns.map((c) => `"${c.label}"`), '"Validation Errors"'].join(",");
  const lines = rejected.map((r) => {
    const rowVals = schema.columns.map((col) => {
      const val = r.data[col.label] ?? r.data[col.key] ?? "";
      return `"${val.replace(/"/g, '""')}"`;
    });
    const errorText = r.errors.join("; ");
    const formattedError =
      errorText.startsWith("Line ") || errorText.startsWith("Row ")
        ? errorText
        : `Line ${r.rowNumber}: ${errorText}`;
    const errorStr = `"${formattedError.replace(/"/g, '""')}"`;
    return [...rowVals, errorStr].join(",");
  });

  return `${headers}\n${lines.join("\n")}\n`;
}

/**
 * DPDP & PCI Compliant Universal Export Sanitizer
 * Redacts sensitive credentials, PINs, encrypted tokens, and medical fields.
 */
export function sanitizeExportRecord(
  datasetKey: ImportDatasetKey,
  record: Record<string, any>
): Record<string, any> {
  const schema = DATASET_SCHEMAS[datasetKey];
  const sanitized: Record<string, any> = {};

  const SENSITIVE_DENYLIST = [
    "password",
    "passwordHash",
    "salt",
    "pin",
    "bankAccountNumber",
    "ifscCode",
    "panNumber",
    "aadhaarNumber",
    "token",
    "secret",
  ];

  for (const col of schema.columns) {
    if (SENSITIVE_DENYLIST.some((k) => col.key.toLowerCase().includes(k.toLowerCase()))) {
      sanitized[col.label] = "REDACTED_CONFIDENTIAL";
    } else {
      sanitized[col.label] = record[col.key] ?? "";
    }
  }

  return sanitized;
}
