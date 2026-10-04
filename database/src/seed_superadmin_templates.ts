import "dotenv/config";
import { db } from "./index";
import {
  superAdminUsers,
  globalTemplateProfiles,
  globalTemplateAcademicYears,
  globalTemplateClasses,
  globalTemplateSubjects,
  globalTemplateFeeHeads,
  globalTemplateSalaryGrades,
  globalTemplateHolidays,
  globalTemplateRoles,
} from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🌱 Seeding Global Template Profiles and Entity Bundles...");

  // 1. Get or ensure superadmin user
  const [superAdmin] = await db.select().from(superAdminUsers).limit(1);
  if (!superAdmin) {
    console.error("❌ No Super Admin user found! Please run manage_super_admin.ts first.");
    process.exit(1);
  }

  const superAdminId = superAdmin.id;
  console.log(`Using Super Admin: ${superAdmin.email} (${superAdminId})`);

  // 2. Define the Profiles
  const profilesData = [
    {
      board: "CBSE" as const,
      schoolType: "SECONDARY" as const,
      displayName: "CBSE Secondary (Classes 1 - 10)",
      description: "Standard Central Board of Secondary Education curriculum template for classes 1 through 10 with NCERT aligned subjects, term system, and fee structure.",
      classes: [
        { name: "Class 1", numericLevel: 1, gradeLevel: "CLASS_1" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 1 },
        { name: "Class 2", numericLevel: 2, gradeLevel: "CLASS_2" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 2 },
        { name: "Class 3", numericLevel: 3, gradeLevel: "CLASS_3" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 3 },
        { name: "Class 4", numericLevel: 4, gradeLevel: "CLASS_4" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 4 },
        { name: "Class 5", numericLevel: 5, gradeLevel: "CLASS_5" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 5 },
        { name: "Class 6", numericLevel: 6, gradeLevel: "CLASS_6" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 6 },
        { name: "Class 7", numericLevel: 7, gradeLevel: "CLASS_7" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 7 },
        { name: "Class 8", numericLevel: 8, gradeLevel: "CLASS_8" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 8 },
        { name: "Class 9", numericLevel: 9, gradeLevel: "CLASS_9" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 9 },
        { name: "Class 10", numericLevel: 10, gradeLevel: "CLASS_10" as const, streams: [], defaultSections: ["A", "B"], sortOrder: 10 },
      ],
      subjects: [
        { name: "English Language & Literature", code: "ENG", subjectType: "LANGUAGE" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Hindi / Regional Language", code: "HIN", subjectType: "LANGUAGE" as const, weeklyPeriods: 5, isOptional: false },
        { name: "Mathematics", code: "MATH", subjectType: "THEORY" as const, weeklyPeriods: 7, isOptional: false },
        { name: "Science & Technology", code: "SCI", subjectType: "THEORY" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Social Science", code: "SST", subjectType: "THEORY" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Information Technology", code: "IT", subjectType: "PRACTICAL" as const, weeklyPeriods: 3, isOptional: true },
        { name: "Art & Physical Education", code: "PET", subjectType: "ACTIVITY" as const, weeklyPeriods: 4, isOptional: false },
      ],
      feeHeads: [
        { name: "Tuition Fee", headType: "TUITION" as const, isMandatory: true, frequency: "MONTHLY" as const, sortOrder: 1 },
        { name: "Admission & Registration Fee", headType: "ADMISSION" as const, isMandatory: true, frequency: "ONE_TIME" as const, sortOrder: 2 },
        { name: "Computer & Smart Class Fee", headType: "LAB" as const, isMandatory: true, frequency: "QUARTERLY" as const, sortOrder: 3 },
        { name: "Examination & Assessment Fee", headType: "EXAM" as const, isMandatory: true, frequency: "QUARTERLY" as const, sortOrder: 4 },
        { name: "Library & Learning Resource Fee", headType: "LIBRARY" as const, isMandatory: false, frequency: "ANNUAL" as const, sortOrder: 5 },
        { name: "Sports & Development Fee", headType: "MISCELLANEOUS" as const, isMandatory: false, frequency: "ANNUAL" as const, sortOrder: 6 },
      ],
      salaryGrades: [
        { gradeName: "PGT (Post Graduate Teacher)", basicSalary: 4500000, hraPercent: "20.00", daPercent: "15.00", pfPercent: "12.00", otherAllowances: { medical: 1500, transport: 2000 } },
        { gradeName: "TGT (Trained Graduate Teacher)", basicSalary: 3500000, hraPercent: "18.00", daPercent: "15.00", pfPercent: "12.00", otherAllowances: { medical: 1200, transport: 1500 } },
        { gradeName: "PRT (Primary Teacher)", basicSalary: 2800000, hraPercent: "15.00", daPercent: "12.00", pfPercent: "12.00", otherAllowances: { medical: 1000, transport: 1000 } },
        { gradeName: "NTT / Pre-Primary Educator", basicSalary: 2200000, hraPercent: "15.00", daPercent: "10.00", pfPercent: "12.00", otherAllowances: { medical: 1000 } },
        { gradeName: "Administrative & Support Staff", basicSalary: 2000000, hraPercent: "12.00", daPercent: "10.00", pfPercent: "12.00", otherAllowances: { medical: 800 } },
      ],
      holidays: [
        { name: "Republic Day", month: 1, day: 26, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "Independence Day", month: 8, day: 15, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "Gandhi Jayanti", month: 10, day: 2, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "National Science Day", month: 2, day: 28, isFixedAnnual: true, holidayType: "REGIONAL" as const },
        { name: "Children's Day", month: 11, day: 14, isFixedAnnual: true, holidayType: "REGIONAL" as const },
      ],
    },
    {
      board: "CBSE" as const,
      schoolType: "PRIMARY" as const,
      displayName: "CBSE Primary (Nursery - Class 5)",
      description: "Early childhood and foundational primary school blueprint with experiential learning focus.",
      classes: [
        { name: "Nursery", numericLevel: -2, gradeLevel: "NURSERY" as const, streams: [], defaultSections: ["A"], sortOrder: 1 },
        { name: "LKG", numericLevel: -1, gradeLevel: "LKG" as const, streams: [], defaultSections: ["A"], sortOrder: 2 },
        { name: "UKG", numericLevel: 0, gradeLevel: "UKG" as const, streams: [], defaultSections: ["A"], sortOrder: 3 },
        { name: "Class 1", numericLevel: 1, gradeLevel: "CLASS_1" as const, streams: [], defaultSections: ["A"], sortOrder: 4 },
        { name: "Class 2", numericLevel: 2, gradeLevel: "CLASS_2" as const, streams: [], defaultSections: ["A"], sortOrder: 5 },
        { name: "Class 3", numericLevel: 3, gradeLevel: "CLASS_3" as const, streams: [], defaultSections: ["A"], sortOrder: 6 },
        { name: "Class 4", numericLevel: 4, gradeLevel: "CLASS_4" as const, streams: [], defaultSections: ["A"], sortOrder: 7 },
        { name: "Class 5", numericLevel: 5, gradeLevel: "CLASS_5" as const, streams: [], defaultSections: ["A"], sortOrder: 8 },
      ],
      subjects: [
        { name: "English Phonics & Reading", code: "ENG_PRI", subjectType: "LANGUAGE" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Environmental Studies (EVS)", code: "EVS", subjectType: "THEORY" as const, weeklyPeriods: 5, isOptional: false },
        { name: "Basic Mathematics", code: "MATH_PRI", subjectType: "THEORY" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Art, Craft & Discovery", code: "ART_CRAFT", subjectType: "ACTIVITY" as const, weeklyPeriods: 5, isOptional: false },
        { name: "Physical Movement & Games", code: "GAMES", subjectType: "ACTIVITY" as const, weeklyPeriods: 4, isOptional: false },
      ],
      feeHeads: [
        { name: "Tuition Fee", headType: "TUITION" as const, isMandatory: true, frequency: "MONTHLY" as const, sortOrder: 1 },
        { name: "Activity & Play-Kit Fee", headType: "MISCELLANEOUS" as const, isMandatory: true, frequency: "QUARTERLY" as const, sortOrder: 2 },
        { name: "Daycare & Caretaker Fee", headType: "MISCELLANEOUS" as const, isMandatory: false, frequency: "MONTHLY" as const, sortOrder: 3 },
      ],
      salaryGrades: [
        { gradeName: "PRT (Primary Teacher)", basicSalary: 2800000, hraPercent: "15.00", daPercent: "12.00", pfPercent: "12.00", otherAllowances: {} },
        { gradeName: "NTT (Nursery Trained Teacher)", basicSalary: 2200000, hraPercent: "15.00", daPercent: "10.00", pfPercent: "12.00", otherAllowances: {} },
      ],
      holidays: [
        { name: "Republic Day", month: 1, day: 26, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "Independence Day", month: 8, day: 15, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "Gandhi Jayanti", month: 10, day: 2, isFixedAnnual: true, holidayType: "NATIONAL" as const },
      ],
    },
    {
      board: "ICSE" as const,
      schoolType: "SECONDARY" as const,
      displayName: "ICSE Secondary (Grades 1 - 10)",
      description: "Rigorous Council for the Indian School Certificate Examinations blueprint with enhanced science lab and English literature curricula.",
      classes: [
        { name: "Grade 1", numericLevel: 1, gradeLevel: "CLASS_1" as const, streams: [], defaultSections: ["A"], sortOrder: 1 },
        { name: "Grade 2", numericLevel: 2, gradeLevel: "CLASS_2" as const, streams: [], defaultSections: ["A"], sortOrder: 2 },
        { name: "Grade 3", numericLevel: 3, gradeLevel: "CLASS_3" as const, streams: [], defaultSections: ["A"], sortOrder: 3 },
        { name: "Grade 4", numericLevel: 4, gradeLevel: "CLASS_4" as const, streams: [], defaultSections: ["A"], sortOrder: 4 },
        { name: "Grade 5", numericLevel: 5, gradeLevel: "CLASS_5" as const, streams: [], defaultSections: ["A"], sortOrder: 5 },
        { name: "Grade 6", numericLevel: 6, gradeLevel: "CLASS_6" as const, streams: [], defaultSections: ["A"], sortOrder: 6 },
        { name: "Grade 7", numericLevel: 7, gradeLevel: "CLASS_7" as const, streams: [], defaultSections: ["A"], sortOrder: 7 },
        { name: "Grade 8", numericLevel: 8, gradeLevel: "CLASS_8" as const, streams: [], defaultSections: ["A"], sortOrder: 8 },
        { name: "Grade 9", numericLevel: 9, gradeLevel: "CLASS_9" as const, streams: [], defaultSections: ["A"], sortOrder: 9 },
        { name: "Grade 10", numericLevel: 10, gradeLevel: "CLASS_10" as const, streams: [], defaultSections: ["A"], sortOrder: 10 },
      ],
      subjects: [
        { name: "English Language", code: "ENG_LANG", subjectType: "LANGUAGE" as const, weeklyPeriods: 5, isOptional: false },
        { name: "English Literature", code: "ENG_LIT", subjectType: "LANGUAGE" as const, weeklyPeriods: 5, isOptional: false },
        { name: "Mathematics", code: "MATH_ICSE", subjectType: "THEORY" as const, weeklyPeriods: 7, isOptional: false },
        { name: "Physics", code: "PHY", subjectType: "THEORY" as const, weeklyPeriods: 4, isOptional: false },
        { name: "Chemistry", code: "CHEM", subjectType: "THEORY" as const, weeklyPeriods: 4, isOptional: false },
        { name: "Biology", code: "BIO", subjectType: "THEORY" as const, weeklyPeriods: 4, isOptional: false },
        { name: "History & Civics", code: "HIST", subjectType: "THEORY" as const, weeklyPeriods: 4, isOptional: false },
        { name: "Geography", code: "GEO", subjectType: "THEORY" as const, weeklyPeriods: 4, isOptional: false },
        { name: "Computer Applications", code: "COMP_APP", subjectType: "PRACTICAL" as const, weeklyPeriods: 4, isOptional: true },
      ],
      feeHeads: [
        { name: "Tuition Fee", headType: "TUITION" as const, isMandatory: true, frequency: "MONTHLY" as const, sortOrder: 1 },
        { name: "Science & Computer Laboratory Fee", headType: "LAB" as const, isMandatory: true, frequency: "QUARTERLY" as const, sortOrder: 2 },
        { name: "ICSE Registration & Exam Fee", headType: "EXAM" as const, isMandatory: true, frequency: "ANNUAL" as const, sortOrder: 3 },
      ],
      salaryGrades: [
        { gradeName: "Senior ICSE Faculty", basicSalary: 5000000, hraPercent: "20.00", daPercent: "15.00", pfPercent: "12.00", otherAllowances: {} },
        { gradeName: "Middle School Teacher", basicSalary: 3800000, hraPercent: "18.00", daPercent: "15.00", pfPercent: "12.00", otherAllowances: {} },
      ],
      holidays: [
        { name: "Republic Day", month: 1, day: 26, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "Independence Day", month: 8, day: 15, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "Gandhi Jayanti", month: 10, day: 2, isFixedAnnual: true, holidayType: "NATIONAL" as const },
      ],
    },
    {
      board: "STATE_BOARD" as const,
      schoolType: "SECONDARY" as const,
      displayName: "State Board Secondary (Classes 1 - 10)",
      description: "State Board curriculum standard template with dual language focus and regional exam compliance.",
      classes: [
        { name: "Class 1", numericLevel: 1, gradeLevel: "CLASS_1" as const, streams: [], defaultSections: ["A"], sortOrder: 1 },
        { name: "Class 5", numericLevel: 5, gradeLevel: "CLASS_5" as const, streams: [], defaultSections: ["A"], sortOrder: 5 },
        { name: "Class 10", numericLevel: 10, gradeLevel: "CLASS_10" as const, streams: [], defaultSections: ["A"], sortOrder: 10 },
      ],
      subjects: [
        { name: "First Language (Regional)", code: "L1_REG", subjectType: "LANGUAGE" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Second Language (English)", code: "L2_ENG", subjectType: "LANGUAGE" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Mathematics", code: "MATH_SB", subjectType: "THEORY" as const, weeklyPeriods: 7, isOptional: false },
        { name: "General Science", code: "GEN_SCI", subjectType: "THEORY" as const, weeklyPeriods: 6, isOptional: false },
        { name: "Social Studies", code: "SOC_STD", subjectType: "THEORY" as const, weeklyPeriods: 5, isOptional: false },
      ],
      feeHeads: [
        { name: "Tuition Fee", headType: "TUITION" as const, isMandatory: true, frequency: "MONTHLY" as const, sortOrder: 1 },
        { name: "Examination Fee", headType: "EXAM" as const, isMandatory: true, frequency: "QUARTERLY" as const, sortOrder: 2 },
      ],
      salaryGrades: [
        { gradeName: "State Scale High School Teacher", basicSalary: 3400000, hraPercent: "15.00", daPercent: "15.00", pfPercent: "12.00", otherAllowances: {} },
      ],
      holidays: [
        { name: "Republic Day", month: 1, day: 26, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "Independence Day", month: 8, day: 15, isFixedAnnual: true, holidayType: "NATIONAL" as const },
        { name: "State Formation Day", month: 11, day: 1, isFixedAnnual: true, holidayType: "REGIONAL" as const },
      ],
    },
  ];

  for (const p of profilesData) {
    console.log(`\n📦 Processing Template Profile: ${p.displayName}...`);

    // Check if profile exists
    const [existing] = await db
      .select()
      .from(globalTemplateProfiles)
      .where(
        eq(globalTemplateProfiles.displayName, p.displayName)
      );

    let profileId = existing?.id;

    if (!existing) {
      const [newProfile] = await db
        .insert(globalTemplateProfiles)
        .values({
          board: p.board,
          schoolType: p.schoolType,
          displayName: p.displayName,
          description: p.description,
          isActive: true,
          createdBy: superAdminId,
        })
        .returning();
      if (newProfile) {
        profileId = newProfile.id;
        console.log(`  ✓ Created Profile: ${newProfile.id}`);
      }
    } else {
      console.log(`  ℹ Profile already exists (${profileId})`);
    }

    if (!profileId) continue;

    // Academic Year Cycle
    const [existingAy] = await db.select().from(globalTemplateAcademicYears).where(eq(globalTemplateAcademicYears.profileId, profileId));
    if (!existingAy) {
      await db.insert(globalTemplateAcademicYears).values({
        profileId,
        name: "Standard Indian Academic Cycle (April - March)",
        startMonth: 4, // April
        endMonth: 3,   // March
        terms: [
          { name: "Term 1 (Summer/Monsoon)", startMonth: 4, endMonth: 9 },
          { name: "Term 2 (Autumn/Winter)", startMonth: 10, endMonth: 3 },
        ],
      });
      console.log("  ✓ Seeded Academic Year template");
    }

    // Classes
    const [classCount] = await db.select().from(globalTemplateClasses).where(eq(globalTemplateClasses.profileId, profileId)).limit(1);
    if (!classCount) {
      for (const c of p.classes) {
        await db
          .insert(globalTemplateClasses)
          .values({
            profileId,
            name: c.name,
            numericLevel: c.numericLevel,
            gradeLevel: c.gradeLevel,
            streams: c.streams,
            defaultSections: c.defaultSections,
            sortOrder: c.sortOrder,
          });
      }
      console.log(`  ✓ Seeded ${p.classes.length} classes`);
    }

    // Subjects
    const [subjectCount] = await db.select().from(globalTemplateSubjects).where(eq(globalTemplateSubjects.profileId, profileId)).limit(1);
    if (!subjectCount) {
      for (const s of p.subjects) {
        await db.insert(globalTemplateSubjects).values({
          profileId,
          name: s.name,
          code: s.code,
          subjectType: s.subjectType,
          weeklyPeriods: s.weeklyPeriods,
          isOptional: s.isOptional,
        });
      }
      console.log(`  ✓ Seeded ${p.subjects.length} subjects`);
    }

    // Fee Heads
    const [feeCount] = await db.select().from(globalTemplateFeeHeads).where(eq(globalTemplateFeeHeads.profileId, profileId)).limit(1);
    if (!feeCount) {
      for (const f of p.feeHeads) {
        await db.insert(globalTemplateFeeHeads).values({
          profileId,
          name: f.name,
          headType: f.headType,
          isMandatory: f.isMandatory,
          frequency: f.frequency,
          sortOrder: f.sortOrder,
        });
      }
      console.log(`  ✓ Seeded ${p.feeHeads.length} fee heads`);
    }

    // Salary Grades
    const [salaryCount] = await db.select().from(globalTemplateSalaryGrades).where(eq(globalTemplateSalaryGrades.profileId, profileId)).limit(1);
    if (!salaryCount) {
      for (const sg of p.salaryGrades) {
        await db.insert(globalTemplateSalaryGrades).values({
          profileId,
          gradeName: sg.gradeName,
          basicSalary: sg.basicSalary,
          hraPercent: Math.round(Number(sg.hraPercent)),
          daPercent: Math.round(Number(sg.daPercent)),
          pfPercent: Math.round(Number(sg.pfPercent)),
          otherAllowances: sg.otherAllowances,
        });
      }
      console.log(`  ✓ Seeded ${p.salaryGrades.length} salary grades`);
    }

    // Holidays
    const [holidayCount] = await db.select().from(globalTemplateHolidays).where(eq(globalTemplateHolidays.profileId, profileId)).limit(1);
    if (!holidayCount) {
      for (const h of p.holidays) {
        await db.insert(globalTemplateHolidays).values({
          profileId,
          name: h.name,
          month: h.month,
          day: h.day,
          isFixedAnnual: h.isFixedAnnual,
          holidayType: h.holidayType,
        });
      }
      console.log(`  ✓ Seeded ${p.holidays.length} holidays`);
    }

    // Default Roles
    const [roleCount] = await db.select().from(globalTemplateRoles).where(eq(globalTemplateRoles.profileId, profileId)).limit(1);
    if (!roleCount) {
      const defaultRoles = [
        { roleName: "SCHOOL_ADMIN" as const, displayName: "School Administrator" },
        { roleName: "PRINCIPAL" as const, displayName: "Principal / Academic Head" },
        { roleName: "HR_MANAGER" as const, displayName: "HR & Payroll Manager" },
        { roleName: "TEACHER" as const, displayName: "Teaching Faculty" },
        { roleName: "ACCOUNTANT" as const, displayName: "Finance & Accounts Officer" },
        { roleName: "LIBRARIAN" as const, displayName: "Chief Librarian" },
        { roleName: "TRANSPORT_MANAGER" as const, displayName: "Transport Incharge" },
        { roleName: "DRIVER" as const, displayName: "School Bus Driver" },
        { roleName: "PARENT" as const, displayName: "Parent / Guardian" },
        { roleName: "STUDENT" as const, displayName: "Enrolled Student" },
      ];
      for (const r of defaultRoles) {
        await db.insert(globalTemplateRoles).values({
          profileId,
          roleName: r.roleName,
          displayName: r.displayName,
          defaultPermissions: [],
        });
      }
      console.log(`  ✓ Seeded 10 default roles`);
    }
  }

  console.log("\n🎉 All Global Template Profiles & Entity Bundles seeded successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
