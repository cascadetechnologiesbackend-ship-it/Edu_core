/**
 * Pure Document, Profile & Consent Engine (Spec v1.2 Phase P15, OP6, OP10, OP11, AC-P14, AC-P24)
 *
 * Implements:
 * - Document submission and expiry re-request evaluation (OP6)
 * - Single aggregated DPDP consent checklist (never 1 card per purpose) (OP11)
 * - Profile change diff formatting and status lifecycle (OP10)
 * - File validation for parent upload (3-click budget AC-P24)
 */

export type DocumentRequestStatus = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "EXPIRED";

export interface DocumentRequestInput {
  id: string;
  studentId?: string | undefined;
  documentType: string;
  title: string;
  status: DocumentRequestStatus;
  dueAt?: Date | string | null | undefined;
  expiresAt?: Date | string | null | undefined;
  rejectionReason?: string | null | undefined;
  verificationNote?: string | null | undefined;
  fileKey?: string | null | undefined;
  uploadedAt?: Date | string | null | undefined;
}

export interface DocumentExpiryEvaluation {
  isExpired: boolean;
  isExpiringSoon: boolean; // within 30 days
  daysUntilExpiry: number | null;
  shouldAutoReRequest: boolean;
  effectiveStatus: DocumentRequestStatus;
}

/**
 * Evaluates document expiry and automated re-request trigger (OP6)
 */
export function evaluateDocumentExpiry(
  doc: DocumentRequestInput,
  now: Date = new Date()
): DocumentExpiryEvaluation {
  if (!doc.expiresAt) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysUntilExpiry: null,
      shouldAutoReRequest: false,
      effectiveStatus: doc.status,
    };
  }

  const expiryDate = new Date(doc.expiresAt);
  const diffMs = expiryDate.getTime() - now.getTime();
  const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysUntilExpiry,
      shouldAutoReRequest: true,
      effectiveStatus: "EXPIRED",
    };
  }

  const isExpiringSoon = daysUntilExpiry <= 30;

  return {
    isExpired: false,
    isExpiringSoon,
    daysUntilExpiry,
    shouldAutoReRequest: isExpiringSoon,
    effectiveStatus: doc.status,
  };
}

/**
 * Validates document upload file format and size constraint (Max 10MB)
 */
export function validateDocumentUpload(file: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): { valid: boolean; error?: string | undefined } {
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedMimeTypes.includes(file.mimeType.toLowerCase())) {
    return {
      valid: false,
      error: "Only PDF, JPEG, PNG, and WebP files are supported.",
    };
  }

  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  if (file.sizeBytes > maxSizeBytes) {
    return {
      valid: false,
      error: "File size exceeds 10MB limit.",
    };
  }

  if (file.sizeBytes <= 0) {
    return {
      valid: false,
      error: "File is empty.",
    };
  }

  return { valid: true };
}

export interface ConsentRecordInput {
  id: string;
  purpose?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  isMandatory?: boolean | undefined;
  granted?: boolean | null | undefined;
  withdrawnAt?: Date | string | null | undefined;
  deadline?: Date | string | null | undefined;
}

export interface AggregatedConsentChecklistItem {
  id: string;
  purpose: string;
  title: string;
  description: string;
  isMandatory: boolean;
  deadline?: string | null | undefined;
  isUrgent: boolean;
}

export interface AggregatedConsentResult {
  items: AggregatedConsentChecklistItem[];
  totalPending: number;
  hasUrgent: boolean;
  feedTier: "T1_action_required" | "T2_informational";
  priority: number;
}

const PURPOSE_FALLBACK_TITLES: Record<string, { title: string; desc: string }> = {
  ANNUAL_STUDENT_PHOTO_DIRECTORY: {
    title: "Student Directory & Year-Book Photo",
    desc: "Consent to include child photo in printed annual directory and school year-book.",
  },
  FIELD_TRIP_TRANSPORT: {
    title: "Off-Campus Educational Trip Transport",
    desc: "Permission for school-organized transit on educational field trips.",
  },
  ACADEMIC_DATA_SHARING: {
    title: "Educational Analytics & Assessment Sharing",
    desc: "Sharing anonymized progress metrics with accredited curriculum assessment partners.",
  },
  HEALTH_RECORD_SHARING: {
    title: "Campus Medical & Emergency First-Aid",
    desc: "Consent for school infirmary and visiting medical professionals to administer emergency care.",
  },
};

/**
 * Aggregates pending DPDP consents into a single checklist card (OP11, Zero-Clutter)
 * NEVER emits multiple cards for different pending purposes.
 */
