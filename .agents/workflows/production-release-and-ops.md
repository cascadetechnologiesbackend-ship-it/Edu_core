---
description: Pre-release verification, observability, performance, testing, and operations checklist (Categories A, H, I, J, K, M).
---

# Production Release & Operations Workflow

Use this workflow before merging to `main`, deploying to Render/production, or auditing system health.

## 1. Testing & Quality Assurance (Category J)
- [ ] **Automated Checks**: Run typecheck, unit tests, and integration tests for all affected workspaces.
- [ ] **E2E & Critical Flows**: Verify critical user journeys (login, demo mode, admissions, fees, attendance, exams) on staging or local production build.
- [ ] **Build Verification**: Run `pnpm -w run build` cleanly with zero errors.

## 2. Architecture, Health & Shutdown (Category A)
- [ ] **Stateless Services**: Ensure no reliance on local in-memory state for multi-instance correctness (except explicit Redis fallback).
- [ ] **Health Checks & Graceful Shutdown**: Verify `/api/health` (and worker health listener on `process.env.PORT`) returns `200 OK` and handles `SIGTERM` cleanly.

## 3. Performance, Mobile & Accessibility (Category H)
- [ ] **Mobile Responsiveness**: Verify layouts on mobile viewports (no horizontal overflow, readable typography, tap-friendly targets).
- [ ] **Accessibility**: Check keyboard navigation, focus states, semantic HTML, and screen-reader labels.
- [ ] **Resource & Cost Awareness**: Avoid N+1 queries, unbounded payloads, and memory leaks.

## 4. Observability & Maintainability (Categories I, K, M)
- [ ] **Structured Logging & Error Tracking**: Log actionable context without PII/secrets; monitor error rates and latency.
- [ ] **Branching & Versioning**: Work on feature/readiness branches, review diffs cleanly, and document architectural/operational decisions.
- [ ] **Rollback & DR**: Confirm a clear rollback path (git revert / Render rollback / DB restore) before deploying.
