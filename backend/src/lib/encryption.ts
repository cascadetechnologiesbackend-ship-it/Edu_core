import crypto from "crypto";

function resolveKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL: ENCRYPTION_KEY environment variable is missing in production. Refusing to boot with default key.",
      );
    }
    console.warn("⚠️ Warning: ENCRYPTION_KEY is not set in environment. Falling back to default key.");
    return "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  }
  return key;
}

export const ENCRYPTION_KEY = resolveKey();
export const ENCRYPTION_KEY_ID = process.env.ENCRYPTION_KEY_ID || "k1";

// Distinct HKDF-derived key for search hashes to ensure cryptographic key separation
const SEARCH_HASH_INFO = "schoolmitra-search-hash-v1";
const DERIVED_SEARCH_KEY = crypto.hkdfSync(
  "sha256",
  Buffer.from(ENCRYPTION_KEY, "hex"),
  Buffer.alloc(0),
  Buffer.from(SEARCH_HASH_INFO, "utf-8"),
  32
);

/**
 * Keyring map for rotation support. Additional historical keys can be provided
 * via JSON in ENCRYPTION_KEYRING or dynamically registered.
 */
const KEY_MAP: Record<string, Buffer> = {
  [ENCRYPTION_KEY_ID]: Buffer.from(ENCRYPTION_KEY, "hex"),
};

/**
 * Decrypts ciphertext.
 * Supports:
 * 1. Authenticated AES-256-GCM (v2:keyId:iv:tag:ciphertext or v2:iv:tag:ciphertext)
 * 2. Legacy unauthenticated AES-256-CBC (iv:ciphertext)
 */
export function decryptData(encryptedText: string | null): string | null {
  if (!encryptedText) return null;
  try {
    // ── Version 2: AES-256-GCM authenticated encryption ──
    if (encryptedText.startsWith("v2:")) {
      const parts = encryptedText.split(":");
      let keyId = ENCRYPTION_KEY_ID;
      let ivHex: string;
      let tagHex: string;
      let cipherHex: string;

      if (parts.length === 5 && parts[1] && parts[2] && parts[3] && parts[4]) {
        // v2:keyId:iv:tag:ciphertext
        keyId = parts[1];
        ivHex = parts[2];
        tagHex = parts[3];
        cipherHex = parts[4];
      } else if (parts.length === 4 && parts[1] && parts[2] && parts[3]) {
        // v2:iv:tag:ciphertext
        ivHex = parts[1];
        tagHex = parts[2];
        cipherHex = parts[3];
      } else {
        return null;
      }

      if (!ivHex || !tagHex || !cipherHex) return null;

      const key = KEY_MAP[keyId] || Buffer.from(ENCRYPTION_KEY, "hex");
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(tagHex, "hex");
      const encrypted = Buffer.from(cipherHex, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString("utf8");
    }

    // ── Version 1 (Legacy): AES-256-CBC ──
    const parts = encryptedText.split(":");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv,
    );
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  } catch (e) {
    // Tamper detection or corrupt ciphertext
    return null;
  }
}

/**
 * Encrypts plaintext using AES-256-GCM with authentication tag and key rotation identifier.
 * Format: v2:keyId:iv:tag:ciphertext
 */
export function encryptData(text: string): string {
  const iv = crypto.randomBytes(12); // NIST recommended 96-bit IV for GCM
  const key = KEY_MAP[ENCRYPTION_KEY_ID] || Buffer.from(ENCRYPTION_KEY, "hex");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v2:${ENCRYPTION_KEY_ID}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Computes deterministic search hash using HKDF-derived key (cryptographic key separation).
 */
export function computeSearchHash(text: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(DERIVED_SEARCH_KEY))
    .update(text.trim().toLowerCase())
    .digest("hex");
}

/**
 * Computes legacy search hash for backwards compatibility during migration.
 */
export function computeLegacySearchHash(text: string): string {
  return crypto
    .createHmac("sha256", ENCRYPTION_KEY)
    .update(text.trim().toLowerCase())
    .digest("hex");
}
