"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  ShieldAlert,
  Edit2,
  Trash2,
  MapPin,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Globe,
  Mail,
  Phone,
  Calendar,
  School,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateSchoolAction,
  deleteSchoolAction,
  toggleSchoolStatusAction,
  startImpersonationAction,
  SchoolFormInput,
} from "./actions";
import { SchoolProvisionModal } from "./SchoolProvisionModal";

export interface SchoolItem {
  id: string;
  name: string;
  board: "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";
  udiseCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  principalName: string;
  establishedYear: number;
  schoolType: string | null;
  website: string | null;
  slug: string | null;
  status: string;
  isActive: boolean;
  createdAt: Date | string;
  deletedAt: Date | string | null;
}

interface Props {
  initialSchools: SchoolItem[];
}

export function SchoolManagementClient({ initialSchools }: Props) {
  const [schoolsList, setSchoolsList] = useState<SchoolItem[]>(initialSchools);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardFilter, setBoardFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal states
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [deletingSchool, setDeletingSchool] = useState<SchoolItem | null>(null);
  const [provisioningSchool, setProvisioningSchool] = useState<SchoolItem | null>(null);
  const [expandedSchoolId, setExpandedSchoolId] = useState<string | null>(null);

  // Transitions
  const [isPending, startTransition] = useTransition();

  // Filtered schools
  const filteredSchools = schoolsList.filter((s) => {
    // Hide archived unless statusFilter is ARCHIVED or ALL
    if (s.status === "ARCHIVED" && statusFilter !== "ARCHIVED" && statusFilter !== "ALL") {
      return false;
    }

    const matchesQuery =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.udiseCode.includes(searchQuery) ||
      (s.slug && s.slug.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesBoard = boardFilter === "ALL" || s.board === boardFilter;
    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;

    return matchesQuery && matchesBoard && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-semantic-interactive" /> School Tenant Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Governing {schoolsList.length} registered school instances across educational boards with real-time operations.
          </p>
        </div>

        <Link
          href="/onboard"
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-xs transition shadow-xs active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New School</span>
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-card border border-border/40">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search school, city, or UDISE..."
            className="w-full min-h-[44px] pl-9 pr-4 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto text-xs">
          {/* Board Selector */}
          <select
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
            aria-label="Filter by Educational Board"
            className="min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-foreground font-medium focus:outline-none focus:border-semantic-interactive"
          >
            <option value="ALL">All Boards</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="STATE_BOARD">State Board</option>
            <option value="IGCSE">IGCSE</option>
            <option value="IB">IB</option>
          </select>

          {/* Status Tabs with scroll on mobile */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition border ${
                statusFilter === "ALL"
                  ? "bg-card text-foreground font-semibold border-border/50 shadow-xs"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              All ({schoolsList.length})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition border ${
                statusFilter === "ACTIVE"
                  ? "bg-semantic-money-in/15 text-semantic-money-in font-semibold border-semantic-money-in/25"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              Active ({schoolsList.filter((s) => s.status === "ACTIVE").length})
            </button>
            <button
              onClick={() => setStatusFilter("SUSPENDED")}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition border ${
                statusFilter === "SUSPENDED"
                  ? "bg-semantic-attention/15 text-semantic-attention font-semibold border-semantic-attention/25"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              Suspended ({schoolsList.filter((s) => s.status === "SUSPENDED").length})
            </button>
            <button
              onClick={() => setStatusFilter("ARCHIVED")}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition border ${
                statusFilter === "ARCHIVED"
                  ? "bg-semantic-money-owed/15 text-semantic-money-owed font-semibold border-semantic-money-owed/25"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              Archived ({schoolsList.filter((s) => s.status === "ARCHIVED").length})
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Schools Table (hidden on mobile, visible on md+) */}
      <div className="hidden md:block rounded-xl border border-border/40 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold tracking-wider border-b border-border/40">
              <tr>
                <th className="py-3.5 px-4">School Profile</th>
                <th className="py-3.5 px-4">Board & Type</th>
                <th className="py-3.5 px-4">Location & Contact</th>
                <th className="py-3.5 px-4">UDISE & Slug</th>
                <th className="py-3.5 px-4">Lifecycle Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <p>No schools match the specified search or filter criteria.</p>
                    {schoolsList.length === 0 && (
                      <div className="mt-3">
                        <Link
                          href="/onboard"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-xs transition shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Provision First School</span>
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s) => {
                  const isActive = s.status === "ACTIVE";
                  const isArchived = s.status === "ARCHIVED";

                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      {/* Profile */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-muted border border-border/40 text-foreground flex items-center justify-center font-bold text-sm">
                            {s.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-sm">{s.name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <span>Principal: {s.principalName || "Not Assigned"}</span>
                              {s.establishedYear && (
                                <span className="text-muted-foreground/60">· Est. {s.establishedYear}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Board & Type */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20">
                          {s.board}
                        </span>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {s.schoolType || "Standard"}
                        </div>
                      </td>

                      {/* Location & Contact */}
                      <td className="py-4 px-4 text-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span>{s.city}, {s.state}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{s.phone}</span>
                          <span>·</span>
                          <span className="truncate max-w-[120px]">{s.email}</span>
                        </div>
                      </td>

                      {/* UDISE & Slug */}
                      <td className="py-4 px-4">
                        <div className="font-mono text-foreground">{s.udiseCode}</div>
                        <div className="text-[11px] text-semantic-interactive font-mono">
                          /{s.slug || s.id.slice(0, 8)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isActive && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-semantic-money-in/15 text-semantic-money-in border border-semantic-money-in/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-semantic-money-in"></span>
                            ACTIVE
                          </span>
                        )}
                        {s.status === "SUSPENDED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-semantic-attention/15 text-semantic-attention border border-semantic-attention/30">
                            <AlertCircle className="w-3 h-3" />
                            SUSPENDED
                          </span>
                        )}
                        {isArchived && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-semantic-money-owed/15 text-semantic-money-owed border border-semantic-money-owed/30">
                            <Trash2 className="w-3 h-3" />
                            ARCHIVED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Impersonate */}
                          {!isArchived && (
                            <form action={startImpersonationAction}>
                              <input type="hidden" name="schoolId" value={s.id} />
                              <input type="hidden" name="schoolName" value={s.name} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-semantic-interactive/10 hover:bg-semantic-interactive/20 text-semantic-interactive border border-semantic-interactive/30 font-medium transition text-xs active:scale-95 shadow-xs"
                                title="Enter school with Superadmin Impersonation"
                              >
                                <Eye className="w-3.5 h-3.5 text-semantic-interactive" />
                                <span>Impersonate</span>
                              </button>
                            </form>
                          )}

                          {/* Digital Twin Provision Button */}
                          {!isArchived && (
                            <button
                              onClick={() => setProvisioningSchool(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border/40 font-medium transition text-xs active:scale-95 shadow-xs"
                              title="Provision Digital Twin Configuration"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-semantic-interactive" />
                              <span>Provision</span>
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => setEditingSchool(s)}
                            className="p-1.5 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition text-xs"
                            title="Edit School Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Status Toggle Button */}
                          {!isArchived && (
                            <button
                              onClick={() => {
                                startTransition(async () => {
                                  const fd = new FormData();
                                  fd.append("schoolId", s.id);
                                  fd.append("currentStatus", s.status);
                                  const res = await toggleSchoolStatusAction(fd);
                                  if (res?.success) {
                                    setSchoolsList((prev) =>
                                      prev.map((item) =>
                                        item.id === s.id ? { ...item, status: res.status! } : item
                                      )
                                    );
                                    toast.success(
                                      `School ${res.status === "ACTIVE" ? "activated" : "suspended"} successfully`
                                    );
                                  } else {
                                    toast.error(res?.error || "Failed to update status");
                                  }
                                });
                              }}
                              className={`p-1.5 rounded-lg border text-xs transition ${
                                isActive
                                  ? "border-semantic-attention/30 text-semantic-attention hover:bg-semantic-attention/10"
                                  : "border-semantic-money-in/30 text-semantic-money-in hover:bg-semantic-money-in/10"
                              }`}
                              title={isActive ? "Suspend School Instance" : "Reactivate School Instance"}
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {!isArchived && (
                            <button
                              onClick={() => setDeletingSchool(s)}
                              className="p-1.5 rounded-lg border border-semantic-money-owed/30 text-semantic-money-owed hover:bg-semantic-money-owed/10 transition text-xs"
                              title="Delete or Archive School"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile School Cards View (UX-R47: Phones show cards) */}
      <div className="block md:hidden space-y-3">
        {filteredSchools.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground rounded-xl border border-border/40 bg-card text-xs space-y-3 shadow-xs">
            <p>No schools match the specified search or filter criteria.</p>
            {schoolsList.length === 0 && (
              <Link
                href="/onboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-xs transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Provision First School</span>
              </Link>
            )}
          </div>
        ) : (
          filteredSchools.map((s) => {
            const isActive = s.status === "ACTIVE";
            const isArchived = s.status === "ARCHIVED";
            const isExpanded = expandedSchoolId === s.id;

            return (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-border/40 bg-card shadow-xs space-y-3 transition hover:border-border/60"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border/40 text-foreground flex items-center justify-center font-bold text-sm shrink-0">
                      {s.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-foreground text-sm leading-tight truncate">
                        {s.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20">
                          {s.board}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[120px]">
                          /{s.slug || s.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-semantic-money-in/15 text-semantic-money-in border border-semantic-money-in/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-semantic-money-in"></span>
                        ACTIVE
                      </span>
                    )}
                    {s.status === "SUSPENDED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-semantic-attention/15 text-semantic-attention border border-semantic-attention/30">
                        <AlertCircle className="w-3 h-3" />
                        SUSPENDED
                      </span>
                    )}
                    {isArchived && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-semantic-money-owed/15 text-semantic-money-owed border border-semantic-money-owed/30">
                        <Trash2 className="w-3 h-3" />
                        ARCHIVED
                      </span>
                    )}
                  </div>
                </div>

                {/* Key metadata summary */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{s.city}, {s.state}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-muted-foreground truncate">
                    <span className="text-[10px] uppercase text-muted-foreground">UDISE:</span>
                    <span>{s.udiseCode}</span>
                  </div>
                </div>

                {/* Expandable details toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedSchoolId(isExpanded ? null : s.id)}
                  className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground pt-1 transition min-h-[32px]"
                >
                  <span>{isExpanded ? "Hide Details" : "Show Full Details & Contact"}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Expanded details panel */}
                {isExpanded && (
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-xs space-y-1.5 text-foreground animate-in fade-in duration-150">
                    <div>
                      <span className="text-muted-foreground font-medium">Principal: </span>
                      <span className="text-foreground font-medium">{s.principalName || "Not Assigned"}</span>
                    </div>
                    {s.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                    {s.address && (
                      <div className="text-[11px] text-muted-foreground">
                        {s.address}, Pincode: {s.pincode}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 pt-1 border-t border-border/30">
                      <span>Type: {s.schoolType || "Standard"}</span>
                      {s.establishedYear && <span>· Est. {s.establishedYear}</span>}
                    </div>
                  </div>
                )}

                {/* Action Bar (Thumb Zone: UX-R20, UX-R21) */}
                <div className="pt-2 flex items-center gap-2 border-t border-border/40">
                  {!isArchived && (
                    <form action={startImpersonationAction} className="flex-1">
                      <input type="hidden" name="schoolId" value={s.id} />
                      <input type="hidden" name="schoolName" value={s.name} />
                      <button
                        type="submit"
                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-xs shadow-xs transition active:scale-95"
                        title="Enter school with Superadmin Impersonation"
                      >
                        <ShieldAlert className="w-4 h-4 text-white/90" />
                        <span>Impersonate</span>
                      </button>
                    </form>
                  )}

                  <div className="flex items-center gap-1.5">
                    {/* Edit button */}
                    <button
                      onClick={() => setEditingSchool(s)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border/40 transition"
                      title="Edit School Metadata"
                      aria-label="Edit School"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Toggle status */}
                    {!isArchived && (
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            const fd = new FormData();
                            fd.append("schoolId", s.id);
                            fd.append("currentStatus", s.status);
                            const res = await toggleSchoolStatusAction(fd);
                            if (res?.success) {
                              setSchoolsList((prev) =>
                                prev.map((item) =>
                                  item.id === s.id
                                    ? {
                                        ...item,
                                        status: res.status as any,
                                        isActive: res.status === "ACTIVE",
                                      }
                                    : item
                                )
                              );
                              toast.success(
                                `School ${res.status === "ACTIVE" ? "activated" : "suspended"} successfully`
                              );
                            } else {
                              toast.error(res?.error || "Failed to update status");
                            }
                          });
                        }}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition ${
                          isActive
                            ? "border-semantic-attention/30 text-semantic-attention bg-semantic-attention/10 hover:bg-semantic-attention/20"
                            : "border-semantic-money-in/30 text-semantic-money-in bg-semantic-money-in/10 hover:bg-semantic-money-in/20"
                        }`}
                        title={isActive ? "Suspend School Instance" : "Reactivate School Instance"}
                        aria-label={isActive ? "Suspend School" : "Reactivate School"}
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete button */}
                    {!isArchived && (
                      <button
                        onClick={() => setDeletingSchool(s)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-semantic-money-owed/30 text-semantic-money-owed bg-semantic-money-owed/10 hover:bg-semantic-money-owed/20 transition"
                        title="Archive School"
                        aria-label="Archive School"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>



      {/* EDIT MODAL */}
      {editingSchool && (
        <SchoolFormModal
          title={`Edit School: ${editingSchool.name}`}
          initialData={editingSchool}
          isOpen={!!editingSchool}
          onClose={() => setEditingSchool(null)}
          onSubmit={async (formData) => {
            const res = await updateSchoolAction(editingSchool.id, formData);
            if (res.success && res.school) {
              setSchoolsList((prev) =>
                prev.map((item) => (item.id === editingSchool.id ? (res.school as SchoolItem) : item))
              );
              toast.success(`School "${res.school.name}" updated successfully!`);
              setEditingSchool(null);
            } else {
              toast.error(res.error || "Failed to update school");
            }
          }}
        />
      )}

      {/* SECURE DELETE CONFIRMATION MODAL */}
      {deletingSchool && (
        <DeleteConfirmModal
          school={deletingSchool}
          isOpen={!!deletingSchool}
          onClose={() => setDeletingSchool(null)}
          onConfirm={async (confirmText) => {
            const res = await deleteSchoolAction(deletingSchool.id, confirmText);
            if (res.success) {
              setSchoolsList((prev) =>
                prev.map((item) =>
                  item.id === deletingSchool.id ? { ...item, status: "ARCHIVED" } : item
                )
              );
              toast.success(`School "${deletingSchool.name}" archived successfully!`);
              setDeletingSchool(null);
            } else {
              toast.error(res.error || "Failed to delete school");
            }
          }}
        />
      )}

      {/* DIGITAL TWIN PROVISIONING MODAL */}
      {provisioningSchool && (
        <SchoolProvisionModal
          school={provisioningSchool}
          isOpen={!!provisioningSchool}
          onClose={() => setProvisioningSchool(null)}
          onSuccess={() => {
            toast.success(`Digital twin provisioning complete for ${provisioningSchool.name}!`);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE SCHOOL FORM MODAL (CREATE & UPDATE)
// ─────────────────────────────────────────────────────────────────────────────

interface SchoolModalProps {
  title: string;
  initialData?: SchoolItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SchoolFormInput) => Promise<void>;
}

function SchoolFormModal({ title, initialData, isOpen, onClose, onSubmit }: SchoolModalProps) {
  const isEditing = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<SchoolFormInput>({
    name: initialData?.name || "",
    board: initialData?.board || "CBSE",
    udiseCode: initialData?.udiseCode || "",
    address: initialData?.address || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    pincode: initialData?.pincode || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    principalName: initialData?.principalName || "",
    establishedYear: initialData?.establishedYear || new Date().getFullYear(),
    schoolType: (initialData?.schoolType as any) || "SECONDARY",
    website: initialData?.website || "",
    slug: initialData?.slug || "",
    academicYearLabel: "2026-2027",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "School name is required";
    if (!formData.udiseCode.trim() || !/^\d{8,11}$/.test(formData.udiseCode.trim())) {
      errs.udiseCode = "UDISE code must be 8-11 digits";
    }
    if (!formData.principalName.trim()) errs.principalName = "Principal name is required";
    if (!formData.email.trim() || !formData.email.includes("@")) errs.email = "Valid email is required";
    if (!formData.phone.trim()) errs.phone = "Phone number is required";
    if (!formData.city.trim()) errs.city = "City is required";
    if (!formData.state.trim()) errs.state = "State is required";
    if (!formData.pincode.trim() || !/^\d{6}$/.test(formData.pincode.trim())) {
      errs.pincode = "Valid 6-digit pincode is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [activeStep, setActiveStep] = useState<"identity" | "contact" | "location" | "session">("identity");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border border-border/40 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <School className="w-5 h-5 text-semantic-interactive" />
            <h2 className="text-base font-bold text-foreground truncate max-w-[240px] sm:max-w-md">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
            aria-label="Close form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Selector Tabs (UX-R41, UX-R42: 3-5 fields per step) */}
        <div className="flex items-center border-b border-border/40 bg-muted/10 px-3 sm:px-6 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveStep("identity")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap min-h-[44px] ${
              activeStep === "identity"
                ? "border-semantic-interactive text-semantic-interactive"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            1. Identity
          </button>
          <button
            type="button"
            onClick={() => setActiveStep("contact")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap min-h-[44px] ${
              activeStep === "contact"
                ? "border-semantic-interactive text-semantic-interactive"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            2. Contact
          </button>
          <button
            type="button"
            onClick={() => setActiveStep("location")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap min-h-[44px] ${
              activeStep === "location"
                ? "border-semantic-interactive text-semantic-interactive"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            3. Location
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setActiveStep("session")}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap min-h-[44px] ${
                activeStep === "session"
                  ? "border-semantic-interactive text-semantic-interactive"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              4. Session
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-4 flex-1">
          {/* Section: Core Identity */}
          {activeStep === "identity" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-xs uppercase font-semibold text-semantic-interactive tracking-wider">
                Institutional Identity & Board
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    School Name <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Delhi Public School"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                  {errors.name && <p className="text-[11px] text-semantic-money-owed mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Educational Board <span className="text-semantic-money-owed">*</span>
                  </label>
                  <select
                    value={formData.board}
                    onChange={(e) => setFormData({ ...formData, board: e.target.value as any })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground focus:outline-none focus:border-semantic-interactive"
                  >
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="STATE_BOARD">State Board</option>
                    <option value="IGCSE">IGCSE</option>
                    <option value="IB">IB</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    UDISE Code <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.udiseCode}
                    onChange={(e) => setFormData({ ...formData, udiseCode: e.target.value })}
                    placeholder="e.g. 09123456789"
                    maxLength={11}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive font-mono"
                  />
                  {errors.udiseCode && <p className="text-[11px] text-semantic-money-owed mt-1">{errors.udiseCode}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    School Level / Type
                  </label>
                  <select
                    value={formData.schoolType}
                    onChange={(e) => setFormData({ ...formData, schoolType: e.target.value as any })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground focus:outline-none focus:border-semantic-interactive"
                  >
                    <option value="PRIMARY">Primary School (K-5)</option>
                    <option value="SECONDARY">Secondary School (K-10)</option>
                    <option value="SENIOR_SECONDARY">Senior Secondary (K-12)</option>
                    <option value="INTEGRATED">Integrated Academy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Established Year
                  </label>
                  <input
                    type="number"
                    value={formData.establishedYear}
                    onChange={(e) => setFormData({ ...formData, establishedYear: Number(e.target.value) })}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    URL Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g. dps-noida"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section: Contact & Leadership */}
          {activeStep === "contact" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-xs uppercase font-semibold text-semantic-interactive tracking-wider">
                Leadership & Official Communication
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Principal Name <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.principalName}
                    onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                    placeholder="Dr. Rajesh Sharma"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                  {errors.principalName && (
                    <p className="text-[11px] text-semantic-money-owed mt-1">{errors.principalName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Official Email <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin@school.edu.in"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                  {errors.email && <p className="text-[11px] text-semantic-money-owed mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Phone Number <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                  {errors.phone && <p className="text-[11px] text-semantic-money-owed mt-1">{errors.phone}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Section: Address & Location */}
          {activeStep === "location" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-xs uppercase font-semibold text-semantic-interactive tracking-wider">
                Campus Location & Territory
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Sector 62, Institutional Area"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    City <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Noida"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                  {errors.city && <p className="text-[11px] text-semantic-money-owed mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    State <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Uttar Pradesh"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                  {errors.state && <p className="text-[11px] text-semantic-money-owed mt-1">{errors.state}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Pincode <span className="text-semantic-money-owed">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="201301"
                    maxLength={6}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
                  />
                  {errors.pincode && <p className="text-[11px] text-semantic-money-owed mt-1">{errors.pincode}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Section: Academic Session (Only on creation) */}
          {activeStep === "session" && !isEditing && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-xs uppercase font-semibold text-semantic-interactive tracking-wider">
                Inaugural Academic Session Setup
              </h3>
              <div className="w-full sm:w-2/3">
                <label className="block text-xs font-medium text-foreground mb-1">
                  Initial Academic Year Label
                </label>
                <input
                  type="text"
                  value={formData.academicYearLabel}
                  onChange={(e) => setFormData({ ...formData, academicYearLabel: e.target.value })}
                  placeholder="2026-2027"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground focus:outline-none focus:border-semantic-interactive font-mono"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                  Automatically initializes the active academic calendar and default terms for this new school tenant.
                </p>
              </div>
            </div>
          )}

          {/* Modal Footer with step navigation and submit button */}
          <div className="pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {activeStep !== "identity" && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeStep === "contact") setActiveStep("identity");
                    if (activeStep === "location") setActiveStep("contact");
                    if (activeStep === "session") setActiveStep("location");
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-border/40 text-foreground hover:bg-muted/40 text-xs transition font-medium"
                >
                  Previous
                </button>
              )}
              {activeStep !== (isEditing ? "location" : "session") && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeStep === "identity") setActiveStep("contact");
                    if (activeStep === "contact") setActiveStep("location");
                    if (activeStep === "location" && !isEditing) setActiveStep("session");
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border/40 text-xs transition font-medium"
                >
                  Next Step
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40 text-xs transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isEditing ? "Save Changes" : "Provision School"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURE TWO-STEP DELETE / ARCHIVE MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteModalProps {
  school: SchoolItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmText: string) => Promise<void>;
}

function DeleteConfirmModal({ school, isOpen, onClose, onConfirm }: DeleteModalProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isMatch =
    confirmInput.trim().toLowerCase() === school.name.trim().toLowerCase() ||
    confirmInput.trim().toUpperCase() === "CONFIRM DELETE";

  const handleConfirm = async () => {
    if (!isMatch) return;
    setIsDeleting(true);
    try {
      await onConfirm(confirmInput);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-semantic-money-owed/30 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3 text-semantic-money-owed">
          <div className="w-10 h-10 rounded-full bg-semantic-money-owed/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-semantic-money-owed" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Archive School Tenant</h3>
            <p className="text-xs text-semantic-money-owed">Destructive operation with audit preservation</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-semantic-money-owed/10 border border-semantic-money-owed/20 text-xs text-foreground space-y-2">
          <p>
            You are about to archive <strong className="text-foreground">"{school.name}"</strong> (UDISE:{" "}
            <span className="font-mono text-semantic-money-owed">{school.udiseCode}</span>).
          </p>
          <p className="text-[11px] text-muted-foreground">
            In compliance with DPDP data governance rules, this tenant will be marked as{" "}
            <span className="text-semantic-money-owed font-semibold">ARCHIVED</span>, preventing all user logins and operations while retaining financial records and audit logs.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Type <strong className="text-foreground font-mono">{school.name}</strong> or{" "}
            <strong className="text-semantic-money-owed font-mono">CONFIRM DELETE</strong> to proceed:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={school.name}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-money-owed"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40 text-xs transition font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-semantic-money-owed hover:bg-semantic-money-owed/90 text-white font-semibold text-xs transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Archive School</span>
          </button>
        </div>
      </div>
    </div>
  );
}
