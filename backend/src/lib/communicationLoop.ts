/**
 * S22 Authoritative Communication Loop Domain Engine
 *
 * Implements:
 * - Threaded conversation resolution with unread tracking & read receipts.
 * - Allocation-scoped recipient discovery (homeroom + subject teachers).
 * - Displacement-safe teacher inbox scoping.
 * - Logged moderation audit for school principals/administrators (OD4).
 * - Tenant isolation (withTenant) and strict RBAC.
 */

import { db } from "@/db";
import {
  parentTeacherMessages,
  users,
  roles,
  userRoles,
  persons,
  students,
  studentFamilyMembers,
  classes,
  sections,
  academicYears,
  classTeacherAssignments,
  sectionSubjectTeachers,
  classSubjects,
  subjects,
  auditLogs,
} from "@schoolmitra/database";
import { eq, and, or, inArray, desc, asc, isNull, sql } from "drizzle-orm";
import { decryptData } from "./encryption";
import { withTenant } from "./tenant";

export interface ComposableTeacherRecipient {
  teacherUserId: string;
  teacherName: string;
  roleTitle: string;
  subjectName?: string | null;
  isClassTeacher: boolean;
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string;
}

export interface ConversationThreadSummary {
  threadId: string;
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string;
  counterpartUserId: string;
  counterpartName: string;
  counterpartRole: string;
  counterpartAvatar?: string | null;
  subject: string;
  lastMessageSnippet: string;
  lastMessageAt: Date;
  lastMessageSenderId: string;
  unreadCount: number;
  totalMessages: number;
}

export interface ThreadMessageItem {
  id: string;
  threadId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  recipientUserId: string;
  studentId: string;
  subject: string;
  content: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  isMe: boolean;
}

/**
 * Resolves truthful display name for a user within a school tenant.
 */
export async function resolveUserName(
  executor: any,
  schoolId: string,
  userId: string,
): Promise<{ name: string; primaryType?: string | null }> {
  const person = await executor.query.persons.findFirst({
    where: and(eq(persons.schoolId, schoolId), eq(persons.userId, userId)),
  });

  if (person) {
    const first = decryptData(person.firstNameEncrypted) || "";
    const last = decryptData(person.lastNameEncrypted) || "";
    const fullName = `${first} ${last}`.trim();
    if (fullName) {
      return { name: fullName, primaryType: person.primaryType };
    }
  }

  const user = await executor.query.users.findFirst({
    where: and(eq(users.schoolId, schoolId), eq(users.id, userId)),
  });

  if (user) {
    const localPart = user.email.split("@")[0] || "User";
    const formatted = localPart.replace(/[._-]/g, " ");
    return { name: formatted, primaryType: null };
  }

  return { name: "School User", primaryType: null };
}

/**
 * Discovers all active teachers (homeroom + subject) for a parent's children.
 */
