# Runbook: S3 Key Tenant Isolation Migration

## Overview
Prior to GAP-006, file uploads were stored under generic prefixes such as `uploads/<timestamp>-<file>`.
To guarantee tenant isolation and comply with Section 8(4) of the DPDP Act 2023, all object storage keys must be prefixed with the tenant's `schoolId`:
```
${schoolId}/${prefix}/${timestamp}-${sanitizedFilename}
```
Example:
```
6f31f9b1-e20b-4680-9a3b-2da68be794c4/documents/1728212345000-id_proof.pdf
```

---

## Pre-Migration Audit

1. **List all objects with legacy keys** (keys not starting with UUID / `platform`):
```bash
aws s3api list-objects-v2 \
  --bucket "$AWS_S3_BUCKET_NAME" \
  --query 'Contents[?!starts_with(Key, `platform/`) && !contains(Key, `/`)].Key'
```

2. **Cross-reference legacy keys with Database tables**:
   - `students.profile_photo_url`
   - `staff.resume_url`
   - `circulars.attachment_url`
   - `fee_receipts.receipt_url`

---

## Migration Steps

### Phase 1: Dual-Read Compatibility (Current State)
The application reads existing presigned URLs and writes new uploads strictly using the `${schoolId}/` prefix. No existing uploaded URLs are broken.

### Phase 2: Copy Legacy S3 Objects to Scoped Keys
For each legacy object referenced in tenant database records:
```bash
# S3 Copy command
aws s3 cp \
  "s3://${AWS_S3_BUCKET_NAME}/${OLD_KEY}" \
  "s3://${AWS_S3_BUCKET_NAME}/${SCHOOL_ID}/${OLD_KEY}"
```

### Phase 3: Database URL Update Script
Run a database migration or batch job to update stored S3 paths:
```sql
UPDATE students
SET profile_photo_url = REPLACE(profile_photo_url, 'uploads/', school_id || '/uploads/')
WHERE profile_photo_url LIKE '%uploads/%'
  AND profile_photo_url NOT LIKE '%' || school_id || '%';
```

### Phase 4: S3 Bucket Policy Enforcement
Once all legacy objects are migrated, attach an IAM / Bucket policy denying `s3:GetObject` and `s3:PutObject` if the key does not start with a valid tenant prefix:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnforceTenantScoping",
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::schoolmitra-uploads/*",
      "Condition": {
        "StringNotLike": {
          "s3:prefix": ["*/*"]
        }
      }
    }
  ]
}
```

---

## Rollback Procedure
If legacy clients or mobile apps fail to retrieve migrated objects:
1. Revert database updates using the migration backup table.
2. Legacy objects are retained in S3 during Phase 2 (not deleted until 30 days after Phase 3 verification).
