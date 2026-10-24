import { db } from "@/db";
import { staff, roles, userRoles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
}

const teachingStaffCache = new Map<string, { data: CanonicalTeacher[]; expiresAt: number }>();

export async function invalidateTeachingStaffCache(schoolId?: string) {
  if (schoolId) {
    teachingStaffCache.delete(schoolId);
  } else {
    teachingStaffCache.clear();
  }
}

export async function getCanonicalTeachingStaff(schoolId: string): Promise<CanonicalTeacher[]> {
  try {
    const now = Date.now();
    const cached = teachingStaffCache.get(schoolId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    // Run staff list and teacher role lookup in parallel
    const [staffList, teacherRole] = await Promise.all([
      db.query.staff.findMany({
        where: and(eq(staff.schoolId, schoolId), eq(staff.isActive, true)),
        with: {
          designation: true,
          department: true,
          user: true,
        },
        orderBy: [desc(staff.createdAt)],
      }),
      db.query.roles.findFirst({
        where: and(eq(roles.schoolId, schoolId), eq(roles.name, "TEACHER")),
      }),
    ]);

    const teachingFaculty: CanonicalTeacher[] = staffList
      .filter((s) => s.designation?.isTeaching && s.user && s.user.isActive)
      .map((s) => {
        const first = decryptData(s.firstNameEncrypted) || "Faculty";
        const last = decryptData(s.lastNameEncrypted) || "";
        const email = decryptData(s.emailEncrypted) || s.user?.email || "";
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
        };
      });

    // Also support fallback teacher accounts in seed/tests that do not have staff profiles,
    // or staff holding authoritative TEACHER role whose designation is marked isTeaching=false (S14-F01)
    const teachingUserIds = new Set(teachingFaculty.map((t) => t.id));

    if (teacherRole) {
      const assignedUserRoles = await db.query.userRoles.findMany({
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

          if (linkedStaff) {
            staffId = linkedStaff.id;
            const first = decryptData(linkedStaff.firstNameEncrypted) || "Faculty";
            const last = decryptData(linkedStaff.lastNameEncrypted) || "";
            name = `${first} ${last}`.trim();
            email = decryptData(linkedStaff.emailEncrypted) || linkedStaff.user?.email || ur.user.email;
            employeeCode = linkedStaff.employeeCode || "FACULTY";
            designationName = linkedStaff.designation?.name || "Teacher";
            departmentName = linkedStaff.department?.name || "Academics";
          }

          teachingFaculty.push({
            id: ur.user.id,
            staffId,
            name,
            email,
            employeeCode,
            designationName,
            departmentName,
            isTeaching: !hasConflict,
            classificationConflict: Boolean(hasConflict),
          });
          teachingUserIds.add(ur.user.id);
        }
      }
    }

    teachingStaffCache.set(schoolId, { data: teachingFaculty, expiresAt: now + 30_000 });
    return teachingFaculty;
  } catch (err) {
    console.error("Error in getCanonicalTeachingStaff:", err);
    return [];
  }
}
