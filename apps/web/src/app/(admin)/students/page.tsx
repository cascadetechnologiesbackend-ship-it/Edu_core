import { db } from "@/db";
import { students } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import crypto from "crypto";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function decryptData(encryptedText: string | null) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(":");
    const ivStr = parts[0];
    const encryptedStr = parts[1];
    if (!ivStr || !encryptedStr) return encryptedText;

    const iv = Buffer.from(ivStr, "hex");
    const encrypted = Buffer.from(encryptedStr, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv,
    );
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return encryptedText;
  }
}

export default async function StudentsDirectory() {
  const allStudents = await db.query.students.findMany({
    orderBy: [desc(students.createdAt)],
    limit: 100,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Student Directory
          </h1>
          <p className="text-gray-500 mt-1">
            View and manage all enrolled students.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-6 py-3 font-medium">Admission No</th>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Gender</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {allStudents.map((student) => {
              const name = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`;

              return (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium">
                    {student.admissionNumber}
                  </td>
                  <td className="px-6 py-4">{name}</td>
                  <td className="px-6 py-4">{student.gender}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${student.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}
                    >
                      {student.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/students/${student.id}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      View Profile
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
