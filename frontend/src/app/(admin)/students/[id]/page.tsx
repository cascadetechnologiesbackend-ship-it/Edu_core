import { db } from "@/db";
import { students, studentFamilyMembers, consentRecords } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import Link from "next/link";

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

import { getSignedDownloadUrl } from "@/lib/s3";

export default async function StudentProfile({
  params,
}: {
  params: { id: string };
}) {
  const student = await db.query.students.findFirst({
    where: eq(students.id, params.id),
  });

  if (!student) {
    return <div className="p-6 text-red-500">Student not found</div>;
  }

  const familyMembers = await db.query.studentFamilyMembers.findMany({
    where: eq(studentFamilyMembers.studentId, student.id),
  });

  const consents = await db.query.consentRecords.findMany({
    where: eq(consentRecords.studentId, student.id),
  });

  const name = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`;

  const photoUrl = student.photoS3Key
    ? await getSignedDownloadUrl(
        student.photoS3Key,
        process.env.S3_BUCKET_NAME || "schoolmitra",
      )
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Student Overview</h2>
        <Link
          href={`/students/${student.id}/fees`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
        >
          View Fee Ledger
        </Link>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-8 flex items-start gap-8">
        <div className="w-32 h-32 bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-4xl overflow-hidden shadow-inner shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Student"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>👤</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {name}
              </h1>
              <p className="text-gray-500 mt-1">
                Admission No: {student.admissionNumber}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${student.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
            >
              {student.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            <div>
              <p className="text-sm text-gray-500 mb-1">Date of Birth</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {student.dateOfBirth?.toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Gender</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {student.gender}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Aadhaar</p>
              <p className="font-medium text-gray-900 dark:text-white font-mono">
                {student.aadhaarLast4
                  ? `XXXX-XXXX-${student.aadhaarLast4}`
                  : "Not Provided"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Category</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {student.category}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Family Tree */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Family Tree
          </h2>
          <div className="space-y-4">
            {familyMembers.map((fm) => (
              <div
                key={fm.id}
                className="flex items-start p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mr-4">
                  {fm.relation === "FATHER"
                    ? "👨"
                    : fm.relation === "MOTHER"
                      ? "👩"
                      : "👤"}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {decryptData(fm.nameEncrypted)}
                  </h3>
                  <p className="text-sm text-gray-500 uppercase tracking-wider">
                    {fm.relation}
                  </p>
                  <div className="mt-2 text-sm">
                    {fm.mobileEncrypted && (
                      <p className="text-gray-600 dark:text-gray-400">
                        📞 {decryptData(fm.mobileEncrypted)}
                      </p>
                    )}
                    {fm.emailEncrypted && (
                      <p className="text-gray-600 dark:text-gray-400">
                        ✉️ {decryptData(fm.emailEncrypted)}
                      </p>
                    )}
                  </div>
                </div>
                {fm.isPrimaryContact && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* DPDP Consent Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            DPDP Consent Records
          </h2>
          <div className="space-y-3">
            {consents.length === 0 ? (
              <p className="text-gray-500 text-sm italic">
                No consent records found.
              </p>
            ) : (
              consents.map((consent) => (
                <div
                  key={consent.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {consent.purposeId}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Notice v{consent.privacyNoticeVersion}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${consent.granted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {consent.granted ? "Granted" : "Withdrawn"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
