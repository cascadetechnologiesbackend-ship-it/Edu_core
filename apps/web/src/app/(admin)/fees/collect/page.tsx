import { db } from "@/db";
import { feeInvoices, students, academicYears } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { CollectForm } from "./CollectForm";
import { decryptData } from "@/lib/encryption";

export default async function FeeCollectPage({ searchParams }: { searchParams: { studentId?: string } }) {
  const activeSchool = await db.query.schools.findFirst();
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  if (!activeSchool || !activeYear) return <div>No active school/year.</div>;

  // Get all pending/partial invoices
  const pendingInvoices = await db.query.feeInvoices.findMany({
    where: inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
    with: {
      feeStructure: {
        with: {
          feeHead: true,
        }
      }
    }
  });

  // Get corresponding students for the dropdown
  const studentIds = new Set(pendingInvoices.map(i => i.studentId));
  
  if (searchParams.studentId) {
    studentIds.add(searchParams.studentId);
  }
  
  let relatedStudents: any[] = [];
  if (studentIds.size > 0) {
    relatedStudents = await db.query.students.findMany({
      where: inArray(students.id, Array.from(studentIds))
    });
  }

  const mappedStudents = relatedStudents.map(s => ({
    id: s.id,
    admissionNumber: s.admissionNumber,
    firstName: decryptData(s.firstNameEncrypted) || "Unknown",
    lastName: decryptData(s.lastNameEncrypted) || "",
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Fee Collection Counter
        </h1>
        <p className="text-sm text-gray-500">Record offline manual payments (Cash, Cheque, DD).</p>
      </div>

      <CollectForm
        invoices={pendingInvoices}
        students={mappedStudents}
        {...(searchParams.studentId ? { defaultStudentId: searchParams.studentId } : {})}
      />
    </div>
  );
}
