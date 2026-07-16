"use client";

import { useState, useTransition } from "react";
import { generateMeritList, issueTopperCertificate } from "../actions";

interface ClassItem {
  id: string;
  displayName: string;
}

interface StudentItem {
  id: string;
  name: string;
  admissionNumber: string;
}

interface ReportCardItem {
  id: string;
  studentId: string;
  rank: number | null;
  overallGrade: string | null;
}

interface CertificateItem {
  id: string;
  studentId: string;
  certificateNumber: string;
  remarks: string | null;
}

interface MeritListManagerProps {
  examId: string;
  classes: ClassItem[];
  students: StudentItem[];
  reportCards: ReportCardItem[];
  issuedCertificates: CertificateItem[];
}

export function MeritListManager({
  examId,
  classes,
  students,
  reportCards: initialReportCards,
  issuedCertificates: initialCertificates,
}: MeritListManagerProps) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [certificates, setCertificates] = useState(initialCertificates);

  // Get report cards with student info for selected class
  const classMeritList = initialReportCards
    .filter((rc) => initialReportCards.some((x) => x.studentId === rc.studentId)) // Simple check
    .map((rc) => {
      const student = students.find((s) => s.id === rc.studentId);
      return {
        ...rc,
        student,
      };
    })
    .filter((item) => item.student !== undefined)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  const handleCalculateRanks = () => {
    startTransition(async () => {
      setMessage("");
      const res = await generateMeritList(examId, selectedClassId);
      if (res.success) {
        setMessage(`✓ ${res.message}`);
        // Fetch new rankings / reload page or update state
        window.location.reload();
      } else {
        setMessage(`✗ ${res.message}`);
      }
    });
  };

  const handleIssueCertificate = (studentId: string, rank: number) => {
    startTransition(async () => {
      setMessage("");
      const res = await issueTopperCertificate(studentId, examId, rank);
      if (res.success && res.certificate) {
        setMessage(`✓ ${res.message}`);
        setCertificates((prev) => [...prev, res.certificate as CertificateItem]);
      } else {
        setMessage(`✗ ${res.message}`);
      }
    });
  };

  const getCertForStudent = (studentId: string) => {
    return certificates.find(
      (c) => c.studentId === studentId && c.remarks?.includes(examId)
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Merit List & Topper Certificates</h2>
        <p className="text-sm text-gray-500">
          Rank students based on their performance in the exam and award certificates of merit.
        </p>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">Select Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-3 py-1.5 text-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCalculateRanks}
          disabled={isPending || !selectedClassId}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? "Calculating..." : "Calculate Class Ranks"}
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.startsWith("✓")
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Merit List Table */}
      <div className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">Student Name</th>
              <th className="px-4 py-3 text-left">Admission No</th>
              <th className="px-4 py-3 text-left">Overall Grade</th>
              <th className="px-4 py-3 text-left">Topper Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {classMeritList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No ranked students. Click &quot;Calculate Class Ranks&quot; to compute rankings.
                </td>
              </tr>
            ) : (
              classMeritList.map((item) => {
                const cert = getCertForStudent(item.studentId);
                const hasRank = item.rank !== null;
                const canGetCert = hasRank && item.rank! <= 3;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 font-semibold text-indigo-600">
                      {item.rank ? `#${item.rank}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{item.student?.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.student?.admissionNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold">{item.overallGrade ?? "—"}</td>
                    <td className="px-4 py-3">
                      {cert ? (
                        <a
                          href={`/api/certificates/${cert.id}/download`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-2 py-1 rounded"
                        >
                          🏆 Download Cert ({cert.certificateNumber})
                        </a>
                      ) : canGetCert ? (
                        <button
                          onClick={() => handleIssueCertificate(item.studentId, item.rank!)}
                          disabled={isPending}
                          className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded"
                        >
                          Issue Certificate
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
