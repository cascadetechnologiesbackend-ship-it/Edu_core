"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Users, AlertCircle } from "lucide-react";
import { Combobox, type ComboboxOption } from "./Combobox";
import {
  CANONICAL_RELIGIONS,
  CANONICAL_CATEGORIES,
  CANONICAL_MOTHER_TONGUES,
} from "@/lib/reference/indiaReferenceData";

export interface DemographicsValue {
  religion: string;
  category: "GENERAL" | "SC" | "ST" | "OBC" | "EWS";
  subCaste?: string | undefined;
  motherTongue: string;
}

export interface PersonalDemographicsPickerProps {
  value: DemographicsValue;
  onChange: (val: DemographicsValue) => void;
  isHindi?: boolean | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  errors?: Partial<Record<keyof DemographicsValue, string>> | undefined;
}

export function PersonalDemographicsPicker({
  value,
  onChange,
  isHindi = false,
  disabled = false,
  required = true,
  className = "",
  errors = {},
}: PersonalDemographicsPickerProps) {
  const [isOtherReligion, setIsOtherReligion] = useState(false);
  const [otherReligionText, setOtherReligionText] = useState("");

  // Sync "Other" religion text
  useEffect(() => {
    const isKnown = CANONICAL_RELIGIONS.some(
      (r) => r.en.toLowerCase() === value.religion.toLowerCase()
    );
    if (!isKnown && value.religion) {
      setIsOtherReligion(true);
      setOtherReligionText(value.religion);
    } else if (value.religion === "Other") {
      setIsOtherReligion(true);
    } else {
      setIsOtherReligion(false);
    }
  }, [value.religion]);

  // Religion options
  const religionOptions: ComboboxOption[] = useMemo(() => {
    return CANONICAL_RELIGIONS.map((r) => ({
      value: r.en,
      label: r.en,
      labelHi: r.hi,
    }));
  }, []);

  const handleReligionChange = (rel: string) => {
    if (rel === "Other") {
      setIsOtherReligion(true);
      onChange({ ...value, religion: otherReligionText || "Other" });
    } else {
      setIsOtherReligion(false);
      onChange({ ...value, religion: rel });
    }
  };

  const handleOtherReligionTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setOtherReligionText(text);
    onChange({ ...value, religion: text });
  };

  // Category options
  const categoryOptions: ComboboxOption[] = useMemo(() => {
    return CANONICAL_CATEGORIES.map((c) => ({
      value: c.code,
      label: c.en,
      labelHi: c.hi,
      badge: c.code,
    }));
  }, []);

  const handleCategoryChange = (cat: string) => {
    const validatedCat = cat as "GENERAL" | "SC" | "ST" | "OBC" | "EWS";
    onChange({
      ...value,
      category: validatedCat,
      subCaste: validatedCat === "GENERAL" ? undefined : value.subCaste,
    });
  };

  // Sub-caste options based on active category
  const subCasteOptions: ComboboxOption[] = useMemo(() => {
    const found = CANONICAL_CATEGORIES.find((c) => c.code === value.category);
    if (!found) return [];
    return found.subCastes.map((s) => ({
      value: s.en,
      label: s.en,
      labelHi: s.hi,
    }));
  }, [value.category]);

  // Mother Tongue options
  const motherTongueOptions: ComboboxOption[] = useMemo(() => {
    return CANONICAL_MOTHER_TONGUES.map((m) => ({
      value: m.en,
      label: m.en,
      labelHi: m.hi,
    }));
  }, []);

  const isReservedCategory = value.category && value.category !== "GENERAL";

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Religion */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "धर्म" : "Religion"}{" "}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <Combobox
            options={religionOptions}
            value={isOtherReligion ? "Other" : value.religion}
            onChange={handleReligionChange}
            placeholder={isHindi ? "धर्म चुनें..." : "Select Religion..."}
            searchPlaceholder={isHindi ? "धर्म खोजें..." : "Search Religion..."}
            disabled={disabled}
            isHindi={isHindi}
            clearable={true}
          />
          {isOtherReligion && (
            <div className="mt-2 animate-in fade-in-50 duration-150">
              <input
                type="text"
                value={otherReligionText}
                onChange={handleOtherReligionTextChange}
                placeholder={isHindi ? "कृपया धर्म निर्दिष्ट करें" : "Please specify religion"}
                disabled={disabled}
                className="w-full h-9 px-3 text-xs md:text-sm font-medium rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-hidden"
              />
            </div>
          )}
          {errors.religion && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.religion}
            </p>
          )}
        </div>

        {/* 2. Mother Tongue */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "मातृभाषा" : "Mother Tongue"}{" "}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <Combobox
            options={motherTongueOptions}
            value={value.motherTongue}
            onChange={(m) => onChange({ ...value, motherTongue: m })}
            placeholder={isHindi ? "मातृभाषा चुनें..." : "Select Mother Tongue..."}
            searchPlaceholder={isHindi ? "मातृभाषा खोजें..." : "Search Mother Tongue..."}
            disabled={disabled}
            isHindi={isHindi}
            allowCreate={true}
            createLabel={isHindi ? "अन्य भाषा जोड़ें" : "Add custom language"}
            onCreateNew={(customLang) => onChange({ ...value, motherTongue: customLang })}
            clearable={true}
          />
          {errors.motherTongue && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.motherTongue}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 3. Category */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "श्रेणी / वर्ग" : "Category / Caste Group"}{" "}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <Combobox
            options={categoryOptions}
            value={value.category}
            onChange={handleCategoryChange}
            placeholder={isHindi ? "श्रेणी चुनें..." : "Select Category..."}
            searchPlaceholder={isHindi ? "श्रेणी खोजें..." : "Search Category..."}
            disabled={disabled}
            isHindi={isHindi}
            clearable={false}
          />
          {errors.category && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.category}
            </p>
          )}
        </div>

        {/* 4. Sub-caste / Community (Revealed when not GENERAL or optional) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "उप-जाति / समुदाय" : "Sub-Caste / Community"}{" "}
            {isReservedCategory && <span className="text-gray-400 font-normal">({isHindi ? "प्रमाणपत्र अनुसार" : "as per certificate"})</span>}
          </label>
          <Combobox
            options={subCasteOptions}
            value={value.subCaste || ""}
            onChange={(s) => onChange({ ...value, subCaste: s })}
            placeholder={
              !value.category
                ? isHindi
                  ? "पहले श्रेणी चुनें"
                  : "Select Category first"
                : isHindi
                ? "उप-जाति चुनें..."
                : "Select Sub-caste..."
            }
            searchPlaceholder={isHindi ? "उप-जाति खोजें..." : "Search Sub-caste..."}
            disabled={disabled || !value.category}
            isHindi={isHindi}
            allowCreate={true}
            createLabel={isHindi ? "अन्य उप-जाति जोड़ें" : "Specify custom sub-caste"}
            onCreateNew={(customSubCaste) => onChange({ ...value, subCaste: customSubCaste })}
            clearable={true}
          />
          {errors.subCaste && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.subCaste}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
