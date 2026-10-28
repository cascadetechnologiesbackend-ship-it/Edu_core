/**
 * Timetable Engine & Workload Feasibility Validator (Sprint S20)
 *
 * Implements:
 * 1. Mathematical Workload Fit Verification (∑ periods ≤ workingDays × instructionPeriods)
 * 2. Deterministic Provisional Schedule Generation for School Digital Twins
 * 3. Teacher and Room Clash Detection
 * 4. Manual Customisation Preservation
 */

export interface SubjectWorkloadInput {
  id: string;
  name: string;
  code?: string | undefined;
  weeklyPeriods: number;
  isLabOrPractical?: boolean | undefined;
}

export interface WorkloadFitResult {
  fits: boolean;
  totalRequiredPeriods: number;
  availableWeeklyPeriods: number;
  slackOrDeficit: number;
  message: string;
  subjectBreakdown: {
    subjectId: string;
    subjectName: string;
    weeklyPeriods: number;
    percentageOfSchedule: number;
  }[];
}

export interface ScheduleSlot {
  dayOfWeek: number; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  periodNumber: number; // 1 to periodsPerDay
  subjectId: string;
  subjectName: string;
  teacherId?: string | undefined;
  roomId?: string | undefined;
  isManualOverride?: boolean | undefined;
}

export interface GeneratedScheduleResult {
  success: boolean;
  message: string;
  slots: ScheduleSlot[];
  unassignedPeriodsCount: number;
  overflowSubjects: { subjectId: string; subjectName: string; remainingPeriods: number }[];
}

export interface TimetableClash {
  type: "TEACHER_DOUBLE_BOOKING" | "ROOM_OVERLAP" | "CLASS_CONCURRENT";
  dayOfWeek: number;
  periodNumber: number;
  conflictingEntityId: string;
  conflictingEntityName: string;
  message: string;
}

/**
 * Validates whether the configured subject period requirements fit within available weekly bell periods.
 */
export function validateWorkloadFit(params: {
  workingDaysCount: number;
  instructionPeriodsPerDay: number;
  subjects: SubjectWorkloadInput[];
}): WorkloadFitResult {
  const { workingDaysCount, instructionPeriodsPerDay, subjects } = params;

  const availableWeeklyPeriods = Math.max(0, workingDaysCount * instructionPeriodsPerDay);
  const totalRequiredPeriods = subjects.reduce((sum, s) => sum + Math.max(0, s.weeklyPeriods || 0), 0);

  const slackOrDeficit = availableWeeklyPeriods - totalRequiredPeriods;
  const fits = totalRequiredPeriods <= availableWeeklyPeriods;

  const subjectBreakdown = subjects.map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    weeklyPeriods: s.weeklyPeriods,
    percentageOfSchedule:
      availableWeeklyPeriods > 0
        ? Math.round((s.weeklyPeriods / availableWeeklyPeriods) * 100)
        : 0,
  }));

  const message = fits
    ? `Schedule feasible: ${totalRequiredPeriods} required periods fit inside ${availableWeeklyPeriods} available periods (${slackOrDeficit} slack/free periods).`
    : `Workload deficit: ${totalRequiredPeriods} periods requested exceeds available ${availableWeeklyPeriods} periods by ${Math.abs(slackOrDeficit)} periods. Reduce weekly periods or increase days/periods per day.`;

  return {
    fits,
    totalRequiredPeriods,
    availableWeeklyPeriods,
    slackOrDeficit,
    message,
    subjectBreakdown,
  };
}

/**
 * Deterministically generates a provisional weekly timetable without exceeding period capacities.
 * Distributes subjects evenly across days to avoid fatigue (max 2 periods of same subject per day).
 * Preserves pre-existing manual overrides.
 */
