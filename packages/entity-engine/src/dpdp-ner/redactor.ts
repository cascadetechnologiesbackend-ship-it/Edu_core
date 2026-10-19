import { DetectedPII, PIIType, scanPII } from "./scanner";

export type RedactionMode = "MASK_PARTIAL" | "REDACT_FULL";

export interface RedactOptions {
  mode?: RedactionMode;
  types?: PIIType[];
}

export interface RedactionResult {
  redactedText: string;
  detectedPII: DetectedPII[];
  redactedCount: number;
}

/**
 * Redacts or masks statutory personal data in compliance with the DPDP Act 2023.
 */
export function redactPII(text: string, options: RedactOptions = {}): RedactionResult {
  if (!text || typeof text !== "string") {
    return { redactedText: "", detectedPII: [], redactedCount: 0 };
  }

  const mode = options.mode || "MASK_PARTIAL";
  const targetTypes = options.types ? new Set(options.types) : null;

  const detectedPII = scanPII(text);
  const toRedact = targetTypes
    ? detectedPII.filter((d) => targetTypes.has(d.type))
    : detectedPII;

  if (toRedact.length === 0) {
    return {
      redactedText: text,
      detectedPII,
      redactedCount: 0,
    };
  }

  // Process replacements from end to start to maintain index offsets
  const sorted = [...toRedact].sort((a, b) => b.startIndex - a.startIndex);
  let result = text;

  for (const item of sorted) {
    const mask = getReplacementString(item.raw, item.type, mode);
    result =
      result.substring(0, item.startIndex) +
      mask +
      result.substring(item.endIndex);
  }

  return {
    redactedText: result,
    detectedPII,
    redactedCount: toRedact.length,
  };
}

function getReplacementString(raw: string, type: PIIType, mode: RedactionMode): string {
  if (mode === "REDACT_FULL") {
    return `[REDACTED_${type}]`;
  }

  // MASK_PARTIAL mode
  switch (type) {
    case "AADHAAR": {
      const digits = raw.replace(/\D/g, "");
      const last4 = digits.slice(-4);
      return `XXXX-XXXX-${last4}`;
    }

    case "PAN": {
      const clean = raw.trim();
      if (clean.length === 10) {
        return `XXXXX${clean.slice(5, 9)}X`;
      }
      return "XXXX-PAN-XXXX";
    }

    case "CREDIT_CARD": {
      const digits = raw.replace(/\D/g, "");
      const last4 = digits.slice(-4);
      return `XXXX-XXXX-XXXX-${last4}`;
    }

    case "INDIAN_PHONE": {
      const digits = raw.replace(/\D/g, "");
      const last4 = digits.slice(-4);
      return `XXXXXX${last4}`;
    }

    case "EMAIL": {
      const parts = raw.split("@");
      const user = parts[0];
      const domain = parts[1];
      if (parts.length === 2 && user && domain) {
        if (user.length <= 2) {
          return `${user.charAt(0)}***@${domain}`;
        }
        return `${user.charAt(0)}***${user.charAt(user.length - 1)}@${domain}`;
      }
      return "x***@domain.com";
    }

    case "IFSC": {
      const clean = raw.trim();
      return `${clean.slice(0, 4)}000****`;
    }

    case "UPI_ID": {
      const parts = raw.split("@");
      const handle = parts[0];
      const provider = parts[1];
      if (parts.length === 2 && handle && provider) {
        const maskedHandle = handle.length > 2 ? `${handle.slice(0, 2)}***` : `***`;
        return `${maskedHandle}@${provider}`;
      }
      return `***@upi`;
    }

    case "PASSPORT":
    case "VOTER_ID": {
      const clean = raw.trim();
      const last3 = clean.slice(-3);
      return `XXXXX${last3}`;
    }

    case "SPDI_HEALTH":
      return "[CONFIDENTIAL_HEALTH_DATA]";

    case "SPDI_CASTE_RELIGION":
      return "[CONFIDENTIAL_CATEGORY_DATA]";

    default:
      return `[MASKED_${type}]`;
  }
}
