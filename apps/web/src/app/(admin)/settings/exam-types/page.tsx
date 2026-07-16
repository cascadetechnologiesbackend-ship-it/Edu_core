import { db } from "@/db";
import { Metadata } from "next";
import { ExamTypesList } from "./ExamTypesList";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Exam Types Settings | SchoolMitra ERP",
};

export default async function ExamTypesSettingsPage() {
  const allTypes = await db.query.examTypes.findMany({
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-sm text-indigo-600 hover:underline">
            ← Settings
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
          Exam Types Settings
        </h1>
        <p className="text-sm text-gray-500">
          Configure exam weightages and codes. These categories appear when creating new exams.
        </p>
      </div>

      <ExamTypesList initialExamTypes={allTypes} />
    </div>
  );
}
