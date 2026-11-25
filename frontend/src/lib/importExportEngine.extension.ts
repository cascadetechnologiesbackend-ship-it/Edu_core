/**
 * ImportExportEngine Extension (Phase 1)
 *
 * Adds:
 * - 9 new ImportDatasetKey values and their schemas
 * - ExportKey union + ExportDefinition interface
 * - EXPORT_DEFINITIONS record (11 exports)
 * - ImportDefinition interface + IMPORT_DEFINITIONS record
 * - sanitizeForSpreadsheet() helper
 *
 * NOTE: This file extends importExportEngine.ts without modifying it.
 * Re-export everything from the base engine so consumers only need this file.
 */

export * from "./importExportEngine";

import type { ColumnDefinition, DatasetSchema } from "./importExportEngine";
import { DATASET_SCHEMAS } from "./importExportEngine";

// ─── Extended ImportDatasetKey ─────────────────────────────────────────────────

export type ExtendedImportDatasetKey =
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

// ─── Extended Dataset Schemas ───────────────────────────────────────────────────

export const EXTENDED_DATASET_SCHEMAS: Record<ExtendedImportDatasetKey, DatasetSchema & { key: ExtendedImportDatasetKey }> = {
  ...DATASET_SCHEMAS as unknown as Record<"STUDENTS" | "STAFF" | "CLASSES" | "SUBJECTS" | "FEE_HEADS" | "SALARY_TEMPLATES" | "HOLIDAYS", DatasetSchema & { key: ExtendedImportDatasetKey }>,

  ADMISSIONS: {
    key: "ADMISSIONS",
    displayName: "Admission Applications",
    description: "Import admission applications with student details and class applied for.",
    uniqueKeyField: "applicationNumber",
    columns: [
      { key: "applicationNumber", label: "Application Number", required: true, type: "string", sampleValue: "APP-2027-001" },
      { key: "studentFirstName", label: "Student First Name", required: true, type: "string", sampleValue: "Riya" },
      { key: "studentLastName", label: "Student Last Name", required: true, type: "string", sampleValue: "Patel" },
      { key: "dob", label: "Date of Birth (YYYY-MM-DD)", required: true, type: "date", sampleValue: "2016-03-22" },
      { key: "gender", label: "Gender", required: true, type: "enum", allowedEnums: ["MALE", "FEMALE", "OTHER"], sampleValue: "FEMALE" },
      { key: "classApplied", label: "Class Applied For", required: true, type: "string", sampleValue: "Class 6" },
      { key: "parentName", label: "Parent / Guardian Name", required: true, type: "string", sampleValue: "Mahesh Patel" },
      { key: "parentPhone", label: "Parent Phone", required: true, type: "string", sampleValue: "+919876543212" },
      { key: "parentEmail", label: "Parent Email", required: false, type: "string", sampleValue: "mahesh.patel@example.com" },
      { key: "category", label: "Category", required: false, type: "enum", allowedEnums: ["GENERAL", "SC", "ST", "OBC", "EWS"], sampleValue: "GENERAL" },
      { key: "previousSchool", label: "Previous School Name", required: false, type: "string", sampleValue: "Sunrise Public School" },
      { key: "status", label: "Application Status", required: false, type: "enum", allowedEnums: ["PENDING", "SHORTLISTED", "ADMITTED", "REJECTED", "WAITLISTED"], sampleValue: "PENDING" },
    ],
  },

  PARENTS: {
    key: "PARENTS",
    displayName: "Parent / Guardian Directory",
    description: "Import parent and guardian records linked to student admission numbers.",
    uniqueKeyField: "phone",
    columns: [
      { key: "studentAdmissionNumber", label: "Student Admission Number", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "firstName", label: "First Name", required: true, type: "string", sampleValue: "Rajesh" },
      { key: "lastName", label: "Last Name", required: true, type: "string", sampleValue: "Sharma" },
      { key: "phone", label: "Mobile Phone", required: true, type: "string", sampleValue: "+919876543210" },
      { key: "email", label: "Email Address", required: false, type: "string", sampleValue: "rajesh.sharma@example.com" },
      { key: "relation", label: "Relation to Student", required: true, type: "enum", allowedEnums: ["FATHER", "MOTHER", "GUARDIAN", "SIBLING"], sampleValue: "FATHER" },
      { key: "occupation", label: "Occupation", required: false, type: "string", sampleValue: "Engineer" },
      { key: "annualIncome", label: "Annual Income (₹)", required: false, type: "number", sampleValue: "800000", isSensitive: true },
    ],
  },

  TIMETABLE: {
    key: "TIMETABLE",
    displayName: "Class Timetable Schedule",
    description: "Import weekly period schedules assigning subjects and teachers to class-section-day-period slots.",
    uniqueKeyField: "slotId",
    columns: [
      { key: "slotId", label: "Slot ID", required: true, type: "string", sampleValue: "10A-MON-P1" },
      { key: "className", label: "Class Name", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "dayOfWeek", label: "Day of Week", required: true, type: "enum", allowedEnums: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"], sampleValue: "MONDAY" },
      { key: "periodNumber", label: "Period Number", required: true, type: "number", sampleValue: "1" },
      { key: "startTime", label: "Start Time (HH:MM)", required: true, type: "string", sampleValue: "08:00" },
      { key: "endTime", label: "End Time (HH:MM)", required: true, type: "string", sampleValue: "08:45" },
      { key: "subjectCode", label: "Subject Code", required: true, type: "string", sampleValue: "MATH-041" },
      { key: "teacherEmployeeCode", label: "Teacher Employee Code", required: true, type: "string", sampleValue: "EMP-101" },
    ],
  },

  ATTENDANCE_OVERRIDE: {
    key: "ATTENDANCE_OVERRIDE",
    displayName: "Attendance Override Records",
    description: "Import bulk attendance corrections or retroactive entries for a date range.",
    uniqueKeyField: "recordId",
    columns: [
      { key: "recordId", label: "Record ID (ClassName-Section-AdmNo-Date)", required: true, type: "string", sampleValue: "10A-ADM001-2027-01-15" },
      { key: "admissionNumber", label: "Admission Number", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "className", label: "Class Name", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "date", label: "Date (YYYY-MM-DD)", required: true, type: "date", sampleValue: "2027-01-15" },
      { key: "status", label: "Status", required: true, type: "enum", allowedEnums: ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "MEDICAL_LEAVE"], sampleValue: "PRESENT" },
      { key: "remarks", label: "Remarks", required: false, type: "string", sampleValue: "Medical leave approved" },
    ],
  },

  EXAM_MARKS: {
    key: "EXAM_MARKS",
    displayName: "Examination Marks Entry",
    description: "Bulk import subject-wise marks for a specified exam and class-section.",
    uniqueKeyField: "entryId",
    columns: [
      { key: "entryId", label: "Entry ID (ExamCode-AdmNo-SubjectCode)", required: true, type: "string", sampleValue: "SA1-2027-ADM001-MATH" },
      { key: "examCode", label: "Exam Code", required: true, type: "string", sampleValue: "SA1-2027" },
      { key: "admissionNumber", label: "Student Admission Number", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "subjectCode", label: "Subject Code", required: true, type: "string", sampleValue: "MATH-041" },
      { key: "marksObtained", label: "Marks Obtained", required: true, type: "number", sampleValue: "87" },
      { key: "maxMarks", label: "Maximum Marks", required: true, type: "number", sampleValue: "100" },
      { key: "isAbsent", label: "Is Absent (TRUE/FALSE)", required: false, type: "string", sampleValue: "FALSE" },
      { key: "remarks", label: "Remarks", required: false, type: "string", sampleValue: "Good performance" },
    ],
  },

  LIBRARY_INVENTORY: {
    key: "LIBRARY_INVENTORY",
    displayName: "Library Book Inventory",
    description: "Import library catalogue with book details, acquisition info, and copy counts.",
    uniqueKeyField: "isbn",
    columns: [
      { key: "isbn", label: "ISBN", required: true, type: "string", sampleValue: "978-0-306-40615-7" },
      { key: "title", label: "Book Title", required: true, type: "string", sampleValue: "Discovery of India" },
      { key: "author", label: "Author(s)", required: true, type: "string", sampleValue: "Jawaharlal Nehru" },
      { key: "publisher", label: "Publisher", required: false, type: "string", sampleValue: "Penguin Books" },
      { key: "publicationYear", label: "Publication Year", required: false, type: "number", sampleValue: "2004" },
      { key: "category", label: "Category", required: true, type: "enum", allowedEnums: ["TEXTBOOK", "REFERENCE", "FICTION", "NON_FICTION", "PERIODICAL", "ENCYCLOPEDIA", "BIOGRAPHY"], sampleValue: "NON_FICTION" },
      { key: "totalCopies", label: "Total Copies", required: true, type: "number", sampleValue: "5" },
      { key: "acquisitionDate", label: "Acquisition Date (YYYY-MM-DD)", required: false, type: "date", sampleValue: "2024-04-01" },
      { key: "shelfLocation", label: "Shelf / Rack Location", required: false, type: "string", sampleValue: "A2-R3" },
    ],
  },

  TRANSPORT_ROUTES: {
    key: "TRANSPORT_ROUTES",
    displayName: "Transport Routes & Stops",
    description: "Import bus routes, vehicle assignments, stop names, and student allocations.",
    uniqueKeyField: "routeCode",
    columns: [
      { key: "routeCode", label: "Route Code", required: true, type: "string", sampleValue: "RT-001" },
      { key: "routeName", label: "Route Name", required: true, type: "string", sampleValue: "North Zone Route A" },
      { key: "vehicleNumber", label: "Vehicle Number", required: true, type: "string", sampleValue: "DL-01-AB-1234" },
      { key: "driverName", label: "Driver Name", required: true, type: "string", sampleValue: "Raju Yadav" },
      { key: "driverPhone", label: "Driver Phone", required: true, type: "string", sampleValue: "+919876543215" },
      { key: "stopName", label: "Stop Name", required: true, type: "string", sampleValue: "Sector 12 Market" },
      { key: "stopOrder", label: "Stop Order", required: true, type: "number", sampleValue: "3" },
      { key: "pickupTime", label: "Pickup Time (HH:MM)", required: true, type: "string", sampleValue: "07:15" },
      { key: "dropTime", label: "Drop Time (HH:MM)", required: false, type: "string", sampleValue: "14:30" },
      { key: "monthlyFee", label: "Monthly Fee (₹)", required: false, type: "number", sampleValue: "1500" },
    ],
  },

  HOSTEL_ROOMS: {
    key: "HOSTEL_ROOMS",
    displayName: "Hostel Room Allocations",
    description: "Import hostel room inventory and student bed allocations.",
    uniqueKeyField: "roomCode",
    columns: [
      { key: "roomCode", label: "Room Code", required: true, type: "string", sampleValue: "BLOCK-A-101" },
      { key: "blockName", label: "Block / Wing Name", required: true, type: "string", sampleValue: "Block A" },
      { key: "floorNumber", label: "Floor Number", required: true, type: "number", sampleValue: "1" },
      { key: "roomType", label: "Room Type", required: true, type: "enum", allowedEnums: ["SINGLE", "DOUBLE", "TRIPLE", "DORMITORY"], sampleValue: "DOUBLE" },
      { key: "capacity", label: "Capacity (Beds)", required: true, type: "number", sampleValue: "2" },
      { key: "studentAdmissionNumber", label: "Student Admission Number (Allotted)", required: false, type: "string", sampleValue: "ADM-2026-001" },
      { key: "monthlyRent", label: "Monthly Rent (₹)", required: false, type: "number", sampleValue: "3000" },
      { key: "amenities", label: "Amenities (Comma-Separated)", required: false, type: "string", sampleValue: "AC, Attached Bathroom" },
    ],
  },

  ASSETS_INVENTORY: {
    key: "ASSETS_INVENTORY",
    displayName: "School Assets Inventory",
    description: "Import school fixed assets, equipment, and consumable inventory for asset tracking.",
    uniqueKeyField: "assetTag",
    columns: [
      { key: "assetTag", label: "Asset Tag / ID", required: true, type: "string", sampleValue: "ASSET-PC-001" },
      { key: "assetName", label: "Asset Name", required: true, type: "string", sampleValue: "Desktop Computer" },
      { key: "category", label: "Category", required: true, type: "enum", allowedEnums: ["FURNITURE", "ELECTRONICS", "SPORTS_EQUIPMENT", "LABORATORY", "MUSICAL_INSTRUMENT", "VEHICLE", "IT_EQUIPMENT", "CONSUMABLE"], sampleValue: "IT_EQUIPMENT" },
      { key: "location", label: "Location / Room", required: true, type: "string", sampleValue: "Computer Lab 1" },
      { key: "purchaseDate", label: "Purchase Date (YYYY-MM-DD)", required: false, type: "date", sampleValue: "2023-07-15" },
      { key: "purchasePrice", label: "Purchase Price (₹)", required: false, type: "number", sampleValue: "55000" },
      { key: "vendor", label: "Vendor / Supplier", required: false, type: "string", sampleValue: "Dell India Pvt Ltd" },
      { key: "warrantyExpiry", label: "Warranty Expiry (YYYY-MM-DD)", required: false, type: "date", sampleValue: "2026-07-14" },
      { key: "condition", label: "Condition", required: false, type: "enum", allowedEnums: ["GOOD", "FAIR", "DAMAGED", "UNDER_REPAIR", "DISPOSED"], sampleValue: "GOOD" },
    ],
  },
};

