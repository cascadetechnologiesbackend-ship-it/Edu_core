import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "./logger";

// ─── Production Environment Fail-Fast Verification ────────────────────────────
const rawEndpoint = process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT || "";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || "";
const region = process.env.AWS_REGION || process.env.S3_REGION || "ap-south-1";

if (process.env.NODE_ENV === "production") {
  if (rawEndpoint.includes("localhost") || rawEndpoint.includes("127.0.0.1") || rawEndpoint.includes(":9000")) {
    throw new Error("FATAL: Production storage configured with insecure localhost/MinIO endpoint: " + rawEndpoint);
  }
  if (accessKeyId === "minioadmin" || secretAccessKey === "minioadmin") {
    throw new Error("FATAL: Production storage configured with insecure default minioadmin credentials.");
  }
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
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (10485760 bytes)

/**
 * Validates upload MIME type and optional size payload against strict whitelist.
 */
export function validateUpload(mimeType: string, sizeBytes?: number): boolean {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }

  if (sizeBytes !== undefined && sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error("File size exceeds 10MB limit.");
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

  if (!accessKeyId || accessKeyId === "") {
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
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid storage key: path traversal sequences are disallowed.");
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("File size exceeds 10MB limit.");
  }

  if (!accessKeyId || accessKeyId === "") {
    // Local / unconfigured fallback: simulate successful archival
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

  if (!accessKeyId || accessKeyId === "") {
    return `/api/receipt/download?key=${encodeURIComponent(key)}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Backwards-compatible download URL generator with optional schoolId scope verification
 */
export async function getSignedDownloadUrl(
  key: string,
  bucket?: string,
  expiresIn = 900,
  userSchoolId?: string
): Promise<string | null> {
  if (!key) return null;

  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid storage key: path traversal sequences are disallowed.");
  }

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

  if (!accessKeyId || accessKeyId === "") {
    return `/api/receipt/download?key=${encodeURIComponent(key)}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucket || BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}
