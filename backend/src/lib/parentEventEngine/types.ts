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
  | "LeaveRejectedCard"
  | "FeeQueryCard"
  | "WeeklyDigestCard"
  | "BusBoardingCard"
  | "BusAlertCard"
  | "StopChangeCard"
  | "DocumentRequestCard"
  | "ProfileChangeCard";

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
  ptmEventId?: string | null;
  bookingWindow?: {
    opensAt: Date | string;
    closesAt: Date | string;
    isOpen: boolean;
  } | null;
  booking?: {
    id: string;
    slotId: string;
    startAt: Date | string;
    endAt: Date | string;
    status: "BOOKED" | "HELD" | "CANCELLED";
    teacherName?: string | null;
    teacherNote?: string | null;
  } | null;
}

export interface NoticeSnapshot {
  id: string;
  title: string;
  contentPreview: string;
  publishedAt: Date | string;
  isPinned: boolean;
  expiresAt?: Date | string | null;
  requiresAcknowledgment?: boolean | undefined;
  acknowledgedAt?: Date | string | null | undefined;
}

export interface PendingConsentSnapshot {
  id: string;
  title: string;
  purpose?: string | undefined;
  description?: string | undefined;
  isMandatory?: boolean | undefined;
  deadline?: Date | string | null | undefined;
  consentType?: string | undefined;
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

export interface FeeQuerySnapshot {
  id: string;
  invoiceId: string;
  studentId?: string;
  termName?: string;
  category: "BREAKDOWN" | "LATE_FEE" | "WAIVER_REQUEST" | "DOUBLE_PAYMENT" | "OTHER";
  message: string;
  status: "OPEN" | "ANSWERED" | "RESOLVED" | "ESCALATED";
  createdAt: Date | string;
  answer?: string | null;
  answeredAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  escalatedAt?: Date | string | null;
  answeredByName?: string | null;
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
  feeQueries?: FeeQuerySnapshot[] | undefined;
  weeklyDigest?: WeeklyDigestSnapshot | undefined;
  busBoardingEvents?: BusBoardingSnapshot[] | undefined;
  stopChangeRequests?: StopChangeSnapshot[] | undefined;
  scheduledStopMinutes?: number | undefined;
  documentRequests?: DocumentRequestSnapshot[] | undefined;
  profileChanges?: ProfileChangeSnapshot[] | undefined;
}

export interface WeeklyDigestSnapshot {
  weekLabel: string; // e.g. "Oct 13 - Oct 19"
  attendanceDays: number;
  totalSchoolDays: number;
  homeworkGradedCount: number;
  feesStatus: "UP_TO_DATE" | "DUE_SOON" | "OVERDUE";
  balanceAmount?: number | undefined;
  upcomingEventsCount: number;
  upcomingEventSummary?: string | undefined;
}

export interface BusBoardingSnapshot {
  id: string;
  direction: "BOARDING" | "ALIGHTING";
  scannedAt: Date | string;
  stopName?: string;
  routeName?: string;
  vehicleNumber?: string;
}

export interface StopChangeSnapshot {
  id: string;
  requestedStopName: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  effectiveDate?: Date | string | null;
  decisionNote?: string | null;
  decidedAt?: Date | string | null;
}

export interface DocumentRequestSnapshot {
  id: string;
  documentType: string;
  title: string;
  description?: string | null | undefined;
  status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "EXPIRED";
  dueAt?: Date | string | null | undefined;
  expiresAt?: Date | string | null | undefined;
  rejectionReason?: string | null | undefined;
  verificationNote?: string | null | undefined;
  fileName?: string | null | undefined;
  uploadedAt?: Date | string | null | undefined;
  verifiedAt?: Date | string | null | undefined;
}

export interface ProfileChangeSnapshot {
  id: string;
  field: string;
  oldValue: Record<string, unknown> | string | null;
  newValue: Record<string, unknown> | string;
  status: "PENDING" | "APPLIED" | "REJECTED";
  decisionReason?: string | null | undefined;
  decidedAt?: Date | string | null | undefined;
  requestedAt?: Date | string | undefined;
}

