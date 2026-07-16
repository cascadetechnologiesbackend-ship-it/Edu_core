"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { verifyConsentOtp, submitAdmissionApplication } from "./actions";

export function AdmissionsWizard({ privacyNoticeVersion, consentPurposes }: any) {
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

  const handleNext = async () => {
    setError("");
    if (step === 1) {
      if (!otpSent) {
        if (mobileOtp.mobile.length !== 10) {
          setError("Please enter a valid 10-digit mobile number");
          return;
        }
        // Verify all mandatory purposes are checked
        const mandatoryPurposes = consentPurposes.filter((p: any) => p.mandatory);
        const missingMandatory = mandatoryPurposes.some((p: any) => !consentState[p.id]);
        if (missingMandatory) {
          setError("You must agree to all mandatory consent purposes to proceed.");
          return;
        }
        setOtpSent(true);
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
    
    const res = await submitAdmissionApplication(formData, consentState);
    setLoading(false);
    
    if (res.success) {
      alert(`Application submitted successfully! Application No: ${res.applicationNumber}`);
      router.push("/admissions");
    } else {
      setError(res.message || "Submission failed");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800">
      
      {/* Stepper Header */}
      <div className="bg-gray-50 dark:bg-slate-800 p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between">
        {[1, 2, 3, 4, 5, 6].map(s => (
          <div key={s} className={`flex items-center space-x-2 ${s === step ? "text-blue-600 font-bold" : s < step ? "text-green-600" : "text-gray-400"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${s === step ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30" : s < step ? "border-green-600 bg-green-50 dark:bg-green-900/30" : "border-gray-300 dark:border-gray-600"}`}>
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
        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}

        {/* STEP 1: DPDP Consent */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
              <h2 className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                <span className="text-xl">🛡️</span> Data Privacy & Consent (DPDP Act 2023)
              </h2>
              <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                {isHindi 
                  ? `कृपया अपने बच्चे के डेटा को संसाधित करने के लिए सहमति की समीक्षा करें और स्पष्ट रूप से अनुमति दें। (सूचना v${privacyNoticeVersion})`
                  : `Please review and explicitly grant consent for processing your child's data. (Notice v${privacyNoticeVersion})`
                }
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {consentPurposes.map((p: any) => (
                <div key={p.id} className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <input
                    type="checkbox"
                    id={p.id}
                    checked={!!consentState[p.id]}
                    onChange={(e) => setConsentState({ ...consentState, [p.id]: e.target.checked })}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <label htmlFor={p.id} className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {isHindi ? p.labelHi || p.label : p.label}
                      {p.mandatory && <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{isHindi ? "अनिवार्य" : "Required"}</span>}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {isHindi ? p.descriptionHi || p.description : p.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 max-w-md mx-auto">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Parent Mobile Verification</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={mobileOtp.mobile}
                    onChange={(e) => setMobileOtp({ ...mobileOtp, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    disabled={otpSent}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                  />
                </div>
                
                {otpSent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OTP (Use 123456)</label>
                    <input
                      type="text"
                      value={mobileOtp.otp}
                      onChange={(e) => setMobileOtp({ ...mobileOtp, otp: e.target.value.slice(0, 6) })}
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Student Basic Information</h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Applicant Full Name</label>
                <input
                  type="text"
                  value={basicInfo.applicantName}
                  onChange={(e) => setBasicInfo({ ...basicInfo, applicantName: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={basicInfo.dateOfBirth}
                  onChange={(e) => setBasicInfo({ ...basicInfo, dateOfBirth: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={basicInfo.gender}
                  onChange={(e) => setBasicInfo({ ...basicInfo, gender: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Grade Applied For</label>
                <select
                  value={basicInfo.gradeAppliedFor}
                  onChange={(e) => setBasicInfo({ ...basicInfo, gradeAppliedFor: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                >
                  <option value="NURSERY">Nursery</option>
                  <option value="LKG">LKG</option>
                  <option value="UKG">UKG</option>
                  <option value="CLASS_1">Class 1</option>
                  <option value="CLASS_2">Class 2</option>
                  <option value="CLASS_5">Class 5</option>
                  <option value="CLASS_10">Class 10</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={basicInfo.category}
                  onChange={(e) => setBasicInfo({ ...basicInfo, category: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                >
                  <option value="GENERAL">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Previous School (Optional)</label>
                <input
                  type="text"
                  value={basicInfo.previousSchool}
                  onChange={(e) => setBasicInfo({ ...basicInfo, previousSchool: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Family Details */}
        {step === 3 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Family Details</h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Father's Name</label>
                <input
                  type="text"
                  value={familyDetails.fatherName}
                  onChange={(e) => setFamilyDetails({ ...familyDetails, fatherName: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mother's Name</label>
                <input
                  type="text"
                  value={familyDetails.motherName}
                  onChange={(e) => setFamilyDetails({ ...familyDetails, motherName: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Primary Email</label>
                <input
                  type="email"
                  value={familyDetails.primaryContactEmail}
                  onChange={(e) => setFamilyDetails({ ...familyDetails, primaryContactEmail: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Pincode</label>
                <input
                  type="text"
                  value={familyDetails.pincode}
                  onChange={(e) => setFamilyDetails({ ...familyDetails, pincode: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Residential Address</label>
                <textarea
                  value={familyDetails.address}
                  onChange={(e) => setFamilyDetails({ ...familyDetails, address: e.target.value })}
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Document Upload</h2>
            <div className="p-12 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800">
              <span className="text-4xl mb-4 block">📄</span>
              <p className="text-gray-500 mb-4">Upload Birth Certificate, Aadhaar (Masked), and Photo here.</p>
              <button className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm font-medium">
                Select Files
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Fees Preview */}
        {step === 5 && (
          <div className="space-y-6 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Structure Preview</h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-800">
              <h3 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-200">Application Fee</h3>
              <p className="text-5xl font-bold text-blue-600 dark:text-blue-400 mb-2">₹500</p>
              <p className="text-blue-800 dark:text-blue-300">Non-refundable registration fee</p>
            </div>
            <p className="text-gray-500">First-term tuition fees will be collected upon successful enrollment.</p>
          </div>
        )}

        {/* STEP 6: Confirmation */}
        {step === 6 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review & Confirm</h2>
            
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Applicant</dt>
                  <dd className="font-medium">{basicInfo.applicantName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Grade</dt>
                  <dd className="font-medium">{basicInfo.gradeAppliedFor.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Parent</dt>
                  <dd className="font-medium">{familyDetails.fatherName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Contact</dt>
                  <dd className="font-medium">{mobileOtp.mobile}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-green-800 dark:text-green-300 font-medium">✓ DPDP Consent Verified via OTP</p>
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
            {loading ? "Processing..." : (step === 1 && !otpSent) ? "Send OTP" : "Continue"}
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
