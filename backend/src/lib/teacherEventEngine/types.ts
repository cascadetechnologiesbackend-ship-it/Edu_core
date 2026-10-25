/**
 * Teacher Event Engine Types (Spec v1.0, AC-T1 - AC-T15)
 *
 * Defines the contract for the orchestrated, zero-clutter teacher feed.
 */

export type TeacherCardType =
  | "AttendanceNowCard"
  | "NowNextCard"
  | "GradingQueueCard"
  | "MarksEntryCard"
  | "LeaveQueueCard"
  | "SubstitutionCard"
  | "PTMTodayCard"
  | "MessagesCard"
  | "InsightCard"
  | "NoticeCard"
  | "HomeworkDueCard"
  | "ClassworkPendingCard";

export type TeacherCardTier =
  | "T1_action_required"
  | "T2_informational"
  | "T3_system_state";

export interface LocalizedString {
  en: string;
  hi: string;
}

export interface DerivedTeacherFeedCard {
  id: string;
  teacherUserId: string;
  cardType: TeacherCardType;
  tier: TeacherCardTier;
  priority: number;
  title: LocalizedString;
  summary: LocalizedString;
  payload: Record<string, any>;
  audience?: Record<string, any>;
  activatedAt: Date;
  expiresAt: Date;
  dismissedAt?: Date | null;
}

export interface AttendanceSectionSummary {
  sectionId: string;
  sectionName: string;
  className: string;
  totalStudents: number;
  markedCount: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  halfDayCount: number;
  isMarked: boolean;
}

export interface TimetablePeriodItem {
  periodId: string;
  periodNumber: number;
  startTime: string; // "HH:MM" e.g. "08:30"
  endTime: string;   // "HH:MM" e.g. "09:15"
  sectionId?: string;
  sectionName?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  roomNumber?: string;
  isFree: boolean;
  lessonPlanStatus?: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  substitutionCovering?: {
    id: string;
    substituteTeacherId: string;
    substituteTeacherName: string;
    status: "PENDING" | "CONFIRMED";
  };
}

export interface AssignmentGradingItem {
  assignmentId: string;
  title: string;
  sectionId: string;
  sectionName: string;
  className: string;
  subjectName: string;
  dueDate: Date | string;
  totalSubmissions: number;
  gradedCount: number;
  ungradedCount: number;
  lateCount: number;
  isPastDue: boolean;
}

export interface MarksEntryWindowItem {
  examId: string;
  examName: string;
  sectionId: string;
  sectionName: string;
  className: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  windowOpensAt: Date | string;
  windowClosesAt: Date | string;
  totalStudents: number;
  completedEntries: number;
  isWindowOpen: boolean;
  isLocked: boolean;
  lockReason?: string;
}

export interface LeaveRequestItem {
  id: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  className: string;
  leaveType: "CASUAL" | "SICK" | "EMERGENCY" | "OTHER";
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  requestedAt: Date | string;
}

export interface SubstitutionItem {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  date: string; // "YYYY-MM-DD"
  periodNumber: number;
  startTime: string;
  endTime: string;
  sectionName?: string;
  className?: string;
  subjectName?: string;
  otherTeacherName: string;
  reason?: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  hasConflict?: boolean;
  conflictReason?: string;
}

export interface PTMSlotItem {
  bookingId: string;
  slotId: string;
  startTime: Date | string;
  endTime: Date | string;
  parentName: string;
  studentName: string;
  sectionName: string;
  status: "BOOKED" | "HELD" | "CANCELLED";
  teacherNote?: string | null;
}

export interface TeacherMessageItem {
  threadId: string;
  parentName: string;
  studentName: string;
  sectionName: string;
  lastMessagePreview: string;
  sentAt: Date | string;
  unreadCount: number;
}

export interface TeacherInsightItem {
  id: string;
  model: "section_attendance_trend" | "homework_neglect_list" | "pre_publish_distribution";
  severity: "AMBER" | "ROSE" | "INFO";
  title: LocalizedString;
  summary: LocalizedString;
  payload: Record<string, any>;
}

export interface TeacherNoticeItem {
  id: string;
  title: string;
  contentPreview: string;
  publishedAt: Date | string;
  isPinned: boolean;
  audience: "TEACHERS" | "ALL" | string;
  expiresAt?: Date | string | null;
}

export interface TeacherHomeworkDueItem {
  id: string;
  title: string;
  subjectName: string;
  sectionName: string;
  className: string;
  dueDate: Date | string;
  submissionCount: number;
  totalStudents: number;
}

export interface TeacherPendingClassworkPeriod {
  periodNumber: number;
  subjectName: string;
  sectionName: string;
  className: string;
  startTime: string;
  endTime: string;
  classSubjectId?: string;
  sectionId?: string;
}

export interface TeacherDataSnapshot {
  teacherUserId: string;
  teacherName?: string;
  isWorkingDay: boolean;
  schoolDayStart?: string; // "HH:MM", default "07:30"
  schoolDayEnd?: string;   // "HH:MM", default "15:30"
  attendanceCutoffTime?: string; // "HH:MM", default "10:00"
  attendanceSections?: AttendanceSectionSummary[];
  timetableToday?: TimetablePeriodItem[];
  gradingAssignments?: AssignmentGradingItem[];
  marksEntryWindows?: MarksEntryWindowItem[];
  pendingLeaveRequests?: LeaveRequestItem[];
  substitutions?: SubstitutionItem[];
  ptmBookingsToday?: PTMSlotItem[];
  unreadMessages?: TeacherMessageItem[];
  insights?: TeacherInsightItem[];
  notices?: TeacherNoticeItem[];
  upcomingHomeworkDue?: TeacherHomeworkDueItem[];
  pendingClassworkPeriods?: TeacherPendingClassworkPeriod[];
  isRestDay?: boolean | undefined;
  calendarEventTitle?: string | undefined;
  isSetupMissing?: boolean | undefined;
  missingAllocationsSummary?: string[] | undefined;
}
