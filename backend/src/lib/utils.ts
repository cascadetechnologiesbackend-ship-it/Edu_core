import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format Indian Rupee amount */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Format Indian date (DD/MM/YYYY) */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Format date and time */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Mask Aadhaar — show only last 4 digits */
export function maskAadhaar(last4: string): string {
  return `XXXX-XXXX-${last4}`;
}

/** Generate initials from name */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Sleep utility (for testing/retry logic) */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Safely parse JSON — returns null on failure */
export function safeParseJson<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** Generate admission number in format 2025/NUR/001 */
export function generateAdmissionNumber(
  year: number,
  gradeCode: string,
  sequence: number,
): string {
  const seq = String(sequence).padStart(3, "0");
  return `${year}/${gradeCode}/${seq}`;
}

/** Grade level display name mapping */
export const GRADE_DISPLAY_NAMES: Record<string, string> = {
  NURSERY: "Nursery",
  LKG: "LKG",
  UKG: "UKG",
  CLASS_1: "Class 1",
  CLASS_2: "Class 2",
  CLASS_3: "Class 3",
  CLASS_4: "Class 4",
  CLASS_5: "Class 5",
  CLASS_6: "Class 6",
  CLASS_7: "Class 7",
  CLASS_8: "Class 8",
  CLASS_9: "Class 9",
  CLASS_10: "Class 10",
};

/** Grade level short codes for admission numbers */
export const GRADE_CODES: Record<string, string> = {
  NURSERY: "NUR",
  LKG: "LKG",
  UKG: "UKG",
  CLASS_1: "C01",
  CLASS_2: "C02",
  CLASS_3: "C03",
  CLASS_4: "C04",
  CLASS_5: "C05",
  CLASS_6: "C06",
  CLASS_7: "C07",
  CLASS_8: "C08",
  CLASS_9: "C09",
  CLASS_10: "C10",
};

/** Determine if a student is a minor (under 18) */
export function isMinor(dateOfBirth: Date): boolean {
  const now = new Date();
  const age = now.getFullYear() - dateOfBirth.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() &&
      now.getDate() >= dateOfBirth.getDate());
  return (hasBirthdayPassed ? age : age - 1) < 18;
}

/** Truncate text to max length */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/** Professional Tax slabs by Indian state */
export const PROFESSIONAL_TAX_SLABS: Record<
  string,
  Array<{ minSalary: number; maxSalary: number | null; monthlyTax: number }>
> = {
  MH: [
    // Maharashtra
    { minSalary: 0, maxSalary: 7499, monthlyTax: 0 },
    { minSalary: 7500, maxSalary: 9999, monthlyTax: 175 },
    { minSalary: 10000, maxSalary: null, monthlyTax: 200 }, // 300 in Feb
  ],
  KA: [
    // Karnataka
    { minSalary: 0, maxSalary: 14999, monthlyTax: 0 },
    { minSalary: 15000, maxSalary: 29999, monthlyTax: 150 },
    { minSalary: 30000, maxSalary: 44999, monthlyTax: 200 },
    { minSalary: 45000, maxSalary: null, monthlyTax: 200 },
  ],
  DL: [{ minSalary: 0, maxSalary: null, monthlyTax: 0 }], // Delhi — no PT
  TN: [
    // Tamil Nadu
    { minSalary: 0, maxSalary: 21000, monthlyTax: 0 },
    { minSalary: 21001, maxSalary: null, monthlyTax: 208 },
  ],
};

/**
 * Calculate Professional Tax for a given state and gross salary.
 */
export function calculateProfessionalTax(
  state: string,
  grossSalary: number,
  isFebruary: boolean = false,
): number {
  const slabs = PROFESSIONAL_TAX_SLABS[state] ?? PROFESSIONAL_TAX_SLABS["DL"];
  if (!slabs) return 0;

  const slab = slabs.find(
    (s) =>
      grossSalary >= s.minSalary &&
      (s.maxSalary === null || grossSalary <= s.maxSalary),
  );

  if (!slab) return 0;

  // Maharashtra special: 300 in February
  if (state === "MH" && grossSalary >= 10000 && isFebruary) return 300;

  return slab.monthlyTax;
}
