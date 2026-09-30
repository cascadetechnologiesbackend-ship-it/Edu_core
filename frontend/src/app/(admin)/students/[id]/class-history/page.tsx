import { db } from "@/db";
import { studentClassHistory, students } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";

import { PromoteStudentModal } from "./PromoteStudentModal";

export default async function StudentClassHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const studentId = params.id;

  const student = await db.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) notFound();

  const history = await db.query.studentClassHistory.findMany({
    where: eq(studentClassHistory.studentId, studentId),
    orderBy: [desc(studentClassHistory.createdAt)],
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Class & Section History
        </h1>
        <PromoteStudentModal
          studentId={student.id}
          schoolId={student.schoolId}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-3 font-medium">Academic Year ID</th>
              <th className="px-6 py-3 font-medium">Class ID</th>
              <th className="px-6 py-3 font-medium">Section ID</th>
              <th className="px-6 py-3 font-medium">Roll No</th>
              <th className="px-6 py-3 font-medium">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No class history records found.
                </td>
              </tr>
            ) : (
              history.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium">
                    {record.academicYearId.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4">{record.classId.slice(0, 8)}...</td>
                  <td className="px-6 py-4">
                    {record.sectionId.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4">{record.rollNumber || "-"}</td>
                  <td className="px-6 py-4">
                    {record.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
