# Layer 11 Evidence: School-Scoped Public Result Portal & Verified Lookup Handler

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T01:11:45+05:30  
**Head Commit Prior to Layer**: `93f3c77`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 11 delivers the school-scoped public result portal, candidate lookup route handler, anti-abuse rate limiting, and public topper honors board adhering to Amendments 4 and 6:

1. **Plain Next.js Route Handler (`POST /s/[slug]/results/lookup`) [Amendment 4]**:
   - Implemented as a plain Route Handler (not a Server Action) avoiding reverse proxy origin mismatches.
   - Keyed on client IP (`x-forwarded-for` first hop) with strict rate-limiting (max 10 lookups per minute per IP, returning HTTP 429).
   - Audit logging: Records all lookup attempts (timestamp, IP address, setupId, and success flag) in `public_result_lookups`.
   - Setup Resolution [Amendment 6]: Defaults cleanly to the school's most recently published report card setup if `setupId` is omitted.
   - Dual-factor Verification: Requires valid candidate identifier (Admission Number or Roll Number) matching institutional records PLUS Date of Birth verification against encrypted student profile.
   - Multi-layer Gate Enforcement:
     - Rejects with 403 if `publicLookupEnabled` is false.
     - Rejects with 403 if `withholdAll` is true.
     - Rejects with 403 if `releaseAt` is in the future.
     - Rejects with 403 if candidate has an active administrative hold (`result_holds`).
     - Rejects with 403 if `feeLockMode === 'HARD'` and unpaid tuition dues exceed the configured threshold.
   - Returns immutable snapshot marksheet payload and cryptographic verification timestamp.

2. **Public Result Portal Interface (`/s/[slug]/results`)**:
   - Institutional branding with school name, UDISE code, and official verification badge.
   - Multi-setup selector (if multiple examination terms are published).
   - Dynamic lookup form supporting both Admission Number and Roll Number with date picker.
   - Academic Merit Honors Board: Displays Top 3 achievers with rank badges and percentages if `publicToppersEnabled` is active.
   - Official Digital Statement of Marks:
     - Candidate details (Name, Admission No, Roll No, Class / Standard).
     - Full scholastic performance grid (Subject, Obtained, Max, Percentage, Grade, Status).
     - Grand total marks, overall CBSE grade, division, and result status (`PASSED`/`FAILED`).
     - "Print Marksheet" (`window.print()`) and "Official PDF" download (`/api/report-cards/${id}/download`).
     - Anti-fraud digital verification footnote with snapshot ref.

---

## 2. Verification Evidence

- `pnpm type-check` across all workspace packages completed with 0 errors.
- Rate-limiting verified on `public_result_lookups` using `x-forwarded-for` first hop.
- Fallback to most recently published setup verified when `setupId` is omitted.
