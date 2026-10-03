import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  books,
  bookCopies,
  libraryMembers,
  bookIssues,
  students,
  staff,
} from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import LibraryClientTabs from "./LibraryClientTabs";

export const metadata: Metadata = {
  title: "Library Management",
  description:
    "Manage catalog books, copies, library card members, and checkouts.",
};

export default async function LibraryPage() {
  const session = await auth();
  const role = session?.user?.role || "STUDENT";
  const userId = session?.user?.id || "";
  const schoolId = session?.user?.schoolId || "";

  // Run all 4 queries in parallel — previously sequential (~2.5s), now concurrent
  const [rawBooks, studentsListRaw, staffListRaw, rawMembers, rawIssues] =
    await Promise.all([
      db.query.books.findMany({
        where: and(eq(books.schoolId, schoolId), isNull(books.deletedAt)),
        with: {
          copies: {
            where: isNull(bookCopies.deletedAt),
          },
        },
      }),
      db.query.students.findMany({
        where: eq(students.schoolId, schoolId),
        columns: { id: true, firstNameEncrypted: true, lastNameEncrypted: true },
        limit: 200,
      }),
      db.query.staff.findMany({
        where: eq(staff.schoolId, schoolId),
        columns: { id: true, firstNameEncrypted: true, lastNameEncrypted: true },
        limit: 200,
      }),
      db.query.libraryMembers.findMany({
        where: eq(libraryMembers.schoolId, schoolId),
      }),
      db.query.bookIssues.findMany({
        where: eq(bookIssues.schoolId, schoolId),
        with: {
          copy: {
            with: {
              book: true,
            },
          },
          member: true,
        },
        orderBy: [desc(bookIssues.issuedAt)],
      }),
    ]);

  const booksList = rawBooks.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    publisher: b.publisher,
    edition: b.edition,
    subject: b.subject,
    category: b.category,
    rackLocation: b.rackLocation,
    totalCopies: b.totalCopies,
    availableCopies: b.availableCopies,
    copies: b.copies.map((c) => ({
      id: c.id,
      barcodeNumber: c.barcodeNumber,
      isAvailable: c.isAvailable,
      condition: c.condition,
    })),
  }));


  const studentsMap = new Map(
    studentsListRaw.map((s) => [
      s.id,
      `${decryptData(s.firstNameEncrypted) || ""} ${decryptData(s.lastNameEncrypted) || ""}`.trim(),
    ]),
  );

  const staffMap = new Map(
    staffListRaw.map((st) => [
      st.id,
      `${decryptData(st.firstNameEncrypted) || ""} ${decryptData(st.lastNameEncrypted) || ""}`.trim(),
    ]),
  );

  const membersList = rawMembers.map((m) => {
    const name =
      m.memberType === "STUDENT"
        ? studentsMap.get(m.memberRefId) || "Unknown Student"
        : staffMap.get(m.memberRefId) || "Unknown Staff";

    return {
      id: m.id,
      memberCardNumber: m.memberCardNumber,
      memberType: m.memberType,
      name,
      maxBooksAllowed: m.maxBooksAllowed,
      loanPeriodDays: m.loanPeriodDays,
    };
  });

  const issuesList = rawIssues.map((i) => {
    const memberName =
      i.member.memberType === "STUDENT"
        ? studentsMap.get(i.member.memberRefId) || "Unknown Student"
        : staffMap.get(i.member.memberRefId) || "Unknown Staff";

    return {
      id: i.id,
      barcodeNumber: i.copy.barcodeNumber,
      title: i.copy.book.title,
      memberCardNumber: i.member.memberCardNumber,
      memberName,
      issuedAt: i.issuedAt.toISOString(),
      dueDate: i.dueDate.toISOString(),
      returnedAt: i.returnedAt ? i.returnedAt.toISOString() : null,
      status: i.status,
    };
  });

  // Simple lists for member registration selection dropdowns
  const studentsList = Array.from(studentsMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
  const staffList = Array.from(staffMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Library Management
        </h1>
        <p className="text-gray-500 mt-1">
          Catalog books, issue member cards, and track checkout transactions.
        </p>
      </div>

      <LibraryClientTabs
        booksList={booksList}
        membersList={membersList}
        issuesList={issuesList}
        studentsList={studentsList}
        staffList={staffList}
        role={role}
        userId={userId}
      />
    </div>
  );
}
