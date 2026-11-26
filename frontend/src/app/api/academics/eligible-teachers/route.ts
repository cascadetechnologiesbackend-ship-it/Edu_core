import { NextResponse } from "next/server";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getTeachingStaffAvailability } from "@/app/(admin)/hr/teachingStaff";
import { AcademicBlockKey } from "@/components/academics/AcademicBlockTabs";
import { withTenant } from "@/db";
import { subjects } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface EligibleTeacher {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  departmentName: string;
  designationName: string;
  qualification?: string | null;
  isOnLeave: boolean;
  leaveEndDate?: string;
  isRecommended: boolean;
  outOfSubjectMatch: boolean;
  matchReason?: string;
}

const SUBJECT_SYNONYMS: Array<{ test: RegExp; matchers: RegExp }> = [
  { test: /\b(math|maths|mathematics)\b/i, matchers: /\b(math|maths|mathematics|msc\s*math|b\.?sc.*math)\b/i },
  { test: /\b(sci|science|general science|evs)\b/i, matchers: /\b(sci|science|physics|chemistry|biology|evs|b\.?sc|m\.?sc)\b/i },
  { test: /\b(phy|physics)\b/i, matchers: /\b(phy|physics|science)\b/i },
  { test: /\b(chem|chemistry)\b/i, matchers: /\b(chem|chemistry|science)\b/i },
  { test: /\b(bio|biology|botany|zoology)\b/i, matchers: /\b(bio|biology|botany|zoology|life science|science)\b/i },
  { test: /\b(eng|english|literature)\b/i, matchers: /\b(eng|english|literature|elt)\b/i },
  { test: /\b(hin|hindi)\b/i, matchers: /\b(hin|hindi|sanskrit)\b/i },
  { test: /\b(skt|sanskrit)\b/i, matchers: /\b(skt|sanskrit|hindi)\b/i },
  { test: /\b(sst|social|history|geography|civics|political)\b/i, matchers: /\b(sst|social|history|geography|civics|political|humanities)\b/i },
  { test: /\b(comp|cs|computer|informatics|it)\b/i, matchers: /\b(comp|cs|computer|informatics|mca|bca|b\.?tech|it)\b/i },
  { test: /\b(acc|accountancy|commerce|business|bst|economics|eco)\b/i, matchers: /\b(acc|accountancy|commerce|business|economics|b\.?com|m\.?com)\b/i },
  { test: /\b(pe|ped|physical|sports|yoga)\b/i, matchers: /\b(pe|ped|physical|sports|b\.?p\.?ed|m\.?p\.?ed|yoga)\b/i },
  { test: /\b(art|drawing|craft|music|dance)\b/i, matchers: /\b(art|fine art|drawing|craft|music|dance)\b/i },
];

