# Security Policy

## Supported Versions

The following versions of SchoolMitra ERP are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within SchoolMitra ERP, please send an e-mail to security@schoolmitra.edu.in. All security vulnerabilities will be promptly addressed.

## Security Practices

We take security seriously and have implemented the following practices:
- **DPDP Act 2023 Compliance**: All minor/student data processing is gated by explicit parental consent tracking.
- **PII Encryption**: Sensitive fields (like parent contact info, names) are stored using AES-256 encryption at rest.
- **Data Subject Rights**: Automated JSON data exports and explicit right-to-be-forgotten purges.
- **Audit Logging**: Every PII read/write/delete operation is immutably logged with user, IP, and timestamp.
- **Rate Limiting**: API routes are rate-limited via Redis sliding-window.
- **Account Lockout**: 5 failed login attempts result in a 15-minute account lockout.
- **Secure File Uploads**: Uploads are restricted by MIME type and size, stored in private S3 buckets, and accessed only via short-lived (15 min) signed URLs.
- **Zero Trust API**: Every tRPC route enforces RBAC (Role-Based Access Control) using Zod input validation.
