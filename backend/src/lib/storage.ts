import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
 * Generate a pre-signed URL for direct browser uploads to S3
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
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