export async function resolveChildTeachers(
  schoolId: string,
  parentUserId: string,
  studentIdFilter?: string,
): Promise<ComposableTeacherRecipient[]> {
  return await withTenant(schoolId, async (tenantDb) => {
    // 1. Find all active children belonging to this parent
    const [primaryStudents, familyLinks] = await Promise.all([
      tenantDb.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.primaryParentUserId, parentUserId),
          eq(students.isActive, true),
        ),
      }),
      tenantDb.query.studentFamilyMembers.findMany({
        where: and(
          eq(studentFamilyMembers.schoolId, schoolId),
          eq(studentFamilyMembers.userId, parentUserId),
        ),
      }),
    ]);

    const studentIds = new Set<string>(primaryStudents.map((s) => s.id));
    for (const link of familyLinks) {
      studentIds.add(link.studentId);
    }

    if (studentIds.size === 0) return [];

    let targetStudentIds = Array.from(studentIds);
    if (studentIdFilter) {
      targetStudentIds = targetStudentIds.filter((id) => id === studentIdFilter);
    }

    if (targetStudentIds.length === 0) return [];

    // Fetch full student records with classes and sections
    const children = await tenantDb.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        inArray(students.id, targetStudentIds),
        eq(students.isActive, true),
      ),
    });

    const [allClasses, allSections, allSubjects, allClassSubjects] = await Promise.all([
      tenantDb.query.classes.findMany({ where: eq(classes.schoolId, schoolId) }),
      tenantDb.query.sections.findMany({ where: eq(sections.schoolId, schoolId) }),
      tenantDb.query.subjects.findMany({ where: eq(subjects.schoolId, schoolId) }),
      tenantDb.query.classSubjects.findMany({ where: eq(classSubjects.schoolId, schoolId) }),
    ]);

    const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
    const sectionMap = new Map(allSections.map((s) => [s.id, s.name]));
    const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]));
    const classSubjectMap = new Map(allClassSubjects.map((cs) => [cs.id, cs.subjectId]));

    const recipients: ComposableTeacherRecipient[] = [];
    const seenKey = new Set<string>();

    for (const child of children) {
      if (!child.currentSectionId) continue;

      const sFirst = decryptData(child.firstNameEncrypted) || "";
      const sLast = decryptData(child.lastNameEncrypted) || "";
      const studentName = `${sFirst} ${sLast}`.trim() || "Student";
      const className = (child.currentClassId && classMap.get(child.currentClassId)) || "Class";
      const sectionName = sectionMap.get(child.currentSectionId) || "Section";

      // A. Homeroom / Class Teacher
      const classTeacherRows = await tenantDb.query.classTeacherAssignments.findMany({
        where: and(
          eq(classTeacherAssignments.schoolId, schoolId),
          eq(classTeacherAssignments.sectionId, child.currentSectionId),
          eq(classTeacherAssignments.isActive, true),
        ),
      });

      for (const ct of classTeacherRows) {
        const key = `${child.id}:${ct.teacherId}:homeroom`;
        if (!seenKey.has(key)) {
          seenKey.add(key);
          const tInfo = await resolveUserName(tenantDb, schoolId, ct.teacherId);
          recipients.push({
            teacherUserId: ct.teacherId,
            teacherName: tInfo.name,
            roleTitle: "Class Teacher",
            subjectName: null,
            isClassTeacher: true,
            studentId: child.id,
            studentName,
            className,
            sectionName,
          });
        }
      }

      // B. Subject Teachers
      const subjectTeacherRows = await tenantDb.query.sectionSubjectTeachers.findMany({
        where: and(
          eq(sectionSubjectTeachers.schoolId, schoolId),
          eq(sectionSubjectTeachers.sectionId, child.currentSectionId),
          eq(sectionSubjectTeachers.isActive, true),
        ),
      });

      for (const st of subjectTeacherRows) {
        const subId = classSubjectMap.get(st.classSubjectId);
        const subName = (subId && subjectMap.get(subId)) || "Subject";
        const key = `${child.id}:${st.teacherId}:${subName}`;
        if (!seenKey.has(key)) {
          seenKey.add(key);
          const tInfo = await resolveUserName(tenantDb, schoolId, st.teacherId);
          recipients.push({
            teacherUserId: st.teacherId,
            teacherName: tInfo.name,
            roleTitle: `${subName} Teacher`,
            subjectName: subName,
            isClassTeacher: false,
            studentId: child.id,
            studentName,
            className,
            sectionName,
          });
        }
      }
    }

    return recipients;
  });
}

/**
 * Validates that sender has permission to contact recipient for the given student.
 */
