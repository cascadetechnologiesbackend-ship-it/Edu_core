"use server";

import { db } from "@/db";
import { feeHeads, feeStructures, classes } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { invalidateCache } from "@/lib/cache";
import { autoAssignFeeStructuresForClass } from "@/lib/feeAssignmentEngine";

// ─── 1. Starter Pack Seeder ──────────────────────────────────────────────────

export async function seedStarterPackFeeHeads() {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const starterPack = [
      {
        name: "Previous Year Arrears",
        code: "ARR",
        priority: 1,
        description: "Brought forward arrears balance from previous fiscal year",
        category: "RECURRING",
        headType: "MISCELLANEOUS" as const,
        discountEligible: false,
        lateFineEligible: false,
        isRefundable: false,
      },
      {
        name: "Tuition Fee",
        code: "TUI",
        priority: 2,
        description: "Core curriculum tuition and pedagogical instruction",
        category: "RECURRING",
        headType: "TUITION" as const,
        discountEligible: true,
        lateFineEligible: true,
        isRefundable: false,
      },
      {
        name: "Admission Fee",
        code: "ADM",
        priority: 3,
        description: "One-time admission registration charge",
        category: "ONE_TIME",
        headType: "ADMISSION" as const,
        discountEligible: false,
        lateFineEligible: false,
        isRefundable: false,
      },
      {
        name: "Annual Development Charges",
        code: "DEV",
        priority: 4,
        description: "Campus infrastructure, sports and physical facility maintenance",
        category: "RECURRING",
        headType: "ACTIVITY" as const,
        discountEligible: false,
        lateFineEligible: true,
        isRefundable: false,
      },
      {
        name: "Science & Computer Lab Fee",
        code: "LAB",
        priority: 5,
        description: "STEM labs, robotics, AI workbench and computer consumables",
        category: "RECURRING",
        headType: "LAB" as const,
        discountEligible: true,
        lateFineEligible: true,
        isRefundable: false,
      },
      {
        name: "Library & Resource Hub",
        code: "LIB",
        priority: 6,
        description: "Digital library catalog and physical book circulations",
        category: "RECURRING",
        headType: "LIBRARY" as const,
        discountEligible: false,
        lateFineEligible: false,
        isRefundable: false,
      },
      {
        name: "Transport Fee (Opt-In)",
        code: "TRN",
        priority: 7,
        description: "School bus transit and route distance service",
        category: "RECURRING",
        headType: "TRANSPORT" as const,
        discountEligible: false,
        lateFineEligible: true,
        isRefundable: false,
      },
      {
        name: "Refundable Caution Deposit",
        code: "CAU",
        priority: 8,
        description: "Security deposit refundable upon Transfer Certificate (TC)",
        category: "REFUNDABLE",
        headType: "MISCELLANEOUS" as const,
        discountEligible: false,
        lateFineEligible: false,
        isRefundable: true,
      },
    ];

    for (const head of starterPack) {
      const existing = await db.query.feeHeads.findFirst({
        where: and(
          eq(feeHeads.schoolId, school.id),
          eq(feeHeads.name, head.name),
        ),
      });

      if (existing) {
        await db
          .update(feeHeads)
          .set({
            code: head.code,
            priority: head.priority,
            description: head.description,
            category: head.category,
            headType: head.headType,
            discountEligible: head.discountEligible,
            lateFineEligible: head.lateFineEligible,
            isRefundable: head.isRefundable,
            isActive: true,
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(feeHeads.id, existing.id));
      } else {
        await db.insert(feeHeads).values({
          schoolId: school.id,
          name: head.name,
          code: head.code,
          priority: head.priority,
          description: head.description,
          category: head.category,
          headType: head.headType,
          discountEligible: head.discountEligible,
          lateFineEligible: head.lateFineEligible,
          isRefundable: head.isRefundable,
          isTaxable: false,
          gstPercentage: "0",
        });
      }
    }

    try {
      revalidatePath("/fees/structures");
    } catch {
      // Ignored outside Next.js request lifecycle
    }

    return { success: true, message: "Starter Pack Fee Heads initialized successfully." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── 2. Save (Create or Update) Fee Head ──────────────────────────────────────

export interface SaveFeeHeadPayload {
  id?: string;
  name: string;
  code: string;
  priority: number;
  description?: string;
  category: "RECURRING" | "ONE_TIME" | "REFUNDABLE";
  headType: any;
  discountEligible: boolean;
  lateFineEligible: boolean;
  isRefundable: boolean;
  isTaxable?: boolean;
  gstPercentage?: string;
}

export async function saveFeeHead(payload: SaveFeeHeadPayload) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    if (!payload.name?.trim()) {
      return { success: false, message: "Head name is required." };
    }

    const code = (payload.code || payload.name.slice(0, 3)).toUpperCase().trim();
    const priority = Number(payload.priority) || 99;

    if (payload.id) {
      // Update existing
      await db
        .update(feeHeads)
        .set({
          name: payload.name.trim(),
          code,
          priority,
          description: payload.description?.trim() || null,
          category: payload.category || "RECURRING",
          headType: payload.headType || "MISCELLANEOUS",
          discountEligible: Boolean(payload.discountEligible),
          lateFineEligible: Boolean(payload.lateFineEligible),
          isRefundable: Boolean(payload.isRefundable),
          isTaxable: Boolean(payload.isTaxable),
          gstPercentage: payload.gstPercentage || "0",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(feeHeads.id, payload.id),
            eq(feeHeads.schoolId, school.id),
          ),
        );
    } else {
      // Insert new
      await db.insert(feeHeads).values({
        schoolId: school.id,
        name: payload.name.trim(),
        code,
        priority,
        description: payload.description?.trim() || null,
        category: payload.category || "RECURRING",
        headType: payload.headType || "MISCELLANEOUS",
        discountEligible: Boolean(payload.discountEligible),
        lateFineEligible: Boolean(payload.lateFineEligible),
        isRefundable: Boolean(payload.isRefundable),
        isTaxable: Boolean(payload.isTaxable),
        gstPercentage: payload.gstPercentage || "0",
      });
    }

    try {
      revalidatePath("/fees/structures");
    } catch {
      // Ignored outside Next.js request lifecycle
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── 3. Delete Fee Head ───────────────────────────────────────────────────────

export async function deleteFeeHead(headId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const existing = await db.query.feeHeads.findFirst({
      where: and(
        eq(feeHeads.id, headId),
        eq(feeHeads.schoolId, school.id),
      ),
    });

    if (!existing) {
      return { success: false, message: "Fee head not found." };
    }

    // Soft delete to preserve historical integrity
    await db
      .update(feeHeads)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feeHeads.id, headId),
          eq(feeHeads.schoolId, school.id),
        ),
      );

    try {
      revalidatePath("/fees/structures");
    } catch {
      // Ignored outside Next.js request lifecycle
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── 4. Save Pricing Matrix (Atomic Batch Upsert) ─────────────────────────────

export interface MatrixEntryPayload {
  classId: string;
  feeHeadId: string;
  term: "ANNUAL" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ONE_TIME";
  amount: string;
  dueDate: string; // ISO date string
}

export async function savePricingMatrix(payload: {
  academicYearId: string;
  entries: MatrixEntryPayload[];
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const { academicYearId, entries } = payload;
    if (!academicYearId || !Array.isArray(entries)) {
      return { success: false, message: "Invalid payload for pricing matrix." };
    }

    // Filter to entries with valid class and head
    const validEntries = entries.filter((e) => e.classId && e.feeHeadId);

    for (const item of validEntries) {
      const parsedAmount = parseFloat(item.amount || "0");
      const dueDate = item.dueDate ? new Date(item.dueDate) : new Date();

      if (parsedAmount > 0) {
        // Upsert fee structure using ON CONFLICT on our unique index
        await db.insert(feeStructures).values({
          schoolId: school.id,
          academicYearId,
          classId: item.classId,
          feeHeadId: item.feeHeadId,
          term: item.term || "ANNUAL",
          amount: parsedAmount.toFixed(2),
          dueDate,
          isActive: true,
        }).onConflictDoUpdate({
          target: [
            feeStructures.schoolId,
            feeStructures.academicYearId,
            feeStructures.classId,
            feeStructures.feeHeadId,
            feeStructures.term,
          ],
          targetWhere: sql`"deleted_at" IS NULL`,
          set: {
            amount: parsedAmount.toFixed(2),
            dueDate,
            isActive: true,
            deletedAt: null,
            updatedAt: new Date(),
          },
        });
      } else {
        // If amount is 0 or cleared, deactivate / soft-delete if it already exists
        await db
          .update(feeStructures)
          .set({
            amount: "0.00",
            isActive: false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(feeStructures.schoolId, school.id),
              eq(feeStructures.academicYearId, academicYearId),
              eq(feeStructures.classId, item.classId),
              eq(feeStructures.feeHeadId, item.feeHeadId),
              eq(feeStructures.term, item.term || "ANNUAL"),
            ),
          );
      }
    }

    // Automatically sync/assign fee structures to all enrolled students in affected classes
    const affectedClassIds = Array.from(new Set(validEntries.map((e) => e.classId)));
    for (const classId of affectedClassIds) {
      await autoAssignFeeStructuresForClass(school.id, academicYearId, classId);
    }

    // Invalidate Redis cache for this academic year
    await invalidateCache(`feeStructures:${academicYearId}`);

    try {
      revalidatePath("/fees/structures");
    } catch {
      // Ignored outside Next.js request lifecycle
    }

    return {
      success: true,
      message: `Pricing matrix updated successfully (${validEntries.length} items processed).`,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── 5. Clone Cohort Fee Structures with % Uplift ─────────────────────────────

export async function cloneCohortFeeStructures(payload: {
  sourceYearId: string;
  targetYearId: string;
  percentageUplift: number;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const { sourceYearId, targetYearId, percentageUplift = 0 } = payload;
    if (!sourceYearId || !targetYearId) {
      return { success: false, message: "Source and Target academic years are required." };
    }

    // 1. Fetch all source structures
    const sourceStructures = await db.query.feeStructures.findMany({
      where: and(
        eq(feeStructures.schoolId, school.id),
        eq(feeStructures.academicYearId, sourceYearId),
        eq(feeStructures.isActive, true),
      ),
    });

    if (!sourceStructures.length) {
      return { success: false, message: "No active fee structures found in the source cohort." };
    }

    // 2. Fetch classes in target year to map by gradeLevel / displayName
    const sourceClasses = await db.query.classes.findMany({
      where: and(eq(classes.schoolId, school.id), eq(classes.academicYearId, sourceYearId)),
    });
    const targetClasses = await db.query.classes.findMany({
      where: and(eq(classes.schoolId, school.id), eq(classes.academicYearId, targetYearId)),
    });

    const sourceClassMap = new Map(sourceClasses.map((c) => [c.id, c.gradeLevel]));
    const targetClassMap = new Map(targetClasses.map((c) => [c.gradeLevel, c.id]));

    let clonedCount = 0;
    const multiplier = 1 + percentageUplift / 100;

    for (const src of sourceStructures) {
      const gradeLevel = sourceClassMap.get(src.classId);
      if (!gradeLevel) continue;

      const targetClassId = targetClassMap.get(gradeLevel);
      if (!targetClassId) continue;

      const originalAmount = parseFloat(src.amount);
      const newAmount = Math.round(originalAmount * multiplier);

      // Advance due date by 1 year
      const targetDueDate = new Date(src.dueDate);
      targetDueDate.setFullYear(targetDueDate.getFullYear() + 1);

      await db.insert(feeStructures).values({
        schoolId: school.id,
        academicYearId: targetYearId,
        classId: targetClassId,
        feeHeadId: src.feeHeadId,
        term: src.term,
        amount: newAmount.toFixed(2),
        dueDate: targetDueDate,
        lateFeeType: src.lateFeeType,
        lateFeeAmount: src.lateFeeAmount,
        lateFeeStartAfterDays: src.lateFeeStartAfterDays,
        isActive: true,
      }).onConflictDoUpdate({
        target: [
          feeStructures.schoolId,
          feeStructures.academicYearId,
          feeStructures.classId,
          feeStructures.feeHeadId,
          feeStructures.term,
        ],
        targetWhere: sql`"deleted_at" IS NULL`,
        set: {
          amount: newAmount.toFixed(2),
          dueDate: targetDueDate,
          isActive: true,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      clonedCount++;
    }

    // Automatically sync/assign fee structures to all enrolled students in target classes
    for (const targetClass of targetClasses) {
      await autoAssignFeeStructuresForClass(school.id, targetYearId, targetClass.id);
    }

    await invalidateCache(`feeStructures:${targetYearId}`);

    try {
      revalidatePath("/fees/structures");
    } catch {
      // Ignored outside Next.js request lifecycle
    }

    return {
      success: true,
      message: `Successfully cloned ${clonedCount} fee structures to target cohort with ${percentageUplift}% uplift.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
