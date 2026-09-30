"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { verifyConsentOtp, dispatchConsentOtp, submitAdmissionApplication } from "./actions";

export function AdmissionsWizard({
  privacyNoticeVersion,
  consentPurposes,
}: any) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Wizard Data State
  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
  const [mobileOtp, setMobileOtp] = useState({ mobile: "", otp: "" });
  const [otpSent, setOtpSent] = useState(false);
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
    category: "GENERAL",
    gradeAppliedFor: "CLASS_1",
    previousSchool: "",
    aadhaarNumber: "",
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

  const [documents, setDocuments] = useState<{
    birthCertificate: File | null;
    aadhaar: File | null;
    photo: File | null;
  }>({
    birthCertificate: null,
    aadhaar: null,
    photo: null,
  });

  const handleNext = async () => {
    setError("");
    if (step === 1) {
      if (!otpSent) {
        if (mobileOtp.mobile.length !== 10) {
          setError("Please enter a valid 10-digit mobile number");
          return;
        }
        // Verify all mandatory purposes are checked
        const mandatoryPurposes = consentPurposes.filter(
          (p: any) => p.mandatory,
        );
        const missingMandatory = mandatoryPurposes.some(
          (p: any) => !consentState[p.id],
        );
        if (missingMandatory) {
          setError(
            "You must agree to all mandatory consent purposes to proceed.",
          );
          return;
        }
        setLoading(true);
        try {
          const res = await dispatchConsentOtp(mobileOtp.mobile);
          if (!res.success) {
            setError(res.message || "Failed to dispatch OTP");
            setLoading(false);
            return;
          }
          setOtpSent(true);
        } catch (e: any) {
          setError(e.message || "Failed to dispatch OTP");
        }
        setLoading(false);
        return;
      } else {
        setLoading(true);
        const res = await verifyConsentOtp(mobileOtp.mobile, mobileOtp.otp);
        setLoading(false);
        if (!res.success) {
          setError(res.message || "Invalid OTP");
          return;
        }
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const formData = {
      ...basicInfo,
      ...familyDetails,
      primaryContactMobile: mobileOtp.mobile, // Overwrite with verified mobile
    };
    
    // Upload documents to S3
    const documentKeys: Record<string, string> = {};
    for (const [key, file] of Object.entries(documents)) {
      if (file) {
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type, prefix: "admissions" }),
          });
          const data = await res.json();
          if (data.url && data.key) {
            await fetch(data.url, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: file,
            });
            documentKeys[key] = data.key;
          }
        } catch (e) {
          console.error(`Failed to upload ${key}`, e);
        }
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
    <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800">
      {/* Stepper Header */}
      <div className="bg-gray-50 dark:bg-slate-800 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div
            key={s}
            className={`flex items-center space-x-2 ${s === step ? "text-blue-600 font-bold" : s < step ? "text-green-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${s === step ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30" : s < step ? "border-green-600 bg-green-50 dark:bg-green-900/30" : "border-gray-300 dark:border-gray-600"}`}
            >
              {s < step ? "✓" : s}
            </div>
            <span className="hidden md:inline text-sm">
              {s === 1 && "Consent"}
              {s === 2 && "Basic Info"}
              {s === 3 && "Family"}
              {s === 4 && "Documents"}
              {s === 5 && "Fees"}
              {s === 6 && "Confirm"}
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

        {/* STEP 1: DPDP Consent */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
              <h2 className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <span className="text-xl">🛡️</span> Data Privacy & Consent (DPDP
                Act 2023)
              </h2>
              <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                {isHindi
                  ? `कृपया अपने बच्चे के डेटा को संसाधित करने के लिए सहमति की समीक्षा करें और स्पष्ट रूप से अनुमति दें। (सूचना v${privacyNoticeVersion})`
                  : `Please review and explicitly grant consent for processing your child's data. (Notice v${privacyNoticeVersion})`}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {consentPurposes.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition"
                >
                  <input
                    type="checkbox"
                    id={p.id}
                    checked={!!consentState[p.id]}
                    onChange={(e) =>
                      setConsentState({
                        ...consentState,
                        [p.id]: e.target.checked,
                      })
                    }
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <label
                      htmlFor={p.id}
                      className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2"
                    >
                      {isHindi ? p.labelHi || p.label : p.label}
                      {p.mandatory && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          {isHindi ? "अनिवार्य" : "Required"}
                        </span>
                      )}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {isHindi
                        ? p.descriptionHi || p.description
                        : p.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 max-w-md mx-auto">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                Parent Mobile Verification
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={mobileOtp.mobile}
                    onChange={(e) =>
                      setMobileOtp({
                        ...mobileOtp,
                        mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    disabled={otpSent}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                  />
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      OTP (Use 123456)
                    </label>
                    <input
                      type="text"
                      value={mobileOtp.otp}
                      onChange={(e) =>
                        setMobileOtp({
                          ...mobileOtp,
                          otp: e.target.value.slice(0, 6),
                        })
                      }
                      placeholder="123456"
                      className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                    />
                  </div>
                )}
              </div>
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
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
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
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={basicInfo.gender}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, gender: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
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
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                >
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
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  value={basicInfo.category}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, category: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                >
                  <option value="GENERAL">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
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
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
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
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
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
                  value={familyDetails.fatherName}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      fatherName: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Mother's Name
                </label>
                <input
                  type="text"
                  value={familyDetails.motherName}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      motherName: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Primary Email
                </label>
                <input
                  type="email"
                  value={familyDetails.primaryContactEmail}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      primaryContactEmail: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={familyDetails.pincode}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      pincode: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Residential Address
                </label>
                <textarea
                  value={familyDetails.address}
                  onChange={(e) =>
                    setFamilyDetails({
                      ...familyDetails,
                      address: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Documents (Mock view for now) */}
        {step === 4 && (
          <div className="space-y-6 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Document Upload
            </h2>
            <div className="grid gap-6 text-left">
              <div className="p-6 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800">
                <label className="block text-sm font-medium mb-2">Birth Certificate</label>
                <input 
                  type="file" 
                  onChange={(e) => setDocuments(prev => ({ ...prev, birthCertificate: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                />
              </div>
              <div className="p-6 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800">
                <label className="block text-sm font-medium mb-2">Aadhaar (Masked)</label>
                <input 
                  type="file" 
                  onChange={(e) => setDocuments(prev => ({ ...prev, aadhaar: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                />
              </div>
              <div className="p-6 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800">
                <label className="block text-sm font-medium mb-2">Student Photo</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setDocuments(prev => ({ ...prev, photo: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Fees Preview */}
        {step === 5 && (
          <div className="space-y-6 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Fee Structure Preview
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-800">
              <h3 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-200">
                Application Fee
              </h3>
              <p className="text-5xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                ₹500
              </p>
              <p className="text-blue-800 dark:text-blue-300">
                Non-refundable registration fee
              </p>
            </div>
            <p className="text-gray-500">
              First-term tuition fees will be collected upon successful
              enrollment.
            </p>
          </div>
        )}

        {/* STEP 6: Confirmation */}
        {step === 6 && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Full Review & Confirm
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold mb-4 border-b dark:border-slate-700 pb-2">Basic Information</h3>
                <dl className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <dt className="text-sm text-gray-500">Applicant Name</dt>
                    <dd className="font-medium">{basicInfo.applicantName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Date of Birth</dt>
                    <dd className="font-medium">{basicInfo.dateOfBirth || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Gender</dt>
                    <dd className="font-medium">{basicInfo.gender}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Category</dt>
                    <dd className="font-medium">{basicInfo.category}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Aadhaar</dt>
                    <dd className="font-medium">{basicInfo.aadhaarNumber || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Grade Applied</dt>
                    <dd className="font-medium">{basicInfo.gradeAppliedFor.replace("_", " ")}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Previous School</dt>
                    <dd className="font-medium">{basicInfo.previousSchool || "-"}</dd>
                  </div>
                </dl>
              </div>

              {/* Family Details */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold mb-4 border-b dark:border-slate-700 pb-2">Family & Contact Details</h3>
                <dl className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <dt className="text-sm text-gray-500">Father's Name</dt>
                    <dd className="font-medium">{familyDetails.fatherName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Mother's Name</dt>
                    <dd className="font-medium">{familyDetails.motherName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Guardian's Name</dt>
                    <dd className="font-medium">{familyDetails.guardianName || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Contact Number</dt>
                    <dd className="font-medium">{mobileOtp.mobile || "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Email Address</dt>
                    <dd className="font-medium">{familyDetails.primaryContactEmail || "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Residential Address</dt>
                    <dd className="font-medium">{familyDetails.address || "-"} {familyDetails.pincode ? `(${familyDetails.pincode})` : ""}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Document Previews */}
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold mb-4 border-b dark:border-slate-700 pb-2">Document Previews</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">Birth Certificate</dt>
                  <dd>
                    {documents.birthCertificate ? (
                      <div className="p-3 border rounded-lg bg-white dark:bg-slate-900 text-sm break-all flex items-center shadow-sm">
                        <span className="text-2xl mr-3">📄</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200 line-clamp-2">{documents.birthCertificate.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-red-500 font-medium">Not uploaded</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">Aadhaar (Masked)</dt>
                  <dd>
                    {documents.aadhaar ? (
                      <div className="p-3 border rounded-lg bg-white dark:bg-slate-900 text-sm break-all flex items-center shadow-sm">
                        <span className="text-2xl mr-3">📄</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200 line-clamp-2">{documents.aadhaar.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-red-500 font-medium">Not uploaded</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">Student Photo</dt>
                  <dd>
                    {documents.photo ? (
                      <div className="p-2 border rounded-lg bg-white dark:bg-slate-900 flex flex-col items-center shadow-sm">
                        {documents.photo.type.startsWith("image/") ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={URL.createObjectURL(documents.photo)} alt="Student Photo" className="h-32 w-32 object-cover rounded-md mb-2 shadow-sm border" />
                        ) : (
                          <div className="h-32 flex items-center justify-center text-5xl mb-2">📄</div>
                        )}
                        <span className="text-xs text-center break-all w-full font-medium text-gray-700 dark:text-gray-200 line-clamp-1" title={documents.photo.name}>{documents.photo.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-red-500 font-medium">Not uploaded</span>
                    )}
                  </dd>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 flex items-center">
              <p className="text-green-800 dark:text-green-300 font-medium">
                ✓ DPDP Consent Verified via OTP ({mobileOtp.mobile})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="bg-gray-50 dark:bg-slate-800 p-6 border-t border-gray-100 dark:border-slate-700 flex justify-between">
        <button
          onClick={handleBack}
          disabled={step === 1 || loading}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50"
        >
          Back
        </button>

        {step < 6 ? (
          <button
            onClick={handleNext}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : step === 1 && !otpSent
                ? "Send OTP"
                : "Continue"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        )}
      </div>
    </div>
  );
}
