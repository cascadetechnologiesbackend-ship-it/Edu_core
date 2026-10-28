"use server";
// PUBLIC: Self-service tenant onboarding for prospective school administrators creating a new school instance.

import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  subjects,
  classSubjects,
  feeHeads,
  departments,
  designations,
  salaryTemplates,
  users,
  roles,
  userRoles,
  persons,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getCanonicalSortOrder } from "@/lib/academicOrdering";
import { encryptData, computeSearchHash } from "@/lib/encryption";
import { seedExamBoardDefaults } from "@/lib/examSeeding";
import { deriveClassGroupsFromClasses, SchoolBoard, GradingScale } from "@/lib/examBoardBlueprints";
import { normalizeProfessionalTaxState } from "@/lib/reference/indiaReferenceData";

export interface ClassSetupItem {
  gradeLevel: string;
  displayName: string;
  sections: string[]; // e.g. ["A", "B"]
  subjectCodes?: string[];
}

export interface SubjectSetupItem {
  name: string;
  code: string;
  subjectType: "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY";
  applicableClassGroups?: string[];
}

export interface FeeHeadSetupItem {
  name: string;
  code: string;
  category: "RECURRING" | "ONE_TIME" | "OPTIONAL";
  headType: "TUITION" | "ADMISSION" | "TRANSPORT" | "HOSTEL" | "LAB" | "LIBRARY" | "EXAM" | "EXAMINATION" | "MISCELLANEOUS";
  isRefundable?: boolean;
}

export interface ComprehensiveOnboardPayload {
  // 1. Session Setup
  academicYearLabel: string;
  startDate: string;
  endDate: string;

  // 2. School Profile
  schoolName: string;
  board: "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";
  udiseCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  principalName?: string;
  currencySymbol?: string;

  // 3. Classes & Sections
  classesSetup: ClassSetupItem[];

  // 4. Subjects
  subjectsSetup: SubjectSetupItem[];

  // 5. Fee Heads & Grading
  feeHeadsSetup: FeeHeadSetupItem[];
  gradingScale?: "CBSE_9_POINT" | "PERCENTAGE" | "GPA";
  loadExamDefaults?: boolean;