export async function validateMessageRecipient(
  schoolId: string,
  senderUserId: string,
  senderRole: string,
  recipientUserId: string,
  studentId: string,
  parentMessageId?: string | null,
): Promise<boolean> {
  return await withTenant(schoolId, async (tenantDb) => {
    // Reply validation: if replying, verify both parties belong to the thread
    if (parentMessageId) {
      const rootMsg = await tenantDb.query.parentTeacherMessages.findFirst({
        where: and(
          eq(parentTeacherMessages.schoolId, schoolId),
          eq(parentTeacherMessages.id, parentMessageId),
        ),
      });

      if (!rootMsg) {
        throw new Error("Referenced conversation thread not found.");
      }

      const participants = new Set([rootMsg.senderUserId, rootMsg.recipientUserId]);
      if (!participants.has(senderUserId)) {
        throw new Error("Not authorized to reply to this thread.");
      }
      return true;
    }

    // New conversation validation
    if (senderRole === "PARENT") {
      const allowedTeachers = await resolveChildTeachers(schoolId, senderUserId, studentId);
      const isAllowed = allowedTeachers.some((t) => t.teacherUserId === recipientUserId);
      if (!isAllowed) {
        throw new Error(
          "Recipient is not currently assigned as a teacher for your child.",
        );
      }
      return true;
    }

    if (senderRole === "TEACHER") {
      // Verify teacher has active allocation for student
      const student = await tenantDb.query.students.findFirst({
        where: and(eq(students.schoolId, schoolId), eq(students.id, studentId)),
      });

      if (!student || !student.currentSectionId) {
        throw new Error("Target student not found or unassigned.");
      }

      // Check teacher's allocations
      const [isClassTeacher, isSubjectTeacher] = await Promise.all([
        tenantDb.query.classTeacherAssignments.findFirst({
          where: and(
            eq(classTeacherAssignments.schoolId, schoolId),
            eq(classTeacherAssignments.sectionId, student.currentSectionId),
            eq(classTeacherAssignments.teacherId, senderUserId),
            eq(classTeacherAssignments.isActive, true),
          ),
        }),
        tenantDb.query.sectionSubjectTeachers.findFirst({
          where: and(
            eq(sectionSubjectTeachers.schoolId, schoolId),
            eq(sectionSubjectTeachers.sectionId, student.currentSectionId),
            eq(sectionSubjectTeachers.teacherId, senderUserId),
            eq(sectionSubjectTeachers.isActive, true),
          ),
        }),
      ]);

      if (!isClassTeacher && !isSubjectTeacher) {
        throw new Error(
          "You are not currently assigned to teach this student's section.",
        );
      }

      // Check recipient is a parent/guardian of student
      const isPrimary = student.primaryParentUserId === recipientUserId;
      const isFamily = await tenantDb.query.studentFamilyMembers.findFirst({
        where: and(
          eq(studentFamilyMembers.schoolId, schoolId),
          eq(studentFamilyMembers.studentId, studentId),
          eq(studentFamilyMembers.userId, recipientUserId),
        ),
      });

      if (!isPrimary && !isFamily) {
        throw new Error("Recipient is not registered as a guardian for this student.");
      }

      return true;
    }

    // Admin/Principal override
    return true;
  });
}

/**
 * Retrieves threaded conversations for a parent.
 */
export async function getParentConversations(
  schoolId: string,
  parentUserId: string,
  options?: { studentId?: string | undefined; limit?: number | undefined; offset?: number | undefined },
): Promise<ConversationThreadSummary[]> {
  return await withTenant(schoolId, async (tenantDb) => {
    // Query all messages where parent is sender or recipient
    const conditions = [
      eq(parentTeacherMessages.schoolId, schoolId),
      or(
        eq(parentTeacherMessages.senderUserId, parentUserId),
        eq(parentTeacherMessages.recipientUserId, parentUserId),
      ),
    ];

    if (options?.studentId) {
      conditions.push(eq(parentTeacherMessages.studentId, options.studentId));
    }

    const allMsgs = await tenantDb.query.parentTeacherMessages.findMany({
      where: and(...conditions),
      orderBy: [desc(parentTeacherMessages.createdAt)],
    });

    if (allMsgs.length === 0) return [];

    // Group into threads
    const threadMap = new Map<string, typeof allMsgs>();
    for (const msg of allMsgs) {
      const threadId = msg.parentMessageId || msg.id;
      const list = threadMap.get(threadId) || [];
      list.push(msg);
      threadMap.set(threadId, list);
    }

    const [allStudents, allClasses, allSections] = await Promise.all([
      tenantDb.query.students.findMany({ where: eq(students.schoolId, schoolId) }),
      tenantDb.query.classes.findMany({ where: eq(classes.schoolId, schoolId) }),
      tenantDb.query.sections.findMany({ where: eq(sections.schoolId, schoolId) }),
    ]);

    const studentMap = new Map(allStudents.map((s) => [s.id, s]));
    const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
    const sectionMap = new Map(allSections.map((s) => [s.id, s.name]));

    const summaries: ConversationThreadSummary[] = [];

    for (const [threadId, msgs] of threadMap.entries()) {
      msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastMsg = msgs[0]!;
      const rootMsg = msgs[msgs.length - 1]!;

      const counterpartUserId =
        lastMsg.senderUserId === parentUserId
          ? lastMsg.recipientUserId
          : lastMsg.senderUserId;

      const counterpartInfo = await resolveUserName(tenantDb, schoolId, counterpartUserId);
      const student = studentMap.get(lastMsg.studentId);
      const studentName = student
        ? `${decryptData(student.firstNameEncrypted) || ""} ${decryptData(student.lastNameEncrypted) || ""}`.trim()
        : "Student";
      const className = (student?.currentClassId && classMap.get(student.currentClassId)) || "Class";
      const sectionName = (student?.currentSectionId && sectionMap.get(student.currentSectionId)) || "Section";

      const unreadCount = msgs.filter(
        (m) => m.recipientUserId === parentUserId && !m.isRead,
      ).length;

      summaries.push({
        threadId,
        studentId: lastMsg.studentId,
        studentName,
        className,
        sectionName,
        counterpartUserId,
        counterpartName: counterpartInfo.name,
        counterpartRole: "Teacher",
        subject: rootMsg.subject || "Message",
        lastMessageSnippet: lastMsg.content.substring(0, 80),
        lastMessageAt: new Date(lastMsg.createdAt),
        lastMessageSenderId: lastMsg.senderUserId,
        unreadCount,
        totalMessages: msgs.length,
      });
    }

    // Sort by latest message desc
    summaries.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    return summaries.slice(offset, offset + limit);
  });
}

