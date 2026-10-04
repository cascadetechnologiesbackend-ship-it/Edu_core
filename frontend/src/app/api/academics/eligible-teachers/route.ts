import { NextResponse } from "next/server";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getCanonicalTeachingStaff, CanonicalTeacher } from "@/app/(admin)/hr/teachingStaff";
import { AcademicBlockKey } from "@/components/academics/AcademicBlockTabs";

export interface EligibleTeacher {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  departmentName: string;
  designationName: string;
  isRecommended: boolean;
  matchReason?: string;
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "HR_MANAGER", "TEACHER"] as const);
    const school = await requireSchool(ctx);

    const { searchParams } = new URL(request.url);
    const classBlock = (searchParams.get("class_block") || "all") as AcademicBlockKey;
    const subjectId = searchParams.get("subject_id");

    // Fetch canonical teaching faculty for the school
    const allTeachers = await getCanonicalTeachingStaff(school.id);

    // If no block filter is requested or "all", return full canonical staff list marked as recommended
    if (classBlock === "all") {
      const response: EligibleTeacher[] = allTeachers.map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        employeeCode: t.employeeCode,
        departmentName: t.departmentName,
        designationName: t.designationName,
        isRecommended: true,
        matchReason: "General Faculty",
      }));

      return NextResponse.json({
        success: true,
        count: response.length,
        teachers: response,
      });
    }

    // Patterns for block-specific department/designation matching
    const PRE_PRIMARY_REGEX = /pre-primary|pre primary|nursery|lkg|ukg|kindergarten|early childhood|playgroup|pp1|pp2/i;
    const PRIMARY_REGEX = /primary|elementary|class 1|class 2|class 3|class 4|class 5/i;
    const MIDDLE_REGEX = /middle|junior high|class 6|class 7|class 8/i;
    const HIGH_SCHOOL_REGEX = /high school|secondary|senior|class 9|class 10|board/i;

    const SENIOR_SPECIALIST_REGEX = /high school|secondary|senior secondary|physics|chemistry|biology|higher math/i;

    let prePrimaryCount = 0;

    const evaluatedTeachers: EligibleTeacher[] = allTeachers.map((t) => {
      const combinedMeta = `${t.departmentName} ${t.designationName}`.toLowerCase();
      let isRecommended = false;
      let matchReason = "School Faculty";

      if (classBlock === "pre_primary") {
        if (PRE_PRIMARY_REGEX.test(combinedMeta)) {
          isRecommended = true;
          matchReason = "Pre-Primary Faculty Specialist";
          prePrimaryCount++;
        } else if (PRIMARY_REGEX.test(combinedMeta) && !SENIOR_SPECIALIST_REGEX.test(combinedMeta)) {
          isRecommended = true;
          matchReason = "Primary & Foundational Staff";
        }
      } else if (classBlock === "primary") {
        if (PRIMARY_REGEX.test(combinedMeta)) {
          isRecommended = true;
          matchReason = "Primary School Faculty";
        }
      } else if (classBlock === "middle_school") {
        if (MIDDLE_REGEX.test(combinedMeta)) {
          isRecommended = true;
          matchReason = "Middle School Faculty";
        }
      } else if (classBlock === "high_school") {
        if (HIGH_SCHOOL_REGEX.test(combinedMeta) || SENIOR_SPECIALIST_REGEX.test(combinedMeta)) {
          isRecommended = true;
          matchReason = "High School & Board Subject Specialist";
        }
      }

      return {
        id: t.id,
        name: t.name,
        email: t.email,
        employeeCode: t.employeeCode,
        departmentName: t.departmentName,
        designationName: t.designationName,
        isRecommended,
        matchReason,
      };
    });

    // If pre_primary is requested and tagged pre-primary teachers exist, strictly filter out senior high school specialists
    let filteredTeachers = evaluatedTeachers;
    if (classBlock === "pre_primary" && prePrimaryCount > 0) {
      filteredTeachers = evaluatedTeachers.filter((t) => {
        const meta = `${t.departmentName} ${t.designationName}`.toLowerCase();
        return !SENIOR_SPECIALIST_REGEX.test(meta) || t.isRecommended;
      });
    }

    // Sort so recommended teachers appear first
    filteredTeachers.sort((a, b) => {
      if (a.isRecommended === b.isRecommended) {
        return a.name.localeCompare(b.name);
      }
      return a.isRecommended ? -1 : 1;
    });

    return NextResponse.json({
      success: true,
      count: filteredTeachers.length,
      teachers: filteredTeachers,
    });
  } catch (err: any) {
    console.error("Error in GET /api/academics/eligible-teachers:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch eligible teachers" },
      { status: 500 }
    );
  }
}
