import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { db } from "@/db";
import { sections, staff, staffAttendance, studentAttendance } from "@/db/schema";
import { decryptData } from "@/lib/encryption";
import AttendanceManager from "./AttendanceManager";
import { StaffAttendanceManager, type StaffAttendanceRow } from "./StaffAttendanceManager";
import { getAssignedSections, getSectionStudents } from "./actions";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export const metadata: Metadata = {
  title: "Attendance Monitor",
  description: "Mark and view student and staff attendance.",
};

function safeDecrypt(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return decryptData(val) || "";
  } catch {
    return val;
  }
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/attendance", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const activeTab = resolvedParams.tab === "staff" ? "staff" : "students";
  const isAdminOrPrincipal = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"].includes(
    ctx.role
  );

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let markedSectionsCount = 0;
  let pendingSectionsCount = 0;
  let staffRows: StaffAttendanceRow[] = [];

  if (isAdminOrPrincipal) {
    try {
      const school = await requireSchool(ctx);
      const [allSections, markedToday] = await Promise.all([
        db.query.sections.findMany({
          where: and(eq(sections.schoolId, school.id), isNull(sections.deletedAt)),
          columns: { id: true },
        }),
        db
          .select({ sectionId: studentAttendance.sectionId })
          .from(studentAttendance)
          .where(
            and(
              eq(studentAttendance.schoolId, school.id),
              gte(studentAttendance.attendanceDate, startOfDay),
              lte(studentAttendance.attendanceDate, endOfDay)
            )
          )
          .groupBy(studentAttendance.sectionId),
      ]);
      const markedSet = new Set(markedToday.map((r) => r.sectionId));
      markedSectionsCount = allSections.filter((s) => markedSet.has(s.id)).length;
      pendingSectionsCount = allSections.length - markedSectionsCount;

      if (activeTab === "staff") {
        const [allStaff, todayStaffAtt] = await Promise.all([
          db.query.staff.findMany({
            where: and(eq(staff.schoolId, school.id), eq(staff.isActive, true), isNull(staff.deletedAt)),
            columns: {
              id: true,
              employeeCode: true,
              firstNameEncrypted: true,
              lastNameEncrypted: true,
            },
            with: { designation: { columns: { name: true } } },
          }),
          db.query.staffAttendance.findMany({
            where: and(
              eq(staffAttendance.schoolId, school.id),
              gte(staffAttendance.attendanceDate, startOfDay),
              lte(staffAttendance.attendanceDate, endOfDay)
            ),
            columns: { staffId: true, status: true },
          }),
        ]);

        const statusMap = new Map(todayStaffAtt.map((a) => [a.staffId, a.status]));
        staffRows = (allStaff as any[]).map((st) => ({
          staffId: st.id,
          name:
            `${safeDecrypt(st.firstNameEncrypted)} ${safeDecrypt(st.lastNameEncrypted)}`.trim() ||
            st.employeeCode ||
            "Staff Member",
          employeeCode: st.employeeCode ?? null,
          designationName: st.designation?.name ?? null,
          status: (statusMap.get(st.id) as any) || "PRESENT",
        }));
      }
    } catch {
      // Non-fatal fallback
    }
  }

  const { initialSections, initialStudents } =
    activeTab === "students"
      ? await withDataPhaseTiming("/attendance", async () => {
          return assertQueryBudget(
            async () => {
              let sectionsRes: any[] = [];
              let studentsRes: any[] = [];
              try {
                sectionsRes = await getAssignedSections();
                if (sectionsRes.length > 0 && sectionsRes[0]?.id) {
                  studentsRes = await getSectionStudents(sectionsRes[0].id, todayStr);
                }
              } catch {
                // Gracefully fallback
              }
              return { initialSections: sectionsRes, initialStudents: studentsRes };
            },
            { maxQueries: 6, label: "Student Attendance Page" }
          );
        })
      : { initialSections: [], initialStudents: [] };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {activeTab === "staff" ? "Staff Attendance" : "Student Attendance"}
          </h1>
          <p className="text-gray-500 mt-1">
            {activeTab === "staff"
              ? "View and mark daily attendance for teaching and non-teaching staff."
              : "Select section and date to mark or update student attendance."}
          </p>
        </div>

        {isAdminOrPrincipal && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1">
            <Link
              href="/attendance"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "students"
                  ? "bg-semantic-interactive text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Student Attendance
            </Link>
            <Link
              href="/attendance?tab=staff"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "staff"
                  ? "bg-semantic-interactive text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Staff Attendance
            </Link>
          </div>
        )}
      </div>

      {isAdminOrPrincipal && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/60 bg-card p-3.5">
            <p className="text-xs text-muted-foreground">Sections Marked Today</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {markedSectionsCount}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-3.5">
            <p className="text-xs text-muted-foreground">Sections Pending Today</p>
            <p
              className={`text-2xl font-bold mt-0.5 ${
                pendingSectionsCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {pendingSectionsCount}
            </p>
          </div>
        </div>
      )}

      {activeTab === "staff" && isAdminOrPrincipal ? (
        <StaffAttendanceManager dateStr={todayStr} initialRows={staffRows} />
      ) : (
        <AttendanceManager
          initialSections={initialSections}
          initialStudents={initialStudents}
          initialSelectedSection={initialSections[0]?.id || ""}
          initialSelectedDate={todayStr}
        />
      )}
    </div>
  );
}