/**
 * Retrieves threaded conversations for a teacher (scoped strictly to active allocations).
 */
export async function getTeacherConversations(
  schoolId: string,
  teacherUserId: string,
  options?: { limit?: number | undefined; offset?: number | undefined },
): Promise<ConversationThreadSummary[]> {
  return await withTenant(schoolId, async (tenantDb) => {
    // 1. Resolve teacher's active section allocations
    const [ctAllocations, stAllocations] = await Promise.all([
      tenantDb.query.classTeacherAssignments.findMany({
        where: and(
          eq(classTeacherAssignments.schoolId, schoolId),
          eq(classTeacherAssignments.teacherId, teacherUserId),
          eq(classTeacherAssignments.isActive, true),
        ),
      }),
      tenantDb.query.sectionSubjectTeachers.findMany({
        where: and(
          eq(sectionSubjectTeachers.schoolId, schoolId),
          eq(sectionSubjectTeachers.teacherId, teacherUserId),
          eq(sectionSubjectTeachers.isActive, true),
        ),
      }),
    ]);

    const activeSectionIds = new Set<string>();
    for (const a of ctAllocations) activeSectionIds.add(a.sectionId);
    for (const a of stAllocations) activeSectionIds.add(a.sectionId);

    // If teacher has no active allocations, inbox is empty (Displacement Law)
    if (activeSectionIds.size === 0) {
      return [];
    }

    // 2. Find students currently in those sections
    const allocatedStudents = await tenantDb.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        inArray(students.currentSectionId, Array.from(activeSectionIds)),
        eq(students.isActive, true),
      ),
    });

    if (allocatedStudents.length === 0) {
      return [];
    }

    const studentIds = allocatedStudents.map((s) => s.id);

    // 3. Query messages involving this teacher and allocated students
    const allMsgs = await tenantDb.query.parentTeacherMessages.findMany({
      where: and(
        eq(parentTeacherMessages.schoolId, schoolId),
        or(
          eq(parentTeacherMessages.senderUserId, teacherUserId),
          eq(parentTeacherMessages.recipientUserId, teacherUserId),
        ),
        inArray(parentTeacherMessages.studentId, studentIds),
      ),
      orderBy: [desc(parentTeacherMessages.createdAt)],
    });

    if (allMsgs.length === 0) return [];

    // Group into threads
    const threadMap = new Map<string, typeof allMsgs>();
    for (const msg of allMsgs) {
      const threadId = msg.parentMessageId || msg.id;
      const list = threadMap.get(threadId) || [];
      list.push(msg);
      threadMap.set(threadId, list);
    }

    const [allClasses, allSections] = await Promise.all([
      tenantDb.query.classes.findMany({ where: eq(classes.schoolId, schoolId) }),
      tenantDb.query.sections.findMany({ where: eq(sections.schoolId, schoolId) }),
    ]);

    const studentMap = new Map(allocatedStudents.map((s) => [s.id, s]));
    const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
    const sectionMap = new Map(allSections.map((s) => [s.id, s.name]));

    const summaries: ConversationThreadSummary[] = [];

    for (const [threadId, msgs] of threadMap.entries()) {
      msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastMsg = msgs[0]!;
      const rootMsg = msgs[msgs.length - 1]!;

      const counterpartUserId =
        lastMsg.senderUserId === teacherUserId
          ? lastMsg.recipientUserId
          : lastMsg.senderUserId;

      const counterpartInfo = await resolveUserName(tenantDb, schoolId, counterpartUserId);
      const student = studentMap.get(lastMsg.studentId);
      const studentName = student
        ? `${decryptData(student.firstNameEncrypted) || ""} ${decryptData(student.lastNameEncrypted) || ""}`.trim()
        : "Student";
      const className = (student?.currentClassId && classMap.get(student.currentClassId)) || "Class";
      const sectionName = (student?.currentSectionId && sectionMap.get(student.currentSectionId)) || "Section";

      const unreadCount = msgs.filter(
        (m) => m.recipientUserId === teacherUserId && !m.isRead,
      ).length;

      summaries.push({
        threadId,
        studentId: lastMsg.studentId,
        studentName,
        className,
        sectionName,
        counterpartUserId,
        counterpartName: counterpartInfo.name,
        counterpartRole: "Parent",
        subject: rootMsg.subject || "Message",
        lastMessageSnippet: lastMsg.content.substring(0, 80),
        lastMessageAt: new Date(lastMsg.createdAt),
        lastMessageSenderId: lastMsg.senderUserId,
        unreadCount,
        totalMessages: msgs.length,
      });
    }

    summaries.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    return summaries.slice(offset, offset + limit);
  });
}

