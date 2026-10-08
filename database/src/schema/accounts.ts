// ─── Accounts Schema ───────────────────────────────────────────────────────────
// Tables: bank_accounts, income_heads, expense_heads, income_vouchers,
//         expense_vouchers, account_ledger_transactions

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  varchar,
  index,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, users } from "./core";

// ─── chart_of_accounts ────────────────────────────────────────────────────────

export const accountClassificationTypeEnum = pgEnum("account_classification_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);

export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: text("name").notNull(),
    type: accountClassificationTypeEnum("type").notNull(),
    parentCode: varchar("parent_code", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolCodeUnique: unique("chart_of_accounts_school_code_unique").on(
      t.schoolId,
      t.code,
    ),
    schoolTypeIdx: index("chart_of_accounts_school_type_idx").on(
      t.schoolId,
      t.type,
    ),
  }),
);

// ─── bank_accounts ────────────────────────────────────────────────────────────

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    ifscCode: varchar("ifsc_code", { length: 20 }),
    branchName: text("branch_name"),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("bank_accounts_school_idx").on(t.schoolId),
    schoolAccountUnique: unique("bank_accounts_school_acc_unique").on(
      t.schoolId,
      t.accountNumber,
    ),
  }),
);

// ─── income_heads ─────────────────────────────────────────────────────────────

export const incomeHeads = pgTable(
  "income_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("income_heads_school_idx").on(t.schoolId),
    schoolNameUnique: unique("income_heads_school_name_unique").on(
      t.schoolId,
      t.name,
    ),
  }),
);

// ─── expense_heads ────────────────────────────────────────────────────────────

export const expenseHeads = pgTable(
  "expense_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("expense_heads_school_idx").on(t.schoolId),
    schoolNameUnique: unique("expense_heads_school_name_unique").on(
      t.schoolId,
      t.name,
    ),
  }),
);

// ─── income_vouchers ──────────────────────────────────────────────────────────

export const incomeVouchers = pgTable(
  "income_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    voucherNumber: text("voucher_number").notNull(),
    incomeHeadId: uuid("income_head_id")
      .notNull()
      .references(() => incomeHeads.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMode: text("payment_mode").notNull().default("CASH"),
    paymentSource: text("payment_source"),
    transactionReference: text("transaction_reference"),
    receiptAttachmentS3Key: text("receipt_attachment_s3_key"),
    entryDate: timestamp("entry_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    schoolIdx: index("income_vouchers_school_idx").on(t.schoolId),
    voucherNumUnique: unique("income_vouchers_num_unique").on(
      t.schoolId,
      t.voucherNumber,
    ),
    dateIdx: index("income_vouchers_date_idx").on(t.entryDate),
  }),
);

// ─── expense_vouchers ─────────────────────────────────────────────────────────

export const expenseVouchers = pgTable(
  "expense_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    voucherNumber: text("voucher_number").notNull(),
    expenseHeadId: uuid("expense_head_id")
      .notNull()
      .references(() => expenseHeads.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "set null",
    }),
    vendorName: text("vendor_name"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMode: text("payment_mode").notNull().default("CASH"),
    transactionReference: text("transaction_reference"),
    invoiceAttachmentS3Key: text("invoice_attachment_s3_key"),
    entryDate: timestamp("entry_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("APPROVED"), // PENDING, APPROVED, REJECTED, PAID
    approvedById: uuid("approved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
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
    schoolIdx: index("expense_vouchers_school_idx").on(t.schoolId),
    voucherNumUnique: unique("expense_vouchers_num_unique").on(
      t.schoolId,
      t.voucherNumber,
    ),
    dateIdx: index("expense_vouchers_date_idx").on(t.entryDate),
    statusIdx: index("expense_vouchers_status_idx").on(t.status),
  }),
);

// ─── account_ledger_transactions ──────────────────────────────────────────────

