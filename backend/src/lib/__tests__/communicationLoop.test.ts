/**
 * Sprint S22 Layer 1: Authoritative Communication Loop Test Suite
 *
 * Verifies:
 * - Allocation-scoped recipient resolution (homeroom + subject teachers).
 * - Thread grouping, last message snippets, and unread counts.
 * - Read receipts and thread marking.
 * - Strict multi-tenant isolation (School A vs School B).
 * - Displacement law: Revoking a teacher's allocation immediately removes conversations from inbox.
 * - Logged moderation audit view for admins (OD4).
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  parentTeacherMessages,
  classes,
  sections,
  subjects,
  classSubjects,
  classTeacherAssignments,
  sectionSubjectTeachers,
  students,
  users,
  persons,
  auditLogs,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import {
  resolveChildTeachers,
  validateMessageRecipient,
  getParentConversations,
  getTeacherConversations,
  getThreadMessages,
  markThreadRead,
  getAdminModerationConversations,
} from "../communicationLoop";
import { encryptData } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";

describe("Sprint S22 Layer 1: Communication Loop Engine", { timeout: 30000 }, () => {
  const schoolAId = ISOLATION_IDS.schoolA.id;
  const schoolBId = ISOLATION_IDS.schoolB.id;
  const academicYearAId = ISOLATION_IDS.schoolA.academicYearId;
  const parentAId = ISOLATION_IDS.schoolA.parentUserId;
  const teacherA1Id = ISOLATION_IDS.schoolA.teacherA1UserId;
  const teacherA2Id = ISOLATION_IDS.schoolA.teacherA2UserId;
  const adminAId = ISOLATION_IDS.schoolA.adminUserId;
  const studentAId = ISOLATION_IDS.schoolA.studentId;

  let sectionAId: string;
  let classSubjectAId: string;

  beforeAll(async () => {
    await seedIsolationSchools();

    // Seed Section A, ClassSubject A, ClassTeacher Assignment, and SubjectTeacher Assignment in School A
    await withTenant(schoolAId, async (tx) => {
      // 1. Section
      let existingSec = await tx.query.sections.findFirst({
        where: and(
          eq(sections.schoolId, schoolAId),
          eq(sections.classId, ISOLATION_IDS.schoolA.classId),
          eq(sections.name, "Section A"),
        ),
      });
      if (!existingSec) {
        const [sec] = await tx
          .insert(sections)
          .values({
            schoolId: schoolAId,
            classId: ISOLATION_IDS.schoolA.classId,
            name: "Section A",
            capacity: 40,
            isActive: true,
          })
          .returning();
        existingSec = sec;
      }
      sectionAId = existingSec!.id;

      // Update student's currentSectionId
      await tx
        .update(students)
        .set({ currentSectionId: sectionAId })
        .where(eq(students.id, studentAId));

      // 2. Class Subject
      let existingCs = await tx.query.classSubjects.findFirst({
        where: and(
          eq(classSubjects.classId, ISOLATION_IDS.schoolA.classId),
          eq(classSubjects.subjectId, ISOLATION_IDS.schoolA.subjectId),
        ),
      });
      if (!existingCs) {
        const [cs] = await tx
          .insert(classSubjects)
          .values({
            schoolId: schoolAId,
            classId: ISOLATION_IDS.schoolA.classId,
            subjectId: ISOLATION_IDS.schoolA.subjectId,
            periodsPerWeek: 5,
          })
          .returning();
        existingCs = cs;
      }
      classSubjectAId = existingCs!.id;

      // 3. Class Teacher assignment for teacherA1
      const existingCt = await tx.query.classTeacherAssignments.findFirst({
        where: and(
          eq(classTeacherAssignments.schoolId, schoolAId),
          eq(classTeacherAssignments.sectionId, sectionAId),
          eq(classTeacherAssignments.teacherId, teacherA1Id),
        ),
      });
      if (!existingCt) {
        await tx.insert(classTeacherAssignments).values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          sectionId: sectionAId,
          teacherId: teacherA1Id,
          isActive: true,
          effectiveFrom: "2026-04-01",
        });
      }

      // 4. Section Subject Teacher assignment for teacherA2
      const existingSt = await tx.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.schoolId, schoolAId),
          eq(sectionSubjectTeachers.sectionId, sectionAId),
          eq(sectionSubjectTeachers.teacherId, teacherA2Id),
        ),
      });
      if (!existingSt) {
        await tx.insert(sectionSubjectTeachers).values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          classSubjectId: classSubjectAId,
          sectionId: sectionAId,
          teacherId: teacherA2Id,
          isActive: true,
          effectiveFrom: "2026-04-01",
        });
      }

      // 5. Persons records for teacherA1 and teacherA2
      await tx
        .insert(persons)
        .values({
          schoolId: schoolAId,
          userId: teacherA1Id,
          primaryType: "STAFF",
          firstNameEncrypted: encryptData("Sunita"),
          lastNameEncrypted: encryptData("Verma"),
          firstNameSearchHash: "hash_sunita",
          lastNameSearchHash: "hash_verma",
          gender: "FEMALE",
          isActive: true,
        })
        .onConflictDoNothing();

      await tx
        .insert(persons)
        .values({
          schoolId: schoolAId,
          userId: teacherA2Id,
          primaryType: "STAFF",
          firstNameEncrypted: encryptData("Rajesh"),
          lastNameEncrypted: encryptData("Sharma"),
          firstNameSearchHash: "hash_rajesh",
          lastNameSearchHash: "hash_sharma",
          gender: "MALE",
          isActive: true,
        })
        .onConflictDoNothing();
    });
  });

  it("1. resolveChildTeachers: resolves both homeroom and subject teachers for parent's children", async () => {
    const teachers = await resolveChildTeachers(schoolAId, parentAId);

    expect(teachers.length).toBeGreaterThanOrEqual(2);

    const homeroom = teachers.find((t) => t.isClassTeacher);
    expect(homeroom).toBeDefined();
    expect(homeroom?.teacherUserId).toBe(teacherA1Id);
    expect(homeroom?.roleTitle).toBe("Class Teacher");
    expect(homeroom?.teacherName).toContain("Sunita");

    const subject = teachers.find((t) => !t.isClassTeacher && t.teacherUserId === teacherA2Id);
    expect(subject).toBeDefined();
    expect(subject?.roleTitle).toContain("Teacher");
    expect(subject?.teacherName).toContain("Rajesh");
  });

  it("2. validateMessageRecipient: validates permissible recipients and rejects cross-tenant/unallocated targets", async () => {
    // Valid: Parent to assigned Class Teacher
    const validParentSend = await validateMessageRecipient(
      schoolAId,
      parentAId,
      "PARENT",
      teacherA1Id,
      studentAId,
    );
    expect(validParentSend).toBe(true);

    // Invalid: Parent to unassigned user / cross-tenant user
    const teacherB1Id = ISOLATION_IDS.schoolB.teacherB1UserId;
    await expect(
      validateMessageRecipient(schoolAId, parentAId, "PARENT", teacherB1Id, studentAId),
    ).rejects.toThrow(/not currently assigned as a teacher/);

    // Valid: Allocated Teacher to Parent
    const validTeacherSend = await validateMessageRecipient(
      schoolAId,
      teacherA1Id,
      "TEACHER",
      parentAId,
      studentAId,
    );
    expect(validTeacherSend).toBe(true);
  });

  it("3. Threading & Unread: Groups conversation threads, counts unread messages, and marks thread as read", async () => {
    let threadId!: string;

    // Parent sends root message
    await withTenant(schoolAId, async (tx) => {
      const [root] = await tx
        .insert(parentTeacherMessages)
        .values({
          schoolId: schoolAId,
          senderUserId: parentAId,
          recipientUserId: teacherA1Id,
          studentId: studentAId,
          subject: "Regarding Homework Submission",
          content: "Hello Ma'am, wanted to check on Aarav's math assignment submission.",
          isRead: false,
        })
        .returning();
      threadId = root!.id;

      // Teacher replies (reply references root id)
      await tx.insert(parentTeacherMessages).values({
        schoolId: schoolAId,
        senderUserId: teacherA1Id,
        recipientUserId: parentAId,
        studentId: studentAId,
        subject: "Re: Regarding Homework Submission",
        content: "Hello, he submitted it on time and received full marks.",
        parentMessageId: threadId,
        isRead: false,
      });
    });

    // Parent checks conversations: should see 1 unread message (from teacher)
    const parentThreads = await getParentConversations(schoolAId, parentAId);
    expect(parentThreads.length).toBeGreaterThan(0);
    const pThread = parentThreads.find((t) => t.threadId === threadId);
    expect(pThread).toBeDefined();
    expect(pThread?.unreadCount).toBe(1);
    expect(pThread?.totalMessages).toBe(2);

    // Teacher checks conversations: should see 1 unread message (from parent)
    const teacherThreads = await getTeacherConversations(schoolAId, teacherA1Id);
    expect(teacherThreads.length).toBeGreaterThan(0);
    const tThread = teacherThreads.find((t) => t.threadId === threadId);
    expect(tThread).toBeDefined();
    expect(tThread?.unreadCount).toBe(1);

    // Parent opens thread and marks as read
    const markRes = await markThreadRead(schoolAId, parentAId, threadId);
    expect(markRes.success).toBe(true);
    expect(markRes.updatedCount).toBe(1); // Only the message sent TO parent is marked read

    // Verify parent's unread count is now 0
    const parentThreadsAfter = await getParentConversations(schoolAId, parentAId);
    const pThreadAfter = parentThreadsAfter.find((t) => t.threadId === threadId);
    expect(pThreadAfter?.unreadCount).toBe(0);

    // Verify teacher's unread message is still unread (teacher hasn't marked read yet)
    const teacherThreadsAfter = await getTeacherConversations(schoolAId, teacherA1Id);
    const tThreadAfter = teacherThreadsAfter.find((t) => t.threadId === threadId);
    expect(tThreadAfter?.unreadCount).toBe(1);
  });

  it("4. Displacement Law: Deactivating teacher allocation immediately revokes inbox visibility", async () => {
    // 1. Teacher A1 initially sees the thread
    const initialThreads = await getTeacherConversations(schoolAId, teacherA1Id);
    expect(initialThreads.length).toBeGreaterThan(0);

    // 2. Deactivate Teacher A1's class teacher assignment (Displacement event)
    await withTenant(schoolAId, async (tx) => {
      await tx
        .update(classTeacherAssignments)
        .set({ isActive: false })
        .where(
          and(
            eq(classTeacherAssignments.schoolId, schoolAId),
            eq(classTeacherAssignments.teacherId, teacherA1Id),
          ),
        );
    });

    // 3. Teacher A1 now sees empty inbox (or no threads for this section)
    const displacedThreads = await getTeacherConversations(schoolAId, teacherA1Id);
    expect(displacedThreads.length).toBe(0);

    // 4. Restore allocation for subsequent tests
    await withTenant(schoolAId, async (tx) => {
      await tx
        .update(classTeacherAssignments)
        .set({ isActive: true })
        .where(
          and(
            eq(classTeacherAssignments.schoolId, schoolAId),
            eq(classTeacherAssignments.teacherId, teacherA1Id),
          ),
        );
    });
  });

  it("5. Moderation View & Access Logging (OD4): Admin can inspect threads with forensic audit log", async () => {
    const moderationThreads = await getAdminModerationConversations(schoolAId, adminAId);
    expect(moderationThreads.length).toBeGreaterThan(0);

    // Verify audit log row was written
    await withTenant(schoolAId, async (tx) => {
      const audits = await tx.query.auditLogs.findMany({
        where: and(
          eq(auditLogs.schoolId, schoolAId),
          eq(auditLogs.userId, adminAId),
          eq(auditLogs.purposeId, "communication_moderation_audit"),
        ),
      });
      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0]?.action).toBe("READ");
    });
  });
});
