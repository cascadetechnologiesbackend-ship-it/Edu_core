// ─── Library Schema ───────────────────────────────────────────────────────────
import {
  pgTable, uuid, text, boolean, timestamp, integer, numeric, index, unique,
} from "drizzle-orm/pg-core";
import { schools } from "./core";
import { relations } from "drizzle-orm";

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  isbn: text("isbn"),
  title: text("title").notNull(),
  author: text("author").notNull(),
  publisher: text("publisher"),
  edition: text("edition"),
  subject: text("subject"),
  category: text("category"),
  rackLocation: text("rack_location"),
  totalCopies: integer("total_copies").notNull().default(1),
  availableCopies: integer("available_copies").notNull().default(1),
  isEResource: boolean("is_e_resource").notNull().default(false),
  eResourceUrl: text("e_resource_url"),
  coverImageS3Key: text("cover_image_s3_key"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  schoolIdx: index("books_school_idx").on(t.schoolId),
  isbnIdx: index("books_isbn_idx").on(t.isbn),
}));

export const bookCopies = pgTable("book_copies", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "restrict" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  barcodeNumber: text("barcode_number").notNull(),
  condition: text("condition").notNull().default("GOOD"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  barcodeUnique: unique("book_copies_barcode_unique").on(t.schoolId, t.barcodeNumber),
}));

export const libraryMembers = pgTable("library_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  memberType: text("member_type").notNull(), // STUDENT | STAFF
  memberRefId: uuid("member_ref_id").notNull(), // student_id or staff_id
  memberCardNumber: text("member_card_number").notNull(),
  maxBooksAllowed: integer("max_books_allowed").notNull().default(2),
  loanPeriodDays: integer("loan_period_days").notNull().default(14),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookIssues = pgTable("book_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  bookCopyId: uuid("book_copy_id").notNull().references(() => bookCopies.id, { onDelete: "restrict" }),
  libraryMemberId: uuid("library_member_id").notNull().references(() => libraryMembers.id, { onDelete: "restrict" }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  renewalCount: integer("renewal_count").notNull().default(0),
  status: text("status").notNull().default("ISSUED"), // ISSUED, RETURNED, OVERDUE, LOST
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  schoolIdx: index("book_issues_school_idx").on(t.schoolId),
  memberIdx: index("book_issues_member_idx").on(t.libraryMemberId),
}));

export const bookFines = pgTable("book_fines", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  bookIssueId: uuid("book_issue_id").notNull().references(() => bookIssues.id, { onDelete: "restrict" }),
  overdueDays: integer("overdue_days").notNull(),
  fineAmount: numeric("fine_amount", { precision: 8, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").notNull().default(false),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const booksRelations = relations(books, ({ many }) => ({
  copies: many(bookCopies),
}));

export const bookCopiesRelations = relations(bookCopies, ({ one, many }) => ({
  book: one(books, {
    fields: [bookCopies.bookId],
    references: [books.id],
  }),
  issues: many(bookIssues),
}));

export const libraryMembersRelations = relations(libraryMembers, ({ many }) => ({
  issues: many(bookIssues),
}));

export const bookIssuesRelations = relations(bookIssues, ({ one, many }) => ({
  copy: one(bookCopies, {
    fields: [bookIssues.bookCopyId],
    references: [bookCopies.id],
  }),
  member: one(libraryMembers, {
    fields: [bookIssues.libraryMemberId],
    references: [libraryMembers.id],
  }),
  fines: many(bookFines),
}));

export const bookFinesRelations = relations(bookFines, ({ one }) => ({
  issue: one(bookIssues, {
    fields: [bookFines.bookIssueId],
    references: [bookIssues.id],
  }),
}));

