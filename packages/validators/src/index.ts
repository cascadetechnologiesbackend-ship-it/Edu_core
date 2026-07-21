import { z } from "zod";

// ─── Common primitives ────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  cursor: z.string().optional(),
});

export const dateSchema = z.string().date(); // YYYY-MM-DD
export const dateTimeSchema = z.string().datetime({ offset: true });

export const indianMobileSchema = z
  .string()
  .regex(
    /^[6-9]\d{9}$/,
    "Invalid Indian mobile number (must be 10 digits starting with 6-9)",
  );

export const aadhaarLast4Schema = z
  .string()
  .regex(/^\d{4}$/, "Must be exactly 4 digits");

export const panSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format");

export const pincodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Invalid Indian pincode");

// ─── Response envelope ────────────────────────────────────────────────────────

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      data: dataSchema,
      meta: z
        .object({
          page: z.number().optional(),
          pageSize: z.number().optional(),
          total: z.number().optional(),
          cursor: z.string().nullable().optional(),
        })
        .optional(),
    }),
    z.object({
      success: z.literal(false),
      error: apiErrorSchema,
    }),
  ]);
}

// ─── Auth / Users ─────────────────────────────────────────────────────────────

export const ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "HR_MANAGER",
  "TEACHER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "PARENT",
  "STUDENT",
] as const;

export type Role = (typeof ROLES)[number];

export const roleSchema = z.enum(ROLES);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10, "Minimum 10 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/\d/, "Must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
});

export const otpLoginSchema = z.object({
  mobile: indianMobileSchema,
  otp: z.string().length(6),
});

export const totpVerifySchema = z.object({
  token: z.string().length(6),
});

// ─── School ───────────────────────────────────────────────────────────────────

export const BOARDS = ["CBSE", "ICSE", "STATE_BOARD", "IGCSE", "IB"] as const;
export type Board = (typeof BOARDS)[number];

export const createSchoolSchema = z.object({
  name: z.string().min(3).max(200),
  board: z.enum(BOARDS),
  udiseCode: z.string().regex(/^\d{11}$/, "UDISE code must be 11 digits"),
  address: z.string().min(10).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: pincodeSchema,
  phone: indianMobileSchema,
  email: z.string().email(),
  principalName: z.string().min(2).max(200),
  establishedYear: z.number().int().min(1800).max(new Date().getFullYear()),
});

export const updateSchoolSchema = createSchoolSchema.partial();

// ─── Academic Year ────────────────────────────────────────────────────────────

export const createAcademicYearSchema = z.object({
  schoolId: uuidSchema,
  label: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-YY e.g. "2025-26"'),
  startDate: dateSchema,
  endDate: dateSchema,
  isActive: z.boolean().default(false),
});

// ─── Admissions ───────────────────────────────────────────────────────────────

export const GRADE_LEVELS = [
  "NURSERY",
  "LKG",
  "UKG",
  "CLASS_1",
  "CLASS_2",
  "CLASS_3",
  "CLASS_4",
  "CLASS_5",
  "CLASS_6",
  "CLASS_7",
  "CLASS_8",
  "CLASS_9",
  "CLASS_10",
] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];

export const gradeLevelSchema = z.enum(GRADE_LEVELS);

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export const CATEGORIES = ["GENERAL", "SC", "ST", "OBC", "EWS"] as const;
export type Category = (typeof CATEGORIES)[number];

export const BLOOD_GROUPS = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
] as const;

export const createAdmissionApplicationSchema = z.object({
  schoolId: uuidSchema,
  academicYearId: uuidSchema,
  applicantName: z.string().min(2).max(200),
  dateOfBirth: dateSchema,
  gender: z.enum(GENDERS),
  category: z.enum(CATEGORIES),
  gradeAppliedFor: gradeLevelSchema,
  previousSchool: z.string().max(200).optional(),
  fatherName: z.string().min(2).max(200),
  motherName: z.string().min(2).max(200),
  guardianName: z.string().max(200).optional(),
  primaryContactMobile: indianMobileSchema,
  primaryContactEmail: z.string().email(),
  address: z.string().min(10).max(500),
  pincode: pincodeSchema,
  isRteApplicant: z.boolean().default(false),
  hasSiblingInSchool: z.boolean().default(false),
  siblingStudentId: uuidSchema.optional(),
});