/**
 * Retrieves ordered chronological messages for a conversation thread.
 */
export async function getThreadMessages(
  schoolId: string,
  userId: string,
  threadId: string,
  userRole?: string,
): Promise<{ subject: string; messages: ThreadMessageItem[] }> {
  return await withTenant(schoolId, async (tenantDb) => {
    const threadRows = await tenantDb.query.parentTeacherMessages.findMany({
      where: and(
        eq(parentTeacherMessages.schoolId, schoolId),
        or(
          eq(parentTeacherMessages.id, threadId),
          eq(parentTeacherMessages.parentMessageId, threadId),
        ),
      ),
      orderBy: [asc(parentTeacherMessages.createdAt)],
    });

    if (threadRows.length === 0) {
      throw new Error("Conversation thread not found.");
    }

    const isAdmin =
      userRole === "SUPER_ADMIN" ||
      userRole === "SCHOOL_ADMIN" ||
      userRole === "PRINCIPAL";

    // Access check: non-admins must be a sender or recipient in the thread
    if (!isAdmin) {
      const isParticipant = threadRows.some(
        (m) => m.senderUserId === userId || m.recipientUserId === userId,
      );
      if (!isParticipant) {
        throw new Error("Not authorized to view this conversation.");
      }
    }

    const rootMsg = threadRows[0]!;
    const userNames = new Map<string, { name: string; primaryType?: string | null }>();

    for (const row of threadRows) {
      if (!userNames.has(row.senderUserId)) {
        userNames.set(
          row.senderUserId,
          await resolveUserName(tenantDb, schoolId, row.senderUserId),
        );
      }
    }

    const items: ThreadMessageItem[] = threadRows.map((m) => {
      const senderInfo = userNames.get(m.senderUserId);
      const isMe = m.senderUserId === userId;
      return {
        id: m.id,
        threadId,
        senderUserId: m.senderUserId,
        senderName: isMe ? "You" : senderInfo?.name || "Participant",
        senderRole: senderInfo?.primaryType === "STAFF" ? "Teacher" : senderInfo?.primaryType === "PARENT" ? "Parent" : "User",
        recipientUserId: m.recipientUserId,
        studentId: m.studentId,
        subject: m.subject,
        content: m.content,
        isRead: m.isRead,
        readAt: m.readAt,
        createdAt: new Date(m.createdAt),
        isMe,
      };
    });

    return {
      subject: rootMsg.subject,
      messages: items,
    };
  });
}

/**
 * Marks all incoming messages in a thread as read by the recipient.
 */
