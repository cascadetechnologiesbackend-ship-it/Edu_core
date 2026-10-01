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
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getSignedDownloadUrl } from "@/lib/s3";
import { notFound } from "next/navigation";
import { Student360Client, Student360Data } from "./Student360Client";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function decryptData(encryptedText: string | null) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(":");
    const ivStr = parts[0];
    const encryptedStr = parts[1];
    if (!ivStr || !encryptedStr) return encryptedText;

    const iv = Buffer.from(ivStr, "hex");
    const encrypted = Buffer.from(encryptedStr, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv,
    );
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return encryptedText;
  }
}

export default async function StudentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireAuth();
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

  // 2. Role-Based Access Control Verification
  if (ctx.role === "TEACHER") {
    // Check if teacher is class teacher of student's section
    const isClassTeacher = student.currentSectionId
      ? await db.query.sections.findFirst({
          where: and(
            eq(sections.id, student.currentSectionId),
            eq(sections.classTeacherId, ctx.userId),
          ),
        })
      : null;

    // Check if teacher teaches any subject to this student's section
    const isSubjectTeacher = student.currentSectionId
      ? await db.query.sectionSubjectTeachers.findFirst({
          where: and(
            eq(sectionSubjectTeachers.sectionId, student.currentSectionId),
            eq(sectionSubjectTeachers.teacherId, ctx.userId),
            eq(sectionSubjectTeachers.isActive, true),
          ),
        })
      : null;

    // Check if teacher is default teacher for any class subjects
    const isClassSubjectTeacher = student.currentClassId
      ? await db.query.classSubjects.findFirst({
          where: and(
            eq(classSubjects.classId, student.currentClassId),
            eq(classSubjects.assignedTeacherId, ctx.userId),
          ),
        })
      : null;

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

  // 3. Resolve Current Placement
  const currentClass = student.currentClassId
    ? await db.query.classes.findFirst({
        where: eq(classes.id, student.currentClassId),
      })
    : null;

  const currentSection = student.currentSectionId
    ? await db.query.sections.findFirst({
        where: eq(sections.id, student.currentSectionId),
      })
    : null;

  const classTeacherUser = currentSection?.classTeacherId
    ? await db.query.users.findFirst({
        where: eq(users.id, currentSection.classTeacherId),
      })
    : null;

  // 4. Resolve Subjects & Teachers
  const classSubjectsList = student.currentClassId
    ? await db.query.classSubjects.findMany({
        where: eq(classSubjects.classId, student.currentClassId),
        with: {
          subject: true,
          teacher: true,
        },
      })
    : [];

  const sectionAllocations = student.currentSectionId
    ? await db.query.sectionSubjectTeachers.findMany({
        where: and(
          eq(sectionSubjectTeachers.sectionId, student.currentSectionId),
          eq(sectionSubjectTeachers.isActive, true),
        ),
        with: {
          teacher: true,
        },
      })
    : [];
  const allocationMap = new Map(
    sectionAllocations.map((a) => [a.classSubjectId, a.teacher]),
  );

  const subjects = classSubjectsList.map((cs) => {
    const overrideTeacher = allocationMap.get(cs.id);
    const teacherName =
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

  // 5. Resolve Attendance
  const attendanceEntries = await db.query.studentAttendance.findMany({
    where: and(
      eq(studentAttendance.studentId, student.id),
      eq(studentAttendance.schoolId, school.id),
    ),
    orderBy: [desc(studentAttendance.attendanceDate)],
    limit: 50,
  });

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

  // 6. Resolve Fees (Accountant, Admin, Parent only)
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

  let applicableFeeStructures: any[] = [];
  let studentInvoices: any[] = [];
  let studentConcessions: any[] = [];

  if (canViewFees && student.currentClassId) {
    applicableFeeStructures = await db.query.feeStructures.findMany({
      where: and(
        eq(feeStructures.classId, student.currentClassId),
        eq(feeStructures.schoolId, school.id),
      ),
      with: { feeHead: true },
    });

    studentInvoices = await db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.studentId, student.id),
        eq(feeInvoices.schoolId, school.id),
      ),
      orderBy: [desc(feeInvoices.createdAt)],
    });

    studentConcessions = await db.query.feeConcessions.findMany({
      where: and(
        eq(feeConcessions.studentId, student.id),
        eq(feeConcessions.schoolId, school.id),
      ),
    });
  }

  // 7. Resolve Family Members
  const familyMembers = await db.query.studentFamilyMembers.findMany({
    where: and(
      eq(studentFamilyMembers.studentId, student.id),
      eq(studentFamilyMembers.schoolId, school.id),
    ),
  });

  // 8. Resolve Documents
  const documents = await db.query.studentDocuments.findMany({
    where: and(
      eq(studentDocuments.studentId, student.id),
      eq(studentDocuments.schoolId, school.id),
    ),
    orderBy: [desc(studentDocuments.createdAt)],
  });

  // 9. Resolve Academic Class History
  const history = await db.query.studentClassHistory.findMany({
    where: and(
      eq(studentClassHistory.studentId, student.id),
      eq(studentClassHistory.schoolId, school.id),
    ),
    with: {
      academicYear: true,
    },
    orderBy: [desc(studentClassHistory.createdAt)],
  });

  const allClasses = await db.query.classes.findMany({
    where: eq(classes.schoolId, school.id),
  });
  const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));

  const allSecs = await db.query.sections.findMany({
    where: eq(sections.schoolId, school.id),
  });
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
    classTeacherName: classTeacherUser?.email?.split("@")[0] || null,
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
    invoices: studentInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
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
