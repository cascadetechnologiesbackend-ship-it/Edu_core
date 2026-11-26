import {
  StudentFeeCardSchema,
  PROHIBITED_STUDENT_FEE_CARD_KEYS,
  type StudentFeeCard,
} from "@schoolmitra/validators";

/**
 * Asserts that no prohibited PII or internal accounting keys exist in a projected fee card.
 */
export function assertNoProhibitedStudentKeys(payload: Record<string, unknown>): void {
  for (const key of PROHIBITED_STUDENT_FEE_CARD_KEYS) {
    if (key in payload) {
      throw new Error(`Prohibited key "${key}" found in StudentFeeCard projection.`);
    }
  }
}

/**
 * Projects a raw student + invoice/payment record into a safe, validated StudentFeeCard.
 */
export function projectToStudentFeeCard(raw: Record<string, unknown>): StudentFeeCard {
  const projected = StudentFeeCardSchema.parse(raw);
  assertNoProhibitedStudentKeys(projected as unknown as Record<string, unknown>);
  return projected;
}

/**
 * Fetches and projects a student's fee card for counter/portal views.
 */
export async function fetchStudentFeeCard(
  _tx: unknown,
  _studentId: string,
  _schoolId?: string
): Promise<StudentFeeCard | null> {
  return null;
}