export function aggregatePendingConsents(
  records: ConsentRecordInput[],
  now: Date = new Date()
): AggregatedConsentResult {
  const pendingRecords = records.filter(
    (r) => r.granted === false || r.granted === null || r.granted === undefined
  );

  if (pendingRecords.length === 0) {
    return {
      items: [],
      totalPending: 0,
      hasUrgent: false,
      feedTier: "T2_informational",
      priority: 0,
    };
  }

  let hasUrgent = false;
  const items: AggregatedConsentChecklistItem[] = pendingRecords.map((r) => {
    let isUrgent = false;
    let deadlineStr: string | null = null;

    if (r.deadline) {
      const dDate = new Date(r.deadline);
      deadlineStr = dDate.toISOString();
      const diffHours = (dDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours <= 48) {
        isUrgent = true;
        hasUrgent = true;
      }
    }

    const purposeKey = r.purpose || "GENERAL_CONSENT";
    const fallback = PURPOSE_FALLBACK_TITLES[purposeKey] || {
      title: purposeKey.replace(/_/g, " "),
      desc: "Consent required under the Digital Personal Data Protection Act.",
    };

    return {
      id: r.id,
      purpose: purposeKey,
      title: r.title || fallback.title,
      description: r.description || fallback.desc,
      isMandatory: Boolean(r.isMandatory),
      deadline: deadlineStr,
      isUrgent,
    };
  });

  return {
    items,
    totalPending: items.length,
    hasUrgent,
    feedTier: hasUrgent ? "T1_action_required" : "T2_informational",
    priority: hasUrgent ? 88 : 45,
  };
}

export type ProfileChangeField = "address" | "phone" | "demographics" | "medical";
export type ProfileChangeStatus = "PENDING" | "APPLIED" | "REJECTED";

export interface ProfileChangeInput {
  id: string;
  studentId?: string | undefined;
  field: string;
  oldValue: Record<string, unknown> | string | null;
  newValue: Record<string, unknown> | string;
  status: ProfileChangeStatus;
  decisionReason?: string | null | undefined;
  requestedAt?: Date | string | undefined;
  decidedAt?: Date | string | null | undefined;
}

export interface FormattedProfileChangeSummary {
  fieldDisplay: string;
  summaryText: string;
  diffItems: Array<{ label: string; from: string; to: string }>;
  isRecentDecision: boolean; // decided within 48h
}

/**
 * Formats profile change summary with dignified, explainable copy (OP10)
 */
export function formatProfileChangeSummary(
  change: ProfileChangeInput,
  now: Date = new Date()
): FormattedProfileChangeSummary {
  const fieldKey = change.field.toLowerCase();
  let fieldDisplay = "Profile Details";
  if (fieldKey.includes("address")) fieldDisplay = "Residential Address";
  else if (fieldKey.includes("phone") || fieldKey.includes("contact")) fieldDisplay = "Emergency Contact";
  else if (fieldKey.includes("medical")) fieldDisplay = "Medical Information";
  else if (fieldKey.includes("demo")) fieldDisplay = "Student Demographics";

  const parseVal = (val: Record<string, unknown> | string | null): Record<string, unknown> => {
    if (!val) return {};
    if (typeof val === "object") return val;
    try {
      return JSON.parse(val);
    } catch {
      return { value: val };
    }
  };

  const oldObj = parseVal(change.oldValue);
  const newObj = parseVal(change.newValue);

  const diffItems: Array<{ label: string; from: string; to: string }> = [];
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  for (const k of allKeys) {
    const fromVal = String(oldObj[k] ?? "-");
    const toVal = String(newObj[k] ?? "-");
    if (fromVal !== toVal) {
      const formattedLabel = k
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      diffItems.push({
        label: formattedLabel,
        from: fromVal,
        to: toVal,
      });
    }
  }

  let summaryText = `Requested update for ${fieldDisplay}`;
  if (change.status === "APPLIED") {
    summaryText = `School verified and applied update for ${fieldDisplay}`;
  } else if (change.status === "REJECTED") {
    summaryText = `Update request could not be applied: ${change.decisionReason || "Please contact administration"}`;
  }

  let isRecentDecision = false;
  if (change.decidedAt && (change.status === "APPLIED" || change.status === "REJECTED")) {
    const dTime = new Date(change.decidedAt).getTime();
    const ageHours = (now.getTime() - dTime) / (1000 * 60 * 60);
    if (ageHours >= 0 && ageHours <= 48) {
      isRecentDecision = true;
    }
  }

  return {
    fieldDisplay,
    summaryText,
    diffItems,
    isRecentDecision,
  };
}

/**
 * Validates profile change field and payload structure
 */
export function validateProfileChangePayload(
  field: string,
  newValue: Record<string, unknown> | string
): { valid: boolean; error?: string | undefined } {
  const allowedFields = ["address", "phone", "demographics", "medical"];
  if (!allowedFields.includes(field.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid field '${field}'. Allowed fields are: ${allowedFields.join(", ")}`,
    };
  }

  if (!newValue) {
    return { valid: false, error: "New value is required." };
  }

  if (typeof newValue === "string" && newValue.trim().length === 0) {
    return { valid: false, error: "New value cannot be empty." };
  }

  if (typeof newValue === "object" && Object.keys(newValue).length === 0) {
    return { valid: false, error: "New value must contain at least one attribute." };
  }

  return { valid: true };
}
