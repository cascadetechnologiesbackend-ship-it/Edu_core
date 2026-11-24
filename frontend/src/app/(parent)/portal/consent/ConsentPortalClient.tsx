"use client";

import { useState } from "react";
import { generateConsentChangeOtp, submitConsentChange } from "../actions";
import { Check, Shield, ShieldAlert } from "lucide-react";

interface Student {
  id: string;
  firstNameEncrypted?: string;
  lastNameEncrypted?: string;
  admissionNumber: string;
  displayName?: string;
}

interface Purpose {
  id: string;
  purposeId: string;
  labelEn: string;
  labelHi: string;
  descriptionEn: string;
  descriptionHi: string;
  mandatory: boolean;
  legalBasis: string;
}

interface ConsentRecord {
  studentId: string;
  purposeId: string;
  granted: boolean;
  otpVerified: boolean;
  grantedAt: Date;
  processingHaltedAt?: Date | null;
}

interface Props {
  students: Student[];
  purposes: Purpose[];
  initialConsentRecords: ConsentRecord[];
}

export default function ConsentPortalClient({
  students,
  purposes,
  initialConsentRecords,
}: Props) {
  const [activeStudentId, setActiveStudentId] = useState(students[0]?.id || "");
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>(
    initialConsentRecords,
  );
  const [loading, setLoading] = useState<string | null>(null);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpTarget, setOtpTarget] = useState<{
    purposeId: string;
    nextVal: boolean;
  } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [otpStatusMsg, setOtpStatusMsg] = useState("");
  const [otpError, setOtpError] = useState("");

  const activeStudent = students.find((s) => s.id === activeStudentId);
  const activeStudentName = activeStudent?.displayName || "Student";

  const getConsentState = (purposeId: string) => {
    const record = consentRecords.find(
      (r) => r.studentId === activeStudentId && r.purposeId === purposeId,
    );
    return record ? record.granted : false;
  };

  const handleToggleClick = (purposeId: string, currentGranted: boolean) => {
    setOtpTarget({ purposeId, nextVal: !currentGranted });
    setOtpCode("");
    setWithdrawalReason("");
    setOtpStatusMsg("");
    setOtpError("");
    setShowOtpModal(true);
  };

  const triggerOtpSend = async () => {
    if (!otpTarget) return;
    setLoading("SEND_OTP");
    const res = await generateConsentChangeOtp(
      activeStudentId,
      otpTarget.purposeId,
    );
    setLoading(null);
    if (res.success) {
      setOtpStatusMsg(
        "OTP generated and sent to console! (Accepts '123456' or code)",
      );
    } else {
      setOtpError(res.message || "Failed to trigger OTP");
    }
  };

  const handleOtpVerify = async () => {
    if (!otpTarget) return;
    if (!otpCode) {
      setOtpError("Please enter the 6-digit OTP code");
      return;
    }

    setLoading("VERIFY_OTP");
    const res = await submitConsentChange({
      studentId: activeStudentId,
      purposeId: otpTarget.purposeId,
      granted: otpTarget.nextVal,
      otpCode,
      ...(!otpTarget.nextVal && withdrawalReason ? { withdrawalReason } : {}),
    });
    setLoading(null);

    if (res.success) {
      // Update local state
      const updatedRecord: ConsentRecord = {
        studentId: activeStudentId,
        purposeId: otpTarget.purposeId,
        granted: otpTarget.nextVal,
        otpVerified: true,
        grantedAt: new Date(),
        processingHaltedAt: !otpTarget.nextVal ? new Date() : null,
      };

      setConsentRecords((prev) => {
        const filtered = prev.filter(
          (r) =>
            !(
              r.studentId === activeStudentId &&
              r.purposeId === otpTarget.purposeId
            ),
        );
        return [...filtered, updatedRecord];
      });

      setShowOtpModal(false);
      setOtpTarget(null);
    } else {
      setOtpError(res.message || "OTP verification failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Selector */}
      {students.length > 1 && (
        <div className="flex border border-border/40 dark:border-border/40 rounded-xl p-1 bg-muted/30 dark:bg-card max-w-md">
          {students.map((s) => {
            const name = s.displayName || "Student";
            return (
              <button
                key={s.id}
                onClick={() => setActiveStudentId(s.id)}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                  activeStudentId === s.id
                    ? "bg-white dark:bg-muted/60 text-[#008299] dark:text-[#30B0C7] shadow-sm"
                    : "text-muted-foreground hover:text-muted-foreground"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* DPDP Legal compliance notice */}
      <div className="p-4 bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/20 rounded-2xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-[#008299] dark:text-[#30B0C7] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">
            DPDP Compliance Consent Agreement
          </h4>
          <p className="text-xs text-muted-foreground">
            In accordance with the Digital Personal Data Protection (DPDP) Act
            2023, the school requires your explicit parental consent to process
            your minor child&apos;s personal data. You have the legal right to
            review, update, or withdraw consent at any time. Withdrawal of
            consent triggers an immediate halt to data processing for that
            purpose within 24 hours.
          </p>
        </div>
      </div>

      {/* Purposes List */}
      <div className="grid grid-cols-1 gap-4">
        {purposes.map((p) => {
          const granted = getConsentState(p.purposeId);
          const record = consentRecords.find(
            (r) =>
              r.studentId === activeStudentId && r.purposeId === p.purposeId,
          );

          return (
            <div
              key={p.id}
              className={`p-6 rounded-2xl border transition-all ${
                granted
                  ? "bg-card border-border/40 dark:border-border/40"
                  : "bg-muted/20 dark:bg-muted/20 border-dashed border-border/40 dark:border-border/40"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-3 flex-1">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-muted/50 dark:bg-muted/60 text-muted-foreground rounded-md">
                      Legal Basis: {p.legalBasis}
                    </span>
                    <h3 className="text-base font-bold mt-2 text-foreground dark:text-white">
                      {p.labelEn}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        / {p.labelHi}
                      </span>
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">
                      {p.descriptionEn}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground italic">
                      {p.descriptionHi}
                    </p>
                  </div>

                  {record && !granted && record.processingHaltedAt && (
                    <div className="text-[10px] text-red-600 dark:text-red-400 font-extrabold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      PROCESSING HALTED: Consent withdrawn on{" "}
                      {new Date(record.grantedAt).toLocaleString()}
                    </div>
                  )}
                  {record && granted && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      CONSENT ACTIVE: Granted on{" "}
                      {new Date(record.grantedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {p.mandatory ? (
                    <span className="text-[10px] font-extrabold text-[#008299] dark:text-[#30B0C7] bg-teal-500/10 dark:bg-teal-950/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">
                      Mandatory
                    </span>
                  ) : (
                    <button
                      onClick={() => handleToggleClick(p.purposeId, granted)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        granted
                          ? "bg-[#008299] dark:bg-[#30B0C7]"
                          : "bg-muted dark:bg-muted/60"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          granted ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && otpTarget && (
        <div className="fixed inset-0 bg-muted/40 dark:bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-card border border-border/40 dark:border-border/40 w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground dark:text-white flex items-center gap-1.5">
              <Shield className="w-5 h-5 text-[#008299] dark:text-[#30B0C7]" />
              Verify Parental OTP
            </h3>

            <p className="text-xs text-muted-foreground">
              You are updating consent choices for{" "}
              <strong>{activeStudentName}</strong>. This requires a 6-digit OTP
              verification.
            </p>

            {otpStatusMsg && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-medium">
                {otpStatusMsg}
              </div>
            )}

            {otpError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-800 dark:text-red-300 rounded-xl text-xs font-semibold">
                {otpError}
              </div>
            )}

            {!otpTarget.nextVal && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Reason for Withdrawal (Optional)
                </label>
                <textarea
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  placeholder="e.g. Transferring school, privacy concerns"
                  className="w-full text-xs bg-muted/30 dark:bg-muted/60 border border-border/40 dark:border-border/40 p-2.5 rounded-xl text-foreground dark:text-white focus:outline-none focus:border-[#008299] dark:focus:border-[#30B0C7]"
                  rows={2}
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  className="flex-1 text-center font-mono font-bold tracking-widest text-lg bg-muted/30 dark:bg-muted/60 border border-border/40 dark:border-border/40 p-2.5 rounded-xl text-foreground dark:text-white focus:outline-none focus:border-[#008299] dark:focus:border-[#30B0C7]"
                />
                <button
                  type="button"
                  onClick={triggerOtpSend}
                  disabled={loading === "SEND_OTP"}
                  className="bg-muted/50 hover:bg-muted dark:bg-muted/60 dark:hover:bg-muted/80 text-muted-foreground dark:text-white text-xs font-bold px-4 rounded-xl border border-border/40 dark:border-border/40"
                >
                  {loading === "SEND_OTP" ? "Sending..." : "Request OTP"}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="bg-card hover:bg-muted/30 dark:bg-card border border-border/40 dark:border-border/40 text-muted-foreground dark:text-muted-foreground text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOtpVerify}
                disabled={loading === "VERIFY_OTP"}
                className="bg-[#008299] dark:bg-[#30B0C7] hover:opacity-90 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5"
              >
                {loading === "VERIFY_OTP" ? "Verifying..." : "Verify & Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
