// ─── Fees Schema ─────────────────────────────────────────────────────────────
// Tables: fee_structures, fee_heads, fee_concessions, fee_invoices,
//         fee_payments, fee_refunds, payment_gateway_logs

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, academicYears, users } from "./core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const feeTermEnum = pgEnum("fee_term", [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "ONE_TIME",
]);

export const feeHeadTypeEnum = pgEnum("fee_head_type", [
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

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "CHEQUE",
  "ONLINE",
  "DD",
  "NEFT",
  "RTGS",
]);

export const feeInvoiceStatusEnum = pgEnum("fee_invoice_status", [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "WAIVED",
  "CANCELLED",
]);

export const concessionTypeEnum = pgEnum("concession_type", [
  "STAFF_WARD",
  "SIBLING",
  "RTE_FREE",
  "MERIT_SCHOLARSHIP",
  "CUSTOM",
  "MANAGEMENT_QUOTA",
]);

export const lateFeeTypeEnum = pgEnum("late_fee_type", ["FLAT", "PERCENTAGE"]);

// ─── fee_heads ────────────────────────────────────────────────────────────────

export const feeHeads = pgTable(
  "fee_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    headType: feeHeadTypeEnum("head_type").notNull(),
    isTaxable: boolean("is_taxable").notNull().default(false),
    gstPercentage: numeric("gst_percentage", { precision: 5, scale: 2 }).default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("fee_heads_school_idx").on(t.schoolId),
    schoolNameUnique: unique("fee_heads_school_name_unique").on(t.schoolId, t.name),
  })
);

// ─── fee_structures ───────────────────────────────────────────────────────────

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id").notNull(),
    feeHeadId: uuid("fee_head_id")
      .notNull()
      .references(() => feeHeads.id, { onDelete: "restrict" }),
    term: feeTermEnum("term").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    lateFeeType: lateFeeTypeEnum("late_fee_type"),
    lateFeeAmount: numeric("late_fee_amount", { precision: 10, scale: 2 }),
    lateFeeStartAfterDays: integer("late_fee_start_after_days"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolYearClassIdx: index("fee_structures_school_year_class_idx").on(
      t.schoolId,
      t.academicYearId,
      t.classId
    ),
  })
);

// ─── fee_concessions ─────────────────────────────────────────────────────────

export const feeConcessions = pgTable(
  "fee_concessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    concessionType: concessionTypeEnum("concession_type").notNull(),
    concessionName: text("concession_name").notNull(),
    appliesTo: text("applies_to").notNull().default("ALL"), // "ALL" or fee_head_id
    discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
    approvedById: uuid("approved_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    studentIdx: index("fee_concessions_student_idx").on(t.studentId),
    schoolYearIdx: index("fee_concessions_school_year_idx").on(
      t.schoolId,
      t.academicYearId
    ),
  })
);

// ─── fee_invoices ─────────────────────────────────────────────────────────────

export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    feeStructureId: uuid("fee_structure_id")
      .references(() => feeStructures.id, { onDelete: "restrict" }),
    grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    lateFeeAmount: numeric("late_fee_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    balanceAmount: numeric("balance_amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: feeInvoiceStatusEnum("status").notNull().default("PENDING"),
    term: feeTermEnum("term").notNull(),
    // SMS reminder tracking
    reminderSentD7: boolean("reminder_sent_d7").notNull().default(false),
    reminderSentD15: boolean("reminder_sent_d15").notNull().default(false),
    reminderSentD30: boolean("reminder_sent_d30").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    invoiceNumberUnique: unique("fee_invoices_number_unique").on(
      t.schoolId,
      t.invoiceNumber
    ),
    studentIdx: index("fee_invoices_student_idx").on(t.studentId),
    schoolYearIdx: index("fee_invoices_school_year_idx").on(t.schoolId, t.academicYearId),
    statusIdx: index("fee_invoices_status_idx").on(t.status),
    dueDateIdx: index("fee_invoices_due_date_idx").on(t.dueDate),
  })
);

// ─── fee_payments ─────────────────────────────────────────────────────────────

export const feePayments = pgTable(
  "fee_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receiptNumber: text("receipt_number").notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    feeInvoiceId: uuid("fee_invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "restrict" }),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    transactionReference: text("transaction_reference"),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
    collectedById: uuid("collected_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    remarks: text("remarks"),
    receiptS3Key: text("receipt_s3_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    receiptUnique: unique("fee_payments_receipt_unique").on(t.schoolId, t.receiptNumber),
    invoiceIdx: index("fee_payments_invoice_idx").on(t.feeInvoiceId),
    studentIdx: index("fee_payments_student_idx").on(t.studentId),
    dateIdx: index("fee_payments_date_idx").on(t.paymentDate),
  })
);

// ─── fee_refunds ──────────────────────────────────────────────────────────────

export const feeRefunds = pgTable(
  "fee_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    feePaymentId: uuid("fee_payment_id")
      .notNull()
      .references(() => feePayments.id, { onDelete: "restrict" }),
    refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, PROCESSED, REJECTED
    approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    paymentIdx: index("fee_refunds_payment_idx").on(t.feePaymentId),
    schoolIdx: index("fee_refunds_school_idx").on(t.schoolId),
  })
);

// ─── payment_gateway_logs ─────────────────────────────────────────────────────

export const paymentGatewayLogs = pgTable(
  "payment_gateway_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    feeInvoiceId: uuid("fee_invoice_id").references(() => feeInvoices.id, {
      onDelete: "restrict",
    }),
    gateway: text("gateway").notNull().default("RAZORPAY"),
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    gatewaySignature: text("gateway_signature"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull(), // CREATED, ATTEMPTED, PAID, FAILED, REFUNDED
    webhookPayload: text("webhook_payload"), // Sanitised — no card data
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    schoolIdx: index("payment_gateway_logs_school_idx").on(t.schoolId),
    orderIdx: index("payment_gateway_logs_order_idx").on(t.gatewayOrderId),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const feeInvoicesRelations = relations(feeInvoices, ({ one, many }) => ({
  school: one(schools, { fields: [feeInvoices.schoolId], references: [schools.id] }),
  feeStructure: one(feeStructures, {
    fields: [feeInvoices.feeStructureId],
    references: [feeStructures.id],
  }),
  payments: many(feePayments),
}));

export const feePaymentsRelations = relations(feePayments, ({ one, many }) => ({
  school: one(schools, { fields: [feePayments.schoolId], references: [schools.id] }),
  invoice: one(feeInvoices, {
    fields: [feePayments.feeInvoiceId],
    references: [feeInvoices.id],
  }),
  refunds: many(feeRefunds),
}));
