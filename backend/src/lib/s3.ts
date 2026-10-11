// Re-export canonical storage implementation for 100% backwards compatibility
export {
  s3Client,
  BUCKET_NAME,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateUpload,
  validateSchoolScopedKey,
  getPresignedUploadUrl,
  generateUploadUrl,
  uploadBufferToS3,
  getPresignedDownloadUrl,
  getSignedDownloadUrl,
} from "./storage";