function matchesSubjectQualification(
  subject: { name: string; code: string },
  teacherMeta: string,
): boolean {
  const subjText = `${subject.name} ${subject.code}`.toLowerCase();
  const normMeta = teacherMeta.toLowerCase();

  for (const syn of SUBJECT_SYNONYMS) {
    if (syn.test.test(subjText)) {
      if (syn.matchers.test(normMeta)) {
        return true;
      }
    }
  }

  // Fallback token match on subject name/code tokens >= 3 chars
  const tokens = subjText
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3 && !["the", "and", "for", "sub"].includes(tok));

  return tokens.some((tok) => normMeta.includes(tok));
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "HR_MANAGER", "TEACHER"] as const);
    const school = await requireSchool(ctx);

    const { searchParams } = new URL(request.url);
    const classBlock = (searchParams.get("class_block") || "all") as AcademicBlockKey;
    const subjectId = searchParams.get("subject_id");

    // Fetch canonical teaching faculty with leave availability & qualifications
    const [allTeachers, subjectRecord] = await Promise.all([
      getTeachingStaffAvailability(school.id),
      subjectId
        ? withTenant(school.id, async (tx) =>
            tx.query.subjects.findFirst({
              where: and(eq(subjects.id, subjectId), eq(subjects.schoolId, school.id)),
              columns: { id: true, name: true, code: true },
            }),
          )
        : Promise.resolve(null),
    ]);

    // Patterns for block-specific department/designation matching
    const PRE_PRIMARY_REGEX = /pre-primary|pre primary|nursery|lkg|ukg|kindergarten|early childhood|playgroup|pp1|pp2/i;
    const PRIMARY_REGEX = /primary|elementary|class 1|class 2|class 3|class 4|class 5/i;
    const MIDDLE_REGEX = /middle|junior high|class 6|class 7|class 8/i;
    const HIGH_SCHOOL_REGEX = /high school|secondary|senior|class 9|class 10|board/i;
    const SENIOR_SPECIALIST_REGEX = /high school|secondary|senior secondary|physics|chemistry|biology|higher math/i;

    let prePrimaryCount = 0;

    const evaluatedTeachers: EligibleTeacher[] = allTeachers.map((t) => {
      const blockMeta = `${t.departmentName} ${t.designationName}`.toLowerCase();
      const qualMeta = `${t.qualification || ""} ${t.departmentName} ${t.designationName}`.toLowerCase();

      let blockRecommended = classBlock === "all";
      let blockReason = classBlock === "all" ? "General Faculty" : "School Faculty";

      if (classBlock === "pre_primary") {
        if (PRE_PRIMARY_REGEX.test(blockMeta)) {
          blockRecommended = true;
          blockReason = "Pre-Primary Faculty Specialist";
          prePrimaryCount++;
        } else if (PRIMARY_REGEX.test(blockMeta) && !SENIOR_SPECIALIST_REGEX.test(blockMeta)) {
          blockRecommended = true;
          blockReason = "Primary & Foundational Staff";
        }
      } else if (classBlock === "primary") {
        if (PRIMARY_REGEX.test(blockMeta)) {
          blockRecommended = true;
          blockReason = "Primary School Faculty";
        }
      } else if (classBlock === "middle_school") {
        if (MIDDLE_REGEX.test(blockMeta)) {
          blockRecommended = true;
          blockReason = "Middle School Faculty";
        }
      } else if (classBlock === "high_school") {
        if (HIGH_SCHOOL_REGEX.test(blockMeta) || SENIOR_SPECIALIST_REGEX.test(blockMeta)) {
          blockRecommended = true;
          blockReason = "High School & Board Subject Specialist";
        }
      }

      let subjectMatched = true;
      let outOfSubjectMatch = false;
      let matchReason = blockReason;

      if (subjectRecord) {
        subjectMatched = matchesSubjectQualification(subjectRecord, qualMeta);
        outOfSubjectMatch = !subjectMatched;
        if (subjectMatched) {
          matchReason =
            classBlock === "all"
              ? `Subject Match (${subjectRecord.name})`
              : `${blockReason} · Subject Match (${subjectRecord.name})`;
        } else {
          matchReason = `Out-of-subject match (${t.departmentName || t.designationName}; override reason recommended)`;
        }
      }

      if (t.isOnLeave) {
        matchReason = `${matchReason} · On approved leave${t.leaveEndDate ? ` until ${t.leaveEndDate}` : ""}`;
      }

      const isRecommended = !t.isOnLeave && (classBlock === "all" ? subjectMatched : blockRecommended && subjectMatched);

      return {
        id: t.id,
        name: t.name,
        email: t.email,
        employeeCode: t.employeeCode,
        departmentName: t.departmentName,
        designationName: t.designationName,
        qualification: t.qualification ?? null,
        isOnLeave: t.isOnLeave,
        ...(t.leaveEndDate ? { leaveEndDate: t.leaveEndDate } : {}),
        isRecommended,
        outOfSubjectMatch,
        matchReason,
      };
    });

    // If pre_primary is requested and tagged pre-primary teachers exist, filter out senior high school specialists
    let filteredTeachers = evaluatedTeachers;
    if (classBlock === "pre_primary" && prePrimaryCount > 0) {
      filteredTeachers = evaluatedTeachers.filter((t) => {
        const meta = `${t.departmentName} ${t.designationName}`.toLowerCase();
        return !SENIOR_SPECIALIST_REGEX.test(meta) || t.isRecommended;
      });
    }

    // Sort: available & recommended first, then available, then on-leave
    filteredTeachers.sort((a, b) => {
      if (a.isOnLeave !== b.isOnLeave) return a.isOnLeave ? 1 : -1;
      if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
      if (a.outOfSubjectMatch !== b.outOfSubjectMatch) return a.outOfSubjectMatch ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      count: filteredTeachers.length,
      subject: subjectRecord ? { id: subjectRecord.id, name: subjectRecord.name, code: subjectRecord.code } : null,
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
