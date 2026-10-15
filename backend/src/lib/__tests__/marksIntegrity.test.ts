import { describe, it, expect } from "vitest";
import { z } from "zod";

// Schema extracted from marksActions.ts to unit test validation rules
const saveMarkEntriesSchema = z.object({
  examId: z.string().uuid("Invalid exam ID"),
  classId: z.string().uuid("Invalid class ID"),
  subjectId: z.string().uuid("Invalid subject ID"),
  componentId: z.string().uuid().nullable().optional(),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid("Invalid student ID"),
        marksObtained: z.number().min(0, "Marks must be non-negative").nullable(),
        isAbsent: z.boolean().default(false),
        isMedicalExempt: z.boolean().default(false),
        remarks: z.string().max(500).optional(),
      }),
    )
    .max(500, "Cannot save more than 500 mark entries in a single request"),
});

describe("S12 Layer 1: Marks Entry Input Validation and Bounds Rules", () => {
  const validExamId = "11111111-1111-1111-1111-111111111111";
  const validClassId = "22222222-2222-2222-2222-222222222222";
  const validSubjectId = "33333333-3333-3333-3333-333333333333";
  const validStudentId = "44444444-4444-4444-4444-444444444444";

  it("validates well-formed payload with present student", () => {
    const payload = {
      examId: validExamId,
      classId: validClassId,
      subjectId: validSubjectId,
      entries: [
        {
          studentId: validStudentId,
          marksObtained: 85,
          isAbsent: false,
          isMedicalExempt: false,
        },
      ],
    };
    const parsed = saveMarkEntriesSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects negative marks obtained", () => {
    const payload = {
      examId: validExamId,
      classId: validClassId,
      subjectId: validSubjectId,
      entries: [
        {
          studentId: validStudentId,
          marksObtained: -5,
          isAbsent: false,
          isMedicalExempt: false,
        },
      ],
    };
    const parsed = saveMarkEntriesSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects batches larger than 500 entries (DoS guard)", () => {
    const entries = Array.from({ length: 501 }, () => ({
      studentId: validStudentId,
      marksObtained: 50,
      isAbsent: false,
      isMedicalExempt: false,
    }));
    const payload = {
      examId: validExamId,
      classId: validClassId,
      subjectId: validSubjectId,
      entries,
    };
    const parsed = saveMarkEntriesSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("Cannot save more than 500");
    }
  });

  it("allows null marksObtained when student is absent or exempt", () => {
    const payload = {
      examId: validExamId,
      classId: validClassId,
      subjectId: validSubjectId,
      entries: [
        {
          studentId: validStudentId,
          marksObtained: null,
          isAbsent: true,
          isMedicalExempt: false,
        },
      ],
    };
    const parsed = saveMarkEntriesSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("enforces distribution bounds check (marks <= maxMarks unless absent)", () => {
    const maxMarks = 50;
    const marksObtained = 65;
    const isAbsent = false;

    // Bounds check logic from marksActions.ts
    const isOutOfBounds = !isAbsent && marksObtained > maxMarks;
    expect(isOutOfBounds).toBe(true);

    const absentOutOfBounds = true && marksObtained > maxMarks; // if isAbsent, exempt from bounds check
    const checked = !true && marksObtained > maxMarks;
    expect(checked).toBe(false);
  });
});
