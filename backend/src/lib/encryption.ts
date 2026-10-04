import crypto from "crypto";

const DEFAULT_DEV_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function resolveKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: ENCRYPTION_KEY must be configured in production environments.");
  }
  return key || DEFAULT_DEV_KEY;
}

export const ENCRYPTION_KEY = resolveKey();

export function decryptData(encryptedText: string | null) {
  if (!encryptedText) return null;
  try {
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
    return decrypted.toString();
  } catch (e) {
    return null;
  }
}

export function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function computeSearchHash(text: string) {
  return crypto
    .createHmac("sha256", ENCRYPTION_KEY)
    .update(text.trim().toLowerCase())
    .digest("hex");
}
