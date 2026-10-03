"use server";

import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  feeHeads,
  users,
  roles,
  userRoles,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface OnboardSchoolPayload {
  // 1. School Profile
  schoolName: string;
  board: "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";
  udiseCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  // 2. Academic Config
  academicYearLabel: string;
  startDate: string;
  endDate: string;
  selectedGrades: string[]; // e.g. ["NURSERY", "LKG", "UKG", "CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5"]
  // 3. Initial Admin Credentials
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export async function registerSchoolTenant(payload: OnboardSchoolPayload) {
  try {
    const {
      schoolName,
      board = "CBSE",
      udiseCode,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      academicYearLabel = "2026-27",
      startDate = "2026-04-01",
      endDate = "2027-03-31",
      selectedGrades = ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5"],
      adminName,
      adminEmail,
      adminPassword,
    } = payload;

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
          principalName: adminName,
          establishedYear: new Date().getFullYear(),
          isActive: true,
        })
        .returning();

      if (!newSchool) throw new Error("Failed to provision school record.");

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

      // 3. Create Default Classes & Section "A" for selected grades
      const gradeDisplayNames: Record<string, string> = {
        NURSERY: "Nursery",
        LKG: "LKG",
        UKG: "UKG",
        CLASS_1: "Class 1",
        CLASS_2: "Class 2",
        CLASS_3: "Class 3",
        CLASS_4: "Class 4",
        CLASS_5: "Class 5",
        CLASS_6: "Class 6",
        CLASS_7: "Class 7",
        CLASS_8: "Class 8",
        CLASS_9: "Class 9",
        CLASS_10: "Class 10",
        CLASS_11: "Class 11",
        CLASS_12: "Class 12",
      };

      for (let i = 0; i < selectedGrades.length; i++) {
        const grade = selectedGrades[i] as any;
        const displayName = gradeDisplayNames[grade] || grade;

        const [cls] = await tx
          .insert(classes)
          .values({
            schoolId: newSchool.id,
            academicYearId: newYear.id,
            gradeLevel: grade,
            displayName,
            sortOrder: i + 1,
            isActive: true,
          })
          .returning();

        if (cls) {
          await tx.insert(sections).values({
            schoolId: newSchool.id,
            classId: cls.id,
            name: "A",
            capacity: 40,
            isActive: true,
          });
        }
      }

      // 4. Seed Starter Pack Fee Heads
      const starterPackHeads = [
        {
          name: "Tuition Fee",
          code: "TUT",
          priority: 1,
          category: "RECURRING",
          headType: "TUITION",
          discountEligible: true,
        },
        {
          name: "Science & Computer Lab Fee",
          code: "LAB",
          priority: 2,
          category: "RECURRING",
          headType: "LAB",
          discountEligible: true,
        },
        {
          name: "Library & Resource Hub",
          code: "LIB",
          priority: 3,
          category: "RECURRING",
          headType: "LIBRARY",
          discountEligible: true,
        },
        {
          name: "Transport Fee (Opt-In)",
          code: "TRN",
          priority: 4,
          category: "OPTIONAL",
          headType: "TRANSPORT",
          discountEligible: false,
        },
        {
          name: "Admission Fee",
          code: "ADM",
          priority: 5,
          category: "ONE_TIME",
          headType: "ADMISSION",
          discountEligible: false,
        },
        {
          name: "Refundable Caution Deposit",
          code: "CAU",
          priority: 6,
          category: "ONE_TIME",
          headType: "MISCELLANEOUS",
          isRefundable: true,
          discountEligible: false,
        },
      ];

      for (const head of starterPackHeads) {
        await tx.insert(feeHeads).values({
          schoolId: newSchool.id,
          name: head.name,
          code: head.code,
          priority: head.priority,
          category: head.category,
          headType: head.headType as any,
          discountEligible: head.discountEligible,
          isRefundable: (head as any).isRefundable || false,
          isActive: true,
        });
      }

      // 5. Seed System Roles for the new School
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

      // 6. Create Initial School Admin Account
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

      if (adminUser && schoolAdminRole) {
        await tx.insert(userRoles).values({
          userId: adminUser.id,
          roleId: schoolAdminRole.id,
          schoolId: newSchool.id,
        });
      }

      return {
        success: true,
        message: `School '${schoolName}' onboarded successfully! You can now log in with ${adminEmail}.`,
        schoolId: newSchool.id,
        adminEmail,
      };
    });
  } catch (err: any) {
    console.error("Failed to onboard school tenant:", err);
    return { success: false, message: err.message || "Onboarding failed." };
  }
}
