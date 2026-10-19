import { validateAadhaar } from "./verhoeff";

export type PIIType =
  | "AADHAAR"
  | "PAN"
  | "PASSPORT"
  | "VOTER_ID"
  | "INDIAN_PHONE"
  | "EMAIL"
  | "BANK_ACCOUNT"
  | "IFSC"
  | "UPI_ID"
  | "CREDIT_CARD"
  | "SPDI_HEALTH"
  | "SPDI_CASTE_RELIGION";

export type PIIRiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface DetectedPII {
  type: PIIType;
  raw: string;
  startIndex: number;
  endIndex: number;
  riskLevel: PIIRiskLevel;
  confidence: number;
  description: string;
}

/**
 * Validates Credit / Debit card numbers using the standard Luhn algorithm.
 */
export function validateLuhn(cardNumber: string): boolean {
  const sanitized = cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(sanitized)) return false;

  let sum = 0;
  let alternate = false;

  for (let i = sanitized.length - 1; i >= 0; i--) {
    let n = parseInt(sanitized.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Scans arbitrary text or database payloads for statutory DPDP 2023 Personal Identifiable Information (PII).
 */
export function scanPII(text: string): DetectedPII[] {
  if (!text || typeof text !== "string") return [];

  const detections: DetectedPII[] = [];
  const matchedSpans: Array<{ start: number; end: number }> = [];

  const isOverlapping = (start: number, end: number) => {
    return matchedSpans.some(
      (span) => Math.max(start, span.start) < Math.min(end, span.end)
    );
  };

  const addDetection = (
    type: PIIType,
    raw: string,
    start: number,
    end: number,
    riskLevel: PIIRiskLevel,
    confidence: number,
    description: string
  ) => {
    if (isOverlapping(start, end)) return;
    matchedSpans.push({ start, end });
    detections.push({
      type,
      raw,
      startIndex: start,
      endIndex: end,
      riskLevel,
      confidence,
      description,
    });
  };

  // 1. Aadhaar (12 digits with Verhoeff verification)
  const aadhaarRegex = /\b([2-9]\d{3}[-\s]?\d{4}[-\s]?\d{4})\b/g;
  let match: RegExpExecArray | null;
  while ((match = aadhaarRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw && validateAadhaar(raw)) {
      addDetection(
        "AADHAAR",
        raw,
        match.index,
        match.index + raw.length,
        "CRITICAL",
        0.99,
        "Indian Statutory Aadhaar Number (Verhoeff Verified)"
      );
    }
  }

  // 2. PAN (Permanent Account Number - 5 letters, 4 digits, 1 letter)
  const panRegex = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;
  while ((match = panRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw) {
      addDetection(
        "PAN",
        raw,
        match.index,
        match.index + raw.length,
        "HIGH",
        0.95,
        "Indian Income Tax Permanent Account Number (PAN)"
      );
    }
  }

  // 3. Indian Credit / Debit Cards (13-19 digits, Luhn validated)
  const cardRegex = /\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/g;
  while ((match = cardRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw && validateLuhn(raw)) {
      addDetection(
        "CREDIT_CARD",
        raw,
        match.index,
        match.index + raw.length,
        "CRITICAL",
        0.98,
        "Payment Card Number (Luhn Validated)"
      );
    }
  }

  // 4. IFSC Code (4 letters, 0, 6 alphanumeric)
  const ifscRegex = /\b([A-Z]{4}0[A-Z0-9]{6})\b/g;
  while ((match = ifscRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw) {
      addDetection(
        "IFSC",
        raw,
        match.index,
        match.index + raw.length,
        "MEDIUM",
        0.95,
        "Indian Financial System Code (IFSC)"
      );
    }
  }

  // 5. Voter ID / EPIC (3 uppercase letters, 7 digits)
  const voterRegex = /\b([A-Z]{3}[0-9]{7})\b/g;
  while ((match = voterRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw) {
      addDetection(
        "VOTER_ID",
        raw,
        match.index,
        match.index + raw.length,
        "MEDIUM",
        0.90,
        "Indian Voter ID (EPIC Card)"
      );
    }
  }

  // 6. Indian Passport (1 letter, 7 digits, typically starting with letters like A-Z)
  const passportRegex = /\b([A-PR-WYa-pr-wy][1-9]\d{6})\b/g;
  while ((match = passportRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw) {
      addDetection(
        "PASSPORT",
        raw,
        match.index,
        match.index + raw.length,
        "HIGH",
        0.85,
        "Indian Passport Number"
      );
    }
  }

  // 7. Email Address
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  while ((match = emailRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw) {
      addDetection(
        "EMAIL",
        raw,
        match.index,
        match.index + raw.length,
        "HIGH",
        0.95,
        "Personal Email Address"
      );
    }
  }

  // 8. Indian Mobile Number (10 digits starting with 6, 7, 8, or 9, with optional +91 or 0 prefix)
  const phoneRegex = /(?:(?:\+91|0)[-\s]?)?([6-9]\d{4}[-\s]?\d{5})\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    const raw = match[0];
    if (raw) {
      const digitsOnly = raw.replace(/\D/g, "");
      if (digitsOnly.length === 10 || (digitsOnly.length === 12 && digitsOnly.startsWith("91"))) {
        addDetection(
          "INDIAN_PHONE",
          raw,
          match.index,
          match.index + raw.length,
          "HIGH",
          0.90,
          "Indian Mobile Telephone Number"
        );
      }
    }
  }

  // 9. UPI VPA Handles
  const upiRegex = /\b([a-zA-Z0-9.\-_]{2,64}@(okhdfcbank|oksbi|okaxis|okicici|paytm|upi|ybl|axl|ibl|apl|barodampay))\b/gi;
  while ((match = upiRegex.exec(text)) !== null) {
    const raw = match[1];
    if (raw) {
      addDetection(
        "UPI_ID",
        raw,
        match.index,
        match.index + raw.length,
        "MEDIUM",
        0.95,
        "Unified Payments Interface (UPI) Virtual Payment Address"
      );
    }
  }

  // 10. SPDI: Health & Medical Conditions
  const healthRegex = /\b(blood group\s*:\s*[ABO][+-]|asthma|diabetic|epilepsy|allergic to [a-zA-Z]+|physically handicapped|special needs)\b/gi;
  while ((match = healthRegex.exec(text)) !== null) {
    const raw = match[0];
    if (raw) {
      addDetection(
        "SPDI_HEALTH",
        raw,
        match.index,
        match.index + raw.length,
        "HIGH",
        0.90,
        "Sensitive Personal Data: Health & Medical Records"
      );
    }
  }

  // 11. SPDI: Caste & Religion Category
  const socialCategoryRegex = /\b(category\s*:\s*(?:general|obc|sc|st|ebc)|religion\s*:\s*(?:hindu|muslim|sikh|christian|jain|buddhist))\b/gi;
  while ((match = socialCategoryRegex.exec(text)) !== null) {
    const raw = match[0];
    if (raw) {
      addDetection(
        "SPDI_CASTE_RELIGION",
        raw,
        match.index,
        match.index + raw.length,
        "HIGH",
        0.90,
        "Sensitive Personal Data: Caste / Social Category or Religion"
      );
    }
  }

  return detections.sort((a, b) => a.startIndex - b.startIndex);
}
