"use client";

import { useState } from "react";
import { uploadParentStudentDocument, fetchParentStudentDocuments } from "@/app/(parent)/portal/actions";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Shield,
  AlertTriangle,
  User,
  Check,
  FileCheck2,
  RefreshCw,
} from "lucide-react";

interface StudentItem {
  id: string;
  admissionNumber: string;
  displayName: string;
}

interface DocItem {
  id: string;
  documentType: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  isVerified: boolean;
  createdAt: Date;
}

interface Props {
  students: StudentItem[];
  initialSelectedStudentId: string;
  initialDocuments: DocItem[];
}

const DOCUMENT_DEFINITIONS = [
  {
    type: "BIRTH_CERTIFICATE",
    aliasTypes: ["BIRTH_CERTIFICATE"],
    titleEn: "Birth Certificate",
    titleHi: "जन्म प्रमाण पत्र",
    subtitle: "Municipal Corporation or Panchayat Issued Certificate",
    dpdpNote: "Used strictly for statutory age and student identity verification under DPDP Act 2023.",
    icon: "📄",
    color: "from-blue-500/20 to-indigo-500/10 border-blue-500/30",
  },
  {
    type: "AADHAAR_PHOTO",
    aliasTypes: ["AADHAAR_PHOTO", "AADHAAR_PHOTO_MASKED"],
    titleEn: "Aadhaar Card (Masked)",
    titleHi: "आधार कार्ड (मास्क्ड)",
    subtitle: "Masked Aadhaar copy displaying only the last 4 digits",
    dpdpNote: "In compliance with UIDAI & DPDP norms: please ensure first 8 digits are obscured.",
    icon: "🛡️",
    color: "from-purple-500/20 to-pink-500/10 border-purple-500/30",
  },
  {
    type: "PASSPORT_PHOTO",
    aliasTypes: ["PASSPORT_PHOTO", "STUDENT_PHOTO"],
    titleEn: "Student Passport Photograph",
    titleHi: "छात्र का पासपोर्ट फोटो",
    subtitle: "Recent formal passport photograph with clean background",
    dpdpNote: "Required for student smart ID card, examination hall ticket, and portal profile.",
    icon: "👤",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
  },
  {
    type: "TC",
    aliasTypes: ["TC", "PREVIOUS_TC"],
    titleEn: "Transfer Certificate (TC)",
    titleHi: "स्थानांतरण प्रमाण पत्र (टीसी)",
    subtitle: "Countersigned migration certificate from previous school",
    dpdpNote: "Ensures continuity of academic records and board registration.",
    icon: "📜",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30",
  },
  {
    type: "VACCINATION",
    aliasTypes: ["VACCINATION", "VACCINATION_RECORD"],
    titleEn: "Medical & Immunization Record",
    titleHi: "स्वास्थ्य और टीकाकरण रिकॉर्ड",
    subtitle: "Immunization chart or general physical fitness certificate",
    dpdpNote: "Essential for emergency first aid and campus health protocol.",
    icon: "🩺",
    color: "from-cyan-500/20 to-sky-500/10 border-cyan-500/30",
  },
  {
    type: "OTHER",
    aliasTypes: ["OTHER", "CASTE_CERTIFICATE", "INCOME_CERTIFICATE", "DISABILITY_CERTIFICATE"],
    titleEn: "Other Certificate / Quota Proof",
    titleHi: "अन्य प्रमाणपत्र / कोटा दस्तावेज़",
    subtitle: "EWS / Caste / Income / Sibling or Sports concession document",
    dpdpNote: "Processed solely to substantiate quota eligibility or fee concession.",
    icon: "📑",
    color: "from-slate-500/20 to-gray-500/10 border-slate-700",
  },
];

