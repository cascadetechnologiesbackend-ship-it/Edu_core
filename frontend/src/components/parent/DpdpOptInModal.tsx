"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkParentConsentStatus, submitParentLoginConsent } from "@/app/(parent)/portal/actions";
import { Shield, Check, Info, AlertTriangle, Lock } from "lucide-react";

interface Purpose {
  id: string;
  purposeId: string;
  labelEn: string;
  labelHi: string;
  descriptionEn: string;
  descriptionHi: string;
  mandatory: boolean;
}

interface StudentItem {
  id: string;
  admissionNumber: string;
  displayName: string;
}

export default function DpdpOptInModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [consentChoices, setConsentChoices] = useState<Record<string, boolean>>({});
  const [isHindi, setIsHindi] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      try {
        const res = await checkParentConsentStatus();
        if (!mounted) return;
        if (res.success && res.needsConsent && res.students && res.students.length > 0) {
          setStudents(res.students);
          setPurposes(res.purposes || []);
          
          // Pre-populate consents: all mandatory are true, optional can be true by default
          const initialMap: Record<string, boolean> = {};
          (res.purposes || []).forEach((p: Purpose) => {
            initialMap[p.purposeId] = true;
          });
          setConsentChoices(initialMap);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Failed to check parent consent status:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  if (!isOpen || loading || students.length === 0) {
    return null;
  }

  const handleToggle = (purposeId: string, mandatory: boolean) => {
    if (mandatory) return; // Cannot toggle mandatory off
    setConsentChoices((prev) => ({
      ...prev,
      [purposeId]: !prev[purposeId],
    }));
  };

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      setError(
        isHindi
          ? "कृपया सहमति सबमिट करने के लिए घोषणा बॉक्स चेक करें।"
          : "Please check the declaration box confirming parental authority."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const consentPayload: Array<{
        studentId: string;
        purposeId: string;
        granted: boolean;
      }> = [];

      for (const student of students) {
        for (const purpose of purposes) {
          consentPayload.push({
            studentId: student.id,
            purposeId: purpose.purposeId,
            granted: purpose.mandatory ? true : !!consentChoices[purpose.purposeId],
          });
        }
      }

      const res = await submitParentLoginConsent({ consents: consentPayload });
      if (res.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message || "Failed to submit consent. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-card border border-border/40 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Gradient Accent */}
        <div className="h-2 w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500" />

        {/* Modal Header */}
        <div className="p-6 border-b border-border/40 bg-muted/40 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {isHindi ? "डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP) सहमति" : "Parental Consent & DPDP Compliance"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isHindi
                  ? "डीपीडीपी अधिनियम 2023 के तहत आपके वार्ड के डेटा प्रसंस्करण के लिए अनिवार्य सहमति"
                  : "Explicit consent notice required under DPDP Act 2023 for your child's schooling records"}
              </p>
            </div>
          </div>

          {/* Language Toggle Button */}
          <button
            type="button"
            onClick={() => setIsHindi(!isHindi)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-muted/60 hover:bg-muted text-muted-foreground border border-border/40 transition"
          >
            {isHindi ? "English" : "हिंदी"}
          </button>
        </div>

        {/* Student Banner */}
        <div className="px-6 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-muted-foreground">
            {isHindi ? "विद्यार्थी:" : "Enrolled Ward(s):"}
          </span>
          <div className="flex flex-wrap gap-2">
            {students.map((st) => (
              <span
                key={st.id}
                className="px-2.5 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 font-medium"
              >
                {st.displayName} ({st.admissionNumber})
              </span>
            ))}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto no-scrollbar">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-900/40 text-xs text-blue-300/90 leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            <p>
              {isHindi
                ? "स्कूल आपके बच्चे की शिक्षा, सुरक्षा और आधिकारिक रिकॉर्ड प्रबंधन के लिए सीमित डेटा संसाधित करता है। आप नीचे दी गई श्रेणियों की समीक्षा कर सकते हैं।"
                : "The school collects and processes minimal student personal data strictly for education delivery, daily safety, and statutory records under the DPDP Act 2023."}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isHindi ? "सहमति के उद्देश्य और श्रेणियां" : "Consent Categories & Data Purposes"}
            </h3>

            {purposes.map((p) => {
              const isChecked = p.mandatory || !!consentChoices[p.purposeId];
              return (
                <div
                  key={p.purposeId}
                  onClick={() => handleToggle(p.purposeId, p.mandatory)}
                  className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 ${
                    p.mandatory
                      ? "bg-muted/20 border-border/40"
                      : "bg-card border-border/40 hover:border-border/40 cursor-pointer"
                  }`}
                >
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {isHindi ? p.labelHi || p.labelEn : p.labelEn}
                      </span>
                      {p.mandatory ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                          {isHindi ? "अनिवार्य" : "Core Educational"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted/60 text-muted-foreground">
                          {isHindi ? "वैकल्पिक" : "Optional"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isHindi ? p.descriptionHi || p.descriptionEn : p.descriptionEn}
                    </p>
                  </div>

                  <div className="pt-0.5 shrink-0">
                    {p.mandatory ? (
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(p.purposeId, p.mandatory)}
                        className="w-5 h-5 rounded-md bg-muted/60 border-border/40 text-[#008299] dark:text-[#30B0C7] focus:ring-[#008299] cursor-pointer"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer (Sticky with Legal Affirmation & Action) */}
        <div className="p-5 sm:p-6 border-t border-border/40 bg-card space-y-4">
          {/* Legal Affirmation Checkbox - always visible directly above action */}
          <div className="p-3.5 rounded-2xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/20">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded bg-muted/60 border-teal-500 text-[#008299] dark:text-[#30B0C7] focus:ring-[#008299] cursor-pointer shrink-0"
              />
              <span className="text-xs text-foreground leading-relaxed font-medium">
                {isHindi
                  ? "मैं पुष्टि करता/करती हूँ कि मैं ऊपर उल्लिखित छात्र(ों) का कानूनी माता-पिता/अभिभावक हूँ और डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP) अधिनियम 2023 के तहत डेटा प्रसंस्करण के लिए स्पष्ट सहमति देता/देती हूँ।"
                  : "I confirm that I am the parent/legal guardian of the enrolled student(s) and hereby provide explicit, informed consent for the processing of personal data in accordance with the DPDP Act 2023."}
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground text-center sm:text-left">
              {isHindi
                ? "आप बाद में 'Consent Center' टैब से कभी भी वैकल्पिक सहमति बदल सकते हैं।"
                : "You can modify optional consents anytime from the Consent Center."}
            </p>

            <button
              type="button"
              disabled={!agreedToTerms || submitting}
              onClick={handleSubmit}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-xs bg-[#008299] hover:bg-[#006e82] dark:bg-[#30B0C7] dark:hover:bg-[#2899ad] disabled:opacity-40 disabled:cursor-not-allowed text-white dark:text-black shadow-md transition flex items-center justify-center gap-2 shrink-0"
            >
              {submitting ? (
                <span>{isHindi ? "सहेज रहा है..." : "Saving..."}</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isHindi ? "सहमति स्वीकारें और आगे बढ़ें" : "Agree & Complete Opt-In"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
