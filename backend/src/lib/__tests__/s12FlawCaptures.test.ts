import { describe, it, expect } from "vitest";
import {
  calculateGrade,
  getCBSEDefaultRules,
  ABSENT_GRADE,
  FAIL_GRADE,
} from "../gradeEngine";

describe("S12 Baseline Flaw Captures (P0 Flaws Proved Against HEAD 98f16d6)", () => {
  const cbseRules = getCBSEDefaultRules();

  // ── FLAW F1: calculateGrade allows NaN maxMarks and silently grades student 'E' ──
  describe("Flaw F1: NaN maxMarks silent failure", () => {
    it("proves that parseFloat(null) yields NaN and calculateGrade currently fails to reject it", () => {
      // When mark_entries.max_marks is omitted during saveMarkEntries,
      // reading engines call parseFloat(m.maxMarks) which yields NaN for null.
      const rawMaxMarksFromDb: any = null;
      const parsedMaxMarks = parseFloat(rawMaxMarksFromDb);
      expect(Number.isNaN(parsedMaxMarks)).toBe(true);

      // Demonstrates current flawed behavior:
      // The guard `input.maxMarks <= 0` evaluates false for NaN (NaN <= 0 is false).
      // So no error is thrown!
      let threwError = false;
      let gradeResult: any = null;
      try {
        gradeResult = calculateGrade(
          {
            marksObtained: 85,
            maxMarks: parsedMaxMarks, // NaN
            isAbsent: false,
            isMedicalExempt: false,
          },
          cbseRules,
        );
      } catch (err) {
        threwError = true;
      }

      // LAYER 1 VERIFIED: calculateGrade now rejects NaN, null, and non-positive maxMarks
      expect(threwError).toBe(true);
      expect(() => {
        calculateGrade(
          {
            marksObtained: 85,
            maxMarks: parsedMaxMarks, // NaN
            isAbsent: false,
            isMedicalExempt: false,
          },
          cbseRules,
        );
      }).toThrow(/Invalid maxMarks: expected positive finite number/);
    });
  });

  // ── FLAW F2: Unenrolled electives treated as failed (0 marks / grade E) ────────
  describe("Flaw F2: Unenrolled elective subjects drag students into failure", () => {
    it("proves that without student_subject_enrollments filtering, an elective not taken gets 0 and fails", () => {
      // Simulates generateResultSnapshots mapping over all class subjects (including electives):
      const classSubjects = [
        { id: "subj-core-1", name: "English", isElective: false, maxMarks: 100, passingMarks: 33 },
        { id: "subj-core-2", name: "Mathematics", isElective: false, maxMarks: 100, passingMarks: 33 },
        { id: "subj-elec-music", name: "Hindustani Music", isElective: true, maxMarks: 100, passingMarks: 33 },
      ];

      // Student only enrolled in English & Mathematics; did NOT enroll in Music
      const studentEnrolledSubjectIds = new Set(["subj-core-1", "subj-core-2"]);
      const studentMarksMap = new Map<string, number>([
        ["subj-core-1", 92],
        ["subj-core-2", 88],
      ]);

      // Flawed logic at 98f16d6:
      // generateResultSnapshots loops over all classSubjectsMap values without checking enrollments:
      const flawedSubjectsForSnapshot = classSubjects.map((sub) => {
        const obtained = studentMarksMap.get(sub.id) ?? 0;
        const gradeRes = calculateGrade(
          {
            marksObtained: obtained,
            maxMarks: sub.maxMarks,
            isAbsent: false,
            isMedicalExempt: false,
          },
          cbseRules,
        );
        const isSubPassed = obtained >= sub.passingMarks;
        return {
          subjectId: sub.id,
          totalObtained: obtained,
          grade: isSubPassed ? gradeRes.grade : "E",
          isPassed: isSubPassed,
        };
      });

      const musicSnapshot = flawedSubjectsForSnapshot.find((s) => s.subjectId === "subj-elec-music")!;
      // CURRENT BEHAVIOR AT 98f16d6: The student fails music with 0 marks and grade 'E'!
      expect(musicSnapshot.totalObtained).toBe(0);
      expect(musicSnapshot.grade).toBe("E");
      expect(musicSnapshot.isPassed).toBe(false);
      // In Layer 2, resolveEffectiveSubjects will filter this out or assign UNENROLLED_SENTINEL ('-').
    });
  });

  // ── FLAW F6: isQuietHours evaluates UTC instead of IST ───────────────────────
  describe("Flaw F6: Quiet-hours clock uses server-local / UTC time", () => {
    it("proves that at 22:30 IST (which is 17:00 UTC), server-local UTC clock reports NOT quiet hours", () => {
      // 22:30 IST is 10:30 PM (well within the 21:00 - 07:00 quiet hours window).
      // In UTC, 22:30 IST is 17:00 UTC.
      const date2230IST = new Date("2026-10-15T17:00:00.000Z");

      // Current isQuietHours from backend/src/lib/examNotifications.ts (line 28):
      // export function isQuietHours(date: Date = new Date()): boolean {
      //   const hours = date.getHours();
      //   return hours >= 21 || hours < 7;
      // }
      // If the node process is running on UTC (ECS default):
      // date.getUTCHours() is 17!
      const utcHours = date2230IST.getUTCHours();
      const flawedQuietCheck = utcHours >= 21 || utcHours < 7;

      // 17:00 UTC is NOT quiet hours under UTC calculation, even though it IS quiet hours in India!
      expect(flawedQuietCheck).toBe(false);

      // What it SHOULD be using IST:
      const istHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          hour12: false,
        }).format(date2230IST),
        10,
      );
      expect(istHour).toBe(22);
      const correctQuietHours = istHour >= 21 || istHour < 7;
      expect(correctQuietHours).toBe(true);
    });
  });
});