// ─── Export Key & Definition ────────────────────────────────────────────────────

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

export interface ExportDefinition {
  key: ExportKey;
  displayName: string;
  supportedFormats: ("CSV" | "XLSX" | "PDF")[];
  allowedRoles: string[];
  sensitiveFields: string[];
  columns: ColumnDefinition[];
  defaultOrientation: "portrait" | "landscape";
  supportsDateRange: boolean;
  supportsClassFilter: boolean;
  requiresAcademicYear: boolean;
}

export const EXPORT_DEFINITIONS: Record<ExportKey, ExportDefinition> = {
  EXPORT_ATTENDANCE_REGISTER: {
    key: "EXPORT_ATTENDANCE_REGISTER",
    displayName: "Monthly Attendance Register",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"],
    sensitiveFields: [],
    columns: [
      { key: "admissionNumber", label: "Admission No.", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "studentName", label: "Student Name", required: true, type: "string", sampleValue: "Aarav Sharma" },
      { key: "className", label: "Class", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "workingDays", label: "Working Days", required: true, type: "number", sampleValue: "26" },
      { key: "presentDays", label: "Present Days", required: true, type: "number", sampleValue: "24" },
      { key: "absentDays", label: "Absent Days", required: true, type: "number", sampleValue: "2" },
      { key: "attendancePercent", label: "Attendance %", required: true, type: "number", sampleValue: "92.31" },
    ],
    defaultOrientation: "landscape",
    supportsDateRange: true,
    supportsClassFilter: true,
    requiresAcademicYear: true,
  },

  EXPORT_EXAM_RESULTS: {
    key: "EXPORT_EXAM_RESULTS",
    displayName: "Examination Results Summary",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT"],
    sensitiveFields: [],
    columns: [
      { key: "admissionNumber", label: "Admission No.", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "studentName", label: "Student Name", required: true, type: "string", sampleValue: "Aarav Sharma" },
      { key: "className", label: "Class", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "examName", label: "Exam Name", required: true, type: "string", sampleValue: "SA1 2026-27" },
      { key: "totalMarks", label: "Total Marks", required: true, type: "number", sampleValue: "500" },
      { key: "marksObtained", label: "Marks Obtained", required: true, type: "number", sampleValue: "435" },
      { key: "percentage", label: "Percentage", required: true, type: "number", sampleValue: "87.00" },
      { key: "grade", label: "Grade", required: true, type: "string", sampleValue: "A1" },
      { key: "result", label: "Result", required: true, type: "enum", allowedEnums: ["PASS", "FAIL", "PROMOTED", "DETAINED", "COMPARTMENT"], sampleValue: "PASS" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: false,
    supportsClassFilter: true,
    requiresAcademicYear: true,
  },

  EXPORT_MARKSHEET: {
    key: "EXPORT_MARKSHEET",
    displayName: "Subject-Wise Marksheet",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"],
    sensitiveFields: [],
    columns: [
      { key: "admissionNumber", label: "Admission No.", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "studentName", label: "Student Name", required: true, type: "string", sampleValue: "Aarav Sharma" },
      { key: "subjectName", label: "Subject", required: true, type: "string", sampleValue: "Mathematics" },
      { key: "subjectCode", label: "Subject Code", required: true, type: "string", sampleValue: "MATH-041" },
      { key: "maxMarks", label: "Max Marks", required: true, type: "number", sampleValue: "100" },
      { key: "marksObtained", label: "Marks Obtained", required: true, type: "number", sampleValue: "87" },
      { key: "grade", label: "Grade", required: true, type: "string", sampleValue: "A1" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: false,
    supportsClassFilter: true,
    requiresAcademicYear: true,
  },

  EXPORT_FEE_COLLECTION_REPORT: {
    key: "EXPORT_FEE_COLLECTION_REPORT",
    displayName: "Fee Collection Report",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"],
    sensitiveFields: [],
    columns: [
      { key: "receiptNumber", label: "Receipt No.", required: true, type: "string", sampleValue: "RCPT-2027-00001" },
      { key: "admissionNumber", label: "Admission No.", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "studentName", label: "Student Name", required: true, type: "string", sampleValue: "Aarav Sharma" },
      { key: "className", label: "Class", required: true, type: "string", sampleValue: "Class 10" },
      { key: "feeHead", label: "Fee Head", required: true, type: "string", sampleValue: "Tuition Fee Q1" },
      { key: "amountPaid", label: "Amount Paid (₹)", required: true, type: "number", sampleValue: "15000" },
      { key: "paymentDate", label: "Payment Date", required: true, type: "date", sampleValue: "2027-04-10" },
      { key: "paymentMode", label: "Payment Mode", required: true, type: "enum", allowedEnums: ["CASH", "UPI", "NEFT", "CHEQUE", "DD"], sampleValue: "UPI" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: true,
    supportsClassFilter: true,
    requiresAcademicYear: true,
  },

  EXPORT_FEE_CHALLAN_BATCH: {
    key: "EXPORT_FEE_CHALLAN_BATCH",
    displayName: "Batch Fee Challans",
    supportedFormats: ["PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
    sensitiveFields: [],
    columns: [
      { key: "challanNumber", label: "Challan No.", required: true, type: "string", sampleValue: "CHAL-2027-001" },
      { key: "admissionNumber", label: "Admission No.", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "studentName", label: "Student Name", required: true, type: "string", sampleValue: "Aarav Sharma" },
      { key: "className", label: "Class", required: true, type: "string", sampleValue: "Class 10" },
      { key: "dueDate", label: "Due Date", required: true, type: "date", sampleValue: "2027-04-30" },
      { key: "feeHead", label: "Fee Head", required: true, type: "string", sampleValue: "Tuition Fee Q1" },
      { key: "dueAmount", label: "Due Amount (₹)", required: true, type: "number", sampleValue: "15000" },
      { key: "totalDue", label: "Total Due (₹)", required: true, type: "number", sampleValue: "17500" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: false,
    supportsClassFilter: true,
    requiresAcademicYear: true,
  },

  EXPORT_PAYROLL_STATEMENT: {
    key: "EXPORT_PAYROLL_STATEMENT",
    displayName: "Monthly Payroll Statement",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER", "ACCOUNTANT"],
    sensitiveFields: ["bankAccountNumber", "ifscCode", "panNumber"],
    columns: [
      { key: "employeeCode", label: "Employee Code", required: true, type: "string", sampleValue: "EMP-101" },
      { key: "employeeName", label: "Employee Name", required: true, type: "string", sampleValue: "Priya Verma" },
      { key: "department", label: "Department", required: true, type: "string", sampleValue: "Mathematics" },
      { key: "designation", label: "Designation", required: true, type: "string", sampleValue: "Senior TGT Teacher" },
      { key: "workingDays", label: "Working Days", required: true, type: "number", sampleValue: "26" },
      { key: "presentDays", label: "Present Days", required: true, type: "number", sampleValue: "25" },
      { key: "grossSalary", label: "Gross Salary (₹)", required: true, type: "number", sampleValue: "58000" },
      { key: "totalDeductions", label: "Total Deductions (₹)", required: true, type: "number", sampleValue: "8700" },
      { key: "netPay", label: "Net Pay (₹)", required: true, type: "number", sampleValue: "49300" },
      { key: "paymentMonth", label: "Payment Month (YYYY-MM)", required: true, type: "string", sampleValue: "2027-04" },
    ],
    defaultOrientation: "landscape",
    supportsDateRange: true,
    supportsClassFilter: false,
    requiresAcademicYear: true,
  },

  EXPORT_STAFF_LIST: {
    key: "EXPORT_STAFF_LIST",
    displayName: "Staff Directory",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "HR_MANAGER"],
    sensitiveFields: ["panNumber", "aadhaarNumber", "bankAccountNumber"],
    columns: [
      { key: "employeeCode", label: "Employee Code", required: true, type: "string", sampleValue: "EMP-101" },
      { key: "firstName", label: "First Name", required: true, type: "string", sampleValue: "Priya" },
      { key: "lastName", label: "Last Name", required: true, type: "string", sampleValue: "Verma" },
      { key: "department", label: "Department", required: true, type: "string", sampleValue: "Mathematics" },
      { key: "designation", label: "Designation", required: true, type: "string", sampleValue: "Senior TGT Teacher" },
      { key: "phone", label: "Phone", required: true, type: "string", sampleValue: "+919876543211" },
      { key: "email", label: "Email", required: true, type: "string", sampleValue: "priya.verma@schoolmitra.in" },
      { key: "joiningDate", label: "Joining Date", required: true, type: "date", sampleValue: "2022-07-01" },
      { key: "role", label: "System Role", required: true, type: "string", sampleValue: "TEACHER" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: false,
    supportsClassFilter: false,
    requiresAcademicYear: false,
  },

  EXPORT_STUDENT_LIST: {
    key: "EXPORT_STUDENT_LIST",
    displayName: "Student Directory",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT"],
    sensitiveFields: [],
    columns: [
      { key: "admissionNumber", label: "Admission No.", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "firstName", label: "First Name", required: true, type: "string", sampleValue: "Aarav" },
      { key: "lastName", label: "Last Name", required: true, type: "string", sampleValue: "Sharma" },
      { key: "className", label: "Class", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "gender", label: "Gender", required: true, type: "enum", allowedEnums: ["MALE", "FEMALE", "OTHER"], sampleValue: "MALE" },
      { key: "dob", label: "Date of Birth", required: true, type: "date", sampleValue: "2012-05-14" },
      { key: "parentName", label: "Parent Name", required: true, type: "string", sampleValue: "Rajesh Sharma" },
      { key: "parentPhone", label: "Parent Phone", required: true, type: "string", sampleValue: "+919876543210" },
      { key: "category", label: "Category", required: false, type: "string", sampleValue: "GENERAL" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: false,
    supportsClassFilter: true,
    requiresAcademicYear: true,
  },

  EXPORT_TIMETABLE: {
    key: "EXPORT_TIMETABLE",
    displayName: "Class Timetable Grid",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"],
    sensitiveFields: [],
    columns: [
      { key: "className", label: "Class", required: true, type: "string", sampleValue: "Class 10" },
      { key: "sectionName", label: "Section", required: true, type: "string", sampleValue: "A" },
      { key: "dayOfWeek", label: "Day", required: true, type: "string", sampleValue: "MONDAY" },
      { key: "periodNumber", label: "Period", required: true, type: "number", sampleValue: "1" },
      { key: "startTime", label: "Start Time", required: true, type: "string", sampleValue: "08:00" },
      { key: "endTime", label: "End Time", required: true, type: "string", sampleValue: "08:45" },
      { key: "subjectName", label: "Subject", required: true, type: "string", sampleValue: "Mathematics" },
      { key: "teacherName", label: "Teacher", required: true, type: "string", sampleValue: "Priya Verma" },
    ],
    defaultOrientation: "landscape",
    supportsDateRange: false,
    supportsClassFilter: true,
    requiresAcademicYear: true,
  },

  EXPORT_LIBRARY_REPORT: {
    key: "EXPORT_LIBRARY_REPORT",
    displayName: "Library Inventory & Issue Report",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"],
    sensitiveFields: [],
    columns: [
      { key: "isbn", label: "ISBN", required: true, type: "string", sampleValue: "978-0-306-40615-7" },
      { key: "title", label: "Title", required: true, type: "string", sampleValue: "Discovery of India" },
      { key: "author", label: "Author", required: true, type: "string", sampleValue: "Jawaharlal Nehru" },
      { key: "category", label: "Category", required: true, type: "string", sampleValue: "NON_FICTION" },
      { key: "totalCopies", label: "Total Copies", required: true, type: "number", sampleValue: "5" },
      { key: "issuedCopies", label: "Issued Copies", required: true, type: "number", sampleValue: "2" },
      { key: "availableCopies", label: "Available", required: true, type: "number", sampleValue: "3" },
      { key: "shelfLocation", label: "Shelf / Rack", required: false, type: "string", sampleValue: "A2-R3" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: false,
    supportsClassFilter: false,
    requiresAcademicYear: false,
  },

  EXPORT_TRANSPORT_REPORT: {
    key: "EXPORT_TRANSPORT_REPORT",
    displayName: "Transport Route Report",
    supportedFormats: ["CSV", "XLSX", "PDF"],
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"],
    sensitiveFields: [],
    columns: [
      { key: "routeCode", label: "Route Code", required: true, type: "string", sampleValue: "RT-001" },
      { key: "routeName", label: "Route Name", required: true, type: "string", sampleValue: "North Zone Route A" },
      { key: "vehicleNumber", label: "Vehicle Number", required: true, type: "string", sampleValue: "DL-01-AB-1234" },
      { key: "driverName", label: "Driver Name", required: true, type: "string", sampleValue: "Raju Yadav" },
      { key: "studentName", label: "Student Name", required: true, type: "string", sampleValue: "Aarav Sharma" },
      { key: "admissionNumber", label: "Admission No.", required: true, type: "string", sampleValue: "ADM-2026-001" },
      { key: "stopName", label: "Stop Name", required: true, type: "string", sampleValue: "Sector 12 Market" },
      { key: "pickupTime", label: "Pickup Time", required: true, type: "string", sampleValue: "07:15" },
      { key: "monthlyFee", label: "Monthly Fee (₹)", required: true, type: "number", sampleValue: "1500" },
    ],
    defaultOrientation: "portrait",
    supportsDateRange: false,
    supportsClassFilter: false,
    requiresAcademicYear: false,
  },
};

// ─── Spreadsheet Formula Injection Sanitizer ───────────────────────────────────

/**
 * Prevents CSV/XLSX formula injection by prefixing dangerous lead characters
 * (=, +, -, @, TAB, CR) with a single quote as per OWASP guidance.
 */
export function sanitizeForSpreadsheet(value: string): string {
  if (typeof value !== "string") return String(value);
  // Prefix formula-injection trigger chars with a single quote
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// ─── ImportDefinition ──────────────────────────────────────────────────────────

export interface ImportDefinition extends DatasetSchema {
  allowedRoles: string[];
  maxRows: number;
  idempotencyKey: string; // Field key used for upsert identity
  protectedFields: string[]; // Fields that must not be overwritten on update
}

// ─── IMPORT_DEFINITIONS ────────────────────────────────────────────────────────

export const IMPORT_DEFINITIONS: Record<ExtendedImportDatasetKey, ImportDefinition> = {
  STUDENTS: {
    ...(DATASET_SCHEMAS.STUDENTS as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 2000,
    idempotencyKey: "admissionNumber",
    protectedFields: [],
  },
  STAFF: {
    ...(DATASET_SCHEMAS.STAFF as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"],
    maxRows: 500,
    idempotencyKey: "employeeCode",
    protectedFields: ["email"],
  },
  CLASSES: {
    ...(DATASET_SCHEMAS.CLASSES as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 50,
    idempotencyKey: "className",
    protectedFields: [],
  },
  SUBJECTS: {
    ...(DATASET_SCHEMAS.SUBJECTS as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 200,
    idempotencyKey: "code",
    protectedFields: [],
  },
  FEE_HEADS: {
    ...(DATASET_SCHEMAS.FEE_HEADS as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
    maxRows: 100,
    idempotencyKey: "name",
    protectedFields: [],
  },
  SALARY_TEMPLATES: {
    ...(DATASET_SCHEMAS.SALARY_TEMPLATES as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"],
    maxRows: 100,
    idempotencyKey: "gradeName",
    protectedFields: [],
  },
  HOLIDAYS: {
    ...(DATASET_SCHEMAS.HOLIDAYS as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 100,
    idempotencyKey: "title",
    protectedFields: [],
  },
  ADMISSIONS: {
    ...(EXTENDED_DATASET_SCHEMAS.ADMISSIONS as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 1000,
    idempotencyKey: "applicationNumber",
    protectedFields: [],
  },
  PARENTS: {
    ...(EXTENDED_DATASET_SCHEMAS.PARENTS as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 2000,
    idempotencyKey: "phone",
    protectedFields: ["phone"],
  },
  TIMETABLE: {
    ...(EXTENDED_DATASET_SCHEMAS.TIMETABLE as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 1000,
    idempotencyKey: "slotId",
    protectedFields: [],
  },
  ATTENDANCE_OVERRIDE: {
    ...(EXTENDED_DATASET_SCHEMAS.ATTENDANCE_OVERRIDE as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 5000,
    idempotencyKey: "recordId",
    protectedFields: [],
  },
  EXAM_MARKS: {
    ...(EXTENDED_DATASET_SCHEMAS.EXAM_MARKS as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"],
    maxRows: 5000,
    idempotencyKey: "entryId",
    protectedFields: [],
  },
  LIBRARY_INVENTORY: {
    ...(EXTENDED_DATASET_SCHEMAS.LIBRARY_INVENTORY as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "LIBRARIAN"],
    maxRows: 5000,
    idempotencyKey: "isbn",
    protectedFields: [],
  },
  TRANSPORT_ROUTES: {
    ...(EXTENDED_DATASET_SCHEMAS.TRANSPORT_ROUTES as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TRANSPORT_MANAGER"],
    maxRows: 200,
    idempotencyKey: "routeCode",
    protectedFields: [],
  },
  HOSTEL_ROOMS: {
    ...(EXTENDED_DATASET_SCHEMAS.HOSTEL_ROOMS as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 500,
    idempotencyKey: "roomCode",
    protectedFields: [],
  },
  ASSETS_INVENTORY: {
    ...(EXTENDED_DATASET_SCHEMAS.ASSETS_INVENTORY as unknown as DatasetSchema),
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
    maxRows: 2000,
    idempotencyKey: "assetTag",
    protectedFields: [],
  },
};