export default function ParentDocumentsClient({
  students,
  initialSelectedStudentId,
  initialDocuments,
}: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState(initialSelectedStudentId);
  const [documents, setDocuments] = useState<DocItem[]>(initialDocuments);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0] || {
    id: "",
    admissionNumber: "N/A",
    displayName: "Student",
  };

  const handleStudentSwitch = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setFeedback(null);
    setRefreshing(true);
    try {
      const res = await fetchParentStudentDocuments(studentId);
      if (res.success && res.documents) {
        setDocuments(res.documents);
      }
    } catch (err: any) {
      console.error("Failed to load documents for student:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFileUpload = async (documentType: string, file: File) => {
    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ type: "error", message: "File exceeds 10MB limit. Please choose a smaller file." });
      return;
    }

    setUploadingType(documentType);
    setFeedback(null);

    try {
      // Step 1: Obtain presigned URL from API
      const presignedRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          prefix: "student-documents",
        }),
      });

      const presignedData = await presignedRes.json();
      if (!presignedData.success || !presignedData.url || !presignedData.key) {
        throw new Error(presignedData.message || "Failed to initiate secure upload channel");
      }

      // Step 2: Upload raw file to storage
      const uploadRes = await fetch(presignedData.url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file bytes to secure storage");
      }

      // Step 3: Record entry in studentDocuments table
      const saveRes = await uploadParentStudentDocument({
        studentId: selectedStudentId,
        documentType,
        s3Key: presignedData.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
      });

      if (!saveRes.success) {
        throw new Error(saveRes.message || "Failed to record document metadata");
      }

      // Add to local state
      const newDoc: DocItem = {
        id: `temp-${Date.now()}`,
        documentType,
        originalFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        isVerified: false,
        createdAt: new Date(),
      };

      setDocuments((prev) => [newDoc, ...prev]);
      setFeedback({
        type: "success",
        message: `Successfully uploaded ${file.name}. It is now pending school administration verification.`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to upload document" });
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ward Selector Bar (if parent has multiple children) */}
      {students.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">Select Ward:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {students.map((st) => {
              const isSelected = st.id === selectedStudentId;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleStudentSwitch(st.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span>{st.displayName}</span>
                  <span className="text-[10px] opacity-75">({st.admissionNumber})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Student Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-lg">
            {selectedStudent.displayName.charAt(0)}
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>{selectedStudent.displayName}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {selectedStudent.admissionNumber}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>DPDP Encrypted Storage • Verified by School Administration</span>
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-950/60 px-3.5 py-2 rounded-xl border border-slate-800/80">
          <span className="font-semibold text-slate-200">
            {documents.length} Document{documents.length === 1 ? "" : "s"}
          </span>{" "}
          on file
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-3 border animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
              : "bg-red-950/30 border-red-800/60 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <Check className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          )}
          <span className="flex-1 font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOCUMENT_DEFINITIONS.map((def) => {
          // Check if any uploaded doc matches this category
          const matchingDoc = documents.find((d) =>
            def.aliasTypes.includes(d.documentType)
          );
          const isUploading = uploadingType === def.type;

          return (
            <div
              key={def.type}
              className={`rounded-2xl border bg-slate-900/90 p-5 flex flex-col justify-between transition hover:border-slate-700/80 ${
                matchingDoc ? "border-slate-800" : "border-slate-800/80"
              }`}
            >
              <div className="space-y-3">
                {/* Header of doc card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
                      {def.icon}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{def.titleEn}</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">{def.subtitle}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {matchingDoc ? (
                      matchingDoc.isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-amber-950/40 text-amber-300 border border-amber-800/40">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Pending Review
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                        Not Uploaded
                      </span>
                    )}
                  </div>
                </div>

                {/* DPDP Notice text */}
                <p className="text-[11px] text-slate-400/90 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                  {def.dpdpNote}
                </p>

                {/* If already uploaded, show file information */}
                {matchingDoc && (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate font-medium">{matchingDoc.originalFileName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">
                      {Math.round(matchingDoc.fileSizeBytes / 1024)} KB
                    </span>
                  </div>
                )}
              </div>

              {/* Action Area: File Upload Button */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <label className="relative cursor-pointer w-full">
                  <input
                    type="file"
                    disabled={isUploading}
                    accept=".pdf,image/*,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(def.type, file);
                        e.target.value = "";
                      }
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                      matchingDoc
                        ? "bg-slate-800 hover:bg-slate-700/80 text-slate-200 border-slate-700"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                    } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : matchingDoc ? (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Re-upload / Replace</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload {def.titleEn}</span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
