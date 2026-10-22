import { createHash } from "crypto";
import { db } from "@/db";
import { piiAuditTrails } from "@/db/schema";
import {
  scanPII,
  redactPII,
  type DetectedPII,
  type PIIType,
  type PIIRiskLevel,
  type RedactionMode,
} from "@schoolmitra/entity-engine/dpdp-ner";

export type EnforcementDecision =
  | "BLOCKED"
  | "MASKED"
  | "CONFIRMED_SEND"
  | "LOGGED_ONLY";

export interface ScanContentParams {
  schoolId: string;
  actorUserId: string;
  surface: string;
  sourceTable: string;
  sourceId?: string | null;
  text: string;
  decisionOverride?: EnforcementDecision;
  redactionMode?: RedactionMode;
  isRelaxedHighWarn?: boolean;
}

export interface ScanContentResult {
  hasPII: boolean;
  riskLevel: PIIRiskLevel | "NONE";
  detectedTypes: PIIType[];
  matchCount: number;
  detectedPII: DetectedPII[];
  decision: EnforcementDecision;
  redactedText?: string;
  contentHash: string;
  auditTrailId?: string;
}

/**
 * Derives overall risk level from a list of detections.
 * Priority: CRITICAL > HIGH > MEDIUM > LOW
 */
export function deriveRiskLevel(detected: DetectedPII[]): PIIRiskLevel | "NONE" {
  if (detected.length === 0) return "NONE";
  if (detected.some((d) => d.riskLevel === "CRITICAL")) return "CRITICAL";
  if (detected.some((d) => d.riskLevel === "HIGH")) return "HIGH";
  if (detected.some((d) => d.riskLevel === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

/**
 * Server-only PII content scanning and audit sink helper (DPDP Act 2023).
 *
 * Rules:
 *  - Computes SHA-256 of raw input for content_hash (forensic proof without raw storage).
 *  - CRITICAL detection defaults to BLOCKED.
 *  - HIGH detection defaults to MASKED (or CONFIRMED_SEND if decisionOverride supplied).
 *  - MEDIUM / LOW defaults to LOGGED_ONLY.
 *  - If hasPII is true, writes an append-only row to pii_audit_trails.
 *  - NEVER stores raw or masked PII in pii_audit_trails.
 */
export async function scanContentForPII(
  params: ScanContentParams
): Promise<ScanContentResult> {
  const {
    schoolId,
    actorUserId,
    surface,
    sourceTable,
    sourceId = null,
    text,
    decisionOverride,
    redactionMode = "MASK_PARTIAL",
    isRelaxedHighWarn = false,
  } = params;

  const contentHash = createHash("sha256").update(text || "").digest("hex");

  if (!text || typeof text !== "string") {
    return {
      hasPII: false,
      riskLevel: "NONE",
      detectedTypes: [],
      matchCount: 0,
      detectedPII: [],
      decision: "LOGGED_ONLY",
      contentHash,
    };
  }

  const detectedPII = scanPII(text);
  const matchCount = detectedPII.length;
  const hasPII = matchCount > 0;
  const riskLevel = deriveRiskLevel(detectedPII);
  const detectedTypes = Array.from(new Set(detectedPII.map((d) => d.type)));

  if (!hasPII) {
    return {
      hasPII: false,
      riskLevel: "NONE",
      detectedTypes: [],
      matchCount: 0,
      detectedPII: [],
      decision: "LOGGED_ONLY",
      contentHash,
    };
  }

  // Determine enforcement decision
  let decision: EnforcementDecision;
  if (decisionOverride) {
    decision = decisionOverride;
  } else if (riskLevel === "CRITICAL") {
    decision = "BLOCKED";
  } else if (riskLevel === "HIGH") {
    decision = isRelaxedHighWarn ? "LOGGED_ONLY" : "BLOCKED";
  } else {
    decision = "LOGGED_ONLY";
  }

  let redactedText: string | undefined;
  if (decision === "MASKED") {
    const redRes = redactPII(text, { mode: redactionMode });
    redactedText = redRes.redactedText;
  }

  let auditTrailId: string | undefined;

  try {
    const [inserted] = await db
      .insert(piiAuditTrails)
      .values({
        schoolId,
        actorUserId,
        surface,
        sourceTable,
        sourceId: sourceId || null,
        detectedTypes,
        riskLevel: riskLevel === "NONE" ? "LOW" : riskLevel,
        matchCount,
        decision,
        redactionMode: decision === "MASKED" ? redactionMode : null,
        contentHash,
      })
      .returning({ id: piiAuditTrails.id });

    auditTrailId = inserted?.id;
  } catch (err) {
    console.error("[DPDP scanContentForPII] Audit log write error:", err);
  }

  return {
    hasPII: true,
    riskLevel,
    detectedTypes,
    matchCount,
    detectedPII,
    decision,
    ...(redactedText !== undefined ? { redactedText } : {}),
    contentHash,
    ...(auditTrailId !== undefined ? { auditTrailId } : {}),
  };
}