  // 6. Admin Credentials
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export type OnboardSchoolPayload = ComprehensiveOnboardPayload;

export async function registerSchoolTenant(payload: ComprehensiveOnboardPayload) {
  try {
    const {
      academicYearLabel = "2026-27",
      startDate = "2026-04-01",
      endDate = "2027-03-31",
      schoolName,
      board = "CBSE",
      udiseCode,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      principalName,
      currencySymbol = "₹",
      classesSetup = [],
      subjectsSetup = [],
      feeHeadsSetup = [],
      gradingScale,
      loadExamDefaults = true,
      adminName,
      adminEmail,
      adminPassword,
    } = payload;

    const validBoards: readonly SchoolBoard[] = ["CBSE", "ICSE", "STATE_BOARD", "IGCSE", "IB"];
    const resolvedBoard: SchoolBoard = validBoards.includes(board as any) ? (board as SchoolBoard) : "CBSE";
    const validScales: readonly GradingScale[] = ["CBSE_9_POINT", "PERCENTAGE", "GPA"];
    const resolvedScale: GradingScale | undefined = gradingScale && validScales.includes(gradingScale as any) ? gradingScale : undefined;

    if (!schoolName || !udiseCode || !adminEmail || !adminPassword) {
      return { success: false, message: "Required fields missing." };
    }

    // Check if school UDISE code already exists
    const existingSchool = await db.query.schools.findFirst({
      where: eq(schools.udiseCode, udiseCode),
    });
    if (existingSchool) {
      return {
        success: false,
        message: `School with UDISE code '${udiseCode}' is already registered.`,
      };
    }

    // Execute atomic provisioning transaction
    return await db.transaction(async (tx) => {
      // 1. Create School Tenant
      const [newSchool] = await tx
        .insert(schools)
        .values({
          name: schoolName,
          board: board as any,
          udiseCode,
          address,
          city,
          state,
          pincode,
          phone,
          email,
          principalName: principalName || adminName,
          establishedYear: new Date().getFullYear(),
          isActive: true,
        })
        .returning();

      if (!newSchool) throw new Error("Failed to provision school record.");

      // S5-T2: Scope subsequent provisioning queries to the newly created school tenant
      await tx.execute(sql`SELECT set_config('app.current_school_id', ${newSchool.id}, true)`);

      // 2. Create Active Academic Year
      const [newYear] = await tx
        .insert(academicYears)
        .values({
          schoolId: newSchool.id,
          label: academicYearLabel,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive: true,
        })
        .returning();

      if (!newYear) throw new Error("Failed to provision academic year.");

      // 3. Create Classes & Sections (Strictly ordered by canonical educational hierarchy)
      const rawClasses: ClassSetupItem[] = classesSetup.length > 0 ? classesSetup : [
        { gradeLevel: "NURSERY", displayName: "Nursery", sections: ["A"] },
        { gradeLevel: "LKG", displayName: "LKG", sections: ["A"] },
        { gradeLevel: "UKG", displayName: "UKG", sections: ["A"] },
        { gradeLevel: "CLASS_1", displayName: "Class 1", sections: ["A"] },
        { gradeLevel: "CLASS_2", displayName: "Class 2", sections: ["A"] },
        { gradeLevel: "CLASS_3", displayName: "Class 3", sections: ["A"] },
        { gradeLevel: "CLASS_4", displayName: "Class 4", sections: ["A"] },
        { gradeLevel: "CLASS_5", displayName: "Class 5", sections: ["A"] },
        { gradeLevel: "CLASS_6", displayName: "Class 6", sections: ["A"] },
        { gradeLevel: "CLASS_7", displayName: "Class 7", sections: ["A"] },
        { gradeLevel: "CLASS_8", displayName: "Class 8", sections: ["A"] },
        { gradeLevel: "CLASS_9", displayName: "Class 9", sections: ["A"] },
        { gradeLevel: "CLASS_10", displayName: "Class 10", sections: ["A"] },
      ];

      // Sort classes canonically: Pre-Primary -> Primary -> Higher Primary -> High School -> Senior Sec
      const sortedClasses = [...rawClasses].sort((a, b) => {
        const orderA = getCanonicalSortOrder(a.gradeLevel, a.displayName);
        const orderB = getCanonicalSortOrder(b.gradeLevel, b.displayName);
        return orderA - orderB;
      });

      const validGradeLevels = new Set([
        "NURSERY", "LKG", "UKG",
        "CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5",
        "CLASS_6", "CLASS_7", "CLASS_8", "CLASS_9", "CLASS_10",
        "CLASS_11", "CLASS_12"
      ]);

      for (let i = 0; i < sortedClasses.length; i++) {
        const clsItem = sortedClasses[i]!;
        let resolvedGradeLevel = clsItem.gradeLevel.toUpperCase().trim();
        if (!validGradeLevels.has(resolvedGradeLevel)) {
          // Normalize e.g. "CLASS 1" -> "CLASS_1", "1" -> "CLASS_1"
          const numMatch = resolvedGradeLevel.match(/\d+/);
          if (numMatch && validGradeLevels.has(`CLASS_${numMatch[0]}`)) {
            resolvedGradeLevel = `CLASS_${numMatch[0]}`;
          } else if (resolvedGradeLevel.includes("NURS")) {
            resolvedGradeLevel = "NURSERY";
          } else if (resolvedGradeLevel.includes("LKG")) {
            resolvedGradeLevel = "LKG";
          } else if (resolvedGradeLevel.includes("UKG")) {
            resolvedGradeLevel = "UKG";
          } else {
            resolvedGradeLevel = "CLASS_1";
          }
        }

        const [cls] = await tx
          .insert(classes)
          .values({
            schoolId: newSchool.id,
            academicYearId: newYear.id,
            gradeLevel: resolvedGradeLevel as any,
            displayName: clsItem.displayName,
            sortOrder: i + 1,
            isActive: true,
          })
          .returning();

        if (cls) {
          const secList = clsItem.sections.length > 0 ? clsItem.sections : ["A"];
          for (const secName of secList) {
            await tx.insert(sections).values({
              schoolId: newSchool.id,
              classId: cls.id,
              name: secName,
              capacity: 40,
              isActive: true,
            });
          }
        }
      }

      // 3.5. Seed Examination Board Blueprint Defaults (Sprint S9)
      let examSeedResult = { insertedExamTypes: 0, insertedGradeRules: 0, insertedCocurricular: 0, skipped: 0 };
      if (loadExamDefaults !== false) {
        const activeClassGroups = deriveClassGroupsFromClasses(sortedClasses);
        examSeedResult = await seedExamBoardDefaults(
          newSchool.id,
          resolvedBoard,
          resolvedScale,
          tx,
          { activeClassGroups },
        );
      }

      // 4. Create Subjects
      const defaultSubjects: SubjectSetupItem[] = subjectsSetup.length > 0 ? subjectsSetup : [
        { name: "English Language & Literature", code: "ENG", subjectType: "LANGUAGE" },
        { name: "Hindi Course A", code: "HIN", subjectType: "LANGUAGE" },
        { name: "Mathematics", code: "MATH", subjectType: "THEORY" },
        { name: "General Science", code: "SCI", subjectType: "THEORY" },
        { name: "Social Science", code: "SST", subjectType: "THEORY" },
        { name: "Computer Science & IT", code: "CS", subjectType: "PRACTICAL" },
        { name: "Environmental Studies", code: "EVS", subjectType: "THEORY" },
        { name: "Physical Education", code: "PED", subjectType: "ACTIVITY" },
      ];

      for (const sub of defaultSubjects) {
        await tx.insert(subjects).values({
          schoolId: newSchool.id,
          name: sub.name,
          code: sub.code || sub.name.substring(0, 4).toUpperCase(),
          subjectType: sub.subjectType || "THEORY",
          maxMarks: 100,
          passingMarks: 33,
          isActive: true,
        }).onConflictDoNothing();
      }

      // Attach provisioned subjects to created classes
      const createdClassesList = await tx
        .select({ id: classes.id, displayName: classes.displayName, gradeLevel: classes.gradeLevel })
        .from(classes)
        .where(eq(classes.schoolId, newSchool.id));
      const createdSubjectsList = await tx
        .select({ id: subjects.id, code: subjects.code })
        .from(subjects)
        .where(eq(subjects.schoolId, newSchool.id));

      if (createdClassesList.length > 0 && createdSubjectsList.length > 0) {
        const subjectCodeToId = new Map(createdSubjectsList.map((s) => [s.code, s.id]));
        const mappingsToInsert: Array<{
          schoolId: string;
          classId: string;
          subjectId: string;
          periodsPerWeek: number;
          isElective: boolean;
        }> = [];

        for (const cls of createdClassesList) {
          const matchingSetup = sortedClasses.find(
            (sc) => sc.displayName === cls.displayName || sc.gradeLevel === cls.gradeLevel
          );

          if (matchingSetup?.subjectCodes && matchingSetup.subjectCodes.length > 0) {
            // Blueprint review selections: only attach specified subjects
            for (const code of matchingSetup.subjectCodes) {
              const subId = subjectCodeToId.get(code);
              if (subId) {
                mappingsToInsert.push({
                  schoolId: newSchool.id,
                  classId: cls.id,
                  subjectId: subId,
                  periodsPerWeek: 5,
                  isElective: false,
                });
              }
            }
          } else {
            // Fallback for setups without explicit subjectCodes
            for (const sub of createdSubjectsList) {
              mappingsToInsert.push({
                schoolId: newSchool.id,
                classId: cls.id,
                subjectId: sub.id,
                periodsPerWeek: 5,
                isElective: false,
              });
            }
          }
        }

        if (mappingsToInsert.length > 0) {
          await tx.insert(classSubjects).values(mappingsToInsert).onConflictDoNothing();
        }
      }

      // 5. Create Fee Heads
      const defaultFeeHeads: FeeHeadSetupItem[] = feeHeadsSetup.length > 0 ? feeHeadsSetup : [
        { name: "Tuition Fee", code: "TUT", category: "RECURRING", headType: "TUITION" },
        { name: "Science & Computer Lab Fee", code: "LAB", category: "RECURRING", headType: "LAB" },
        { name: "Library & Resource Hub", code: "LIB", category: "RECURRING", headType: "LIBRARY" },
        { name: "Transport Fee (Opt-In)", code: "TRN", category: "OPTIONAL", headType: "TRANSPORT" },
        { name: "Admission Fee", code: "ADM", category: "ONE_TIME", headType: "ADMISSION" },
        { name: "Refundable Caution Deposit", code: "CAU", category: "ONE_TIME", headType: "MISCELLANEOUS", isRefundable: true },
      ];

      for (let i = 0; i < defaultFeeHeads.length; i++) {
        const head = defaultFeeHeads[i]!;
        await tx.insert(feeHeads).values({
          schoolId: newSchool.id,
          name: head.name,
          code: head.code || `FH_${i + 1}`,
          priority: i + 1,
          category: head.category as any,
          headType: (head.headType === "EXAMINATION" ? "EXAM" : head.headType) as any,
          discountEligible: head.headType === "TUITION" || head.headType === "LAB",
          isRefundable: head.isRefundable || false,
          isActive: true,
        });
      }

      // 6. Seed Standard Departments & Designations
      const standardDepartments = [
        { name: "School-Wide Administration", key: "ADMIN" },
        { name: "Pre-Primary Academic Department", key: "PRE_PRI" },
        { name: "Primary Academic Department", key: "PRI" },
        { name: "Middle School Academic Department", key: "MID" },
        { name: "High School Academic Department", key: "HIGH" },
        { name: "Finance & Accounts", key: "FIN" },
        { name: "Human Resources", key: "HR" },
        { name: "Library & Information Hub", key: "LIB" },
        { name: "Transport & Fleet Logistics", key: "TRN" },
        { name: "IT & Educational Technology", key: "IT" },
        { name: "Sports & Physical Education", key: "SPORTS" },
        { name: "Facilities & Campus Operations", key: "OPS" },
      ];

      const createdDepts = await tx
        .insert(departments)
        .values(
          standardDepartments.map((d) => ({
            schoolId: newSchool.id,
            name: d.name,
            isActive: true,
          }))
        )
        .returning();

      const deptMap: Record<string, string> = {};
      for (let i = 0; i < standardDepartments.length; i++) {
        const item = standardDepartments[i]!;
        const created = createdDepts[i];
        if (created) {
          deptMap[item.key] = created.id;
        }
      }

      const standardDesignations = [
        { name: "Principal", deptKey: "ADMIN", isTeaching: false, mappedRole: "PRINCIPAL" },
        { name: "Vice Principal", deptKey: "ADMIN", isTeaching: false, mappedRole: "PRINCIPAL" },
        { name: "Academic Coordinator", deptKey: "ADMIN", isTeaching: true, mappedRole: "TEACHER" },
        { name: "Head of Department (HoD)", deptKey: "ADMIN", isTeaching: true, mappedRole: "TEACHER" },
        { name: "Pre-Primary Teacher (PRT)", deptKey: "PRE_PRI", isTeaching: true, mappedRole: "TEACHER" },
        { name: "Primary Teacher (PRT)", deptKey: "PRI", isTeaching: true, mappedRole: "TEACHER" },
        { name: "Trained Graduate Teacher (TGT) - Science", deptKey: "MID", isTeaching: true, mappedRole: "TEACHER" },
        { name: "Trained Graduate Teacher (TGT) - Mathematics", deptKey: "MID", isTeaching: true, mappedRole: "TEACHER" },
        { name: "High School Teacher (TGT) - Physics", deptKey: "HIGH", isTeaching: true, mappedRole: "TEACHER" },
        { name: "Chief Accountant / Bursar", deptKey: "FIN", isTeaching: false, mappedRole: "ACCOUNTANT" },
        { name: "HR Manager / Executive", deptKey: "HR", isTeaching: false, mappedRole: "SCHOOL_ADMIN" },
        { name: "Head Librarian", deptKey: "LIB", isTeaching: false, mappedRole: "LIBRARIAN" },
        { name: "Transport Operations Manager", deptKey: "TRN", isTeaching: false, mappedRole: "TRANSPORT_MANAGER" },
        { name: "System Administrator / IT Support", deptKey: "IT", isTeaching: false, mappedRole: "SCHOOL_ADMIN" },
      ];

      for (const des of standardDesignations) {
        const deptId = deptMap[des.deptKey] || createdDepts[0]?.id;
        if (deptId) {
          await tx.insert(designations).values({
            schoolId: newSchool.id,
            departmentId: deptId,
            name: des.name,
            mappedRole: des.mappedRole,
            isTeaching: des.isTeaching,
            isActive: true,
          }).onConflictDoNothing();
        }
      }

      // 7. Seed 4 Standard Default Salary Templates
      const defaultTaxState = (state && normalizeProfessionalTaxState(state)) || "DL";
      const defaultTemplates = [
        { name: "Standard Teaching Faculty", basicPercent: "50.00", daPercent: "10.00", hraPercent: "20.00", pfEmployeePercent: "12.00", pfEmployerPercent: "12.00", esiApplicable: false, professionalTaxState: defaultTaxState },
        { name: "Admin Cadre", basicPercent: "45.00", daPercent: "10.00", hraPercent: "25.00", pfEmployeePercent: "12.00", pfEmployerPercent: "12.00", esiApplicable: false, professionalTaxState: defaultTaxState },
        { name: "Support Staff", basicPercent: "60.00", daPercent: "15.00", hraPercent: "15.00", pfEmployeePercent: "12.00", pfEmployerPercent: "12.00", esiApplicable: true, professionalTaxState: defaultTaxState },
        { name: "Fixed Contract Staff", basicPercent: "100.00", daPercent: "0.00", hraPercent: "0.00", pfEmployeePercent: "0.00", pfEmployerPercent: "0.00", esiApplicable: false, professionalTaxState: defaultTaxState },
      ];

      for (const tpl of defaultTemplates) {
        await tx.insert(salaryTemplates).values({
          schoolId: newSchool.id,
          name: tpl.name,
          basicPercent: tpl.basicPercent,
          daPercent: tpl.daPercent,
          hraPercent: tpl.hraPercent,
          pfEmployeePercent: tpl.pfEmployeePercent,
          pfEmployerPercent: tpl.pfEmployerPercent,
          esiApplicable: tpl.esiApplicable,
          professionalTaxState: tpl.professionalTaxState,
          isActive: true,
        }).onConflictDoNothing();
      }

      // 8. Seed System Roles for the new School
      const systemRoles = [
        { name: "SUPER_ADMIN", displayName: "Super Admin", isSystemRole: true },
        { name: "SCHOOL_ADMIN", displayName: "School Administrator", isSystemRole: true },
        { name: "PRINCIPAL", displayName: "Principal", isSystemRole: true },
        { name: "HR_MANAGER", displayName: "HR & Payroll Manager", isSystemRole: true },
        { name: "TEACHER", displayName: "Educator / Teacher", isSystemRole: true },
        { name: "ACCOUNTANT", displayName: "Accountant", isSystemRole: true },
        { name: "LIBRARIAN", displayName: "Librarian", isSystemRole: true },
        { name: "TRANSPORT_MANAGER", displayName: "Transport Operations Manager", isSystemRole: true },
        { name: "PARENT", displayName: "Parent / Guardian", isSystemRole: true },
        { name: "STUDENT", displayName: "Student", isSystemRole: true },
        { name: "DRIVER", displayName: "Bus Driver", isSystemRole: true },
      ];

      const createdRoles = await tx
        .insert(roles)
        .values(
          systemRoles.map((r) => ({
            schoolId: newSchool.id,
            name: r.name as any,
            displayName: r.displayName,
            isSystemRole: r.isSystemRole,
          }))
        )
        .returning();

      const schoolAdminRole = createdRoles.find((r) => r.name === "SCHOOL_ADMIN");

      // 9. Create Initial School Admin Account
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const [adminUser] = await tx
        .insert(users)
        .values({
          schoolId: newSchool.id,
          email: adminEmail.toLowerCase().trim(),
          passwordHash,
          isActive: true,
          isEmailVerified: true,
        })
        .returning();

      if (adminUser) {
        const nameParts = adminName.trim().split(/\s+/);
        const adminFirstName = nameParts[0] || "School";
        const adminLastName = nameParts.slice(1).join(" ") || "Admin";

        await tx.insert(persons).values({
          schoolId: newSchool.id,
          userId: adminUser.id,
          primaryType: "STAFF",
          firstNameEncrypted: encryptData(adminFirstName),
          lastNameEncrypted: encryptData(adminLastName),
          firstNameSearchHash: computeSearchHash(adminFirstName),
          lastNameSearchHash: computeSearchHash(adminLastName),
          gender: "OTHER",
          primaryEmailEncrypted: encryptData(adminEmail.toLowerCase().trim()),
          primaryMobileEncrypted: phone ? encryptData(phone) : null,
          isActive: true,
        });

        if (schoolAdminRole) {
          await tx.insert(userRoles).values({
            userId: adminUser.id,
            roleId: schoolAdminRole.id,
            schoolId: newSchool.id,
          });
        }
      }

      const examMsg = loadExamDefaults !== false
        ? `, and ${examSeedResult.insertedExamTypes} exam types (${examSeedResult.insertedGradeRules} grade rules)`
        : "";

      return {
        success: true,
        message: `School '${schoolName}' onboarded successfully! ${sortedClasses.length} classes, ${defaultSubjects.length} subjects, ${defaultFeeHeads.length} fee heads, ${standardDepartments.length} departments, 4 salary templates${examMsg} provisioned under tenant ${udiseCode}.`,
        schoolId: newSchool.id,
        adminEmail,
        examSeedResult,
      };
    });
  } catch (err: any) {
    console.error("Failed to onboard school tenant:", err);
    return { success: false, message: err.message || "Onboarding failed." };
  }
}