export async function markThreadRead(
  schoolId: string,
  userId: string,
  threadId: string,
): Promise<{ success: boolean; updatedCount: number }> {
  return await withTenant(schoolId, async (tenantDb) => {
    const unreadMsgs = await tenantDb.query.parentTeacherMessages.findMany({
      where: and(
        eq(parentTeacherMessages.schoolId, schoolId),
        or(
          eq(parentTeacherMessages.id, threadId),
          eq(parentTeacherMessages.parentMessageId, threadId),
        ),
        eq(parentTeacherMessages.recipientUserId, userId),
        eq(parentTeacherMessages.isRead, false),
      ),
    });

    if (unreadMsgs.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const ids = unreadMsgs.map((m) => m.id);
    const now = new Date();

    await tenantDb
      .update(parentTeacherMessages)
      .set({
        isRead: true,
        readAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(parentTeacherMessages.schoolId, schoolId),
          inArray(parentTeacherMessages.id, ids),
        ),
      );

    return { success: true, updatedCount: ids.length };
  });
}

/**
 * Logged read-only audit view for Principal/Admin (OD4).
 */
export async function getAdminModerationConversations(
  schoolId: string,
  adminUserId: string,
  options?: { limit?: number | undefined; offset?: number | undefined },
): Promise<ConversationThreadSummary[]> {
  return await withTenant(schoolId, async (tenantDb) => {
    // 1. Forensic Audit Logging of moderation access
    const adminUser = await tenantDb.query.users.findFirst({
      where: and(eq(users.schoolId, schoolId), eq(users.id, adminUserId)),
    });
    const adminEmail = adminUser?.email || "admin@schoolmitra.internal";

    await tenantDb.insert(auditLogs).values({
      schoolId,
      userId: adminUserId,
      userEmail: adminEmail,
      userRole: "SCHOOL_ADMIN",
      action: "READ",
      tableName: "parent_teacher_messages",
      purposeId: "communication_moderation_audit",
      ipAddress: "0.0.0.0",
      userAgent: "Admin Communication Hub",
      metadata: {
        action: "VIEW_MODERATED_CONVERSATIONS",
        timestamp: new Date().toISOString(),
      },
    });

    // 2. Fetch all messages in the school
    const allMsgs = await tenantDb.query.parentTeacherMessages.findMany({
      where: eq(parentTeacherMessages.schoolId, schoolId),
      orderBy: [desc(parentTeacherMessages.createdAt)],
    });

    if (allMsgs.length === 0) return [];

    const threadMap = new Map<string, typeof allMsgs>();
    for (const msg of allMsgs) {
      const threadId = msg.parentMessageId || msg.id;
      const list = threadMap.get(threadId) || [];
      list.push(msg);
      threadMap.set(threadId, list);
    }

    const [allStudents, allClasses, allSections] = await Promise.all([
      tenantDb.query.students.findMany({ where: eq(students.schoolId, schoolId) }),
      tenantDb.query.classes.findMany({ where: eq(classes.schoolId, schoolId) }),
      tenantDb.query.sections.findMany({ where: eq(sections.schoolId, schoolId) }),
    ]);

    const studentMap = new Map(allStudents.map((s) => [s.id, s]));
    const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
    const sectionMap = new Map(allSections.map((s) => [s.id, s.name]));

    const summaries: ConversationThreadSummary[] = [];

    for (const [threadId, msgs] of threadMap.entries()) {
      msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastMsg = msgs[0]!;
      const rootMsg = msgs[msgs.length - 1]!;

      const senderInfo = await resolveUserName(tenantDb, schoolId, lastMsg.senderUserId);
      const student = studentMap.get(lastMsg.studentId);
      const studentName = student
        ? `${decryptData(student.firstNameEncrypted) || ""} ${decryptData(student.lastNameEncrypted) || ""}`.trim()
        : "Student";
      const className = (student?.currentClassId && classMap.get(student.currentClassId)) || "Class";
      const sectionName = (student?.currentSectionId && sectionMap.get(student.currentSectionId)) || "Section";

      summaries.push({
        threadId,
        studentId: lastMsg.studentId,
        studentName,
        className,
        sectionName,
        counterpartUserId: lastMsg.senderUserId,
        counterpartName: senderInfo.name,
        counterpartRole: senderInfo.primaryType || "User",
        subject: rootMsg.subject || "Message",
        lastMessageSnippet: lastMsg.content.substring(0, 80),
        lastMessageAt: new Date(lastMsg.createdAt),
        lastMessageSenderId: lastMsg.senderUserId,
        unreadCount: 0,
        totalMessages: msgs.length,
      });
    }

    summaries.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    return summaries.slice(offset, offset + limit);
  });
}
