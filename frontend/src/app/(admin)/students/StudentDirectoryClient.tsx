"use client";

import { useState, useMemo, useDeferredValue, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, UserPlus, Users, ChevronRight, Filter, ShieldAlert, KeyRound, Download } from "lucide-react";
import { searchStudentsAction, exportStudentsAction } from "./actions";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import { ExportDialog, type ExportRequestPayload } from "@/components/import-export";
import { DATASET_SCHEMAS } from "@/lib/importExportEngine";
import { downloadExportRows } from "@/lib/exportDownload";
import { toast } from "sonner";
import { getAvatarColor, getInitials } from "@/lib/utils";

export interface StudentListItem {
  id: string;
  admissionNumber: string;
  fullName: string;
  gender: string;
  className: string;
  sectionName: string;
  classId: string | null;
  sectionId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface StudentDirectoryClientProps {
  initialStudents?: StudentListItem[];
  students?: StudentListItem[]; // Backward compatibility
  initialNextCursor?: string | null;
  classes: ClassOption[];
}

export function StudentDirectoryClient({
  initialStudents,
  students: legacyStudents,
  initialNextCursor = null,
  classes,
}: StudentDirectoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classIdParam = searchParams.get("classId");

  const [studentList, setStudentList] = useState<StudentListItem[]>(
    initialStudents || legacyStudents || [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Initialize selectedClassId from URL param (?classId=) if present
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classIdParam || "ALL",
  );
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [isPending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Sync if URL param changes
  useEffect(() => {
    if (classIdParam) {
      setSelectedClassId(classIdParam);
    }
  }, [classIdParam]);

  // Filter in-memory for instant feedback on active page
  const filteredStudents = useMemo(() => {
    return studentList.filter((s) => {
      // Class filter
      if (selectedClassId !== "ALL" && s.classId !== selectedClassId) {
        return false;
      }
      // Status filter
      if (selectedStatus === "ACTIVE" && !s.isActive) return false;
      if (selectedStatus === "INACTIVE" && s.isActive) return false;

      // Text search (name or admission number) using deferred value
      if (deferredSearchTerm.trim()) {
        const term = deferredSearchTerm.toLowerCase();
        const matchesName = s.fullName.toLowerCase().includes(term);
        const matchesAdm = s.admissionNumber.toLowerCase().includes(term);
        if (!matchesName && !matchesAdm) return false;
      }
      return true;
    });
  }, [studentList, deferredSearchTerm, selectedClassId, selectedStatus]);

  // Server-side search trigger when filter changes or user presses enter
  const handleServerSearch = () => {
    startTransition(async () => {
      try {
        const res = await searchStudentsAction({
          search: searchTerm,
          classId: selectedClassId,
          status: selectedStatus,
          limit: 30,
        });
        setStudentList(res.students);
        setNextCursor(res.nextCursor);
      } catch (err) {
        console.error("Failed to search students:", err);
      }
    });
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await searchStudentsAction({
        search: searchTerm,
        classId: selectedClassId,
        status: selectedStatus,
        cursor: nextCursor,
        limit: 30,
      });
      setStudentList((prev) => [...prev, ...res.students]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      console.error("Failed to load more students:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar (Law L1: 320px search input pinned left) */}
      <div className="bg-card rounded-2xl p-4 shadow-level-1 border border-border/40 flex flex-col md:flex-row flex-wrap gap-3 items-stretch md:items-center justify-between">
        {/* Search Input (320px width) */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students by name or admission #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleServerSearch();
            }}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-border/60 bg-muted/40 hover:bg-muted/60 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[44px] transition"
          />
        </div>

        {/* Filter Dropdowns + Add Student Primary Action */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="py-2 px-3 text-xs font-semibold rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/60 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[44px]"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="py-2 px-3 text-xs font-semibold rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/60 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[44px]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Parent Linkage Repair Queue Action */}
          <Link
            href="/students/linkage"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition inline-flex items-center gap-1.5 min-h-[44px]"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Parent Linkage</span>
          </Link>

          {/* Student Access Queue Action */}
          <Link
            href="/students/access"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition inline-flex items-center gap-1.5 min-h-[44px]"
          >
            <KeyRound className="w-3.5 h-3.5 text-blue-500" />
            <span>Student Access</span>
          </Link>

          {/* Export Students */}
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-border/60 bg-muted/40 hover:bg-muted/60 text-foreground transition inline-flex items-center gap-1.5 min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          {/* Primary Action Button: Add Student */}
          <Link
            href="/admissions/new"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white transition shadow-sm inline-flex items-center gap-1.5 min-h-[44px]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Enroll Student</span>
          </Link>
        </div>
      </div>

      {/* Results Count & Data Container */}
      <div className="bg-card rounded-2xl shadow-level-1 border border-border/40 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 flex justify-between items-center bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Showing <strong className="text-foreground">{filteredStudents.length}</strong> enrolled students
            {isPending && <span className="ml-2 text-xs text-blue-500 animate-pulse">(Searching…)</span>}
          </span>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                handleServerSearch();
              }}
              className="text-xs text-blue-500 font-semibold hover:underline"
            >
              Clear Search
            </button>
          )}
        </div>

        {/* Desktop Table View (People Render as People per Law L12) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/30 text-muted-foreground font-semibold uppercase text-[11px] tracking-wider border-b border-border/40">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Admission Number</th>
                <th className="px-6 py-3.5">Current Placement</th>
                <th className="px-6 py-3.5">Gender</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <EmptyStateCTA
                      icon={Users}
                      title="No students match criteria"
                      hint="Try adjusting your search terms or clearing the class filter."
                      ctaLabel="Reset Filter"
                      onCta={() => {
                        setSelectedClassId("ALL");
                        setSelectedStatus("ALL");
                        setSearchTerm("");
                        handleServerSearch();
                      }}
                    />
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const avatarBg = getAvatarColor(student.fullName);
                  const initials = getInitials(student.fullName);

                  return (
                    <tr
                      key={student.id}
                      onClick={() => router.push(`/students/${student.id}`)}
                      className="hover:bg-primary/5 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Avatar + Loud Name (Law L12) */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                            style={{ backgroundColor: avatarBg }}
                          >
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-primary transition">
                              {student.fullName}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              Adm: {student.admissionNumber}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Admission Number */}
                      <td className="px-6 py-4 font-mono font-semibold text-gray-700 dark:text-gray-300">
                        {student.admissionNumber}
                      </td>

                      {/* Class & Section placement */}
                      <td className="px-6 py-4">
                        {student.className ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200">
                            {student.className} • Sec {student.sectionName || "A"}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Gender */}
                      <td className="px-6 py-4 text-gray-500 font-medium">
                        {student.gender}
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            student.isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                          <span>{student.isActive ? "Active" : "Inactive"}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/students/${student.id}`}
                          prefetch={false}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline text-xs"
                        >
                          <span>Student 360</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (< 768px per UX-R47) */}
        <div className="block md:hidden p-3 space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              {isPending ? "Searching student records..." : "No students found matching your criteria."}
            </div>
          ) : (
            filteredStudents.map((student) => {
              const avatarBg = getAvatarColor(student.fullName);
              const initials = getInitials(student.fullName);

              return (
                <div
                  key={student.id}
                  onClick={() => router.push(`/students/${student.id}`)}
                  className="p-4 bg-card rounded-2xl border border-border/40 shadow-level-1 space-y-3 cursor-pointer active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                        style={{ backgroundColor: avatarBg }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {student.fullName}
                        </h4>
                        <p className="font-mono text-[11px] text-gray-400">
                          Adm: {student.admissionNumber}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        student.isActive
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {student.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    {student.className ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 font-bold text-gray-700 dark:text-gray-300">
                        {student.className} • Sec {student.sectionName || "A"}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Unassigned</span>
                    )}
                    {student.gender && (
                      <span className="px-2 py-0.5 rounded bg-gray-100/60 dark:bg-slate-800/60">
                        {student.gender}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/students/${student.id}`}
                    prefetch={false}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs shadow-xs transition"
                  >
                    <span>Open Student 360</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })
          )}
        </div>

        {/* Load More Pagination */}
        {nextCursor && (
          <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-slate-800 text-center bg-gray-50/50 dark:bg-slate-800/20">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full sm:w-auto min-h-[40px] px-6 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {loadingMore ? "Loading more..." : "Load More Students ↓"}
            </button>
          </div>
        )}
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        datasetKey="STUDENTS"
        filteredCount={filteredStudents.length}
        onConfirm={async (payload: ExportRequestPayload) => {
          const rows = await exportStudentsAction({
            search: payload.scope === "filtered" ? searchTerm : undefined,
            classId: payload.scope === "filtered" ? selectedClassId : "ALL",
            status: payload.scope === "filtered" ? selectedStatus : "ALL",
            dateFrom: payload.dateFrom,
            dateTo: payload.dateTo,
          });
          const schema = DATASET_SCHEMAS.STUDENTS;
          const cols = payload.columns.map((key) => ({
            key,
            label: schema.columns.find((c) => c.key === key)?.label || key,
          }));
          await downloadExportRows({
            rows,
            columns: cols,
            format: payload.format,
            fileName: `students-export-${new Date().toISOString().slice(0, 10)}`,
            sheetName: "Students",
            title: "Student Directory Export",
          });
          toast.success(`Exported ${rows.length} student records (${payload.format})`);
        }}
      />
    </div>
  );
}
