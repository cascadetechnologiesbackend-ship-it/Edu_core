"use client";

import React, { useState, useTransition, useRef } from "react";
import {
  User,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  Briefcase,
  GraduationCap,
  Bus,
  KeyRound,
  Globe,
  Moon,
  Sun,
  Loader2,
  Save,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateSelfProfileAction,
  uploadAvatarAction,
  type DecryptedSelfProfile,
  type ReadOnlyProfileDetails,
} from "@/app/actions/profile";
import type { CompletenessResult } from "@/lib/profileCompleteness";
import Link from "next/link";

interface UserProfileViewProps {
  initialProfile: DecryptedSelfProfile;
  initialCompleteness: CompletenessResult;
  initialReadOnlyDetails?: ReadOnlyProfileDetails | undefined;
}

export function UserProfileView({
  initialProfile,
  initialCompleteness,
  initialReadOnlyDetails,
}: UserProfileViewProps) {
  const [profile, setProfile] = useState<DecryptedSelfProfile>(initialProfile);
  const [completeness, setCompleteness] = useState<CompletenessResult>(initialCompleteness);
  const [readOnlyDetails] = useState<ReadOnlyProfileDetails>(initialReadOnlyDetails || {});

  const [isSaving, startTransition] = useTransition();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile.avatarUrl || null);
  const [dpdpConsent, setDpdpConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    firstName: initialProfile.firstName || "",
    middleName: initialProfile.middleName || "",
    lastName: initialProfile.lastName || "",
    mobile: initialProfile.mobile || "",
    email: initialProfile.email || "",
    address: initialProfile.address || "",
    emergencyContact: initialProfile.emergencyContact || "",
    bloodGroup: initialProfile.bloodGroup || "",
    preferredLanguage: (initialProfile.preferredLanguage as "en" | "hi") || "en",
    themePreference: (initialProfile.prefersDarkMode ? "dark" : "light") as "light" | "dark",
  });

  const getInitials = () => {
    const f = formData.firstName ? formData.firstName.charAt(0) : "U";
    const l = formData.lastName ? formData.lastName.charAt(0) : "";
    return `${f}${l}`.toUpperCase();
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar size must not exceed 2MB");
      return;
    }

    // Local instant preview
    const objectUrl = URL.createObjectURL(file);
    setAvatarUrl(objectUrl);

    setIsUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await uploadAvatarAction(fd);
      if (res.success && res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        toast.success("Profile photo updated successfully!");
      } else {
        toast.error(res.error || "Failed to upload avatar");
        setAvatarUrl(initialProfile.avatarUrl || null);
      }
    } catch (err: any) {
      toast.error(err.message || "Avatar upload failed");
      setAvatarUrl(initialProfile.avatarUrl || null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = () => {
    const needsConsent =
      (Boolean(formData.emergencyContact) && formData.emergencyContact !== initialProfile.emergencyContact) ||
      (Boolean(formData.address) && formData.address !== initialProfile.address) ||
      (Boolean(formData.bloodGroup) && formData.bloodGroup !== initialProfile.bloodGroup);

    if (needsConsent && !dpdpConsent) {
      toast.error("Please check the DPDP consent box to save emergency contact or address details.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateSelfProfileAction({
          firstName: formData.firstName.trim() || undefined,
          middleName: formData.middleName.trim() || null,
          lastName: formData.lastName.trim() || undefined,
          mobile: formData.mobile.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || null,
          emergencyContact: formData.emergencyContact.trim() || null,
          bloodGroup: formData.bloodGroup.trim() || null,
          preferredLanguage: formData.preferredLanguage,
          themePreference: formData.themePreference,
          hasGivenDpdpConsent: dpdpConsent || undefined,
        });

        if (res.success) {
          toast.success("Profile updated successfully!");
          // Optimistically update local profile
          setProfile((prev) => ({
            ...prev,
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            mobile: formData.mobile,
            address: formData.address,
            emergencyContact: formData.emergencyContact,
            bloodGroup: formData.bloodGroup,
            preferredLanguage: formData.preferredLanguage,
            prefersDarkMode: formData.themePreference === "dark",
          }));
        } else {
          toast.error(res.error || "Failed to update profile");
        }
      } catch (err: any) {
        toast.error(err.message || "An unexpected error occurred");
      }
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500 text-emerald-500 border-emerald-500/30";
    if (score >= 50) return "bg-amber-500 text-amber-500 border-amber-500/30";
    return "bg-rose-500 text-rose-500 border-rose-500/30";
  };

  const getProgressBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Forced Password Change Notice */}
      {profile.mustChangePassword && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-300">
                Action Required: Default Password in Use
              </h4>
              <p className="text-xs text-amber-200/80 mt-0.5">
                For security compliance, please change your default password to protect sensitive ERP records.
              </p>
            </div>
          </div>
          <Link
            href="/force-password-change"
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs whitespace-nowrap transition flex items-center gap-1.5 shadow"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Change Password
          </Link>
        </div>
      )}

      {/* Hero Profile Banner with Avatar & Completeness Meter */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar with Camera Picker */}
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-indigo-500/30 bg-slate-800 shadow-inner flex items-center justify-center text-3xl font-bold text-indigo-300">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials()}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              aria-label="Upload profile picture"
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg border border-indigo-400/30 transition transform hover:scale-105 disabled:opacity-50"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarSelect}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
          </div>

          {/* User Headline & Roles */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {profile.firstName} {profile.middleName ? `${profile.middleName} ` : ""}{profile.lastName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 w-fit mx-auto md:mx-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                {profile.role.replace(/_/g, " ")}
              </span>
            </div>

            <p className="text-sm text-slate-400 flex items-center justify-center md:justify-start gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              {profile.email}
              {profile.mobile && (
                <>
                  <span className="text-slate-600">•</span>
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {profile.mobile}
                </>
              )}
            </p>

            {/* Completeness Bar */}
            <div className="pt-2 max-w-md">
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  Profile Completeness
                  <span className="text-[10px] text-slate-400">
                    ({completeness.completed.length}/{completeness.completed.length + completeness.missing.length})
                  </span>
                </span>
                <span className={`font-bold ${completeness.percent >= 90 ? "text-emerald-400" : completeness.percent >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                  {completeness.percent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
                <div
                  className={`h-full transition-all duration-500 ${getProgressBg(completeness.percent)}`}
                  style={{ width: `${completeness.percent}%` }}
                />
              </div>

              {completeness.missing.length > 0 && (
                <div className="mt-2 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-medium">Missing: </span>
                  {completeness.missing.map((f: string, i: number) => (
                    <span key={f} className="inline-block mr-1.5">
                      • {f.replace(/([A-Z])/g, " $1").toLowerCase()}
                      {i < completeness.missing.length - 1 ? "" : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Read-Only Role Identity Badges */}
      {(readOnlyDetails.designationName ||
        readOnlyDetails.employeeCode ||
        readOnlyDetails.admissionNumber ||
        readOnlyDetails.licenceNumber) && (
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-400" /> Institutional Record (Verified)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {readOnlyDetails.employeeCode && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Employee Code</span>
                <span className="font-semibold text-white font-mono mt-0.5 block">
                  {readOnlyDetails.employeeCode}
                </span>
              </div>
            )}
            {readOnlyDetails.designationName && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Designation</span>
                <span className="font-semibold text-indigo-300 mt-0.5 block truncate">
                  {readOnlyDetails.designationName}
                </span>
              </div>
            )}
            {readOnlyDetails.departmentName && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Department</span>
                <span className="font-semibold text-slate-200 mt-0.5 block truncate">
                  {readOnlyDetails.departmentName}
                </span>
              </div>
            )}
            {readOnlyDetails.joiningDate && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Joining Date</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">
                  {readOnlyDetails.joiningDate}
                </span>
              </div>
            )}
            {readOnlyDetails.admissionNumber && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Admission Number</span>
                <span className="font-semibold text-white font-mono mt-0.5 block">
                  {readOnlyDetails.admissionNumber}
                </span>
              </div>
            )}
            {readOnlyDetails.className && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Class & Section</span>
                <span className="font-semibold text-indigo-300 mt-0.5 block">
                  {readOnlyDetails.className} {readOnlyDetails.sectionName ? `(${readOnlyDetails.sectionName})` : ""}
                </span>
              </div>
            )}
            {readOnlyDetails.licenceNumber && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Driving Licence</span>
                <span className="font-semibold text-white font-mono mt-0.5 block">
                  {readOnlyDetails.licenceNumber}
                </span>
              </div>
            )}
            {readOnlyDetails.assignedVehicle && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Assigned Bus</span>
                <span className="font-semibold text-emerald-400 mt-0.5 block truncate">
                  {readOnlyDetails.assignedVehicle}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editable Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Personal Details */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <User className="w-4 h-4 text-indigo-400" /> Personal Identity
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Middle Name</label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Middle"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Preferred Language</label>
                <select
                  value={formData.preferredLanguage}
                  onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="en">English (en-IN)</option>
                  <option value="hi">Hindi (hi-IN)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Theme Mode</label>
                <select
                  value={formData.themePreference}
                  onChange={(e) => setFormData({ ...formData, themePreference: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="dark">Dark Interface</option>
                  <option value="light">Light Interface</option>
                </select>
              </div>
            </div>

            {profile.aadhaarLast4 && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs mt-2">
                <span className="text-slate-400">Masked Aadhaar (DPDP compliant)</span>
                <span className="font-mono text-slate-200">•••• •••• {profile.aadhaarLast4}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Contact Information */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Phone className="w-4 h-4 text-emerald-400" /> Contact & Residence
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">Mobile Number (India +91) *</label>
                {profile.isMobileVerified ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-semibold">Unverified</span>
                )}
              </div>
              <input
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="10-digit mobile number"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">Official / Account Email</label>
                {profile.isEmailVerified && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800 text-sm text-slate-400 cursor-not-allowed"
                title="Email address is managed by platform identity administrator"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Residential Address</label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Street address, city, state, postal code"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Sensitive Health & Emergency Info (DPDP Act 2023 Regulated) */}
      <div className="p-6 rounded-2xl border border-indigo-950/60 bg-gradient-to-br from-slate-900 to-indigo-950/20 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">
              Emergency Contact & Medical Details
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            DPDP Act 2023 Protected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Emergency Contact Number (India +91)
            </label>
            <input
              type="tel"
              value={formData.emergencyContact}
              onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              placeholder="e.g. 9876543210"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Blood Group</label>
            <select
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>

        {/* DPDP Consent Notice & Checkbox */}
        <div className="mt-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
          <input
            id="dpdpConsent"
            type="checkbox"
            checked={dpdpConsent}
            onChange={(e) => setDpdpConsent(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
          />
          <label htmlFor="dpdpConsent" className="text-xs text-slate-300 leading-relaxed cursor-pointer select-none">
            <span className="font-semibold text-white">Explicit DPDP Consent: </span>
            I hereby give explicit consent for SchoolMitra ERP and my school to collect and encrypt my personal residential address, emergency contact, and medical information solely for safety, health, and campus emergency communication. This data will never be shared with unauthorized third parties.
          </label>
        </div>
      </div>

      {/* Save Action Bar */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/force-password-change"
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition flex items-center gap-2"
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          Change Password
        </Link>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 border border-indigo-400/30 transition flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Profile Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
