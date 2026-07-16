"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { books, bookCopies, libraryMembers, bookIssues, bookFines, auditLogs } from "@/db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { logAuditEvent } from "@/lib/auditLogger";
import { z } from "zod";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"];

async function checkAuth() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

function makeAuditCtx(session: any) {
  return {
    session,
    ip: "127.0.0.1",
    userAgent: "ServerAction",
  };
}

// ─── Zod Validators ───────────────────────────────────────────────────────────

const saveBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  publisher: z.string().optional(),
  edition: z.string().optional(),
  subject: z.string().optional(),
  category: z.string().optional(),
  rackLocation: z.string().optional(),
  isbn: z.string().optional(),
  copiesCount: z.number().int().min(1).max(50),
});

const registerMemberSchema = z.object({
  memberType: z.enum(["STUDENT", "STAFF"]),
  memberRefId: z.string().uuid(),
  memberCardNumber: z.string().min(1, "Card number is required"),
  maxBooksAllowed: z.number().int().min(1).default(3),
  loanPeriodDays: z.number().int().min(1).default(14),
});

const issueBookSchema = z.object({
  barcodeNumber: z.string().min(1, "Barcode is required"),
  memberCardNumber: z.string().min(1, "Card number is required"),
});

const returnBookSchema = z.object({
  issueId: z.string().uuid(),
  condition: z.string().min(1, "Condition is required"),
  fineAmount: z.number().min(0).default(0),
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function saveBook(rawData: unknown) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const data = saveBookSchema.parse(rawData);

  const [book] = await db
    .insert(books)
    .values({
      schoolId,
      title: data.title,
      author: data.author,
      ...(data.publisher ? { publisher: data.publisher } : {}),
      ...(data.edition ? { edition: data.edition } : {}),
      ...(data.subject ? { subject: data.subject } : {}),
      ...(data.category ? { category: data.category } : {}),
      ...(data.rackLocation ? { rackLocation: data.rackLocation } : {}),
      ...(data.isbn ? { isbn: data.isbn } : {}),
      totalCopies: data.copiesCount,
      availableCopies: data.copiesCount,
      isActive: true,
    })
    .returning();

  if (!book) throw new Error("Failed to save book");

  // Create individual copy instances with barcodes
  const barcodePrefix = data.title.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "BOK");
  const suffixRandom = Math.floor(Math.random() * 1000).toString();

  for (let i = 1; i <= data.copiesCount; i++) {
    await db.insert(bookCopies).values({
      bookId: book.id,
      schoolId,
      barcodeNumber: `BC-${barcodePrefix}-${suffixRandom}-${i}`,
      condition: "GOOD",
      isAvailable: true,
    });
  }

  await logAuditEvent(makeAuditCtx(session) as any, {
    schoolId,
    action: "WRITE",
    tableName: "books",
    recordId: book.id,
    purposeId: "academic_records",
    metadata: { title: data.title, copiesCount: data.copiesCount },
  });

  return { success: true, book };
}

export async function registerLibraryMember(rawData: unknown) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const data = registerMemberSchema.parse(rawData);

  // Check if card number already exists
  const existing = await db.query.libraryMembers.findFirst({
    where: and(
      eq(libraryMembers.schoolId, schoolId),
      eq(libraryMembers.memberCardNumber, data.memberCardNumber)
    ),
  });

  if (existing) {
    return { success: false, message: "Card number already registered" };
  }

  const [member] = await db
    .insert(libraryMembers)
    .values({
      schoolId,
      memberType: data.memberType,
      memberRefId: data.memberRefId,
      memberCardNumber: data.memberCardNumber,
      maxBooksAllowed: data.maxBooksAllowed,
      loanPeriodDays: data.loanPeriodDays,
      isActive: true,
    })
    .returning();

  if (!member) throw new Error("Failed to register member");

  await logAuditEvent(makeAuditCtx(session) as any, {
    schoolId,
    action: "WRITE",
    tableName: "library_members",
    recordId: member.id,
    purposeId: "academic_records",
    metadata: { memberCardNumber: data.memberCardNumber, memberType: data.memberType },
  });

  return { success: true, member };
}