export function generateDeterministicSchedule(params: {
  workingDays: number[]; // e.g. [1, 2, 3, 4, 5, 6]
  instructionPeriodsPerDay: number; // e.g. 8
  subjects: SubjectWorkloadInput[];
  existingSlots?: ScheduleSlot[] | undefined;
}): GeneratedScheduleResult {
  const {
    workingDays,
    instructionPeriodsPerDay,
    subjects,
    existingSlots = [],
  } = params;

  const slotsMap = new Map<string, ScheduleSlot>();

  // 1. Lock in manual overrides from existing slots
  for (const slot of existingSlots) {
    if (slot.isManualOverride) {
      const key = `${slot.dayOfWeek}-${slot.periodNumber}`;
      slotsMap.set(key, slot);
    }
  }

  // 2. Prepare remaining subject quotas
  const remainingQuota = new Map<string, { subject: SubjectWorkloadInput; count: number }>();
  for (const s of subjects) {
    // Subtract any already manually scheduled slots
    const manuallyAssigned = existingSlots.filter(
      (slot) => slot.isManualOverride && slot.subjectId === s.id
    ).length;

    const needed = Math.max(0, s.weeklyPeriods - manuallyAssigned);
    if (needed > 0) {
      remainingQuota.set(s.id, { subject: s, count: needed });
    }
  }

  // Sort subjects by workload descending (heaviest subjects first) for balanced dispersion
  const sortedSubjects = Array.from(remainingQuota.values()).sort(
    (a, b) => b.count - a.count
  );

  // Track daily subject frequencies to prevent > 2 of same subject on any day
  const dailySubjectCount = new Map<string, number>(); // key: `${dayOfWeek}-${subjectId}`

  // 3. Grid Assignment loop (Day-by-Day, Period-by-Period)
  for (let period = 1; period <= instructionPeriodsPerDay; period++) {
    for (const day of workingDays) {
      const key = `${day}-${period}`;
      if (slotsMap.has(key)) {
        continue; // Already occupied by manual override
      }

      // Find best candidate subject for this slot
      let assignedSubject: SubjectWorkloadInput | null = null;

      for (const item of sortedSubjects) {
        if (item.count <= 0) continue;

        const dayKey = `${day}-${item.subject.id}`;
        const countToday = dailySubjectCount.get(dayKey) || 0;

        // Constraint: No more than 2 periods of same subject on any single day
        if (countToday >= 2) continue;

        // Constraint: Avoid assigning same subject in adjacent period unless it's a double practical/lab
        if (period > 1) {
          const prevKey = `${day}-${period - 1}`;
          const prevSlot = slotsMap.get(prevKey);
          if (prevSlot && prevSlot.subjectId === item.subject.id && !item.subject.isLabOrPractical) {
            continue;
          }
        }

        assignedSubject = item.subject;
        item.count--;
        dailySubjectCount.set(dayKey, countToday + 1);
        break;
      }

      if (assignedSubject) {
        slotsMap.set(key, {
          dayOfWeek: day,
          periodNumber: period,
          subjectId: assignedSubject.id,
          subjectName: assignedSubject.name,
          isManualOverride: false,
        });
      }
    }
  }

  // 4. Check for any remaining overflow subjects that could not fit
  const overflowSubjects: { subjectId: string; subjectName: string; remainingPeriods: number }[] = [];
  for (const item of sortedSubjects) {
    if (item.count > 0) {
      overflowSubjects.push({
        subjectId: item.subject.id,
        subjectName: item.subject.name,
        remainingPeriods: item.count,
      });
    }
  }

  const slots = Array.from(slotsMap.values()).sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.periodNumber - b.periodNumber;
  });

  const totalGridSlots = workingDays.length * instructionPeriodsPerDay;
  const unassignedPeriodsCount = totalGridSlots - slots.length;

  return {
    success: overflowSubjects.length === 0,
    message:
      overflowSubjects.length === 0
        ? `Deterministic timetable generated successfully (${slots.length} periods mapped).`
        : `Timetable generated with ${overflowSubjects.length} overflowing subjects that could not fit into the available grid.`,
    slots,
    unassignedPeriodsCount,
    overflowSubjects,
  };
}

/**
 * Validates timetable periods for teacher or room concurrency clashes.
 */
export function checkScheduleClashes(
  slots: {
    dayOfWeek: number;
    periodNumber: number;
    classId: string;
    teacherId?: string | null | undefined;
    roomId?: string | null | undefined;
  }[]
): TimetableClash[] {
  const clashes: TimetableClash[] = [];
  const teacherSlots = new Map<string, string>(); // key: `${day}-${period}-${teacherId}` -> classId
  const roomSlots = new Map<string, string>();    // key: `${day}-${period}-${roomId}` -> classId

  for (const slot of slots) {
    const timeKey = `${slot.dayOfWeek}-${slot.periodNumber}`;

    // 1. Teacher double-booking check
    if (slot.teacherId) {
      const teacherKey = `${timeKey}-${slot.teacherId}`;
      const existingClass = teacherSlots.get(teacherKey);
      if (existingClass && existingClass !== slot.classId) {
        clashes.push({
          type: "TEACHER_DOUBLE_BOOKING",
          dayOfWeek: slot.dayOfWeek,
          periodNumber: slot.periodNumber,
          conflictingEntityId: slot.teacherId,
          conflictingEntityName: `Teacher ${slot.teacherId}`,
          message: `Teacher is double-booked on Day ${slot.dayOfWeek}, Period ${slot.periodNumber} across classes.`,
        });
      } else {
        teacherSlots.set(teacherKey, slot.classId);
      }
    }

    // 2. Room double-booking check
    if (slot.roomId) {
      const roomKey = `${timeKey}-${slot.roomId}`;
      const existingClass = roomSlots.get(roomKey);
      if (existingClass && existingClass !== slot.classId) {
        clashes.push({
          type: "ROOM_OVERLAP",
          dayOfWeek: slot.dayOfWeek,
          periodNumber: slot.periodNumber,
          conflictingEntityId: slot.roomId,
          conflictingEntityName: `Room ${slot.roomId}`,
          message: `Room ${slot.roomId} is assigned simultaneously to multiple classes on Day ${slot.dayOfWeek}, Period ${slot.periodNumber}.`,
        });
      } else {
        roomSlots.set(roomKey, slot.classId);
      }
    }
  }

  return clashes;
}
