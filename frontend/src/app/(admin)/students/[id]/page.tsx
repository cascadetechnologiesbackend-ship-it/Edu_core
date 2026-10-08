import { db } from "@/db";
import {
  students,
  studentFamilyMembers,
  studentDocuments,
  studentClassHistory,
  studentAttendance,
  admissionApplications,
  admissionWorkflowSteps,
  classes,
  sections,
  academicYears,
  classSubjects,
  sectionSubjectTeachers,
  feeStructures,
  feeInvoices,
  feeConcessions,
  users,
  staff,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getSignedDownloadUrl } from "@/lib/s3";
import { notFound, redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { decryptData } from "@/lib/encryption";
import { Student360Client, Student360Data } from "./Student360Client";

export default async function StudentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, `/students/${params.id}`, { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const school = await requireSchool(ctx);

  // 1. Fetch Student Record scoped strictly to school
  const student = await db.query.students.findFirst({
    where: and(
      eq(students.id, params.id),
      eq(students.schoolId, school.id),
    ),
    with: {
      academicYear: true,
    },
  });

  if (!student) {
    notFound();
  }

  // 2. Role-Based Access Control Verification for Teachers
  if (ctx.role === "TEACHER") {
    const [isClassTeacher, isSubjectTeacher, isClassSubjectTeacher] = await Promise.all([
      student.currentSectionId
        ? db.query.sections.findFirst({
            where: and(
              eq(sections.id, student.currentSectionId),
              eq(sections.classTeacherId, ctx.userId),
            ),
          })
        : Promise.resolve(null),
      student.currentSectionId
        ? db.query.sectionSubjectTeachers.findFirst({
            where: and(
              eq(sectionSubjectTeachers.sectionId, student.currentSectionId),
              eq(sectionSubjectTeachers.teacherId, ctx.userId),
              eq(sectionSubjectTeachers.isActive, true),
            ),
          })
        : Promise.resolve(null),
      student.currentClassId
        ? db.query.classSubjects.findFirst({
            where: and(
              eq(classSubjects.classId, student.currentClassId),
              eq(classSubjects.assignedTeacherId, ctx.userId),
            ),
          })
        : Promise.resolve(null),
    ]);

    if (!isClassTeacher && !isSubjectTeacher && !isClassSubjectTeacher) {
      return (
        <div className="p-12 max-w-lg mx-auto text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Access Denied
          </h2>
          <p className="text-sm text-gray-500">
            You are not assigned to this student's class or subjects.
          </p>
        </div>
      );
    }
  }

  const canViewFees = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "ACCOUNTANT",
    "PARENT",
  ].includes(ctx.role);
  const canMutateFees = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "ACCOUNTANT",
  ].includes(ctx.role);

  // 3. Parallel Execution: Run all independent queries simultaneously in a single Promise.all
  const [
    currentClass,
    currentSection,
    classSubjectsList,
    sectionAllocations,
    attendanceEntries,
    feeStructuresList,
    studentInvoicesList,
    studentConcessionsList,
    familyMembers,
    documents,
    history,
    allClasses,
    allSecs,
  ] = await Promise.all([
    // Current Class
    student.currentClassId
      ? db.query.classes.findFirst({
          where: eq(classes.id, student.currentClassId),
        })
      : Promise.resolve(null),

    // Current Section with classTeacher relation
    student.currentSectionId
      ? db.query.sections.findFirst({
          where: eq(sections.id, student.currentSectionId),
          with: { classTeacher: true },
        })
      : Promise.resolve(null),

    // Class Subjects
    student.currentClassId
      ? db.query.classSubjects.findMany({
          where: eq(classSubjects.classId, student.currentClassId),
          with: {
            subject: true,
            teacher: true,
          },
        })
      : Promise.resolve([]),

    // Section Allocations
    student.currentSectionId
      ? db.query.sectionSubjectTeachers.findMany({
          where: and(
            eq(sectionSubjectTeachers.sectionId, student.currentSectionId),
            eq(sectionSubjectTeachers.isActive, true),
          ),
          with: {
            teacher: true,
          },
        })
      : Promise.resolve([]),

    // Attendance
    db.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.studentId, student.id),
        eq(studentAttendance.schoolId, school.id),
      ),
      orderBy: [desc(studentAttendance.attendanceDate)],
      limit: 50,
    }),

    // Fee Structures
    canViewFees && student.currentClassId
      ? db.query.feeStructures.findMany({
          where: and(
            eq(feeStructures.classId, student.currentClassId),
            eq(feeStructures.schoolId, school.id),
          ),
          with: { feeHead: true },
        })
      : Promise.resolve([]),

    // Fee Invoices
    canViewFees
      ? db.query.feeInvoices.findMany({
          where: and(
            eq(feeInvoices.studentId, student.id),
            eq(feeInvoices.schoolId, school.id),
          ),
          with: {
            feeStructure: {
              with: {
                feeHead: true,
              },
            },
          },
          orderBy: [desc(feeInvoices.createdAt)],
        })
      : Promise.resolve([]),

    // Fee Concessions
    canViewFees
      ? db.query.feeConcessions.findMany({
          where: and(
            eq(feeConcessions.studentId, student.id),
            eq(feeConcessions.schoolId, school.id),
          ),
        })
      : Promise.resolve([]),

    // Family Members
    db.query.studentFamilyMembers.findMany({
      where: and(
        eq(studentFamilyMembers.studentId, student.id),
        eq(studentFamilyMembers.schoolId, school.id),
      ),
    }),

    // Documents
    db.query.studentDocuments.findMany({
      where: and(
        eq(studentDocuments.studentId, student.id),
        eq(studentDocuments.schoolId, school.id),
      ),
      orderBy: [desc(studentDocuments.createdAt)],
    }),

    // Class History
    db.query.studentClassHistory.findMany({
      where: and(
        eq(studentClassHistory.studentId, student.id),
        eq(studentClassHistory.schoolId, school.id),
      ),
      with: {
        academicYear: true,
      },
      orderBy: [desc(studentClassHistory.createdAt)],
    }),

    // All Classes (for history resolution)
    db.query.classes.findMany({
      where: eq(classes.schoolId, school.id),
    }),

    // All Sections (for history resolution)
    db.query.sections.findMany({
      where: eq(sections.schoolId, school.id),
    }),
  ]);

  // 4. Resolve Subject Teachers & Staff Profiles
  const classTeacherUser = currentSection?.classTeacher;
  const allocationMap = new Map(
    sectionAllocations.map((a) => [a.classSubjectId, a.teacher]),
  );

  const teacherUserIds = Array.from(
    new Set(
      [
        currentSection?.classTeacherId,
        ...sectionAllocations.map((a) => a.teacherId),
        ...classSubjectsList.map((cs) => cs.assignedTeacherId),
      ].filter(Boolean) as string[],
    ),
  );

  const staffProfiles =
    teacherUserIds.length > 0
      ? await db.query.staff.findMany({
          where: and(
            eq(staff.schoolId, school.id),
            inArray(staff.userId, teacherUserIds),
          ),
        })
      : [];

  const staffNameMap = new Map<string, string>();
  for (const s of staffProfiles) {
    if (s.userId) {
      const fName = decryptData(s.firstNameEncrypted) || "";
      const lName = decryptData(s.lastNameEncrypted) || "";
      const fullName = `${fName} ${lName}`.trim();
      if (fullName) staffNameMap.set(s.userId, fullName);
    }
  }

  const subjects = classSubjectsList.map((cs) => {
    const overrideTeacher = allocationMap.get(cs.id);
    const teacherId = overrideTeacher?.id || cs.teacher?.id;
    const teacherName =
      (teacherId && staffNameMap.get(teacherId)) ||
      overrideTeacher?.email?.split("@")[0] ||
      cs.teacher?.email?.split("@")[0] ||
      "Not Assigned";

    return {
      id: cs.id,
      name: cs.subject?.name || "Subject",
      code: cs.subject?.code || "SUB",
      teacherName,
    };
  });

  // 5. Compute Attendance Percentages
  const totalAtt = attendanceEntries.length;
  const presentCount = attendanceEntries.filter(
    (a) => a.status === "PRESENT",
  ).length;
  const absentCount = attendanceEntries.filter(
    (a) => a.status === "ABSENT",
  ).length;
  const lateCount = attendanceEntries.filter((a) => a.status === "LATE").length;
  const attendancePercentage =
    totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 100;

  const applicableFeeStructures = feeStructuresList;
  const studentInvoices = studentInvoicesList;
  const studentConcessions = studentConcessionsList;

  const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
  const secMap = new Map(allSecs.map((s) => [s.id, s.name]));

  const mappedHistory = history.map((h) => ({
    id: h.id,
    academicYearLabel: h.academicYear?.label || "Session",
    className: classMap.get(h.classId) || "Class",
    sectionName: secMap.get(h.sectionId) || "A",
    promotionStatus: h.promotionStatus,
    createdAt: h.createdAt.toISOString(),
  }));

  // 10. Compile Chronological Timeline Events
  const timelineEvents: Student360Data["timelineEvents"] = [];

  // Admission application milestones
  if (student.admissionApplicationId) {
    const app = await db.query.admissionApplications.findFirst({
      where: eq(admissionApplications.id, student.admissionApplicationId),
      with: { workflowSteps: true },
    });
    if (app) {
      timelineEvents.push({
        id: `app-${app.id}`,
        date: app.createdAt.toISOString(),
        title: `Application Submitted (${app.applicationNumber})`,
        description: `Admission application submitted for Grade ${app.gradeAppliedFor}.`,
        type: "ADMISSION",
      });
      if (app.workflowSteps) {
        for (const step of app.workflowSteps) {
          if (step.stepName !== "APPLICATION_SUBMITTED" && step.completedAt) {
            timelineEvents.push({
              id: `step-${step.id}`,
              date: step.completedAt.toISOString(),
              title: `Workflow: ${step.stepName}`,
              description: step.notes || `Application progressed to ${step.stepName}.`,
              type: "ADMISSION",
            });
          }
        }
      }
    }
  }

  // Enrollment milestone
  timelineEvents.push({
    id: `enroll-${student.id}`,
    date: student.admissionDate.toISOString(),
    title: `Enrolled into ${currentClass?.displayName || "Class"} • Section ${currentSection?.name || "A"}`,
    description: `Official institutional admission record established under Admission No ${student.admissionNumber}.`,
    type: "ENROLLMENT",
  });

  // History / promotion events
  for (const h of mappedHistory) {
    if (h.promotionStatus === "PROMOTED") {
      timelineEvents.push({
        id: `history-${h.id}`,
        date: h.createdAt,
        title: `Promoted to ${h.className} • Section ${h.sectionName}`,
        description: `Academic advancement recorded for session ${h.academicYearLabel}.`,
        type: "ACADEMIC",
      });
    }
  }

  // Sort timeline chronologically descending
  timelineEvents.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // Available classes and academic years for Promotion Modal
  const availableClasses = await db.query.classes.findMany({
    where: and(
      eq(classes.schoolId, school.id),
      eq(classes.isActive, true),
    ),
    with: {
      sections: {
        where: eq(sections.isActive, true),
      },
    },
    orderBy: [classes.sortOrder, classes.displayName],
  });

  const availableYears = await db.query.academicYears.findMany({
    where: eq(academicYears.schoolId, school.id),
    orderBy: [desc(academicYears.startDate)],
  });

  // Photo signed URL
  const photoUrl = student.photoS3Key
    ? await getSignedDownloadUrl(
        student.photoS3Key,
        process.env.S3_BUCKET_NAME || "schoolmitra",
      )
    : null;

  const firstName = decryptData(student.firstNameEncrypted) || "Unknown";
  const lastName = decryptData(student.lastNameEncrypted) || "";
  const fullName = `${firstName} ${lastName}`.trim();

  const student360Data: Student360Data = {
    id: student.id,
    admissionNumber: student.admissionNumber,
    fullName,
    dateOfBirth: student.dateOfBirth?.toISOString() || null,
    gender: student.gender,
    category: student.category,
    bloodGroup: student.bloodGroup,
    aadhaarLast4: student.aadhaarLast4,
    apaarId: student.apaarId,
    photoUrl,
    isActive: student.isActive,
    admissionDate: student.admissionDate.toISOString(),
    leavingDate: student.leavingDate?.toISOString() || null,
    leavingReason: student.leavingReason,
    className: currentClass?.displayName || "",
    sectionName: currentSection?.name || "",
    academicYearLabel: student.academicYear?.label || "",
    classTeacherName:
      (classTeacherUser?.id && staffNameMap.get(classTeacherUser.id)) ||
      classTeacherUser?.email?.split("@")[0] ||
      null,
    familyMembers: familyMembers.map((fm) => ({
      id: fm.id,
      relation: fm.relation,
      name: decryptData(fm.nameEncrypted) || "Guardian",
      mobile: decryptData(fm.mobileEncrypted),
      email: decryptData(fm.emailEncrypted),
      isPrimaryContact: fm.isPrimaryContact,
      isEmergencyContact: fm.isEmergencyContact,
      hasConsentAuthority: fm.hasConsentAuthority,
    })),
    subjects,
    attendanceSummary: {
      total: totalAtt,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      percentage: attendancePercentage,
    },
    attendanceLogs: attendanceEntries.map((log) => ({
      id: log.id,
      date: log.attendanceDate.toISOString(),
      status: log.status,
      remarks: log.remarks,
    })),
    canViewFees,
    canMutateFees,
    feeStructures: applicableFeeStructures.map((fs) => ({
      id: fs.id,
      name: fs.feeHead?.name || "Fee",
      term: fs.term,
      amount: fs.amount,
      dueDate: fs.dueDate.toISOString(),
    })),
    invoices: studentInvoices.map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      feeTypeName: inv.feeStructure?.feeHead?.name || "Tuition / General Fee",
      netAmount: inv.netAmount,
      paidAmount: inv.paidAmount,
      balanceAmount: inv.balanceAmount,
      status: inv.status,
      dueDate: inv.dueDate.toISOString(),
      term: inv.term,
    })),
    concessions: studentConcessions.map((c) => ({
      id: c.id,
      concessionName: c.concessionName,
      concessionType: c.concessionType,
      discountPercentage: c.discountPercentage,
      discountAmount: c.discountAmount,
    })),
    documents: documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      originalFileName: doc.originalFileName,
      isVerified: doc.isVerified,
      createdAt: doc.createdAt.toISOString(),
    })),
    classHistory: mappedHistory,
    timelineEvents,
  };

  return (
    <div className="p-6">
      <Student360Client
        data={student360Data}
        schoolId={school.id}
        availableClasses={availableClasses.map((c) => ({
          id: c.id,
          name: c.displayName,
          sections: c.sections?.map((s) => ({ id: s.id, name: s.name })),
        }))}
        availableYears={availableYears.map((y) => ({
          id: y.id,
          label: y.label,
        }))}
      />
    </div>
  );
}
