"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  UserCheck,
  UserPlus,
  RefreshCw,
  Mail,
  Phone,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  findParentCandidatesAction,
  linkStudentToParentAction,
  inviteAndLinkParentAction,
  getUnlinkedStudentsAction,
} from "./actions";

export interface UnlinkedStudentRow {
  id: string;
  admissionNumber: string;
  studentName: string;
  className: string;
  sectionName: string;
  guardianName: string | null;
  guardianMobile: string | null;
  guardianEmail: string | null;
  guardianRelation: string | null;
  createdAt: string;
}

export interface ParentCandidateItem {
  userId: string;
  email: string;
  name: string;
  mobile: string | null;
  matchReason: string;
}

interface ParentLinkageClientProps {
  initialUnlinkedStudents: UnlinkedStudentRow[];
}

export function ParentLinkageClient({
  initialUnlinkedStudents,
}: ParentLinkageClientProps) {
  const [studentsList, setStudentsList] = useState<UnlinkedStudentRow[]>(
    initialUnlinkedStudents,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  // Match / Link Modal State
  const [selectedStudent, setSelectedStudent] = useState<UnlinkedStudentRow | null>(null);
  const [candidates, setCandidates] = useState<ParentCandidateItem[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);

  // Link Confirm Dialog State
  const [confirmLinkData, setConfirmLinkData] = useState<{
    student: UnlinkedStudentRow;
    candidate: ParentCandidateItem;
  } | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // Invite Result Modal State
  const [inviteResult, setInviteResult] = useState<{
    studentName: string;
    isNewlyProvisioned: boolean;
    credentials?: {
      email: string;
      claimToken: string;
      claimUrl: string;
      temporaryPassword?: string;
      mobile?: string | null;
    };
  } | null>(null);

  const filteredStudents = studentsList.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(term) ||
      s.admissionNumber.toLowerCase().includes(term) ||
      (s.guardianName && s.guardianName.toLowerCase().includes(term)) ||
      (s.guardianEmail && s.guardianEmail.toLowerCase().includes(term)) ||
      (s.guardianMobile && s.guardianMobile.includes(term))
    );
  });

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const res = await getUnlinkedStudentsAction();
        if (res.success) {
          setStudentsList(res.students);
          toast.success("Linkage queue updated");
        }
      } catch (err: any) {
        toast.error("Failed to refresh queue");
      }
    });
  };

  const handleOpenFindMatch = async (student: UnlinkedStudentRow) => {
    setSelectedStudent(student);
    setMatchModalOpen(true);
    setIsSearchingCandidates(true);
    setCandidates([]);

    try {
      const res = await findParentCandidatesAction(student.id);
      if (res.success) {
        setCandidates(res.candidates);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to search parent candidates");
    } finally {
      setIsSearchingCandidates(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!confirmLinkData) return;
    setIsLinking(true);

    try {
      const res = await linkStudentToParentAction(
        confirmLinkData.student.id,
        confirmLinkData.candidate.userId,
      );

      if (res.success) {
        toast.success(
          `Linked ${confirmLinkData.student.studentName} to ${confirmLinkData.candidate.name}`,
        );
        setStudentsList((prev) =>
          prev.filter((s) => s.id !== confirmLinkData.student.id),
        );
        setConfirmLinkData(null);
        setMatchModalOpen(false);
      } else {
        toast.error(res.message || "Failed to link parent");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setIsLinking(false);
    }
  };

  const handleInviteParent = (student: UnlinkedStudentRow) => {
    startTransition(async () => {
      try {
        const res = await inviteAndLinkParentAction(student.id);
        if (res.success) {
          toast.success(`Account linked for ${student.studentName}`);
          setStudentsList((prev) => prev.filter((s) => s.id !== student.id));

          if (res.credentials) {
            setInviteResult({
              studentName: student.studentName,
              isNewlyProvisioned: !!res.isNewlyProvisioned,
              credentials: res.credentials,
            });
          }
        } else {
          toast.error(res.message || "Invitation failed");
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to invite parent");
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Student Parent Linkage Queue
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {studentsList.length} Unlinked
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Resolve unlinked students created outside admissions or missing primary parent accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/students"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            ← Back to Directory
          </Link>
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-gray-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="w-full sm:w-96 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by student, admission #, guardian name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/60 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-primary min-h-[40px] transition"
          />
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Showing <strong>{filteredStudents.length}</strong> unlinked wards
        </div>
      </div>

      {/* Unlinked Students Table */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {searchTerm ? "No Matching Students" : "All Students Successfully Linked"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
            {searchTerm
              ? "Try adjusting your search terms or clearing the filter."
              : "Every active student profile in this school has an active parent account linked. No repair required."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/75 dark:bg-slate-800/40 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Student & Adm #</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Guardian on Record</th>
                  <th className="py-3 px-4">Guardian Contact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {student.studentName}
                      </div>
                      <div className="text-[11px] font-mono text-gray-500">
                        {student.admissionNumber}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {student.className}
                      </span>
                      <span className="text-gray-500 ml-1">
                        ({student.sectionName})
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {student.guardianName || "—"}
                      </div>
                      {student.guardianRelation && (
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                          {student.guardianRelation}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 space-y-1">
                      {student.guardianEmail ? (
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{student.guardianEmail}</span>
                        </div>
                      ) : null}
                      {student.guardianMobile ? (
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{student.guardianMobile}</span>
                        </div>
                      ) : null}
                      {!student.guardianEmail && !student.guardianMobile && (
                        <span className="text-gray-400 italic">No contact details</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                        <ShieldAlert className="w-3 h-3" />
                        No Parent Linked
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenFindMatch(student)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition inline-flex items-center gap-1"
                        >
                          <Search className="w-3 h-3" />
                          Find Parent
                        </button>

                        <button
                          onClick={() => handleInviteParent(student)}
                          disabled={!student.guardianEmail || isPending}
                          title={
                            !student.guardianEmail
                              ? "Guardian email is required to invite"
                              : "Generate account & claim credentials"
                          }
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/95 transition disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                        >
                          <UserPlus className="w-3 h-3" />
                          Invite Parent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Find Match Modal */}
      <AppModal
        open={matchModalOpen}
        onClose={() => setMatchModalOpen(false)}
        title={`Find Matching Parent for ${selectedStudent?.studentName || ""}`}
        size="md"
        footer={
          <button
            onClick={() => setMatchModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Close
          </button>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs space-y-1">
            <div className="text-gray-500 dark:text-gray-400">Guardian on Record:</div>
            <div className="font-bold text-gray-900 dark:text-white">
              {selectedStudent?.guardianName || "Unspecified"} ({selectedStudent?.guardianRelation || "Guardian"})
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              {selectedStudent?.guardianEmail && `Email: ${selectedStudent.guardianEmail}`}
              {selectedStudent?.guardianEmail && selectedStudent?.guardianMobile && " • "}
              {selectedStudent?.guardianMobile && `Mobile: ${selectedStudent.guardianMobile}`}
            </div>
          </div>

          {isSearchingCandidates ? (
            <div className="py-8 text-center text-xs text-gray-500 animate-pulse">
              Searching parent accounts within this school...
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-6 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-900 dark:text-white">
                No Existing Parent Account Matched
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                No user in this school matches the guardian's email. You can use "Invite Parent" to provision a new account.
              </p>
              {selectedStudent && (
                <button
                  onClick={() => {
                    setMatchModalOpen(false);
                    handleInviteParent(selectedStudent);
                  }}
                  disabled={!selectedStudent.guardianEmail}
                  className="mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/95 transition inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Invite & Provision Parent Now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Matched User Accounts ({candidates.length})
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {candidates.map((cand) => (
                  <div
                    key={cand.userId}
                    className="p-3.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900"
                  >
                    <div>
                      <div className="font-bold text-xs text-gray-900 dark:text-white">
                        {cand.name}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {cand.email} {cand.mobile ? `• ${cand.mobile}` : ""}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        {cand.matchReason}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (selectedStudent) {
                          setConfirmLinkData({
                            student: selectedStudent,
                            candidate: cand,
                          });
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition inline-flex items-center gap-1 shadow-xs"
                    >
                      <UserCheck className="w-3 h-3" />
                      Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppModal>

      {/* Link Confirm Dialog */}
      {confirmLinkData && (
        <ConfirmDialog
          open={!!confirmLinkData}
          onClose={() => setConfirmLinkData(null)}
          onConfirm={handleConfirmLink}
          title="Confirm Parent Linkage"
          confirmText="Confirm Link"
          confirmVariant="primary"
          isLoading={isLinking}
          description={
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <p>
                Are you sure you want to link student{" "}
                <strong className="text-gray-900 dark:text-white">
                  {confirmLinkData.student.studentName}
                </strong>{" "}
                to parent account{" "}
                <strong className="text-gray-900 dark:text-white">
                  {confirmLinkData.candidate.name} ({confirmLinkData.candidate.email})
                </strong>
                ?
              </p>
              <p className="text-[11px] text-gray-500">
                This grant gives this parent immediate access to view this child's attendance, fees, academic feed, and report cards in the Parent App.
              </p>
            </div>
          }
        />
      )}

      {/* Invite Parent Credentials Modal */}
      <AppModal
        open={!!inviteResult}
        onClose={() => setInviteResult(null)}
        title="Parent Account Provisioned & Linked"
        size="md"
        footer={
          <button
            onClick={() => setInviteResult(null)}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/95"
          >
            Done
          </button>
        }
      >
        {inviteResult && inviteResult.credentials && (
          <div className="space-y-4 text-xs">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 p-3 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-900 dark:text-emerald-200">
                  Account successfully created and linked to {inviteResult.studentName}.
                </span>
                <p className="text-emerald-800 dark:text-emerald-300 text-[11px] mt-0.5">
                  Share these temporary onboarding credentials with the parent.
                </p>
              </div>
            </div>

            <div className="space-y-2 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Login Email
                </div>
                <div className="font-mono text-xs font-bold text-gray-900 dark:text-white flex items-center justify-between mt-0.5">
                  <span>{inviteResult.credentials.email}</span>
                  <button
                    onClick={() =>
                      copyToClipboard(inviteResult.credentials!.email, "Email")
                    }
                    className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {inviteResult.credentials.temporaryPassword && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Temporary Password
                  </div>
                  <div className="font-mono text-xs font-bold text-gray-900 dark:text-white flex items-center justify-between mt-0.5">
                    <span>{inviteResult.credentials.temporaryPassword}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          inviteResult.credentials!.temporaryPassword!,
                          "Temporary Password",
                        )
                      }
                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Claim Account Link (7 Days)
                </div>
                <div className="font-mono text-[11px] text-gray-700 dark:text-gray-300 flex items-center justify-between mt-0.5 break-all">
                  <span>{inviteResult.credentials.claimUrl}</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        inviteResult.credentials!.claimUrl,
                        "Claim URL",
                      )
                    }
                    className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 shrink-0 ml-2"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
}
