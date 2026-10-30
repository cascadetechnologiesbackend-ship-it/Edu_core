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
  roles,
  events,
  schoolProvisions,
  globalTemplateProfiles,
  bellSchedule,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCanonicalBlueprint, getAllCanonicalBlueprints, CanonicalBlueprint } from "./canonicalBlueprints";
import { normalizeProfessionalTaxState } from "./reference/indiaReferenceData";

export interface DryRunPreviewResult {
  canProvision: boolean;
  isAlreadyProvisioned?: boolean | undefined;
  schoolId: string;
  schoolName: string;
  blueprintId: string;
  blueprintName?: string | undefined;
  error?: string | undefined;
  existingCounts?: {
    classes: number;
    subjects: number;
    feeHeads: number;
    departments: number;
    bellSchedulePeriods?: number | undefined;
  } | undefined;
  prospectiveCounts?: {
    classes: number;
    sections: number;
    subjects: number;
    classSubjectMappings: number;
    feeHeads: number;
    departments: number;
    salaryGrades: number;
    holidays: number;
    roles: number;
    bellSchedulePeriods?: number | undefined;
  } | undefined;
  preview?: {
    classes: string[];
    subjects: string[];
    feeHeads: string[];
    salaryGrades: string[];
    holidays: string[];
    bellSchedule?: string[] | undefined;
  } | undefined;
}

export interface TopUpResult {
  success: boolean;
  addedCount: number;
  message: string;
}

export interface ProvisionResult {
  success: boolean;
  message: string;
  provisionId?: string | undefined;
  alreadyProvisioned?: boolean | undefined;
  entityCounts?: Record<string, number> | undefined;
}

/**
 * Non-mutating Dry-Run Validator: Previews prospective entity generation without modifying database.
 */
export async function dryRunProvisionSchool(
  schoolId: string,
  blueprintId: string
): Promise<DryRunPreviewResult> {
  const school = await db.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  if (!school) {
    return {
      canProvision: false,
      schoolId,
      schoolName: "Unknown",
      blueprintId,
      error: `School with ID '${schoolId}' was not found.`,
    };
  }

  // Check idempotency: Has this school already been provisioned?
  const existingProvision = await db.query.schoolProvisions.findFirst({
    where: eq(schoolProvisions.schoolId, schoolId),
  });

  if (existingProvision) {
    return {
      canProvision: false,
      isAlreadyProvisioned: true,
      schoolId,
      schoolName: school.name,
      blueprintId,
      error: `School '${school.name}' has already been provisioned (Status: ${existingProvision.status}, Version: ${existingProvision.blueprintVersion}).`,
    };
  }

  const blueprint = getCanonicalBlueprint(blueprintId);
  if (!blueprint) {
    return {
      canProvision: false,
      schoolId,
      schoolName: school.name,
      blueprintId,
      error: `Canonical Blueprint '${blueprintId}' does not exist in registry.`,
    };
  }

  // Count existing records
  const existingClasses = await db.select({ count: sql<number>`count(*)` }).from(classes).where(eq(classes.schoolId, schoolId));
  const existingSubjects = await db.select({ count: sql<number>`count(*)` }).from(subjects).where(eq(subjects.schoolId, schoolId));
  const existingFeeHeads = await db.select({ count: sql<number>`count(*)` }).from(feeHeads).where(eq(feeHeads.schoolId, schoolId));
  const existingDepts = await db.select({ count: sql<number>`count(*)` }).from(departments).where(eq(departments.schoolId, schoolId));
  const existingBellPeriods = await db
    .select({ count: sql<number>`count(*)` })
    .from(bellSchedule)
    .where(and(eq(bellSchedule.schoolId, schoolId), eq(bellSchedule.isActive, true)));

  const totalSections = blueprint.classes.reduce((sum, c) => sum + c.defaultSections.length, 0);
  const prospectiveInstructionalPeriods = blueprint.bellSchedule?.periods?.filter((p) => p.periodNumber > 0) || [];

  return {
    canProvision: true,
    schoolId,
    schoolName: school.name,
    blueprintId,
    blueprintName: blueprint.displayName,
    existingCounts: {
      classes: Number(existingClasses[0]?.count || 0),
      subjects: Number(existingSubjects[0]?.count || 0),
      feeHeads: Number(existingFeeHeads[0]?.count || 0),
      departments: Number(existingDepts[0]?.count || 0),
      bellSchedulePeriods: Number(existingBellPeriods[0]?.count || 0),
    },
    prospectiveCounts: {
      classes: blueprint.classes.length,
      sections: totalSections,
      subjects: blueprint.subjects.length,
      classSubjectMappings: blueprint.classes.length * blueprint.subjects.length,
      feeHeads: blueprint.feeHeads.length,
      departments: 12,
      salaryGrades: blueprint.salaryGrades.length,
      holidays: blueprint.holidays.length,
      roles: blueprint.roleDefaults.length,
      bellSchedulePeriods: prospectiveInstructionalPeriods.length,
    },
    preview: {
      classes: blueprint.classes.map((c) => `${c.name} (${c.defaultSections.join(", ")})`),
      subjects: blueprint.subjects.map((s) => `${s.name} [${s.code}] - ${s.weeklyPeriods} per/wk`),
      feeHeads: blueprint.feeHeads.map((f) => `${f.name} (${f.frequency})`),
      salaryGrades: blueprint.salaryGrades.map((g) => `${g.gradeName}`),
      holidays: blueprint.holidays.map((h) => `${h.name} (Month ${h.month}, Day ${h.day})`),
      bellSchedule: prospectiveInstructionalPeriods.map((p) => `Period ${p.periodNumber}: ${p.startTime} - ${p.endTime}`),
    },
  };
}

