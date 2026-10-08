// ─── Student Fee Advances Schema ──────────────────────────────────────────────
// Tables: student_fee_advances, student_fee_advance_allocations
// Spec: AZ-05 Advance Fees Engine & Double-Entry Invariants

import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, users, academicYears } from "./core";
import { students } from "./students";
import { feeInvoices } from "./fees";
import { bankAccounts, accountLedgerTransactions } from "./accounts";

export type AdvanceStatus =
  | "UNALLOCATED"
  | "PARTIALLY_ALLOCATED"
  | "FULLY_ALLOCATED"
  | "REFUNDED";

export const studentFeeAdvances = pgTable(
  "student_fee_advances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id").references(
      () => academicYears.id,
      { onDelete: "restrict" }
    ),
    advanceNumber: text("advance_number").notNull(),
    advanceDate: timestamp("advance_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    allocatedAmount: numeric("allocated_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    balanceAmount: numeric("balance_amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull().default("CASH"),
    transactionReference: text("transaction_reference"),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("UNALLOCATED"),
    receiptNumber: text("receipt_number"),
    remarks: text("remarks"),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    advanceNumberUnique: unique("student_fee_advances_number_unique").on(
      t.schoolId,
      t.advanceNumber
    ),
    studentIdx: index("student_fee_advances_student_idx").on(
      t.schoolId,
      t.studentId
    ),
    statusIdx: index("student_fee_advances_status_idx").on(t.status),
    dateIdx: index("student_fee_advances_date_idx").on(t.advanceDate),
  })
);

export const studentFeeAdvanceAllocations = pgTable(
  "student_fee_advance_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    advanceId: uuid("advance_id")
      .notNull()
      .references(() => studentFeeAdvances.id, { onDelete: "restrict" }),
    feeInvoiceId: uuid("fee_invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "restrict" }),
    allocatedAmount: numeric("allocated_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    allocationDate: timestamp("allocation_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ledgerTransactionId: uuid("ledger_transaction_id").references(
      () => accountLedgerTransactions.id,
      { onDelete: "set null" }
    ),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    advanceIdx: index("advance_allocations_advance_idx").on(t.advanceId),
    invoiceIdx: index("advance_allocations_invoice_idx").on(t.feeInvoiceId),
    schoolIdx: index("advance_allocations_school_idx").on(t.schoolId),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const studentFeeAdvancesRelations = relations(
  studentFeeAdvances,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [studentFeeAdvances.schoolId],
      references: [schools.id],
    }),
    student: one(students, {
      fields: [studentFeeAdvances.studentId],
      references: [students.id],
    }),
    academicYear: one(academicYears, {
      fields: [studentFeeAdvances.academicYearId],
      references: [academicYears.id],
    }),
    bankAccount: one(bankAccounts, {
      fields: [studentFeeAdvances.bankAccountId],
      references: [bankAccounts.id],
    }),
    createdBy: one(users, {
      fields: [studentFeeAdvances.createdById],
      references: [users.id],
    }),
    allocations: many(studentFeeAdvanceAllocations),
  })
);

export const studentFeeAdvanceAllocationsRelations = relations(
  studentFeeAdvanceAllocations,
  ({ one }) => ({
    advance: one(studentFeeAdvances, {
      fields: [studentFeeAdvanceAllocations.advanceId],
      references: [studentFeeAdvances.id],
    }),
    invoice: one(feeInvoices, {
      fields: [studentFeeAdvanceAllocations.feeInvoiceId],
      references: [feeInvoices.id],
    }),
    school: one(schools, {
      fields: [studentFeeAdvanceAllocations.schoolId],
      references: [schools.id],
    }),
    ledgerTransaction: one(accountLedgerTransactions, {
      fields: [studentFeeAdvanceAllocations.ledgerTransactionId],
      references: [accountLedgerTransactions.id],
    }),
    createdBy: one(users, {
      fields: [studentFeeAdvanceAllocations.createdById],
      references: [users.id],
    }),
  })
);
