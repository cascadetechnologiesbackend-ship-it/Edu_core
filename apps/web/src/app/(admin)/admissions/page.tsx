import { db } from "@/db";
import { admissionApplications } from "@/db/schema";
import { desc, count, eq } from "drizzle-orm";
import Link from "next/link";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function decryptData(encryptedText: string | null) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(":");
    const ivStr = parts[0];
    const encryptedStr = parts[1];
    if (!ivStr || !encryptedStr) return encryptedText;
  
    const iv = Buffer.from(ivStr, "hex");
    const encrypted = Buffer.from(encryptedStr, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return encryptedText;
  }
}

export default async function AdmissionsDashboard() {
  const applicationsPromise = db.query.admissionApplications.findMany({
    orderBy: [desc(admissionApplications.createdAt)],
    limit: 50,
  });

  const totalPromise = db.select({ value: count() }).from(admissionApplications);
  const rtePromise = db.select({ value: count() }).from(admissionApplications).where(eq(admissionApplications.isRteApplicant, true));

  const [applications, [totalResult], [rteResult]] = await Promise.all([
    applicationsPromise,
    totalPromise,
    rtePromise,
  ]);

  const totalApps = totalResult?.value ?? 0;
  const rteApps = rteResult?.value ?? 0;
  const rtePercentage = totalApps > 0 ? Math.round((rteApps / totalApps) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Admissions</h1>
          <p className="text-gray-500 mt-1">Manage student applications and enrolments.</p>
        </div>
        <Link href="/admissions/new">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors">
            New Admission
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 shadow border border-gray-200 dark:border-slate-800">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Applications</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalApps}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 shadow border border-gray-200 dark:border-slate-800">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">RTE 25% Quota Tracker</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{rteApps}</p>
            <p className="text-sm text-gray-500 font-medium">({rtePercentage}% of total)</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 dark:bg-gray-700 overflow-hidden">
            <div className={`h-2.5 rounded-full ${rtePercentage >= 25 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(rtePercentage, 100)}%` }}></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{rtePercentage >= 25 ? 'Quota met or exceeded' : 'Below 25% mandate'}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
            <tr>
              <th className="px-6 py-3 font-medium">App No</th>
              <th className="px-6 py-3 font-medium">Applicant Name</th>
              <th className="px-6 py-3 font-medium">Grade</th>
              <th className="px-6 py-3 font-medium">Parent Contact</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {applications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No admission applications found.
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium">
                    <Link href={`/admissions/${app.id}`} className="text-blue-600 hover:underline">
                      {app.applicationNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4">{decryptData(app.applicantNameEncrypted)}</td>
                  <td className="px-6 py-4">{app.gradeAppliedFor.replace('_', ' ')}</td>
                  <td className="px-6 py-4">{decryptData(app.primaryContactMobileEncrypted)}</td>
                  <td className="px-6 py-4">{app.createdAt?.toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                      {app.status}
                    </span>
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