export async function issueBook(rawData: unknown) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const data = issueBookSchema.parse(rawData);

  // 1. Resolve library member
  const member = await db.query.libraryMembers.findFirst({
    where: and(
      eq(libraryMembers.schoolId, schoolId),
      eq(libraryMembers.memberCardNumber, data.memberCardNumber),
      eq(libraryMembers.isActive, true)
    ),
  });

  if (!member) {
    return { success: false, message: "Active library member card not found" };
  }

  // 2. Resolve book copy
  const copy = await db.query.bookCopies.findFirst({
    where: and(
      eq(bookCopies.schoolId, schoolId),
      eq(bookCopies.barcodeNumber, data.barcodeNumber),
      isNull(bookCopies.deletedAt)
    ),
  });

  if (!copy) {
    return { success: false, message: "Book copy barcode not found in catalog" };
  }

  if (!copy.isAvailable) {
    return { success: false, message: "Book copy is currently checked out" };
  }

  // 3. Perform checkouts transaction
  await db.transaction(async (tx) => {
    // Set copy as unavailable
    await tx
      .update(bookCopies)
      .set({ isAvailable: false })
      .where(eq(bookCopies.id, copy.id));

    // Create checkout issue log
    const dueDate = new Date(Date.now() + member.loanPeriodDays * 24 * 60 * 60 * 1000);
    await tx.insert(bookIssues).values({
      schoolId,
      bookCopyId: copy.id,
      libraryMemberId: member.id,
      dueDate,
      status: "ISSUED",
    });

    // Decrement available count in books
    await tx
      .update(books)
      .set({
        availableCopies: sql`available_copies - 1`,
      })
      .where(eq(books.id, copy.bookId));
  });

  await logAuditEvent(makeAuditCtx(session) as any, {
    schoolId,
    action: "WRITE",
    tableName: "book_issues",
    recordId: copy.id,
    purposeId: "academic_records",
    metadata: { barcodeNumber: data.barcodeNumber, memberCardNumber: data.memberCardNumber },
  });

  return { success: true };
}

export async function returnBook(rawData: unknown) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const data = returnBookSchema.parse(rawData);

  // 1. Resolve active checkout issue
  const issue = await db.query.bookIssues.findFirst({
    where: and(
      eq(bookIssues.schoolId, schoolId),
      eq(bookIssues.id, data.issueId)
    ),
  });

  if (!issue) {
    return { success: false, message: "Checkout issue log not found" };
  }

  // 2. Return copy and log fines
  await db.transaction(async (tx) => {
    // Mark copy as available
    await tx
      .update(bookCopies)
      .set({ isAvailable: true, condition: data.condition })
      .where(eq(bookCopies.id, issue.bookCopyId));

    // Update issue log returnedAt
    await tx
      .update(bookIssues)
      .set({ returnedAt: new Date(), status: "RETURNED" })
      .where(eq(bookIssues.id, issue.id));

    // Register fine if any
    if (data.fineAmount > 0) {
      const overdueDays = Math.max(
        0,
        Math.ceil((Date.now() - new Date(issue.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      await tx.insert(bookFines).values({
        schoolId,
        bookIssueId: issue.id,
        overdueDays,
        fineAmount: data.fineAmount.toString(),
        isPaid: true,
        paidAt: new Date(),
      });
    }

    // Increment available count in books table
    const copy = await tx.query.bookCopies.findFirst({
      where: eq(bookCopies.id, issue.bookCopyId),
    });
    if (copy) {
      await tx
        .update(books)
        .set({
          availableCopies: sql`available_copies + 1`,
        })
        .where(eq(books.id, copy.bookId));
    }
  });

  await logAuditEvent(makeAuditCtx(session) as any, {
    schoolId,
    action: "WRITE",
    tableName: "book_issues",
    recordId: issue.id,
    purposeId: "academic_records",
    metadata: { issueId: data.issueId, fineAmount: data.fineAmount },
  });

  return { success: true };
}