/**
 * Atomic Provisioning Engine: Transactionally clones canonical blueprint configuration into school tenant.
 * Guarantees idempotency via school_provisions unique constraint.
 * Preserves customisations with ON CONFLICT DO NOTHING.
 */
export async function executeProvisionSchool(params: {
  schoolId: string;
  blueprintId: string;
  operatorUserId: string;
  notes?: string | undefined;
}): Promise<ProvisionResult> {
  const { schoolId, blueprintId, operatorUserId, notes } = params;

  const blueprint = getCanonicalBlueprint(blueprintId);
  if (!blueprint) {
    return { success: false, message: `Blueprint '${blueprintId}' not found.` };
  }

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  if (!school) {
    return { success: false, message: `School '${schoolId}' not found.` };
  }

  // Idempotency check before transaction
  const priorProvision = await db.query.schoolProvisions.findFirst({
    where: eq(schoolProvisions.schoolId, schoolId),
  });
  if (priorProvision) {
    return {
      success: false,
      alreadyProvisioned: true,
      message: `School '${school.name}' has already been provisioned on ${priorProvision.provisionedAt.toISOString()}.`,
    };
  }

  // Ensure global_template_profiles record exists to satisfy foreign key requirement
  let profile = await db.query.globalTemplateProfiles.findFirst({
    where: and(
      eq(globalTemplateProfiles.board, blueprint.board as any),
      eq(globalTemplateProfiles.schoolType, blueprint.schoolType as any)
    ),
  });

  if (!profile) {
    const [createdProfile] = await db
      .insert(globalTemplateProfiles)
      .values({
        board: blueprint.board as any,
        schoolType: blueprint.schoolType as any,
        displayName: blueprint.displayName,
        description: blueprint.description,
        createdBy: operatorUserId,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    profile = createdProfile || (await db.query.globalTemplateProfiles.findFirst({
      where: and(
        eq(globalTemplateProfiles.board, blueprint.board as any),
        eq(globalTemplateProfiles.schoolType, blueprint.schoolType as any)
      ),
    }));
  }

  if (!profile) {
    return { success: false, message: "Failed to establish global template profile reference." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Establish tenant context
      await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);

      // 2. Resolve Active Academic Year
      let activeYear = await tx.query.academicYears.findFirst({
        where: and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)),
      });

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; // 1-12
      const startYear = currentMonth < blueprint.academicYear.startMonth ? currentYear - 1 : currentYear;
      const endYear = startYear + 1;

      if (!activeYear) {
        const [newYear] = await tx
          .insert(academicYears)
          .values({
            schoolId,
            label: `${startYear}-${String(endYear).slice(-2)}`,
            startDate: new Date(`${startYear}-04-01`),
            endDate: new Date(`${endYear}-03-31`),
            isActive: true,
          })
          .returning();
        activeYear = newYear;
      }

      if (!activeYear) throw new Error("Could not initialize active academic year.");

      // 3. Clone Classes & Sections
      let classesCreated = 0;
      let sectionsCreated = 0;
      const createdClassMap = new Map<string, string>(); // gradeLevel -> classId

      for (const cls of blueprint.classes) {
        let existingClass = await tx.query.classes.findFirst({
          where: and(
            eq(classes.schoolId, schoolId),
            eq(classes.academicYearId, activeYear.id),
            eq(classes.gradeLevel, cls.gradeLevel as any)
          ),
        });

        if (!existingClass) {
          const [newCls] = await tx
            .insert(classes)
            .values({
              schoolId,
              academicYearId: activeYear.id,
              gradeLevel: cls.gradeLevel as any,
              displayName: cls.name,
              sortOrder: cls.sortOrder,
              isActive: true,
            })
            .returning();
          existingClass = newCls;
          classesCreated++;
        }

        if (existingClass) {
          createdClassMap.set(cls.gradeLevel, existingClass.id);
          for (const secName of cls.defaultSections) {
            const existingSection = await tx.query.sections.findFirst({
              where: and(
                eq(sections.schoolId, schoolId),
                eq(sections.classId, existingClass.id),
                eq(sections.name, secName)
              ),
            });
            if (!existingSection) {
              await tx.insert(sections).values({
                schoolId,
                classId: existingClass.id,
                name: secName,
                capacity: 40,
                isActive: true,
              });
              sectionsCreated++;
            }
          }
        }
      }

      // 4. Clone Subjects
      let subjectsCreated = 0;
      const createdSubjectMap = new Map<string, string>(); // code -> subjectId

      for (const sub of blueprint.subjects) {
        let existingSub = await tx.query.subjects.findFirst({
          where: and(eq(subjects.schoolId, schoolId), eq(subjects.code, sub.code)),
        });

        if (!existingSub) {
          const [newSub] = await tx
            .insert(subjects)
            .values({
              schoolId,
              name: sub.name,
              code: sub.code,
              subjectType: sub.subjectType as any,
              maxMarks: 100,
              passingMarks: 33,
              isActive: true,
            })
            .returning();
          existingSub = newSub;
          subjectsCreated++;
        }

        if (existingSub) {
          createdSubjectMap.set(sub.code, existingSub.id);
        }
      }

      // 5. Connect Class-Subject Mappings
      let classSubjectsCreated = 0;
      const allClasses = await tx.query.classes.findMany({
        where: and(eq(classes.schoolId, schoolId), eq(classes.academicYearId, activeYear.id)),
      });

      for (const cls of allClasses) {
        for (const sub of blueprint.subjects) {
          const subId = createdSubjectMap.get(sub.code);
          if (subId) {
            const existingMapping = await tx.query.classSubjects.findFirst({
              where: and(
                eq(classSubjects.schoolId, schoolId),
                eq(classSubjects.classId, cls.id),
                eq(classSubjects.subjectId, subId)
              ),
            });
            if (!existingMapping) {
              await tx.insert(classSubjects).values({
                schoolId,
                classId: cls.id,
                subjectId: subId,
                periodsPerWeek: sub.weeklyPeriods,
                isElective: sub.isOptional,
              });
              classSubjectsCreated++;
            }
          }
        }
      }

      // 6. Clone Fee Heads (Zero pricing default)
      let feeHeadsCreated = 0;
      for (const fh of blueprint.feeHeads) {
        const existingFh = await tx.query.feeHeads.findFirst({
          where: and(eq(feeHeads.schoolId, schoolId), eq(feeHeads.name, fh.name)),
        });
        if (!existingFh) {
          await tx.insert(feeHeads).values({
            schoolId,
            name: fh.name,
            code: `FH_${fh.sortOrder}`,
            priority: fh.sortOrder,
            category: "RECURRING",
            headType: (fh.headType === "EXAMINATION" ? "EXAM" : fh.headType) as any,
            discountEligible: fh.headType === "TUITION" || fh.headType === "LAB",
            isRefundable: false,
            isActive: true,
          });
          feeHeadsCreated++;
        }
      }

      // 7. Seed Standard Departments & Salary Templates
      let departmentsCreated = 0;
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

      for (const dept of standardDepartments) {
        const existingDept = await tx.query.departments.findFirst({
          where: and(eq(departments.schoolId, schoolId), eq(departments.name, dept.name)),
        });
        if (!existingDept) {
          await tx.insert(departments).values({
            schoolId,
            name: dept.name,
            isActive: true,
          });
          departmentsCreated++;
        }
      }

      let salaryTemplatesCreated = 0;
      const stateTax = (school.state && normalizeProfessionalTaxState(school.state)) || "DL";
      for (const sg of blueprint.salaryGrades) {
        const existingTpl = await tx.query.salaryTemplates.findFirst({
          where: and(eq(salaryTemplates.schoolId, schoolId), eq(salaryTemplates.name, sg.gradeName)),
        });
        if (!existingTpl) {
          await tx.insert(salaryTemplates).values({
            schoolId,
            name: sg.gradeName,
            basicPercent: "50.00",
            hraPercent: String(sg.hraPercent) + ".00",
            daPercent: String(sg.daPercent) + ".00",
            pfEmployeePercent: String(sg.pfPercent) + ".00",
            pfEmployerPercent: String(sg.pfPercent) + ".00",
            esiApplicable: false,
            professionalTaxState: stateTax,
            isActive: true,
          });
          salaryTemplatesCreated++;
        }
      }

      // 8. Clone Holidays into Events
      let holidaysCreated = 0;
      for (const hol of blueprint.holidays) {
        const holidayYear = hol.month < blueprint.academicYear.startMonth ? endYear : startYear;
        const holidayDate = new Date(`${holidayYear}-${String(hol.month).padStart(2, "0")}-${String(hol.day).padStart(2, "0")}`);

        const existingEvent = await tx.query.events.findFirst({
          where: and(
            eq(events.schoolId, schoolId),
            eq(events.title, hol.name),
            eq(events.eventType, "HOLIDAY")
          ),
        });

        if (!existingEvent) {
          await tx.insert(events).values({
            schoolId,
            title: hol.name,
            description: `Official school holiday: ${hol.name}`,
            startDate: holidayDate,
            endDate: holidayDate,
            eventType: "HOLIDAY",
            isPublic: true,
            createdById: operatorUserId,
          });
          holidaysCreated++;
        }
      }

      // 9. Seed Standard Roles
      let rolesCreated = 0;
      for (const r of blueprint.roleDefaults) {
        const existingRole = await tx.query.roles.findFirst({
          where: and(eq(roles.schoolId, schoolId), eq(roles.name, r.roleName as any)),
        });
        if (!existingRole) {
          await tx.insert(roles).values({
            schoolId,
            name: r.roleName as any,
            displayName: r.displayName,
            isSystemRole: true,
          });
          rolesCreated++;
        }
      }

      // 10. Clone Bell Schedule (Instructional Periods 1..N)
      let bellSchedulePeriodsCreated = 0;
      if (blueprint.bellSchedule?.periods) {
        const instructionalPeriods = blueprint.bellSchedule.periods.filter(
          (p) => p.periodNumber > 0
        );

        for (const p of instructionalPeriods) {
          const existingPeriod = await tx.query.bellSchedule.findFirst({
            where: and(
              eq(bellSchedule.schoolId, schoolId),
              eq(bellSchedule.periodNumber, p.periodNumber)
            ),
          });

          if (!existingPeriod) {
            await tx
              .insert(bellSchedule)
              .values({
                schoolId,
                periodNumber: p.periodNumber,
                name: `Period ${p.periodNumber}`,
                startTime: p.startTime,
                endTime: p.endTime,
                periodType: (p.periodType === "ASSEMBLY"
                  ? "ASSEMBLY"
                  : p.periodType === "SHORT_BREAK"
                  ? "BREAK"
                  : p.periodType === "LUNCH_BREAK"
                  ? "LUNCH"
                  : "REGULAR") as any,
                isActive: true,
              })
              .onConflictDoNothing();
            bellSchedulePeriodsCreated++;
          } else if (!existingPeriod.isActive) {
            // Reactivate if previously deactivated to respect unique constraint and restore active period
            await tx
              .update(bellSchedule)
              .set({
                isActive: true,
                name: existingPeriod.name || `Period ${p.periodNumber}`,
                startTime: p.startTime,
                endTime: p.endTime,
              })
              .where(eq(bellSchedule.id, existingPeriod.id));
            bellSchedulePeriodsCreated++;
          }
        }
      }

      // 11. Record Provenance & Idempotency Lock in school_provisions
      const entityCounts = {
        classes: classesCreated,
        sections: sectionsCreated,
        subjects: subjectsCreated,
        classSubjects: classSubjectsCreated,
        feeHeads: feeHeadsCreated,
        departments: departmentsCreated,
        salaryTemplates: salaryTemplatesCreated,
        holidays: holidaysCreated,
        roles: rolesCreated,
        bellSchedulePeriods: bellSchedulePeriodsCreated,
      };

      const [provisionRecord] = await tx
        .insert(schoolProvisions)
        .values({
          schoolId,
          profileId: profile!.id,
          blueprintVersion: blueprint.version,
          provisionedBy: operatorUserId,
          status: "COMPLETED",
          entityCounts,
          notes: notes || `Provisioned from blueprint '${blueprint.displayName}'.`,
        })
        .returning();

      return {
        success: true,
        message: `School '${school.name}' provisioned successfully with ${blueprint.displayName}!`,
        provisionId: provisionRecord?.id,
        entityCounts,
      };
    });
  } catch (err: any) {
    console.error("executeProvisionSchool error:", err);
    return {
      success: false,
      message: err?.message || "Failed to provision school configuration.",
    };
  }
}

