"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitAdmissionApplication } from "./actions";
import {
  AddressAutofill,
  type AddressValue,
  formatAddressForStorage,
} from "@/components/forms/AddressAutofill";
import {
  PersonalDemographicsPicker,
  type DemographicsValue,
} from "@/components/forms/PersonalDemographicsPicker";

export function AdmissionsWizard({
  privacyNoticeVersion,
  consentPurposes,
  availableGrades = [],
}: {
  privacyNoticeVersion: string;
  consentPurposes: any[];
  availableGrades?: Array<{ grade: string; displayName: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Wizard Data State
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
  const [isHindi, setIsHindi] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language) {
      setIsHindi(navigator.language.toLowerCase().startsWith("hi"));
    }
  }, []);

  const [basicInfo, setBasicInfo] = useState({
    applicantName: "",
    dateOfBirth: "",
    gender: "MALE",
    bloodGroup: "",
    category: "GENERAL",
    gradeAppliedFor: availableGrades?.[0]?.grade || "CLASS_1",
    previousSchool: "",
    aadhaarNumber: "",
    isRteApplicant: false,
    optInTransport: false,
    optInHostel: false,
    hasSiblingInSchool: false,
  });

  const [demographics, setDemographics] = useState<DemographicsValue>({
    religion: "Hinduism",
    category: "GENERAL",
    subCaste: "",
    motherTongue: "Hindi",
  });

  const [familyDetails, setFamilyDetails] = useState({
    fatherName: "",
    motherName: "",
    guardianName: "",
    primaryContactMobile: "",
    primaryContactEmail: "",
    address: "",
    pincode: "",
  });

  const [addressValue, setAddressValue] = useState<AddressValue>({
    pincode: "",
    state: "",
    district: "",
    city: "",
    line1: "",
    line2: "",
  });

  const [documents, setDocuments] = useState<{
    birthCertificate: File | null;
    aadhaar: File | null;
    photo: File | null;
    transferCertificate: File | null;
  }>({
    birthCertificate: null,
    aadhaar: null,
    photo: null,
    transferCertificate: null,
  });

  const handleNext = async () => {
    setError("");
    if (step === 1) {
      // Step 1: DPDP Notice review. Digital consent will be collected on parent login.
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!basicInfo.applicantName.trim()) {
        setError("Please enter the applicant's full name");
        return;
      }
      if (!basicInfo.dateOfBirth) {
        setError("Please enter the date of birth");
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!familyDetails.fatherName.trim() && !familyDetails.motherName.trim() && !familyDetails.guardianName.trim()) {
        setError("Please enter at least one parent or guardian name");
        return;
      }
      if (!/^[6-9]\d{9}$/.test(familyDetails.primaryContactMobile)) {
        setError("Please enter a valid 10-digit Indian mobile number for primary contact");
        return;
      }
      if (!familyDetails.primaryContactEmail.trim() || !familyDetails.primaryContactEmail.includes("@")) {
        setError("Please enter a valid email address");
        return;
      }
      if (!/^\d{6}$/.test(addressValue.pincode)) {
        setError("Please enter a valid 6-digit PIN code for residential address");
        return;
      }
      if (!addressValue.state.trim() || !addressValue.district.trim() || !addressValue.line1.trim()) {
        setError("Please enter complete address details (State, District, and Street Line)");
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      // Step 4: Documents are optional during admission (can be uploaded later by parent)
      setStep(5);
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const formattedAddress = formatAddressForStorage(addressValue);
    const formData = {
      ...basicInfo,
      category: demographics.category,
      religion: demographics.religion,
      motherTongue: demographics.motherTongue,
      subCaste: demographics.subCaste || undefined,
      bloodGroup: basicInfo.bloodGroup ? basicInfo.bloodGroup : undefined,
      ...familyDetails,
      address: formattedAddress,
      pincode: addressValue.pincode,
      state: addressValue.state,
      district: addressValue.district,
      primaryContactMobile: familyDetails.primaryContactMobile,
    };
    
    // Upload documents
    const documentKeys: Record<string, any> = {};
    for (const [key, file] of Object.entries(documents)) {
      if (file) {
        let assignedKey = `admissions/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || "application/octet-stream",
              prefix: "admissions",
            }),
          });
          const data = await res.json();
          if (data.url && data.key) {
            assignedKey = data.key;
            await fetch(data.url, {
              method: "PUT",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });
          }
        } catch (e) {
          console.error(`Failed to upload ${key}`, e);
        }
        documentKeys[key] = {
          key: assignedKey,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size || 0,
        };
      }
    }

    const res = await submitAdmissionApplication(formData, consentState, documentKeys);
    setLoading(false);

    if (res.success) {
      alert(
        `Application submitted successfully! Application No: ${res.applicationNumber}`,
      );
      router.push("/admissions");
    } else {
      setError(res.message || "Submission failed");
    }
  };

  return (
    <div className="bg-card shadow-sm rounded-2xl overflow-hidden border border-border/40">
      {/* Stepper Header */}
      <div className="bg-muted/40 p-4 border-b border-border/40 flex justify-between">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`flex items-center space-x-2 ${s === step ? "text-[#007AFF] dark:text-[#0A84FF] font-bold" : s < step ? "text-[#34C759] dark:text-[#30D158]" : "text-muted-foreground"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all font-mono text-xs ${s === step ? "border-[#007AFF] dark:border-[#0A84FF] bg-[#007AFF]/15 text-[#007AFF] dark:text-[#0A84FF]" : s < step ? "border-[#34C759] dark:border-[#30D158] bg-[#34C759]/15 text-[#34C759] dark:text-[#30D158]" : "border-border text-muted-foreground"}`}
            >
              {s < step ? "✓" : s}
            </div>
            <span className="hidden md:inline text-sm">
              {s === 1 && "DPDP Notice"}
              {s === 2 && "Basic Info"}
              {s === 3 && "Family"}
              {s === 4 && "Documents"}
              {s === 5 && "Confirm"}
            </span>
          </div>
        ))}
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* STEP 1: DPDP Consent Notice */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="mb-4 bg-[#007AFF]/10 dark:bg-[#0A84FF]/12 p-5 rounded-2xl border border-[#007AFF]/25 dark:border-[#0A84FF]/30">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">🛡️</span>
                <div>
                  <h2 className="font-bold text-base text-[#007AFF] dark:text-[#0A84FF]">
                    Data Privacy &amp; Processing Notice (DPDP Act 2023)
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isHindi
                      ? `डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 के तहत स्कूल डेटा प्रसंस्करण सूचना (v${privacyNoticeVersion})।`
                      : `School Data Processing & Privacy Notice under DPDP Act 2023 (Notice v${privacyNoticeVersion}).`}
                  </p>
                  <div className="mt-3 bg-card/90 p-3.5 rounded-xl border border-border/60 text-xs text-foreground space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-foreground">
                      <span>📲</span> Parent App Digital Consent Workflow
                    </p>
                    <p className="text-muted-foreground">
                      In compliance with DPDP regulations, verifiable parental opt-in is collected directly from the parent/guardian when they first log into the <strong>Parent Companion App</strong>. You may review the processing purposes below and click <strong>Continue</strong> to fill the admission details.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {consentPurposes.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-start space-x-3 p-4 border border-border/60 rounded-xl bg-card"
                >
                  <div className="mt-0.5 text-[#007AFF] dark:text-[#0A84FF] font-bold">✓</div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground flex items-center justify-between gap-2">
                      <span>{isHindi ? p.labelHindi || p.labelHi || p.label : p.label}</span>
                      {p.mandatory ? (
                        <span className="px-2 py-0.5 text-xs bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25 rounded-full font-medium whitespace-nowrap">
                          {isHindi ? "अनिवार्य" : "Core Educational"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full whitespace-nowrap">
                          {isHindi ? "वैकल्पिक" : "Optional"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isHindi
                        ? p.descriptionHindi || p.descriptionHi || p.description
                        : p.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#34C759]/10 dark:bg-[#30D158]/12 border border-[#34C759]/25 dark:border-[#30D158]/30 rounded-xl text-xs text-[#1B6A2E] dark:text-[#30D158] flex items-center gap-2">
              <span className="text-base font-bold">✓</span>
              <span>Parent login credentials will be dispatched to the primary mobile entered in Family Details upon enrollment.</span>
            </div>
          </div>
        )}

        {/* STEP 2: Basic Info */}
        {step === 2 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Student Basic Information
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Applicant Full Name
                </label>
                <input
                  type="text"
                  value={basicInfo.applicantName}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      applicantName: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={basicInfo.dateOfBirth}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, dateOfBirth: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={basicInfo.gender}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, gender: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Blood Group
                </label>
                <select
                  value={basicInfo.bloodGroup}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, bloodGroup: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A_POSITIVE">A+ (A Positive)</option>
                  <option value="A_NEGATIVE">A- (A Negative)</option>
                  <option value="B_POSITIVE">B+ (B Positive)</option>
                  <option value="B_NEGATIVE">B- (B Negative)</option>
                  <option value="AB_POSITIVE">AB+ (AB Positive)</option>
                  <option value="AB_NEGATIVE">AB- (AB Negative)</option>
                  <option value="O_POSITIVE">O+ (O Positive)</option>
                  <option value="O_NEGATIVE">O- (O Negative)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Grade Applied For
                </label>
                <select
                  value={basicInfo.gradeAppliedFor}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      gradeAppliedFor: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                >
                  {availableGrades.length > 0 ? (
                    availableGrades.map((g) => (
                      <option key={g.grade} value={g.grade}>
                        {g.displayName}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="NURSERY">Nursery</option>
                      <option value="LKG">LKG</option>
                      <option value="UKG">UKG</option>
                      <option value="CLASS_1">Class 1</option>
                      <option value="CLASS_2">Class 2</option>
                      <option value="CLASS_3">Class 3</option>
                      <option value="CLASS_4">Class 4</option>
                      <option value="CLASS_5">Class 5</option>
                      <option value="CLASS_6">Class 6</option>
                      <option value="CLASS_7">Class 7</option>
                      <option value="CLASS_8">Class 8</option>
                      <option value="CLASS_9">Class 9</option>
                      <option value="CLASS_10">Class 10</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  placeholder="12-digit Aadhaar"
                  value={basicInfo.aadhaarNumber}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, aadhaarNumber: e.target.value })
                  }
                  maxLength={12}
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div className="col-span-2 pt-2 border-t border-border/40">
                <PersonalDemographicsPicker
                  value={demographics}
                  onChange={(val) => {
                    setDemographics(val);
                    setBasicInfo((prev) => ({ ...prev, category: val.category }));
                  }}
                  isHindi={isHindi}
                  required={false}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Previous School (Optional)
                </label>
                <input
                  type="text"
                  value={basicInfo.previousSchool}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      previousSchool: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div className="col-span-2 pt-2 border-t border-border/40 space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  Quota &amp; Facility Opt-Ins (Automated Fee Structure Assignments)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <label className="flex items-center space-x-3 p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={basicInfo.isRteApplicant}
                      onChange={(e) =>
                        setBasicInfo({ ...basicInfo, isRteApplicant: e.target.checked })
                      }
                      className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF] rounded border-border focus:ring-[#007AFF]"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground block">RTE 25% Free Quota</span>
                      <span className="text-xs text-muted-foreground block">100% Tuition Waiver</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={basicInfo.optInTransport}
                      onChange={(e) =>
                        setBasicInfo({ ...basicInfo, optInTransport: e.target.checked })
                      }
                      className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF] rounded border-border focus:ring-[#007AFF]"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground block">Transport Facility</span>
                      <span className="text-xs text-muted-foreground block">Auto-assign Bus Fee</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={basicInfo.optInHostel}
                      onChange={(e) =>
                        setBasicInfo({ ...basicInfo, optInHostel: e.target.checked })
                      }
                      className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF] rounded border-border focus:ring-[#007AFF]"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground block">Hostel / Boarding</span>
                      <span className="text-xs text-muted-foreground block">Auto-assign Hostel Fee</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3.5 rounded-xl border border-[#007AFF]/25 dark:border-[#0A84FF]/30 bg-[#007AFF]/10 dark:bg-[#0A84FF]/12 cursor-pointer hover:bg-[#007AFF]/15 transition">
                    <input
                      type="checkbox"
                      checked={basicInfo.hasSiblingInSchool}
                      onChange={(e) =>
                        setBasicInfo({ ...basicInfo, hasSiblingInSchool: e.target.checked })
                      }
                      className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF] rounded border-border focus:ring-[#007AFF]"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white block">Sibling in School</span>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 block font-medium">10% Sibling Concession</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Family Details */}
        {step === 3 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Family Details
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Father's Name
                </label>
                <input
                  type="text"
                  name="fatherName"
                  value={familyDetails.fatherName}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      fatherName: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Mother's Name
                </label>
                <input
                  type="text"
                  name="motherName"
                  value={familyDetails.motherName}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      motherName: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Guardian's Name (Optional)
                </label>
                <input
                  type="text"
                  name="guardianName"
                  value={familyDetails.guardianName}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      guardianName: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Primary Contact Mobile <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="primaryContactMobile"
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  value={familyDetails.primaryContactMobile}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      primaryContactMobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  maxLength={10}
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Primary Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="primaryContactEmail"
                  value={familyDetails.primaryContactEmail}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      primaryContactEmail: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 dark:bg-muted/30 text-foreground px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] min-h-[44px]"
                />
              </div>

              <div className="col-span-2 pt-3 border-t border-border/40">
                <AddressAutofill
                  value={addressValue}
                  onChange={(val) => {
                    setAddressValue(val);
                    setFamilyDetails((prev) => ({
                      ...prev,
                      pincode: val.pincode,
                      address: formatAddressForStorage(val),
                    }));
                  }}
                  isHindi={isHindi}
                  required={true}
                  autoFocusPincode={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Documents (Optional during admission) */}
        {step === 4 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Document Upload
              </h2>
              <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/40">
                <span>✓</span> Documents are optional during initial admission
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                You can upload documents now or the parent can upload them later from the Parent Companion App.
              </p>
            </div>

            <div className="grid gap-4 text-left">
              <div className="p-4 border-2 border-dashed border-border/60 rounded-xl bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">Birth Certificate</label>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Optional</span>
                </div>
                <input 
                  type="file" 
                  accept=".pdf,image/*"
                  onChange={(e) => setDocuments(prev => ({ ...prev, birthCertificate: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#007AFF]/10 file:text-[#007AFF] dark:file:bg-[#0A84FF]/15 dark:file:text-[#0A84FF] hover:file:bg-[#007AFF]/20 cursor-pointer" 
                />
              </div>

              <div className="p-4 border-2 border-dashed border-border/60 rounded-xl bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">Aadhaar (Masked)</label>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Optional</span>
                </div>
                <input 
                  type="file" 
                  accept=".pdf,image/*"
                  onChange={(e) => setDocuments(prev => ({ ...prev, aadhaar: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#007AFF]/10 file:text-[#007AFF] dark:file:bg-[#0A84FF]/15 dark:file:text-[#0A84FF] hover:file:bg-[#007AFF]/20 cursor-pointer" 
                />
              </div>

              <div className="p-4 border-2 border-dashed border-border/60 rounded-xl bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">Student Photo</label>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Optional</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setDocuments(prev => ({ ...prev, photo: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#007AFF]/10 file:text-[#007AFF] dark:file:bg-[#0A84FF]/15 dark:file:text-[#0A84FF] hover:file:bg-[#007AFF]/20 cursor-pointer" 
                />
              </div>

              <div className="p-4 border-2 border-dashed border-border/60 rounded-xl bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">Transfer Certificate (TC)</label>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Optional</span>
                </div>
                <input 
                  type="file" 
                  accept=".pdf,image/*"
                  onChange={(e) => setDocuments(prev => ({ ...prev, transferCertificate: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#007AFF]/10 file:text-[#007AFF] dark:file:bg-[#0A84FF]/15 dark:file:text-[#0A84FF] hover:file:bg-[#007AFF]/20 cursor-pointer" 
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Confirmation */}
        {step === 5 && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Full Review & Confirm
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="bg-muted/20 rounded-2xl p-6 border border-border/40">
                <h3 className="text-lg font-semibold mb-4 border-b border-border/40 pb-2 text-foreground">Basic Information</h3>
                <dl className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Applicant Name</dt>
                    <dd className="font-medium text-foreground">{basicInfo.applicantName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Date of Birth</dt>
                    <dd className="font-medium text-foreground font-mono">{basicInfo.dateOfBirth || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Gender</dt>
                    <dd className="font-medium text-foreground">{basicInfo.gender}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Category</dt>
                    <dd className="font-medium text-foreground">{demographics.category}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Religion</dt>
                    <dd className="font-medium text-foreground">{demographics.religion || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Mother Tongue</dt>
                    <dd className="font-medium text-foreground">{demographics.motherTongue || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Blood Group</dt>
                    <dd className="font-medium text-foreground">
                      {basicInfo.bloodGroup
                        ? basicInfo.bloodGroup.replace("_", " ")
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Aadhaar</dt>
                    <dd className="font-medium text-foreground font-mono">{basicInfo.aadhaarNumber || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Grade Applied</dt>
                    <dd className="font-medium text-foreground">{basicInfo.gradeAppliedFor.replace("_", " ")}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-muted-foreground">Previous School</dt>
                    <dd className="font-medium text-foreground">{basicInfo.previousSchool || "-"}</dd>
                  </div>
                </dl>
              </div>

              {/* Family Details */}
              <div className="bg-muted/20 rounded-2xl p-6 border border-border/40">
                <h3 className="text-lg font-semibold mb-4 border-b border-border/40 pb-2 text-foreground">Family & Contact Details</h3>
                <dl className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Father's Name</dt>
                    <dd className="font-medium text-foreground">{familyDetails.fatherName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Mother's Name</dt>
                    <dd className="font-medium text-foreground">{familyDetails.motherName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Guardian's Name</dt>
                    <dd className="font-medium text-foreground">{familyDetails.guardianName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Contact Number</dt>
                    <dd className="font-medium text-foreground font-mono">{familyDetails.primaryContactMobile || "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-muted-foreground">Email Address</dt>
                    <dd className="font-medium text-foreground font-mono">{familyDetails.primaryContactEmail || "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-muted-foreground">Residential Address</dt>
                    <dd className="font-medium text-foreground">{familyDetails.address || "-"} {familyDetails.pincode ? `(${familyDetails.pincode})` : ""}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Document Previews */}
            <div className="bg-muted/20 rounded-2xl p-6 border border-border/40">
              <h3 className="text-lg font-semibold mb-4 border-b border-border/40 pb-2 text-foreground">Document Previews</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-2">Birth Certificate</dt>
                  <dd>
                    {documents.birthCertificate ? (
                      <div className="p-3 border border-border/40 rounded-xl bg-card text-sm break-all flex items-center shadow-xs">
                        <span className="text-xl mr-2">📄</span>
                        <span className="font-medium text-foreground line-clamp-1">{documents.birthCertificate.name}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25">
                        Pending (Parent App)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-2">Aadhaar (Masked)</dt>
                  <dd>
                    {documents.aadhaar ? (
                      <div className="p-3 border border-border/40 rounded-xl bg-card text-sm break-all flex items-center shadow-xs">
                        <span className="text-xl mr-2">📄</span>
                        <span className="font-medium text-foreground line-clamp-1">{documents.aadhaar.name}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25">
                        Pending (Parent App)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-2">Student Photo</dt>
                  <dd>
                    {documents.photo ? (
                      <div className="p-2 border border-border/40 rounded-xl bg-card flex flex-col items-center shadow-xs">
                        {documents.photo.type.startsWith("image/") ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={URL.createObjectURL(documents.photo)} alt="Student Photo" className="h-24 w-24 object-cover rounded-xl mb-1 shadow-sm border border-border/40" />
                        ) : (
                          <div className="h-24 flex items-center justify-center text-4xl mb-1">📄</div>
                        )}
                        <span className="text-xs text-center break-all w-full font-medium text-foreground line-clamp-1" title={documents.photo.name}>{documents.photo.name}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25">
                        Pending (Parent App)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-2">Transfer Cert. (TC)</dt>
                  <dd>
                    {documents.transferCertificate ? (
                      <div className="p-3 border border-border/40 rounded-xl bg-card text-sm break-all flex items-center shadow-xs">
                        <span className="text-xl mr-2">📄</span>
                        <span className="font-medium text-foreground line-clamp-1">{documents.transferCertificate.name}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25">
                        Pending (Parent App)
                      </span>
                    )}
                  </dd>
                </div>
              </div>
            </div>

            <div className="bg-[#007AFF]/10 dark:bg-[#0A84FF]/12 p-4 rounded-2xl border border-[#007AFF]/25 dark:border-[#0A84FF]/30 flex items-center gap-3">
              <span className="text-xl">🛡️</span>
              <div className="text-xs text-[#007AFF] dark:text-[#0A84FF] space-y-1">
                <p className="font-medium text-foreground">
                  DPDP digital parental consent prompt will be requested directly from the parent upon their first login to the Parent Companion App.
                </p>
                <p className="text-muted-foreground">
                  Fee structure and first invoice will be generated on enrollment.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="bg-muted/40 p-5 sm:p-6 border-t border-border/40 flex justify-between items-center">
        <button
          onClick={handleBack}
          disabled={step === 1 || loading}
          className="px-6 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted/40 font-semibold min-h-[44px] transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          Back
        </button>

        {step < 5 ? (
          <button
            onClick={handleNext}
            disabled={loading}
            className="px-6 py-2.5 bg-[#007AFF] dark:bg-[#0A84FF] hover:bg-[#0068DB] dark:hover:bg-[#0071E3] text-white font-semibold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            {loading ? "Processing..." : "Continue"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 bg-[#34C759] dark:bg-[#30D158] hover:bg-[#248A3D] text-white font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        )}
      </div>
    </div>
  );
}
