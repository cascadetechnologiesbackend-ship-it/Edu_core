"use client";

import { useState, useMemo, useDeferredValue, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, UserPlus, Users, ChevronRight, Filter, ShieldAlert, KeyRound } from "lucide-react";
import { searchStudentsAction } from "./actions";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-gray-200 dark:border-slate-800 flex flex-col md:flex-row flex-wrap gap-3 items-stretch md:items-center justify-between">
        {/* Search Input (320px width) */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students by name or admission #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleServerSearch();
            }}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/60 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-primary min-h-[40px] transition"
          />
        </div>

        {/* Filter Dropdowns + Add Student Primary Action */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-400">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="py-2 px-3 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-primary min-h-[40px]"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-gray-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="py-2 px-3 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-primary min-h-[40px]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Parent Linkage Repair Queue Action */}
          <Link
            href="/students/linkage"
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition inline-flex items-center gap-1.5 min-h-[40px]"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Parent Linkage</span>
          </Link>

          {/* Student Access Queue Action */}
          <Link
            href="/students/access"
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition inline-flex items-center gap-1.5 min-h-[40px]"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Student Access</span>
          </Link>

          {/* Primary Action Button: Add Student */}
          <Link
            href="/admissions/new"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 transition shadow-xs inline-flex items-center gap-1.5 min-h-[40px]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Enroll Student</span>
          </Link>
        </div>
      </div>

      {/* Results Count & Data Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/20">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Showing <strong className="text-gray-900 dark:text-white">{filteredStudents.length}</strong> enrolled students
            {isPending && <span className="ml-2 text-xs text-primary animate-pulse">(Searching…)</span>}
          </span>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                handleServerSearch();
              }}
              className="text-xs text-primary font-bold hover:underline"
            >
              Clear Search
            </button>
          )}
        </div>

        {/* Desktop Table View (People Render as People per Law L12) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/75 dark:bg-slate-800/40 text-gray-500 font-bold uppercase text-[11px] border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Admission Number</th>
                <th className="px-6 py-3.5">Current Placement</th>
                <th className="px-6 py-3.5">Gender</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            student.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          {student.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/students/${student.id}`}
                          prefetch={false}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-primary font-bold hover:underline text-xs"
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
            <div className="p-8 text-center text-gray-400 text-xs">
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
                  className="p-4 bg-gray-50/70 dark:bg-slate-800/40 rounded-2xl border border-gray-200/80 dark:border-slate-800 space-y-3 cursor-pointer"
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
    </div>
  );
}
