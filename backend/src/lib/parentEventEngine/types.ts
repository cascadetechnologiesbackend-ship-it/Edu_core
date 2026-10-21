/**
 * Parent Event Engine Types (Spec v1.0)
 *
 * Defines the contract for the high-intent, zero-clutter parent feed.
 */

export type CardType =
  | "PaymentCard"
  | "AttendanceCard"
  | "BusLiveCard"
  | "HomeworkCard"
  | "ReportCardCard"
  | "PTMCard"
  | "NoticeCard"
  | "ConsentCard"
  | "InsightCard"
  | "MessageCard"
  | "LeaveApprovedCard"
  | "LeaveRejectedCard";

export type CardTier =
  | "T1_action_required"
  | "T2_informational"
  | "T3_system_state";

export interface LocalizedString {
  en: string;
  hi: string;
}

export interface DerivedFeedCard {
  id: string;
  studentId: string;
  cardType: CardType;
  tier: CardTier;
  priority: number;
  title: LocalizedString;
  summary: LocalizedString;
  payload: Record<string, any>;
  activatedAt: Date;
  expiresAt: Date;
  dismissedAt?: Date | null;
}

export interface InvoiceSnapshot {
  id: string;
  termName: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED" | "CANCELLED";
  dueDate: Date | string;
  balanceAmount: number;
  lateFeeAmount: number;
  reminderSentFlags?: {
    d7?: boolean;
    d15?: boolean;
    d30?: boolean;
  };
  lastPayment?: {
    status: string; // "PAID" | "ATTEMPTED" | "FAILED"
    paidAt: Date | string;
    amount?: number;
    receiptNumber?: string;
  };
}

export interface AttendanceSnapshot {
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
  markedAt: Date | string;
  remarks?: string | null;
}

export interface BusPassSnapshot {
  isActive: boolean;
  routeId: string;
  routeName?: string;
  stopId: string;
  stopName?: string;
  stopOrder: number;
  stopCoords?: { lat: number; lng: number };
}

export interface GpsPingSnapshot {
  lat: number;
  lng: number;
  speed: number;
  recordedAt: Date | string;
}

export interface RouteStopSnapshot {
  id: string;
  stopOrder: number;
  lat: number;
  lng: number;
  name: string;
  estimatedTime?: string | undefined;
}

export interface HomeworkSnapshot {
  id: string;
  title: string;
  subjectName: string;
  dueDate: Date | string;
  isSubmitted: boolean;
  submission?: {
    submittedAt: Date | string;
    grade?: string | null;
    feedback?: string | null;
  };
}

export interface ReportCardSnapshot {
  id: string;
  termName: string;
  publishedAt: Date | string;
  viewedAt?: Date | string | null;
  averageScore: number;
  previousAverageScore?: number | null;
}

export interface UpcomingEventSnapshot {
  id: string;
  title: string;
  eventType: string; // PTM, HOLIDAY, EXAM, SPORTS, CULTURAL
  startDate: Date | string;
  endDate?: Date | string | null;
  venue?: string | null;
}

export interface NoticeSnapshot {
  id: string;
  title: string;
  contentPreview: string;
  publishedAt: Date | string;
  isPinned: boolean;
  expiresAt?: Date | string | null;
}

export interface PendingConsentSnapshot {
  id: string;
  title: string;
  deadline?: Date | string | null;
  consentType?: string;
}

export interface UnreadMessageSnapshot {
  threadId: string;
  teacherName: string;
  teacherAvatar?: string | null;
  lastMessagePreview: string;
  sentAt: Date | string;
}

export interface InsightSnapshot {
  id: string;
  model: "attendance_risk" | "performance_dip" | "fee_stress" | "homework_neglect";
  severity: "AMBER" | "ROSE";
  finding: LocalizedString;
  actionLink?: string | undefined;
}

export interface LeaveRequestSnapshot {
  id: string;
  leaveType: "CASUAL" | "SICK" | "EMERGENCY" | "OTHER";
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED_BY_PARENT";
  decidedAt?: Date | string | null;
  decisionNote?: string | null;
  teacherName?: string | null;
}

export interface ParentDataSnapshot {
  studentName?: string | undefined;
  invoices?: InvoiceSnapshot[] | undefined;
  attendanceToday?: AttendanceSnapshot | undefined;
  busPass?: BusPassSnapshot | undefined;
  latestBusPing?: GpsPingSnapshot | undefined;
  routeStops?: RouteStopSnapshot[] | undefined;
  isCommuteWindowOverride?: boolean | undefined;
  homework?: HomeworkSnapshot[] | undefined;
  reportCards?: ReportCardSnapshot[] | undefined;
  upcomingEvents?: UpcomingEventSnapshot[] | undefined;
  notices?: NoticeSnapshot[] | undefined;
  pendingConsents?: PendingConsentSnapshot[] | undefined;
  unreadMessages?: UnreadMessageSnapshot[] | undefined;
  insights?: InsightSnapshot[] | undefined;
  leaveRequests?: LeaveRequestSnapshot[] | undefined;
}
