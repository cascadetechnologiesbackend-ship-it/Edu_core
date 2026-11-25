# Document Generation Standard

## Overview
All generated documents (Fee Receipts, Due Slips, Report Cards, Transfer Certificates, and Bulk Exports) in SchoolMitra ERP must adhere to deterministic formatting, tenant isolation, and auditability standards.

## Supported Formats
- **CSV (`text/csv`)**: UTF-8 with BOM for Excel compatibility; RFC 4180 escaping.
- **XLSX (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)**: Styled headers, frozen top row, explicit column types.
- **JSON (`application/json`)**: Schema-versioned payloads for programmatic integrations.
- **PDF**: Generated server-side with school branding, watermark support, and verification QR codes.

## Storage & Delivery
- Generated artifacts are persisted to S3 under `schools/{schoolId}/exports/` or `schools/{schoolId}/documents/`.
- Client delivery uses presigned URLs with a maximum TTL of 1 hour.
