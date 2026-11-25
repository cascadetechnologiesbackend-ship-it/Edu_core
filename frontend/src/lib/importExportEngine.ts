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
  | "HOLIDAYS"
  | "ADMISSIONS"
  | "PARENTS"
  | "TIMETABLE"
  | "ATTENDANCE_OVERRIDE"
  | "EXAM_MARKS"
  | "LIBRARY_INVENTORY"
  | "TRANSPORT_ROUTES"
  | "HOSTEL_ROOMS"
  | "ASSETS_INVENTORY";

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
  ADMISSIONS: {
    key: "ADMISSIONS",
    displayName: "Admissions & Enquiries",
    description: "Import prospective student enquiries, applications, and admission statuses.",
    uniqueKeyField: "applicationNumber",
    columns: [
      { key: "applicationNumber", label: "Application Number", required: true, type: "string", sampleValue: "APP-2026-001" },
      { key: "studentName", label: "Student Name", required: true, type: "string", sampleValue: "Ananya Verma" },
      { key: "dob", label: "Date of Birth (YYYY-MM-DD)", required: true, type: "date", sampleValue: "2014-08-21" },
      { key: "gender", label: "Gender", required: true, type: "enum", allowedEnums: ["MALE", "FEMALE", "OTHER"], sampleValue: "FEMALE" },
      { key: "applyingForClass", label: "Applying For Class", required: true, type: "string", sampleValue: "Class 6" },
      { key: "parentName", label: "Parent Name", required: true, type: "string", sampleValue: "Suresh Verma" },
      { key: "parentPhone", label: "Parent Phone", required: true, type: "string", sampleValue: "+919876543220" },
      { key: "status", label: "Status", required: true, type: "enum", allowedEnums: ["ENQUIRY", "APPLIED", "SHORTLISTED", "ADMITTED", "REJECTED"], sampleValue: "APPLIED" },
    ],
  },
  PARENTS: {
    key: "PARENTS",
    displayName: "Parents & Guardians",
    description: "Import parent/guardian profiles linked to student admission numbers.",
    uniqueKeyField: "phone",
    columns: [
      { key: "phone", label: "Phone Number", required: true, type: "string", sampleValue: "+919876543210" },
      { key: "fullName", label: "Full Name", required: true, type: "string", sampleValue: "Rajesh Sharma" },
      { key: "email", label: "Email", required: false, type: "string", sampleValue: "rajesh.sharma@example.com" },
      { key: "relation", label: "Relation", required: true, type: "enum", allowedEnums: ["FATHER", "MOTHER", "GUARDIAN"], sampleValue: "FATHER" },
      { key: "studentAdmissionNumber", label: "Student Admission Number", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "occupation", label: "Occupation (Optional)", required: false, type: "string", sampleValue: "Engineer" },
    ],
  },
  TIMETABLE: {
    key: "TIMETABLE",
    displayName: "Class Timetable",
    description: "Import weekly class period schedules, subjects, teachers, and rooms.",
    uniqueKeyField: "slotKey",
    columns: [
      { key: "slotKey", label: "Slot Key", required: true, type: "string", sampleValue: "10A-MON-P1" },
      { key: "className", label: "Class Name", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "dayOfWeek", label: "Day of Week", required: true, type: "enum", allowedEnums: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"], sampleValue: "MONDAY" },
      { key: "periodNumber", label: "Period Number", required: true, type: "number", sampleValue: "1" },
      { key: "subjectCode", label: "Subject Code", required: true, type: "string", sampleValue: "MATH-041" },
      { key: "teacherEmployeeCode", label: "Teacher Employee Code", required: true, type: "string", sampleValue: "EMP-101" },
      { key: "roomNumber", label: "Room Number (Optional)", required: false, type: "string", sampleValue: "R-204" },
    ],
  },
  ATTENDANCE_OVERRIDE: {
    key: "ATTENDANCE_OVERRIDE",
    displayName: "Attendance Override",
    description: "Import bulk attendance corrections or backdated attendance records.",
    uniqueKeyField: "recordKey",
    columns: [
      { key: "recordKey", label: "Record Key", required: true, type: "string", sampleValue: "ADM-2026-001_2026-11-20" },
      { key: "admissionNumber", label: "Admission Number", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "date", label: "Date (YYYY-MM-DD)", required: true, type: "date", sampleValue: "2026-11-20" },
      { key: "status", label: "Attendance Status", required: true, type: "enum", allowedEnums: ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"], sampleValue: "PRESENT" },
      { key: "reason", label: "Override Reason", required: true, type: "string", sampleValue: "Medical certificate submitted" },
    ],
  },
  EXAM_MARKS: {
    key: "EXAM_MARKS",
    displayName: "Exam Marks",
    description: "Import student examination marks per subject and exam cycle.",
    uniqueKeyField: "markKey",
    columns: [
      { key: "markKey", label: "Mark Key", required: true, type: "string", sampleValue: "UT1-ADM-2026-001-MATH" },
      { key: "examCode", label: "Exam Code", required: true, type: "string", sampleValue: "UT-1-2026" },
      { key: "admissionNumber", label: "Admission Number", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "subjectCode", label: "Subject Code", required: true, type: "string", sampleValue: "MATH-041" },
      { key: "marksObtained", label: "Marks Obtained", required: true, type: "number", sampleValue: "88" },
      { key: "maxMarks", label: "Max Marks", required: true, type: "number", sampleValue: "100" },
      { key: "isAbsent", label: "Is Absent (TRUE/FALSE)", required: false, type: "string", sampleValue: "FALSE" },
    ],
  },
  LIBRARY_INVENTORY: {
    key: "LIBRARY_INVENTORY",
    displayName: "Library Inventory",
    description: "Import library books, ISBNs, authors, categories, and copy counts.",
    uniqueKeyField: "accessionNumber",
    columns: [
      { key: "accessionNumber", label: "Accession Number", required: true, type: "string", sampleValue: "LIB-0001" },
      { key: "title", label: "Book Title", required: true, type: "string", sampleValue: "Concepts of Physics Vol 1" },
      { key: "author", label: "Author", required: true, type: "string", sampleValue: "H.C. Verma" },
      { key: "isbn", label: "ISBN (Optional)", required: false, type: "string", sampleValue: "978-8177091878" },
      { key: "category", label: "Category", required: true, type: "string", sampleValue: "Science" },
      { key: "totalCopies", label: "Total Copies", required: true, type: "number", sampleValue: "10" },
    ],
  },
  TRANSPORT_ROUTES: {
    key: "TRANSPORT_ROUTES",
    displayName: "Transport Routes",
    description: "Import school bus routes, vehicle numbers, drivers, and monthly fees.",
    uniqueKeyField: "routeCode",
    columns: [
      { key: "routeCode", label: "Route Code", required: true, type: "string", sampleValue: "RT-01" },
      { key: "routeName", label: "Route Name", required: true, type: "string", sampleValue: "Sector 14 - Main Campus" },
      { key: "vehicleNumber", label: "Vehicle Number", required: true, type: "string", sampleValue: "DL-1PC-4521" },
      { key: "driverName", label: "Driver Name", required: true, type: "string", sampleValue: "Ramesh Kumar" },
      { key: "driverPhone", label: "Driver Phone", required: true, type: "string", sampleValue: "+919876543299" },
      { key: "monthlyFee", label: "Monthly Fee (₹)", required: true, type: "number", sampleValue: "2200" },
    ],
  },
  HOSTEL_ROOMS: {
    key: "HOSTEL_ROOMS",
    displayName: "Hostel Rooms",
    description: "Import hostel blocks, room numbers, capacities, and monthly charges.",
    uniqueKeyField: "roomCode",
    columns: [
      { key: "roomCode", label: "Room Code", required: true, type: "string", sampleValue: "BH-101" },
      { key: "hostelName", label: "Hostel Name", required: true, type: "string", sampleValue: "Boys Hostel A" },
      { key: "roomNumber", label: "Room Number", required: true, type: "string", sampleValue: "101" },
      { key: "roomType", label: "Room Type", required: true, type: "enum", allowedEnums: ["SINGLE", "DOUBLE", "TRIPLE", "DORMITORY"], sampleValue: "DOUBLE" },
      { key: "capacity", label: "Bed Capacity", required: true, type: "number", sampleValue: "2" },
      { key: "monthlyFee", label: "Monthly Fee (₹)", required: true, type: "number", sampleValue: "6500" },
    ],
  },
  ASSETS_INVENTORY: {
    key: "ASSETS_INVENTORY",
    displayName: "Assets Inventory",
    description: "Import school fixed assets, equipment, serial numbers, and locations.",
    uniqueKeyField: "assetTag",
    columns: [
      { key: "assetTag", label: "Asset Tag", required: true, type: "string", sampleValue: "AST-2026-001" },
      { key: "name", label: "Asset Name", required: true, type: "string", sampleValue: "Smart Interactive Board" },
      { key: "category", label: "Category", required: true, type: "string", sampleValue: "IT Equipment" },
      { key: "location", label: "Location", required: true, type: "string", sampleValue: "Room 102" },
      { key: "purchaseDate", label: "Purchase Date (YYYY-MM-DD)", required: true, type: "date", sampleValue: "2026-04-15" },
      { key: "purchaseValue", label: "Purchase Value (₹)", required: true, type: "number", sampleValue: "85000" },
      { key: "condition", label: "Condition", required: true, type: "enum", allowedEnums: ["NEW", "GOOD", "FAIR", "NEEDS_REPAIR", "RETIRED"], sampleValue: "GOOD" },
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


/**
 * Prevents CSV/XLSX formula injection by prefixing values starting with
 * '=', '+', '-', '@', '\t', or '\r' with a single quote (').
 */
export function sanitizeForSpreadsheet(value: string): string {
  if (!value) return value;
  const firstChar = value.charAt(0);
  if (
    firstChar === "=" ||
    firstChar === "+" ||
    firstChar === "-" ||
    firstChar === "@" ||
    firstChar === "\t" ||
    firstChar === "\r"
  ) {
    return `'${value}`;
  }
  return value;
}

export type ExportKey =
  | "EXPORT_ATTENDANCE_REGISTER"
  | "EXPORT_EXAM_RESULTS"
  | "EXPORT_MARKSHEET"
  | "EXPORT_FEE_COLLECTION_REPORT"
  | "EXPORT_FEE_CHALLAN_BATCH"
  | "EXPORT_PAYROLL_STATEMENT"
  | "EXPORT_STAFF_LIST"
  | "EXPORT_STUDENT_LIST"
  | "EXPORT_TIMETABLE"
  | "EXPORT_LIBRARY_REPORT"
  | "EXPORT_TRANSPORT_REPORT";

export type ExportFormat = "PDF" | "XLSX" | "CSV";

export interface ExportDefinition {
  key: ExportKey;
  displayName: string;
  description: string;
  supportedFormats: ExportFormat[];
  category: "ACADEMIC" | "FINANCE" | "HR" | "OPERATIONS";
  requiresFilter?: string[];
}

export const EXPORT_DEFINITIONS: Record<ExportKey, ExportDefinition> = {
  EXPORT_STUDENT_LIST: {
    key: "EXPORT_STUDENT_LIST",
    displayName: "Student Directory",
    description: "Export enrolled students with class, section, admission number, and guardian contact.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "ACADEMIC",
    requiresFilter: ["classId", "sectionId"],
  },
  EXPORT_ATTENDANCE_REGISTER: {
    key: "EXPORT_ATTENDANCE_REGISTER",
    displayName: "Attendance Register",
    description: "Export monthly or date-range student attendance register with present/absent summary.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "ACADEMIC",
    requiresFilter: ["classId", "sectionId", "month"],
  },
  EXPORT_EXAM_RESULTS: {
    key: "EXPORT_EXAM_RESULTS",
    displayName: "Exam Results Ledger",
    description: "Export subject-wise marks, totals, percentages, and ranks for an exam cycle.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "ACADEMIC",
    requiresFilter: ["examId", "classId"],
  },
  EXPORT_MARKSHEET: {
    key: "EXPORT_MARKSHEET",
    displayName: "Student Marksheet",
    description: "Export individual or batch student marksheets with grades and remarks.",
    supportedFormats: ["PDF"],
    category: "ACADEMIC",
    requiresFilter: ["examId", "studentId"],
  },
  EXPORT_FEE_COLLECTION_REPORT: {
    key: "EXPORT_FEE_COLLECTION_REPORT",
    displayName: "Fee Collection Report",
    description: "Export fee receipts, payment modes, head-wise totals, and collection summary.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "FINANCE",
    requiresFilter: ["fromDate", "toDate"],
  },
  EXPORT_FEE_CHALLAN_BATCH: {
    key: "EXPORT_FEE_CHALLAN_BATCH",
    displayName: "Fee Challan Batch",
    description: "Export printable batch fee challans for pending student dues.",
    supportedFormats: ["PDF"],
    category: "FINANCE",
    requiresFilter: ["classId", "feeCycleId"],
  },
  EXPORT_PAYROLL_STATEMENT: {
    key: "EXPORT_PAYROLL_STATEMENT",
    displayName: "Payroll Statement",
    description: "Export monthly staff salary register with earnings, deductions, and net pay.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "HR",
    requiresFilter: ["month", "year"],
  },
  EXPORT_STAFF_LIST: {
    key: "EXPORT_STAFF_LIST",
    displayName: "Staff Directory",
    description: "Export teaching and non-teaching staff directory with department and designation.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "HR",
  },
  EXPORT_TIMETABLE: {
    key: "EXPORT_TIMETABLE",
    displayName: "Class Timetable",
    description: "Export weekly period-wise timetable grid for a class/section or teacher.",
    supportedFormats: ["PDF"],
    category: "ACADEMIC",
    requiresFilter: ["classId", "sectionId"],
  },
  EXPORT_LIBRARY_REPORT: {
    key: "EXPORT_LIBRARY_REPORT",
    displayName: "Library Inventory & Circulation",
    description: "Export library catalog, issued books, overdue items, and available copies.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "OPERATIONS",
  },
  EXPORT_TRANSPORT_REPORT: {
    key: "EXPORT_TRANSPORT_REPORT",
    displayName: "Transport Routes & Allocation",
    description: "Export bus routes, vehicle assignments, driver contacts, and student ridership.",
    supportedFormats: ["PDF", "XLSX", "CSV"],
    category: "OPERATIONS",
  },
};

export interface ImportDefinition {
  key: ImportDatasetKey;
  displayName: string;
  description: string;
  category: "ACADEMIC" | "FINANCE" | "HR" | "OPERATIONS";
  maxRows: number;
  supportsDryRun: boolean;
}

export const IMPORT_DEFINITIONS: Record<ImportDatasetKey, ImportDefinition> = {
  STUDENTS: {
    key: "STUDENTS",
    displayName: "Students Directory",
    description: "Bulk import enrolled students and primary parent contacts.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  STAFF: {
    key: "STAFF",
    displayName: "Teaching & Non-Teaching Staff",
    description: "Bulk import staff records, departments, and roles.",
    category: "HR",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  CLASSES: {
    key: "CLASSES",
    displayName: "Classes & Sections",
    description: "Bulk import class hierarchy and section divisions.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  SUBJECTS: {
    key: "SUBJECTS",
    displayName: "Curriculum Subjects",
    description: "Bulk import subject catalogues and weekly period counts.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  FEE_HEADS: {
    key: "FEE_HEADS",
    displayName: "Fee Structure Heads",
    description: "Bulk import fee heads, frequencies, and ledger codes.",
    category: "FINANCE",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  SALARY_TEMPLATES: {
    key: "SALARY_TEMPLATES",
    displayName: "HR Salary Templates",
    description: "Bulk import salary grade templates and allowance percentages.",
    category: "HR",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  HOLIDAYS: {
    key: "HOLIDAYS",
    displayName: "Academic Calendar Holidays",
    description: "Bulk import national, regional, and school holidays.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  ADMISSIONS: {
    key: "ADMISSIONS",
    displayName: "Admissions & Enquiries",
    description: "Bulk import prospective student enquiries and applications.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  PARENTS: {
    key: "PARENTS",
    displayName: "Parents & Guardians",
    description: "Bulk import parent/guardian profiles linked to students.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  TIMETABLE: {
    key: "TIMETABLE",
    displayName: "Class Timetable",
    description: "Bulk import weekly class period schedules.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  ATTENDANCE_OVERRIDE: {
    key: "ATTENDANCE_OVERRIDE",
    displayName: "Attendance Override",
    description: "Bulk import attendance corrections and backdated records.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  EXAM_MARKS: {
    key: "EXAM_MARKS",
    displayName: "Exam Marks",
    description: "Bulk import student examination marks.",
    category: "ACADEMIC",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  LIBRARY_INVENTORY: {
    key: "LIBRARY_INVENTORY",
    displayName: "Library Inventory",
    description: "Bulk import library books and copy counts.",
    category: "OPERATIONS",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  TRANSPORT_ROUTES: {
    key: "TRANSPORT_ROUTES",
    displayName: "Transport Routes",
    description: "Bulk import bus routes, vehicles, and drivers.",
    category: "OPERATIONS",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  HOSTEL_ROOMS: {
    key: "HOSTEL_ROOMS",
    displayName: "Hostel Rooms",
    description: "Bulk import hostel rooms, capacities, and fees.",
    category: "OPERATIONS",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
  ASSETS_INVENTORY: {
    key: "ASSETS_INVENTORY",
    displayName: "Assets Inventory",
    description: "Bulk import school fixed assets and equipment.",
    category: "OPERATIONS",
    maxRows: MAX_IMPORT_ROWS,
    supportsDryRun: true,
  },
};
