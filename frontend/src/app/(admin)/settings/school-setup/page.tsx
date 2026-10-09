"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  BookOpen,
  Palette,
  Globe,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Save,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSchoolProfile,
  updateSchoolProfile,
  uploadSchoolLogo,
} from "./actions";
import type { CompletenessResult } from "@/lib/profileCompleteness";

export default function SchoolSetupPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [logoUploading, setLogoUploading] = useState(false);

  const [schoolData, setSchoolData] = useState<any>(null);
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    principalName: "",
    establishedYear: new Date().getFullYear(),
    board: "CBSE",
    udiseCode: "",
    website: "",
    motto: "",
    about: "",
    socialTwitter: "",
    socialInstagram: "",
    socialFacebook: "",
    socialLinkedin: "",
    socialYoutube: "",
    themeLight: "#4f46e5",
    themeDark: "#6366f1",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getSchoolProfile();
      setSchoolData(res.school);
      setCompleteness(res.completeness);

      const social = (res.school.socialHandles as any) || {};
      const theme = (res.school.themeColors as any) || {};

      setFormData({
        name: res.school.name || "",
        address: res.school.address || "",
        city: res.school.city || "",
        state: res.school.state || "",
        pincode: res.school.pincode || "",
        phone: res.school.phone || "",
        email: res.school.email || "",
        principalName: res.school.principalName || "",
        establishedYear: res.school.establishedYear || new Date().getFullYear(),
        board: res.school.board || "CBSE",
        udiseCode: res.school.udiseCode || "",
        website: res.school.website || "",
        motto: res.school.motto || "",
        about: res.school.about || "",
        socialTwitter: social.twitter || "",
        socialInstagram: social.instagram || "",
        socialFacebook: social.facebook || "",
        socialLinkedin: social.linkedin || "",
        socialYoutube: social.youtube || "",
        themeLight: theme.light || "#4f46e5",
        themeDark: theme.dark || "#6366f1",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load school profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "establishedYear" ? parseInt(value) || 0 : value,
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
          const socialHandles: Record<string, string> = {};
          if (formData.socialTwitter) socialHandles.twitter = formData.socialTwitter;
          if (formData.socialInstagram) socialHandles.instagram = formData.socialInstagram;
          if (formData.socialFacebook) socialHandles.facebook = formData.socialFacebook;
          if (formData.socialLinkedin) socialHandles.linkedin = formData.socialLinkedin;
          if (formData.socialYoutube) socialHandles.youtube = formData.socialYoutube;

          const payload = {
            name: formData.name,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            phone: formData.phone,
            email: formData.email,
            principalName: formData.principalName,
            establishedYear: Number(formData.establishedYear),
            board: formData.board as any,
            udiseCode: formData.udiseCode,
            website: formData.website || null,
            motto: formData.motto || null,
            about: formData.about || null,
            socialHandles,
            themeColors: {
              light: formData.themeLight,
              dark: formData.themeDark,
            },
          };

        const res = await updateSchoolProfile(payload);
        setSchoolData(res.school);
        setCompleteness(res.completeness);
        toast.success("School profile updated successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to update school profile");
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB");
      return;
    }

    const data = new FormData();
    data.append("logo", file);

    setLogoUploading(true);
    try {
      const res = await uploadSchoolLogo(data);
      setSchoolData(res.school);
      setCompleteness(res.completeness);
      toast.success("School logo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload school logo");
    } finally {
      setLogoUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-gray-500">Loading school profile details...</p>
      </div>
    );
  }

  const percent = completeness?.percent ?? 0;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Building2 className="w-3.5 h-3.5" /> Institution Identity & Branding
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2">
            School Profile Manager
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Maintain your official institutional data, accreditation, digital identity, and brand styling.
          </p>
        </div>

        {/* System Badges (Protected) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 text-xs font-mono font-medium rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Status: {schoolData?.status || "ACTIVE"}
          </span>
          <span className="px-3 py-1 text-xs font-mono font-medium rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            Tier: {schoolData?.subscriptionTier || "STANDARD"}
          </span>
          {schoolData?.slug && (
            <span className="px-3 py-1 text-xs font-mono font-medium rounded-lg bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
              /{schoolData.slug}
            </span>
          )}
        </div>
      </div>

      {/* Completeness Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base ${
              percent >= 90
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                : percent >= 70
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
            }`}>
              {percent}%
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                School Profile Completeness
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {percent >= 90
                  ? "Great job! Your institution profile has comprehensive institutional and digital presence details."
                  : "Complete all sections to unlock customized receipts, parent portal branding, and website badges."}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 self-start sm:self-auto">
            {completeness?.completedWeight ?? 0} / {completeness?.totalWeight ?? 100} Points
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              percent >= 90
                ? "bg-emerald-500"
                : percent >= 70
                ? "bg-indigo-600"
                : "bg-amber-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Missing Items Chips */}
        {completeness?.missing && completeness.missing.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Missing fields:
            </span>
            {completeness.missing.map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              >
                <AlertCircle className="w-3 h-3 text-amber-600" /> {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSaveProfile} className="space-y-8">
        {/* Section 1: Basic Information */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              1. Basic Institutional Details
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Official School Name *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Postal Address *
              </label>
              <input
                type="text"
                name="address"
                required
                value={formData.address}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                City *
              </label>
              <input
                type="text"
                name="city"
                required
                value={formData.city}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                State *
              </label>
              <input
                type="text"
                name="state"
                required
                value={formData.state}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Pincode *
              </label>
              <input
                type="text"
                name="pincode"
                required
                value={formData.pincode}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Official Contact Phone *
              </label>
              <input
                type="text"
                name="phone"
                required
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Official Email Address *
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Principal / Head of Institution *
              </label>
              <input
                type="text"
                name="principalName"
                required
                value={formData.principalName}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Established Year *
              </label>
              <input
                type="number"
                name="establishedYear"
                required
                min={1800}
                max={new Date().getFullYear()}
                value={formData.establishedYear}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Affiliation & Board */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              2. Board Affiliation & Accreditation
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Education Board *
              </label>
              <select
                name="board"
                value={formData.board}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="CBSE">Central Board of Secondary Education (CBSE)</option>
                <option value="ICSE">Council for the Indian School Certificate Examinations (ICSE)</option>
                <option value="STATE_BOARD">State Secondary Education Board</option>
                <option value="IGCSE">Cambridge Assessment (IGCSE)</option>
                <option value="IB">International Baccalaureate (IB)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                UDISE+ Code *
              </label>
              <input
                type="text"
                name="udiseCode"
                required
                maxLength={11}
                value={formData.udiseCode}
                onChange={handleInputChange}
                placeholder="11-digit national UDISE code"
                className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Branding & Theme */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
            <Palette className="w-5 h-5 text-pink-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              3. Visual Identity & Brand Styling
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Upload Card */}
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-950/60 border border-dashed border-gray-300 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                {schoolData?.logoUrl ? (
                  <img
                    src={schoolData.logoUrl}
                    alt="School Logo"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <Building2 className="w-10 h-10 text-gray-400" />
                )}
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Institutional Emblem / Logo
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPEG, WebP or SVG under 2MB. Appears on fee receipts, student IDs, and portal headers.
                </p>
                <div>
                  <label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer shadow-sm transition"
                  >
                    {logoUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        {schoolData?.logoUrl ? "Change Logo" : "Upload Logo"}
                      </>
                    )}
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={logoUploading}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Brand Colors */}
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Theme Colors (Hex Codes)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Light Theme Primary
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="themeLight"
                      value={formData.themeLight}
                      onChange={handleInputChange}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      name="themeLight"
                      value={formData.themeLight}
                      onChange={handleInputChange}
                      className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Dark Theme Primary
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      name="themeDark"
                      value={formData.themeDark}
                      onChange={handleInputChange}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      name="themeDark"
                      value={formData.themeDark}
                      onChange={handleInputChange}
                      className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Digital Presence & Motto */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
            <Globe className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              4. Digital Presence & Mission Statement
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Official Website URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://www.example.edu"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 pr-10"
                />
                {formData.website && (
                  <a
                    href={formData.website}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                School Motto / Tagline
              </label>
              <input
                type="text"
                name="motto"
                maxLength={250}
                value={formData.motto}
                onChange={handleInputChange}
                placeholder="e.g., Knowledge is Power • Tamaso Ma Jyotirgamaya"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                About the Institution
              </label>
              <textarea
                name="about"
                rows={3}
                maxLength={2000}
                value={formData.about}
                onChange={handleInputChange}
                placeholder="Brief narrative about the institution's history, vision, and pedagogy..."
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Twitter / X Handle
              </label>
              <input
                type="text"
                name="socialTwitter"
                value={formData.socialTwitter}
                onChange={handleInputChange}
                placeholder="@SchoolHandle"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Instagram Handle
              </label>
              <input
                type="text"
                name="socialInstagram"
                value={formData.socialInstagram}
                onChange={handleInputChange}
                placeholder="@school_official"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                Facebook Page URL
              </label>
              <input
                type="text"
                name="socialFacebook"
                value={formData.socialFacebook}
                onChange={handleInputChange}
                placeholder="facebook.com/SchoolOfficial"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                LinkedIn Page URL
              </label>
              <input
                type="text"
                name="socialLinkedin"
                value={formData.socialLinkedin}
                onChange={handleInputChange}
                placeholder="linkedin.com/school/example"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Action Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-md shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
