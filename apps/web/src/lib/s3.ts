import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.S3_REGION || "ap-south-1",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
  },
  forcePathStyle: true, // Required for MinIO
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateUpload(mimeType: string, sizeBytes?: number) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }
  
  if (sizeBytes !== undefined && sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds 10MB limit.`);
  }

  // TODO: integrate ClamAV or similar for virus scanning
  return true;
}

export async function generateUploadUrl(key: string, bucket: string, contentType: string) {
  validateUpload(contentType);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  // 15-minute expiry for upload
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return uploadUrl;
}

export async function getSignedDownloadUrl(key: string, bucket: string, expiresIn = 900) {
  if (!key) return null;
  
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export { s3Client };
