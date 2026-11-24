"use client";

import React from "react";
import { useOnboarding } from "../onboardContext";
import { Building2, Calendar, Mail, Phone, MapPin, Hash, UserCheck } from "lucide-react";

export function Step2Profile() {
  const {
    academicSession,
    setAcademicSession,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    schoolName,
    setSchoolName,
    udiseCode,
    setUdiseCode,
    address,
    setAddress,
    city,
    setCity,
    state,
    setState,
    pincode,
    setPincode,
    phone,
    setPhone,
    email,
    setEmail,
    principalName,
    setPrincipalName,
    currencySymbol,
    setCurrencySymbol,
  } = useOnboarding();

  // Auto-generate UDISE code / slug from school name if empty
  const handleSchoolNameChange = (val: string) => {
    setSchoolName(val);
    if (!udiseCode || udiseCode === schoolName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 15)) {
      setUdiseCode(val.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 15));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-semantic-interactive">
          Step 2: Institutional Profile & Academic Session
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          School Details & Session Window
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Configure the official institutional identity, statutory registration code, and the active academic session.
        </p>
      </div>

      <div className="space-y-6">
        {/* Session Window */}
        <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Calendar className="w-4 h-4 text-semantic-interactive" />
            <span>Active Academic Session</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Session Label *
              </label>
              <input
                type="text"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                placeholder="2026-27"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {/* School Profile */}
        <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Building2 className="w-4 h-4 text-semantic-interactive" />
            <span>School Identification</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                School Name *
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => handleSchoolNameChange(e.target.value)}
                placeholder="e.g. Delhi Public Academy"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                UDISE Code / URL Slug *
              </label>
              <input
                type="text"
                value={udiseCode}
                onChange={(e) => setUdiseCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="e.g. 07040100101 or dpa-delhi"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Unique identifier used for tenant isolation and public portal subdomain.
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Official School Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@dpa.edu.in"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Principal / Head of Institution
              </label>
              <input
                type="text"
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                placeholder="e.g. Dr. Sunita Mehra"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Plot 14, Sector 6"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                City / Locality
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="New Delhi"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="110075"
                maxLength={6}
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