// ─── Students ─────────────────────────────────────────────────────────────────

export const createStudentSchema = z.object({
  schoolId: uuidSchema,
  academicYearId: uuidSchema,
  admissionApplicationId: uuidSchema.optional(),
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  dateOfBirth: dateSchema,
  gender: z.enum(GENDERS),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  category: z.enum(CATEGORIES),
  motherTongue: z.string().max(50).optional(),
  religion: z.string().max(50).optional(),
  nationality: z.string().max(50).default("Indian"),
  aadhaarLast4: aadhaarLast4Schema.optional(),
  apaarId: z.string().max(50).optional(),
  classId: uuidSchema,
  sectionId: uuidSchema,
  rollNumber: z.string().max(20).optional(),
  admissionNumber: z.string().max(50),
  admissionDate: dateSchema,
  previousSchool: z.string().max(200).optional(),
  rteApplicant: z.boolean().default(false),
});

// ─── DPDP / Consent ───────────────────────────────────────────────────────────

export const CONSENT_PURPOSE_IDS = [
  "admission_data",
  "academic_records",
  "attendance",
  "health_records",
  "photos_videos",
  "transport",
  "communication",
  "biometric",
  "third_party_apps",
  "cctv",
  "published_results",
  "alumni_data",
] as const;

export type ConsentPurposeId = (typeof CONSENT_PURPOSE_IDS)[number];

export const consentPurposeIdSchema = z.enum(CONSENT_PURPOSE_IDS);

export const recordConsentSchema = z.object({
  studentId: uuidSchema,
  parentUserId: uuidSchema,
  purposeIds: z.array(consentPurposeIdSchema).min(1),
  privacyNoticeVersion: z.string(),
  method: z.enum(["web_form", "app", "physical_scan"]),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  otpVerified: z.boolean(),
});

export const withdrawConsentSchema = z.object({
  studentId: uuidSchema,
  parentUserId: uuidSchema,
  purposeIds: z.array(consentPurposeIdSchema).min(1),
  reason: z.string().max(1000).optional(),
});

// ─── Rights Requests (DPDP Sections 11–14) ───────────────────────────────────

export const RIGHTS_REQUEST_TYPES = [
  "ACCESS",
  "CORRECTION",
  "ERASURE",
  "GRIEVANCE",
  "NOMINATION",
] as const;

export const createRightsRequestSchema = z.object({
  schoolId: uuidSchema,
  studentId: uuidSchema,
  requestType: z.enum(RIGHTS_REQUEST_TYPES),
  description: z.string().min(10).max(2000),
  nomineeDetails: z
    .object({
      name: z.string().min(2).max(200),
      email: z.string().email(),
      mobile: indianMobileSchema,
      relationship: z.string().max(100),
    })
    .optional(),
});

// ─── Fee ─────────────────────────────────────────────────────────────────────

export const FEE_TERMS = [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "ONE_TIME",
] as const;

export const FEE_HEAD_TYPES = [
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
] as const;

export const createFeeStructureSchema = z.object({
  schoolId: uuidSchema,
  academicYearId: uuidSchema,
  classId: uuidSchema,
  term: z.enum(FEE_TERMS),
  dueDate: dateSchema,
  feeHeads: z
    .array(
      z.object({
        feeHeadId: uuidSchema,
        amount: z.number().positive(),
        isTaxable: z.boolean().default(false),
        taxPercentage: z.number().min(0).max(28).default(0),
      }),
    )
    .min(1),
});

