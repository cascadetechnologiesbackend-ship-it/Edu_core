/**
 * Student Event Engine Types (Spec v1.0, Phase S3)
 *
 * Defines the contract for the high-intent, zero-clutter student feed.
 */

export type StudentFeedCardType =
  | "HomeworkDue"
  | "ClassworkRecap"
  | "AssessmentCountdown"
  | "NoticeCard"
  | "MarksPublished"
  | "FeeHoldWarning";

export type CardTier =
  | "T0_emergency"
  | "T1_action_required"
  | "T2_informational"
  | "T3_system_state";

export interface LocalizedString {
  en: string;
  hi: string;
}

export interface StudentFeedCard {
  id: string;
  studentId: string;
  cardType: StudentFeedCardType;
  tier: CardTier;
  priority: number;
  title: LocalizedString;
  summary: LocalizedString;
  payload: Record<string, any>;
  activatedAt: Date;
  expiresAt: Date;
  dismissedAt?: Date | null;
  occurredAt?: Date;
  isPinned?: boolean;
}

export interface StudentHomeworkSnapshot {
  id: string;
  title: string;
  description: string | null;
  classSubjectId: string;
  subjectName: string;
  dueDate: Date | string;
  status: string;
  attachmentS3Key: string | null;
  teacherName: string;
  isSubmitted: boolean;
  submission?: {
    id: string;
    submittedAt: Date | string;
    isLate: boolean;
    marksAwarded?: number | null;
    grade?: string | null;
    remarks?: string | null;
  };
}

export interface StudentClassworkSnapshot {
  id: string;
  classSubjectId: string;
  subjectName: string;
  chapterName: string | null;
  topicTitle: string | null;
  objectives: string | null;
  homework: string | null;
  teachingMethods: string | null;
  resources: string | null;
  completedDate: Date | string;
  teacherName: string;
}

export interface StudentAssessmentSnapshot {
  id: string;
  title: string;
  classSubjectId: string;
  subjectName: string;
  assessmentType: string;
  scheduledDate: Date | string;
  maxMarks: number;
  syllabusCoverage: string | null;
  status: string;
}

export interface StudentNoticeSnapshot {
  id: string;
  title: string;
  content: string;
  audienceType: string;
  publishedAt: Date | string;
  expiresAt?: Date | string | null;
  isPinned: boolean;
  requiresAcknowledgment: boolean;
  isAcknowledged: boolean;
  attachmentS3Key?: string | null;
}

export interface StudentMarksSnapshot {
  examId: string;
  examName: string;
  academicYearId?: string;
  subjectName?: string;
  overallGrade?: string | null;
  percentage?: number | null;
  marksAwarded?: number | null;
  maxMarks?: number | null;
  rank?: number | null;
  teacherRemarks?: string | null;
  pdfS3Key?: string | null;
  publishedAt: Date | string;
}

export interface StudentDataSnapshot {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  enrolledSubjectIds: string[];
  homework: StudentHomeworkSnapshot[];
  classwork: StudentClassworkSnapshot[];
  upcomingAssessments: StudentAssessmentSnapshot[];
  notices: StudentNoticeSnapshot[];
  publishedMarks: StudentMarksSnapshot[];
  admitCardFeeHold?: {
    examName: string;
    balanceDue: number;
    feeLockMode: string;
  } | null;
  attendanceSummary?: {
    presentDays: number;
    totalDays: number;
    ratePercent: number | null;
  } | null;
}
