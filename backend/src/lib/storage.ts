import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "schoolmitra-uploads";

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
  // Must strictly be prefixed with `${schoolId}/`
  const prefix = `${schoolId}/`;
  return key.startsWith(prefix);
}

/**
 * Generate a pre-signed URL for direct browser uploads to S3 (TTL: 300s / 5 minutes)
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300
) {
  // Reject traversal sequences before issuing presigned url
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid storage key: path traversal sequences are disallowed.");
  }

  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "") {
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

  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "") {
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
    console.error("[Storage] Failed to upload buffer to S3:", err);
    return { success: false, s3Key: key, error: err.message };
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

  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "") {
    return `/api/receipt/download?key=${encodeURIComponent(key)}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

