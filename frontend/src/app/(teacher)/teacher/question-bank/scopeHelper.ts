import { and, eq, inArray } from "drizzle-orm";
import { classSubjects, auditLogs } from "@/db/schema";
import { resolveTeacherScope } from "@/lib/teacherEventEngine/scopeResolver";
import { getClientRequestContext } from "@/lib/requestContext";

export interface TeacherClassSubjectScope {
  authorizedPairs: Array<{ classId: string; subjectId: string }>;
  authorizedPairKeys: Set<string>;
  authorizedClassIds: string[];
  authorizedSubjectIds: string[];
  authorizedClassSubjectIds: string[];
}

export const ADMIN_MODERATION_ROLES = new Set([
  "SCHOOL_ADMIN",
  "SUPER_ADMIN",
  "PRINCIPAL",
]);

/**
 * Resolves a teacher's authorized (classId, subjectId) pairs from their
 * canonical teachingSections allocation inside the active tenant transaction.
 */
export async function resolveTeacherClassSubjectScope(
  tx: any,
  userId: string,
  schoolId: string,
): Promise<TeacherClassSubjectScope> {
  const scope = await resolveTeacherScope(userId, { tx, schoolId });
  const classSubjectIds = Array.from(
    new Set(
      scope.teachingSections
        .map((ts) => ts.classSubjectId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (classSubjectIds.length === 0) {
    return {
      authorizedPairs: [],
      authorizedPairKeys: new Set(),
      authorizedClassIds: [],
      authorizedSubjectIds: [],
      authorizedClassSubjectIds: [],
    };
  }

  const csRows: Array<{ id: string; classId: string; subjectId: string }> =
    await tx
      .select({
        id: classSubjects.id,
        classId: classSubjects.classId,
        subjectId: classSubjects.subjectId,
      })
      .from(classSubjects)
      .where(
        and(
          eq(classSubjects.schoolId, schoolId),
          inArray(classSubjects.id, classSubjectIds),
        ),
      );

  const authorizedPairKeys = new Set<string>();
  const authorizedPairs: Array<{ classId: string; subjectId: string }> = [];
  const classIdsSet = new Set<string>();
  const subjectIdsSet = new Set<string>();
  const csIdsSet = new Set<string>();

  for (const row of csRows) {
    const key = `${row.classId}:${row.subjectId}`;
    if (!authorizedPairKeys.has(key)) {
      authorizedPairKeys.add(key);
      authorizedPairs.push({ classId: row.classId, subjectId: row.subjectId });
    }
    classIdsSet.add(row.classId);
    subjectIdsSet.add(row.subjectId);
    csIdsSet.add(row.id);
  }

  return {
    authorizedPairs,
    authorizedPairKeys,
    authorizedClassIds: Array.from(classIdsSet),
    authorizedSubjectIds: Array.from(subjectIdsSet),
    authorizedClassSubjectIds: Array.from(csIdsSet),
  };
}

/**
 * Appends an immutable audit log entry inside the active tenant transaction.
 */
export async function writeQuestionAuditLog(
  tx: any,
  params: {
    userId: string;
    userEmail?: string | null;
    userRole: string;
    schoolId: string;
    tableName: string;
    recordId: string | null;
    purposeId: string;
    metadata: Record<string, unknown>;
  },
) {
  const reqCtx = getClientRequestContext();
  await tx.insert(auditLogs).values({
    userId: params.userId,
    userEmail: params.userEmail || "[audit-system]",
    userRole: params.userRole,
    schoolId: params.schoolId,
    action: "WRITE",
    tableName: params.tableName,
    recordId: params.recordId,
    purposeId: params.purposeId,
    ipAddress: reqCtx.ipAddress,
    userAgent: reqCtx.userAgent,
    metadata: params.metadata,
  });
}