/**
 * Top-Up Provisioning Engine: Scoped exclusively to bell schedule periods.
 * Adds missing periods (1..periodsPerDay) for an existing/already-provisioned school
 * without re-cloning other entities (classes, subjects, fees) and without breaching
 * the sp_school_unique constraint on school_provisions.
 */
export async function topUpSchoolProvision(
  schoolId: string,
  blueprintId?: string
): Promise<TopUpResult> {
  const school = await db.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  if (!school) {
    return {
      success: false,
      addedCount: 0,
      message: `School with ID '${schoolId}' was not found.`,
    };
  }

  const priorProvision = await db.query.schoolProvisions.findFirst({
    where: eq(schoolProvisions.schoolId, schoolId),
  });

  // Determine blueprint: explicitly requested -> prior provision profile -> fallback default
  let blueprint: CanonicalBlueprint | undefined;
  if (blueprintId) {
    blueprint = getCanonicalBlueprint(blueprintId);
  } else if (priorProvision?.profileId) {
    const profile = await db.query.globalTemplateProfiles.findFirst({
      where: eq(globalTemplateProfiles.id, priorProvision.profileId),
    });
    if (profile) {
      blueprint = getAllCanonicalBlueprints().find(
        (b) => b.board === profile.board && b.schoolType === profile.schoolType
      );
    }
  }

  if (!blueprint) {
    blueprint = getCanonicalBlueprint("cbse-secondary-v1") || getAllCanonicalBlueprints()[0];
  }

  if (!blueprint) {
    return {
      success: false,
      addedCount: 0,
      message: `Could not resolve a canonical blueprint for school '${school.name}'.`,
    };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Establish tenant context
      await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);

      // 2. Fetch existing bell schedule periods for this school
      const existingPeriods = await tx.query.bellSchedule.findMany({
        where: eq(bellSchedule.schoolId, schoolId),
      });

      // 3. Add missing periods 1..periodsPerDay
      let addedCount = 0;
      const periodsToClone = blueprint.bellSchedule.periods.filter(
        (p) => p.periodNumber >= 1 && p.periodNumber <= blueprint.bellSchedule.periodsPerDay
      );

      for (const p of periodsToClone) {
        const existing = existingPeriods.find((ep) => ep.periodNumber === p.periodNumber);
        if (!existing) {
          await tx.insert(bellSchedule).values({
            schoolId,
            periodNumber: p.periodNumber,
            name: p.periodType === "ACTIVITY" ? `Period ${p.periodNumber} (Activity)` : `Period ${p.periodNumber}`,
            startTime: p.startTime,
            endTime: p.endTime,
            periodType: "REGULAR",
            isActive: true,
          });
          addedCount++;
        } else if (!existing.isActive) {
          await tx
            .update(bellSchedule)
            .set({
              isActive: true,
              name: existing.name || (p.periodType === "ACTIVITY" ? `Period ${p.periodNumber} (Activity)` : `Period ${p.periodNumber}`),
              startTime: p.startTime,
              endTime: p.endTime,
            })
            .where(eq(bellSchedule.id, existing.id));
          addedCount++;
        }
      }

      // 4. Update schoolProvisions entityCounts without inserting new record (strict sp_school_unique compliance)
      if (priorProvision) {
        const prevCounts = (typeof priorProvision.entityCounts === "object" && priorProvision.entityCounts !== null)
          ? (priorProvision.entityCounts as Record<string, number>)
          : {};

        const updatedEntityCounts = {
          ...prevCounts,
          bellSchedule: existingPeriods.length + addedCount,
          bellSchedulePeriods: existingPeriods.length + addedCount,
        };

        await tx
          .update(schoolProvisions)
          .set({ entityCounts: updatedEntityCounts })
          .where(eq(schoolProvisions.id, priorProvision.id));
      }

      return {
        success: true,
        addedCount,
        message: addedCount > 0
          ? `Bell schedule for '${school.name}' topped up with ${addedCount} period(s).`
          : `Bell schedule for '${school.name}' is already up-to-date (${existingPeriods.length} existing periods).`,
      };
    });
  } catch (err: any) {
    console.error("topUpSchoolProvision error:", err);
    return {
      success: false,
      addedCount: 0,
      message: err?.message || "Failed to top up bell schedule.",
    };
  }
}