export const collectFeeSchema = z.object({
  schoolId: uuidSchema,
  studentId: uuidSchema,
  feeInvoiceId: uuidSchema,
  amountPaid: z.number().positive(),
  paymentMethod: z.enum(["CASH", "CHEQUE", "ONLINE", "DD", "NEFT"]),
  transactionReference: z.string().max(200).optional(),
  paymentDate: dateSchema,
  remarks: z.string().max(500).optional(),
});

// ─── Attendance ───────────────────────────────────────────────────────────────

export const ATTENDANCE_STATUS = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "LEAVE",
  "HOLIDAY",
] as const;

export const markAttendanceSchema = z.object({
  schoolId: uuidSchema,
  sectionId: uuidSchema,
  date: dateSchema,
  periodId: uuidSchema.optional(),
  records: z
    .array(
      z.object({
        studentId: uuidSchema,
        status: z.enum(ATTENDANCE_STATUS),
        remarks: z.string().max(200).optional(),
      }),
    )
    .min(1),
});

// ─── Examinations ─────────────────────────────────────────────────────────────

export const EXAM_TYPES = [
  "UNIT_TEST",
  "HALF_YEARLY",
  "ANNUAL",
  "PRACTICAL",
  "INTERNAL_ASSESSMENT",
  "PRE_BOARD",
  "ACTIVITY",
] as const;

export const markEntrySchema = z.object({
  schoolId: uuidSchema,
  examId: uuidSchema,
  subjectId: uuidSchema,
  entries: z
    .array(
      z.object({
        studentId: uuidSchema,
        marksObtained: z.number().min(0),
        isAbsent: z.boolean().default(false),
        remarks: z.string().max(200).optional(),
      }),
    )
    .min(1),
});

// ─── HR / Staff ────────────────────────────────────────────────────────────────

export const CONTRACT_TYPES = [
  "PERMANENT",
  "PROBATION",
  "CONTRACTUAL",
  "PART_TIME",
  "GUEST_FACULTY",
] as const;

export const LEAVE_TYPES = [
  "CL",
  "EL",
  "ML",
  "SL",
  "LWP",
  "MATERNITY",
  "PATERNITY",
] as const;

export const createStaffSchema = z.object({
  schoolId: uuidSchema,
  employeeCode: z.string().min(2).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: dateSchema,
  gender: z.enum(GENDERS),
  email: z.string().email(),
  mobile: indianMobileSchema,
  departmentId: uuidSchema,
  designationId: uuidSchema,
  contractType: z.enum(CONTRACT_TYPES),
  joiningDate: dateSchema,
  qualification: z.string().max(500),
  aadhaarLast4: aadhaarLast4Schema.optional(),
  // PAN is server-side only, encrypted — not exposed in shared schema
});

export const leaveRequestSchema = z.object({
  staffId: uuidSchema,
  leaveType: z.enum(LEAVE_TYPES),
  startDate: dateSchema,
  endDate: dateSchema,
  reason: z.string().min(10).max(1000),
  attachmentKey: z.string().max(500).optional(),
});

// ─── Communication ────────────────────────────────────────────────────────────

export const NOTICE_AUDIENCES = [
  "ALL",
  "PARENTS",
  "TEACHERS",
  "STUDENTS",
  "STAFF",
  "CLASS",
  "SECTION",
] as const;

export const createNoticeSchema = z.object({
  schoolId: uuidSchema,
  title: z.string().min(3).max(300),
  content: z.string().min(10).max(10000),
  audienceType: z.enum(NOTICE_AUDIENCES),
  audienceFilter: z
    .object({
      classIds: z.array(uuidSchema).optional(),
      sectionIds: z.array(uuidSchema).optional(),
      roles: z.array(roleSchema).optional(),
    })
    .optional(),
  publishAt: dateTimeSchema.optional(),
  expiresAt: dateTimeSchema.optional(),
  sendSms: z.boolean().default(false),
  sendEmail: z.boolean().default(false),
  sendPush: z.boolean().default(false),
});

// ─── File Upload ─────────────────────────────────────────────────────────────

export const ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const fileUploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_DOCUMENT_TYPES),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // 10MB
  purpose: z.string().max(100),
});

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { z };
