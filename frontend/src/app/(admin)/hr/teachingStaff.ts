import { db, withTenant } from "@/db";
import { staff, roles, userRoles, leaveRequests } from "@/db/schema";
import { eq, and, desc, lte, gte } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";

// ─── CANONICAL TEACHING STAFF RESOLVER FOR AMS & SIS ─────────────────────────
export interface CanonicalTeacher {
  id: string;
  staffId: string;
  name: string;
  email: string;
  employeeCode: string;
  designationName: string;
  departmentName: string;
  isTeaching: boolean;
  classificationConflict?: boolean;
  qualification?: string | null;
  isOnLeave?: boolean;
}

const teachingStaffCache = new Map<string, { data: CanonicalTeacher[]; expiresAt: number }>();

export async function invalidateTeachingStaffCache(schoolId?: string) {
  if (schoolId) {
    teachingStaffCache.delete(schoolId);
  } else {
    teachingStaffCache.clear();
  }
}

export async function getActiveApprovedLeaveStaffMap(
  schoolId: string,
  dateStr?: string,
  txClient?: any,
): Promise<Map<string, { endDate: string }>> {
  const targetDay = dateStr || new Date().toISOString().slice(0, 10);
  const startOfDay = new Date(`${targetDay}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDay}T23:59:59.999Z`);

  const runner = async (tx: any) => {
    if (typeof tx?.query?.leaveRequests?.findMany !== "function") {
      return new Map<string, { endDate: string }>();
    }
    const approvedLeaves = await tx.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.schoolId, schoolId),
        eq(leaveRequests.status, "HR_APPROVED"),
        lte(leaveRequests.startDate, endOfDay),
        gte(leaveRequests.endDate, startOfDay),
      ),
      columns: {
        staffId: true,
        endDate: true,
      },
    });

    const map = new Map<string, { endDate: string }>();
    for (const lr of approvedLeaves) {
      if (lr.staffId) {
        map.set(lr.staffId, {
          endDate: lr.endDate ? new Date(lr.endDate).toISOString().slice(0, 10) : targetDay,
        });
      }
    }
    return map;
  };

  try {
    if (txClient) return await runner(txClient);
    return await withTenant(schoolId, runner);
  } catch {
    return new Map();
  }
}

export async function getCanonicalTeachingStaff(schoolId: string): Promise<CanonicalTeacher[]> {
  try {
    const now = Date.now();
    const cached = teachingStaffCache.get(schoolId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const teachingFaculty: CanonicalTeacher[] = await withTenant(schoolId, async (tx) => {
      // Run staff list, teacher role lookup, and active approved leaves in parallel inside tenant context
      const [staffList, teacherRole, leaveMap] = await Promise.all([
        tx.query.staff.findMany({
          where: and(eq(staff.schoolId, schoolId), eq(staff.isActive, true)),
          with: {
            designation: true,
            department: true,
            user: true,
          },
          orderBy: [desc(staff.createdAt)],
        }),
        tx.query.roles.findFirst({
          where: and(eq(roles.schoolId, schoolId), eq(roles.name, "TEACHER")),
        }),
        getActiveApprovedLeaveStaffMap(schoolId, undefined, tx),
      ]);

      const faculty: CanonicalTeacher[] = staffList
        .filter((s) => s.designation?.isTeaching && s.user && s.user.isActive)
        .map((s) => {
          const first = decryptData(s.firstNameEncrypted) || "Faculty";
          const last = decryptData(s.lastNameEncrypted) || "";
          const email = decryptData(s.emailEncrypted) || s.user?.email || "";
          const onLeave = leaveMap.has(s.id);
          return {
            id: s.userId!, // users.id for AMS foreign keys
            staffId: s.id,
            name: `${first} ${last}`.trim(),
            email,
            employeeCode: s.employeeCode,
            designationName: s.designation?.name || "Teacher",
            departmentName: s.department?.name || "—",
            isTeaching: true,
            classificationConflict: false,
            ...(s.qualification ? { qualification: s.qualification } : {}),
            ...(onLeave ? { isOnLeave: true } : {}),
          };
        });

      // Also support fallback teacher accounts in seed/tests that do not have staff profiles,
      // or staff holding authoritative TEACHER role whose designation is marked isTeaching=false (S14-F01)
      const teachingUserIds = new Set(faculty.map((t) => t.id));

      if (teacherRole) {
        const assignedUserRoles = await tx.query.userRoles.findMany({
          where: and(eq(userRoles.schoolId, schoolId), eq(userRoles.roleId, teacherRole.id)),
          with: { user: true },
        });

        for (const ur of assignedUserRoles) {
          if (ur.user && ur.user.isActive && !teachingUserIds.has(ur.userId)) {
            const linkedStaff = staffList.find((s) => s.userId === ur.userId);
            const hasConflict = linkedStaff && !linkedStaff.designation?.isTeaching;

            let name = ur.user.email.split("@")[0] ?? "Teacher";
            let email = ur.user.email;
            let employeeCode = "FACULTY";
            let designationName = "Teacher";
            let departmentName = "Academics";
            let staffId = "";
            let qualification: string | null | undefined;
            let onLeave = false;

            if (linkedStaff) {
              staffId = linkedStaff.id;
              const first = decryptData(linkedStaff.firstNameEncrypted) || "Faculty";
              const last = decryptData(linkedStaff.lastNameEncrypted) || "";
              name = `${first} ${last}`.trim();
              email = decryptData(linkedStaff.emailEncrypted) || linkedStaff.user?.email || ur.user.email;
              employeeCode = linkedStaff.employeeCode || "FACULTY";
              designationName = linkedStaff.designation?.name || "Teacher";
              departmentName = linkedStaff.department?.name || "Academics";
              qualification = linkedStaff.qualification;
              onLeave = leaveMap.has(linkedStaff.id);
            }

            faculty.push({
              id: ur.user.id,
              staffId,
              name,
              email,
              employeeCode,
              designationName,
              departmentName,
              isTeaching: !hasConflict,
              classificationConflict: Boolean(hasConflict),
              ...(qualification ? { qualification } : {}),
              ...(onLeave ? { isOnLeave: true } : {}),
            });
            teachingUserIds.add(ur.user.id);
          }
        }
      }

      return faculty;
    });

    teachingStaffCache.set(schoolId, { data: teachingFaculty, expiresAt: now + 30_000 });
    return teachingFaculty;
  } catch (err) {
    console.error("Error in getCanonicalTeachingStaff:", err);
    return [];
  }
}

export async function getTeachingStaffAvailability(
  schoolId: string,
  dateStr?: string,
): Promise<Array<CanonicalTeacher & { isOnLeave: boolean; leaveEndDate?: string; qualification: string | null }>> {
  const [teachers, leaveMap] = await Promise.all([
    getCanonicalTeachingStaff(schoolId),
    getActiveApprovedLeaveStaffMap(schoolId, dateStr),
  ]);

  return teachers.map((t) => {
    const leaveInfo = t.staffId ? leaveMap.get(t.staffId) : undefined;
    const isOnLeave = Boolean(leaveInfo || t.isOnLeave);
    return {
      ...t,
      isOnLeave,
      ...(leaveInfo?.endDate ? { leaveEndDate: leaveInfo.endDate } : {}),
      qualification: t.qualification ?? null,
    };
  });
}
