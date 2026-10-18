"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Sparkles, AlertCircle } from "lucide-react";
import { Combobox, type ComboboxOption } from "./Combobox";
import {
  INDIAN_STATES,
  getDistrictsForState,
  pincodeToStateDistrict,
  getStateByCode,
} from "@/lib/reference/indiaReferenceData";

export interface AddressValue {
  pincode: string;
  state: string;
  stateCode?: string | undefined;
  district: string;
  city?: string | undefined;
  line1: string;
  line2?: string | undefined;
}

export interface AddressAutofillProps {
  value: AddressValue;
  onChange: (val: AddressValue) => void;
  geoHint?: { state: string; stateCode: string; city?: string | undefined; source: "ip" } | null | undefined;
  isHindi?: boolean | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  autoFocusPincode?: boolean | undefined;
  className?: string | undefined;
  errors?: Partial<Record<keyof AddressValue, string>> | undefined;
}

export function AddressAutofill({
  value,
  onChange,
  geoHint,
  isHindi = false,
  disabled = false,
  required = true,
  autoFocusPincode = false,
  className = "",
  errors = {},
}: AddressAutofillProps) {
  const [autofillSource, setAutofillSource] = useState<"pincode" | "geo" | null>(null);

  // Apply geoHint once on mount if no existing state is set
  useEffect(() => {
    if (geoHint && !value.state && !value.pincode) {
      onChange({
        ...value,
        state: geoHint.state,
        stateCode: geoHint.stateCode,
        city: value.city || geoHint.city || "",
      });
      setAutofillSource("geo");
    }
  }, [geoHint]);

  // Handle pincode change: triggers sub-50ms instant lookup
  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
    const updated: AddressValue = { ...value, pincode: raw };

    if (raw.length === 6) {
      const match = pincodeToStateDistrict(raw);
      if (match) {
        updated.state = match.state;
        updated.stateCode = match.stateCode;
        if (match.district) {
          updated.district = match.district;
        }
        setAutofillSource("pincode");
      }
    } else if (autofillSource === "pincode" && raw.length < 6) {
      setAutofillSource(null);
    }

    onChange(updated);
  };

  // State options from canonical 36 states/UTs
  const stateOptions: ComboboxOption[] = useMemo(() => {
    return INDIAN_STATES.map((s) => ({
      value: s.nameEn,
      label: s.nameEn,
      labelHi: s.nameHi,
      badge: s.code,
      group: s.isUnionTerritory ? "Union Territories" : "States",
    }));
  }, []);

  // District options filtered by current state
  const districtOptions: ComboboxOption[] = useMemo(() => {
    const rawDistricts = getDistrictsForState(value.stateCode || value.state);
    return rawDistricts.map((d) => ({
      value: d.en,
      label: d.en,
      labelHi: d.hi,
    }));
  }, [value.state, value.stateCode]);

  const handleStateChange = (selectedStateName: string) => {
    const stateObj = INDIAN_STATES.find(
      (s) => s.nameEn === selectedStateName || s.code === selectedStateName
    );
    const stateCode = stateObj?.code || "";
    const stateName = stateObj?.nameEn || selectedStateName;

    // Check if current district is valid for new state, otherwise clear it
    const newDistricts = getDistrictsForState(stateCode);
    const isCurrentDistrictValid = newDistricts.some(
      (d) => d.en.toLowerCase() === (value.district || "").toLowerCase()
    );

    onChange({
      ...value,
      state: stateName,
      stateCode,
      district: isCurrentDistrictValid ? value.district : "",
    });
    setAutofillSource(null);
  };

  const handleDistrictChange = (selectedDistrict: string) => {
    onChange({
      ...value,
      district: selectedDistrict,
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Autofill Status Notification */}
      {autofillSource === "pincode" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-in fade-in-50 duration-200">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {isHindi
              ? "पिनकोड से स्वतः भरा गया — यदि गलत हो तो बदलें"
              : "Auto-filled from pincode — change if wrong"}
          </span>
        </div>
      )}

      {autofillSource === "geo" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 text-xs font-medium animate-in fade-in-50 duration-200">
          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            {isHindi
              ? "आपके स्थान से पहचाना गया — यदि गलत हो तो बदलें"
              : "Detected from your location — change if wrong"}
          </span>
        </div>
      )}

      {/* Row 1: Pincode (Autofocus trigger), State, District */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Pincode First */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "पिन कोड" : "PIN Code"}{" "}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus={autoFocusPincode}
              value={value.pincode}
              onChange={handlePincodeChange}
              disabled={disabled}
              placeholder="e.g. 560001"
              className={`w-full h-10 px-3 text-xs md:text-sm font-medium rounded-xl border bg-white dark:bg-slate-900 transition-colors outline-hidden ${
                errors.pincode
                  ? "border-rose-400 dark:border-rose-600 focus:border-rose-500"
                  : "border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
              }`}
            />
            {value.pincode && value.pincode.length === 6 && (
              <span className="absolute right-3 top-2.5 text-emerald-500 text-xs font-bold">
                ✓
              </span>
            )}
          </div>
          {errors.pincode && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.pincode}
            </p>
          )}
        </div>

        {/* 2. State */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "राज्य" : "State"}{" "}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <Combobox
            options={stateOptions}
            value={value.state}
            onChange={handleStateChange}
            placeholder={isHindi ? "राज्य चुनें..." : "Select State..."}
            searchPlaceholder={isHindi ? "राज्य खोजें..." : "Search State..."}
            disabled={disabled}
            isHindi={isHindi}
            clearable={true}
          />
          {errors.state && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.state}
            </p>
          )}
        </div>

        {/* 3. District */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "ज़िला" : "District"}{" "}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <Combobox
            options={districtOptions}
            value={value.district}
            onChange={handleDistrictChange}
            placeholder={
              !value.state
                ? isHindi
                  ? "पहले राज्य चुनें"
                  : "Select State first"
                : isHindi
                ? "ज़िला चुनें..."
                : "Select District..."
            }
            searchPlaceholder={isHindi ? "ज़िला खोजें..." : "Search District..."}
            disabled={disabled || !value.state}
            isHindi={isHindi}
            allowCreate={true}
            createLabel={isHindi ? "अन्य ज़िला जोड़ें" : "Add custom district"}
            onCreateNew={(customDistrict) => handleDistrictChange(customDistrict)}
            clearable={true}
          />
          {errors.district && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.district}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: City / Locality & Street Lines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 4. City / Locality */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "शहर / क्षेत्र" : "City / Locality"}
          </label>
          <input
            type="text"
            value={value.city || ""}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            disabled={disabled}
            placeholder="e.g. Indiranagar"
            className="w-full h-10 px-3 text-xs md:text-sm font-medium rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors outline-hidden"
          />
        </div>

        {/* 5. Address Line 1 */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            {isHindi ? "पता पंक्ति 1" : "Address Line 1"}{" "}
            {required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="text"
            value={value.line1}
            onChange={(e) => onChange({ ...value, line1: e.target.value })}
            disabled={disabled}
            placeholder="House/Flat No., Building Name, Street"
            className={`w-full h-10 px-3 text-xs md:text-sm font-medium rounded-xl border bg-white dark:bg-slate-900 transition-colors outline-hidden ${
              errors.line1
                ? "border-rose-400 dark:border-rose-600 focus:border-rose-500"
                : "border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
            }`}
          />
          {errors.line1 && (
            <p className="mt-1 text-[11px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.line1}
            </p>
          )}
        </div>
      </div>

      {/* Row 3: Address Line 2 (Optional) */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
          {isHindi ? "पता पंक्ति 2 (वैकल्पिक)" : "Address Line 2 (Optional)"}
        </label>
        <input
          type="text"
          value={value.line2 || ""}
          onChange={(e) => onChange({ ...value, line2: e.target.value })}
          disabled={disabled}
          placeholder="Landmark, Suite, Floor"
          className="w-full h-10 px-3 text-xs md:text-sm font-medium rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors outline-hidden"
        />
      </div>
    </div>
  );
}

/**
 * Helper to combine lines and locality into a single address string for encryption.
 */
export function formatAddressForStorage(val: AddressValue): string {
  return [val.line1, val.line2, val.city].filter(Boolean).join(", ");
}