export const accountLedgerTransactions = pgTable(
  "account_ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    transactionNumber: text("transaction_number").notNull(),
    sourceType: text("source_type").notNull(), // FEE_COLLECTION, INCOME_VOUCHER, EXPENSE_VOUCHER, OPENING_BALANCE, MANUAL_ADJUSTMENT
    sourceId: uuid("source_id"),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "set null",
    }),
    transactionType: text("transaction_type").notNull(), // CREDIT, DEBIT
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    debitAccountId: uuid("debit_account_id").references(
      () => chartOfAccounts.id,
      { onDelete: "set null" },
    ),
    creditAccountId: uuid("credit_account_id").references(
      () => chartOfAccounts.id,
      { onDelete: "set null" },
    ),
    description: text("description"),
    transactionDate: timestamp("transaction_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("ledger_tx_school_idx").on(t.schoolId),
    dateIdx: index("ledger_tx_date_idx").on(t.transactionDate),
    bankAccIdx: index("ledger_tx_bank_acc_idx").on(t.bankAccountId),
    debitAccIdx: index("ledger_tx_debit_acc_idx").on(t.debitAccountId),
    creditAccIdx: index("ledger_tx_credit_acc_idx").on(t.creditAccountId),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  school: one(schools, {
    fields: [bankAccounts.schoolId],
    references: [schools.id],
  }),
  incomeVouchers: many(incomeVouchers),
  expenseVouchers: many(expenseVouchers),
  ledgerTransactions: many(accountLedgerTransactions),
}));

export const incomeHeadsRelations = relations(incomeHeads, ({ one, many }) => ({
  school: one(schools, {
    fields: [incomeHeads.schoolId],
    references: [schools.id],
  }),
  vouchers: many(incomeVouchers),
}));

export const expenseHeadsRelations = relations(expenseHeads, ({ one, many }) => ({
  school: one(schools, {
    fields: [expenseHeads.schoolId],
    references: [schools.id],
  }),
  vouchers: many(expenseVouchers),
}));

export const incomeVouchersRelations = relations(incomeVouchers, ({ one }) => ({
  school: one(schools, {
    fields: [incomeVouchers.schoolId],
    references: [schools.id],
  }),
  incomeHead: one(incomeHeads, {
    fields: [incomeVouchers.incomeHeadId],
    references: [incomeHeads.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [incomeVouchers.bankAccountId],
    references: [bankAccounts.id],
  }),
  createdBy: one(users, {
    fields: [incomeVouchers.createdById],
    references: [users.id],
  }),
}));

export const expenseVouchersRelations = relations(expenseVouchers, ({ one }) => ({
  school: one(schools, {
    fields: [expenseVouchers.schoolId],
    references: [schools.id],
  }),
  expenseHead: one(expenseHeads, {
    fields: [expenseVouchers.expenseHeadId],
    references: [expenseHeads.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [expenseVouchers.bankAccountId],
    references: [bankAccounts.id],
  }),
  createdBy: one(users, {
    fields: [expenseVouchers.createdById],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [expenseVouchers.approvedById],
    references: [users.id],
  }),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  school: one(schools, {
    fields: [chartOfAccounts.schoolId],
    references: [schools.id],
  }),
  debitTransactions: many(accountLedgerTransactions, {
    relationName: "debitAccount",
  }),
  creditTransactions: many(accountLedgerTransactions, {
    relationName: "creditAccount",
  }),
}));

export const accountLedgerTransactionsRelations = relations(
  accountLedgerTransactions,
  ({ one }) => ({
    school: one(schools, {
      fields: [accountLedgerTransactions.schoolId],
      references: [schools.id],
    }),
    bankAccount: one(bankAccounts, {
      fields: [accountLedgerTransactions.bankAccountId],
      references: [bankAccounts.id],
    }),
    debitAccount: one(chartOfAccounts, {
      fields: [accountLedgerTransactions.debitAccountId],
      references: [chartOfAccounts.id],
      relationName: "debitAccount",
    }),
    creditAccount: one(chartOfAccounts, {
      fields: [accountLedgerTransactions.creditAccountId],
      references: [chartOfAccounts.id],
      relationName: "creditAccount",
    }),
    createdBy: one(users, {
      fields: [accountLedgerTransactions.createdById],
      references: [users.id],
    }),
  }),
);
