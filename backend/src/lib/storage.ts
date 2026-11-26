import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { logger } from "./logger";

// ─── Production Environment Fail-Fast Verification ────────────────────────────
const isAwsCloud = Boolean(
  process.env.AWS_S3_BUCKET_NAME ||
  (process.env.AWS_REGION && !process.env.AWS_S3_ENDPOINT)
);

export function assertProductionStorageSafe(): void {
  if (process.env.NODE_ENV === "production") {
    // If running in AWS environment with bucket or region configured, native AWS S3 is used
    if (isAwsCloud) {
      return;
    }

    const ep = process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT || "";
    const key = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || "";
    const secret = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || "";

    if (ep.includes("localhost") || ep.includes("127.0.0.1") || ep.includes(":9000")) {
      throw new Error("FATAL: Production storage configured with insecure localhost/MinIO endpoint: " + ep);
    }
    if (key === "minioadmin" || secret === "minioadmin") {
      throw new Error("FATAL: Production storage configured with insecure default minioadmin credentials.");
    }
  }
}

const rawEndpoint = isAwsCloud
  ? (process.env.AWS_S3_ENDPOINT || "")
  : (process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT || "");

const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || "";
const region = process.env.AWS_REGION || process.env.S3_REGION || "ap-south-1";

function hasS3Credentials(): boolean {
  const key = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || "";
  const secret = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || "";
  return Boolean(key && secret);
}

function getLocalStorageDir(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(os.tmpdir(), "schoolmitra-storage"));
}

function assertSafeStorageKey(key: string): void {
  if (!key || key.includes("..") || key.includes("\\") || key.startsWith("/") || key.includes("\0")) {
    throw new Error("Invalid storage key: path traversal sequences are disallowed.");
  }
}

function resolveLocalStoragePath(key: string): string {
  assertSafeStorageKey(key);
  const baseDir = getLocalStorageDir();
  const resolved = path.resolve(baseDir, key);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new Error("Invalid storage key: resolved path escapes storage root.");
  }
  return resolved;
}

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

if (process.env.NODE_ENV === "production" && !isBuildPhase) {
  assertProductionStorageSafe();
}

export const s3Client = new S3Client({
  region,
  ...(rawEndpoint ? { endpoint: rawEndpoint, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || "schoolmitra-uploads";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (10485760 bytes)
export const MAX_ARCHIVE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB for bulk export ZIP archives

/**
 * Validates upload MIME type and optional size payload against strict whitelist.
 */
export function validateUpload(mimeType: string, sizeBytes?: number): boolean {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }

  const limit =
    mimeType === "application/zip" || mimeType === "application/x-zip-compressed"
      ? MAX_ARCHIVE_SIZE_BYTES
      : MAX_FILE_SIZE_BYTES;

  if (sizeBytes !== undefined && sizeBytes > limit) {
    throw new Error(`File size exceeds allowed limit (${limit / (1024 * 1024)}MB).`);
  }

  return true;
}

/**
 * Validates that an S3 storage key starts with the tenant schoolId
 * and contains no path traversal sequences (../, \).
 */
export function validateSchoolScopedKey(key: string, schoolId: string): boolean {
  if (!key || !schoolId) return false;
  // Disallow any path traversal characters
  if (key.includes("..") || key.includes("\\")) return false;
  // Disallow leading slashes
  if (key.startsWith("/")) return false;
  // Must strictly be prefixed with `${schoolId}/` or `schools/${schoolId}/`
  return key.startsWith(`${schoolId}/`) || key.startsWith(`schools/${schoolId}/`);
}

/**
 * Generate a pre-signed URL for direct browser uploads to S3 (TTL: 300s / 5 minutes)
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  // Reject traversal sequences before issuing presigned url
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid storage key: path traversal sequences are disallowed.");
  }

  validateUpload(contentType);

  if (!hasS3Credentials()) {
    // Local dev mode fallback: Direct upload endpoint
    return `/api/upload?key=${encodeURIComponent(key)}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Downloads an S3 object (or local dev storage object when S3 is unconfigured in non-prod)
 * and returns its content as a Buffer.
 * Enforces path traversal and optional tenant-prefix safety checks.
 */
export async function downloadBufferFromS3(key: string, schoolId?: string): Promise<Buffer> {
  assertSafeStorageKey(key);
  if (schoolId && !validateSchoolScopedKey(key, schoolId)) {
    throw new Error("Access Denied: Cannot access storage key outside tenant scope.");
  }

  if (!hasS3Credentials()) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE_FALLBACK !== "true") {
      throw new Error("Storage service is not configured in production.");
    }
    const localPath = resolveLocalStoragePath(key);
    return await fs.readFile(localPath);
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error(`S3 object "${key}" returned empty body.`);
  }

  // Compatible with AWS SDK v3 streaming body
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Backwards-compatible alias for generateUploadUrl
 */
export async function generateUploadUrl(
  key: string,
  bucket?: string,
  contentType = "application/pdf"
): Promise<string> {
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid storage key: path traversal sequences are disallowed.");
  }

  validateUpload(contentType);

  const command = new PutObjectCommand({
    Bucket: bucket || BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 900 });
}

/**
 * Upload an in-memory buffer (such as generated PDF receipt) directly to S3
 */
export async function uploadBufferToS3(
  key: string,
  buffer: Buffer,
  contentType = "application/pdf"
): Promise<{ success: boolean; s3Key: string; error?: string }> {
  assertSafeStorageKey(key);

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("File size exceeds 10MB limit.");
  }

  if (!hasS3Credentials()) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE_FALLBACK !== "true") {
      return { success: false, s3Key: key, error: "Storage service is not configured in production" };
    }
    const localPath = resolveLocalStoragePath(key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);
    return { success: true, s3Key: key };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await s3Client.send(command);
    return { success: true, s3Key: key };
  } catch (err: any) {
    logger.error({ err, key }, "[Storage] Failed to upload buffer to S3");
    // Generic sanitized error message to prevent AWS metadata leakage
    return { success: false, s3Key: key, error: "Failed to upload file to storage" };
  }
}

/**
 * Generate pre-signed URL for downloading or viewing archived S3 objects (TTL: 900s / 15 minutes)
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 900
): Promise<string> {
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid storage key: path traversal sequences are disallowed.");
  }

  if (!hasS3Credentials()) {
    return `/api/receipt/download?key=${encodeURIComponent(key)}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}
export async function getSignedDownloadUrl(
  key: string,
  bucket?: string,
  expiresIn = 900,
  userSchoolId?: string
): Promise<string | null> {
  if (!key) return null;

  assertSafeStorageKey(key);

  if (userSchoolId) {
    if (key.startsWith("schools/")) {
      const parts = key.split("/");
      const keySchoolId = parts[1];
      if (keySchoolId && keySchoolId !== userSchoolId) {
        throw new Error(`Access Denied: Cannot access documents from school ${keySchoolId}`);
      }
    } else if (!validateSchoolScopedKey(key, userSchoolId)) {
      throw new Error(`Access Denied: Cannot access documents from school outside tenant scope`);
    }
  }

  if (!hasS3Credentials()) {
    return `/api/receipt/download?key=${encodeURIComponent(key)}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucket || BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}
