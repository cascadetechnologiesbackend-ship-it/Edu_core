/**
 * Verhoeff Algorithm for Dihedral Group D5 Checksum Verification.
 *
 * Mandatory mathematical checksum used by UIDAI for 12-digit Indian Aadhaar numbers.
 * Effectively detects all single-digit transcription errors and adjacent transposition errors.
 */

// Dihedral group D5 multiplication table
const D_TABLE: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Permutation table P
const P_TABLE: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// Inverse table INV in D5
const INV_TABLE: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Validates whether a numerical string has a valid Verhoeff checksum.
 */
export function validateVerhoeff(numStr: string): boolean {
  const sanitized = numStr.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(sanitized)) return false;

  let c = 0;
  const digits = sanitized.split("").map(Number).reverse();

  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i] ?? 0;
    const pRow = P_TABLE[i % 8] ?? [];
    const pVal = pRow[digit] ?? 0;
    const dRow = D_TABLE[c] ?? [];
    c = dRow[pVal] ?? 0;
  }

  return c === 0;
}

/**
 * Generates the Verhoeff checksum digit for a numerical string.
 */
export function generateVerhoeff(numStr: string): number {
  const sanitized = numStr.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(sanitized)) {
    throw new Error(`Invalid numeric input for Verhoeff generation: ${numStr}`);
  }

  let c = 0;
  const digits = sanitized.split("").map(Number).reverse();

  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i] ?? 0;
    const pRow = P_TABLE[(i + 1) % 8] ?? [];
    const pVal = pRow[digit] ?? 0;
    const dRow = D_TABLE[c] ?? [];
    c = dRow[pVal] ?? 0;
  }

  return INV_TABLE[c] ?? 0;
}

/**
 * Validates an Indian Aadhaar number (12 digits, cannot start with 0 or 1, must pass Verhoeff).
 */
export function validateAadhaar(aadhaarStr: string): boolean {
  const sanitized = aadhaarStr.replace(/[\s-]/g, "");
  if (!/^[2-9]\d{11}$/.test(sanitized)) return false;
  return validateVerhoeff(sanitized);
}
