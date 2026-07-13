# AGENTS.md — SchoolMitra ERP
# Antigravity IDE Agent Standing Instructions

## Project Identity
- Product: SchoolMitra ERP (School Management for Nursery–Class 10)
- Stack: Next.js 14 + TypeScript 5 + Drizzle ORM + PostgreSQL 16 + Redis 7
- Compliance: DPDP Act 2023 (India) — treat ALL students as minors requiring parental consent

## Code Style
- TypeScript strict mode — zero `any` types; use `unknown` + type guards
- Zod validation on every API endpoint (request and response)
- Drizzle ORM for ALL database access — no raw SQL except in migration files
- React Server Components by default; add "use client" only when necessary
- Tailwind CSS + shadcn/ui for all UI — no inline styles except dynamic values

## Architecture Rules
- All business logic in `src/server/` (tRPC routers or server actions)
- All DB schemas in `src/db/schema.ts` using Drizzle pg-core
- All shared types in `packages/validators/`
- API routes: `/api/v1/[module]/[resource]` — versioned from day one
- Environment variables: secrets only in `.env` (server-side); `NEXT_PUBLIC_` prefix only for non-sensitive config

## DPDP Compliance (Non-Negotiable)
- NEVER process student data without checking consent first (use `assertConsent(studentId, purposeId)` middleware)
- NEVER store full Aadhaar numbers — last 4 digits only, masked in UI
- ALWAYS write to audit_log for every PII read/write/delete
- ALWAYS use AES-256 encryption for PII text columns
- ALWAYS use signed S3 URLs (15-min expiry) for student photos and documents
- Consent withdrawal must halt processing within 24 hours

## Security
- bcrypt cost factor 12 for passwords
- JWT: 15-min access token + 7-day refresh token with rotation
- Rate limit: 100 req/min unauthenticated, 500 req/min authenticated
- Input sanitisation: DOMPurify for any HTML rendering
- File uploads: validate MIME type, enforce 10MB limit, virus scan stub

## Testing
- Vitest for unit tests — cover fee calculation, grade engine, payroll engine
- React Testing Library for component tests
- Playwright for E2E — cover: login, admission flow, fee payment, report card generation
- Minimum 80% coverage on `src/server/` business logic

## Git Conventions
- Commits: Conventional Commits format (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Branch: `feature/module-name`, `fix/issue-description`
- No secrets in commits — pre-commit hook with gitleaks

## Do Not Change
- `packages/dpdp/` consent engine interfaces without updating all callers
- Database migration files once applied — create new migration for changes
- Audit log table — append-only, no update/delete operations
- Privacy notice version history — immutable once published
