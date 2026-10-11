# Stage S2-G Evidence: Engineering Hygiene, Dependencies & Ratchet Baselines

**Sprint**: S2 Security & Release Integrity Hardening Sprint (`edu-core-security-release-integrity-hardening-s2`)  
**Stage**: S2-G (Engineering Hygiene & Dependencies)  
**Date**: 2026-10-11  
**Status**: VERIFIED  

---

## 1. Executive Summary

Stage S2-G establishes production-grade engineering hygiene, modernizes dependency hygiene, enforces Docker build isolation, provides root-level technical documentation, and establishes empirical baseline ratchets for TypeScript types, logging, and file length:
1. **Container Context Isolation**: Created root `.dockerignore` strictly excluding git trees, developer agents, local documentation, Playwright artifacts, and caching layers from image context.
2. **Canonical Project Documentation**: Authored production-ready root `README.md` specifying monorepo architecture, environment contracts, zero-downtime migration protocols, and operational deployment flows.
3. **Dependency Modernization & v2 Purge**:
   - Completely eradicated deprecated legacy `aws-sdk` v2 (`^2.1600.0`) from `frontend/package.json` and `frontend/next.config.mjs` (superseded by modular `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` v3).
   - Relocated `@types/*`, `typescript`, `eslint`, `postcss`, `tailwindcss`, and compiler tools from runtime `dependencies` to `devDependencies` across `frontend`, `database`, and `backend`.
   - Injected `overrides` in root `package.json` ensuring patched `nodemailer` (`^6.9.14`).
   - `pnpm install` pruned 13 unneeded transitive packages cleanly.
4. **Discipline Ratchets & Baselines (`scripts/count-eslint-baselines.mjs`)**:
   - Automated script measuring changed files since sprint start (`7ffefcc`).
   - Captured explicit `any` baseline: 220 occurrences across 58 changed files.
   - Captured runtime `console.*` baseline: 51 occurrences across runtime actions/routes.
   - Captured large-file ratchet (> 1000 lines): 1 file (`frontend/src/app/(admin)/hr/actions.ts` at 1980 lines) tracked for modular splitting.
5. **Coverage & Test Watermark**:
   - Backend Suite: 25 files, 171 passing unit/integration tests.
   - Frontend Suite: 19 files, 137 passing tests.
   - Monorepo Suite: 308 passing tests (100% green, 0 failures, 0 skipped).

---

## 2. Docker Context Hardening (`.dockerignore`)

The following files and patterns are now prevented from entering production container builds:
- Metadata & Agents: `.git`, `.gitignore`, `.agents`, `.gemini`, `.kiro`, `repo-analysis`
- Docs & Evidence: `docs/`, `*.md` (except `README.md`)
- Local Dependencies & Caches: `node_modules/`, `.pnpm-store/`, `.turbo/`, `dist/`, `.next/`
- Test & Coverage Artifacts: `coverage/`, `test-results/`, `playwright-report/`, `playwright/.cache/`
- Local Environment Files: `.env*.local`, `.env.development`, `*.log`

---

## 3. Dependency Modernization Diffs

### Removed `aws-sdk` v2 & External Package Pruning

```diff
--- a/frontend/package.json
+++ b/frontend/package.json
@@ -62,3 +62,0 @@
-    "aws-sdk": "^2.1600.0",

--- a/frontend/next.config.mjs
+++ b/frontend/next.config.mjs
@@ -156,3 +156,0 @@
-      "aws-sdk",
```

### Relocated Development & Typing Tooling to `devDependencies`

| Package | Moved to `devDependencies` |
| :--- | :--- |
| `@schoolmitra/frontend` | `@types/bcryptjs`, `@types/dompurify`, `@types/leaflet`, `@types/node`, `@types/nodemailer`, `@types/pg`, `@types/qrcode`, `@types/react`, `@types/react-dom`, `autoprefixer`, `eslint`, `eslint-config-next`, `eslint-plugin-schoolmitra`, `postcss`, `tailwindcss`, `tailwindcss-animate`, `tsx`, `typescript` |
| `@schoolmitra/database` | `@types/bcryptjs`, `@types/pg`, `tsx`, `typescript` |
| `@schoolmitra/backend` | `@types/bcryptjs`, `@types/node`, `@types/nodemailer`, `@types/pg`, `@types/qrcode`, `@types/react`, `@types/react-dom`, `typescript` |

---

## 4. Engineering Discipline Ratchets (`scripts/s2-hygiene-baseline.json`)

Execution of `node scripts/count-eslint-baselines.mjs` against sprint boundary `7ffefcc` recorded:

```json
{
  "baseCommit": "7ffefcc",
  "totalFilesAudited": 58,
  "totalAnyCount": 220,
  "totalConsoleCount": 51,
  "largeFilesOver1000Lines": [
    {
      "file": "frontend/src/app/(admin)/hr/actions.ts",
      "lineCount": 1980
    }
  ]
}
```

### Ratchet Invariant
- Future sprints are restricted from increasing `totalAnyCount` above 220 in these touched files.
- Runtime `console.*` statements must be steadily migrated to Pino `logger.*`.
- The single 1980-line file (`frontend/src/app/(admin)/hr/actions.ts`) is documented in the residual-risk register for phase-based modular decomposition.

---

## 5. Verification Verdict

Stage S2-G satisfies all requirements:
- [x] Root `.dockerignore` created and verified.
- [x] Comprehensive root `README.md` authored.
- [x] Legacy `aws-sdk` v2 purged from frontend and next.config.
- [x] `@types/*`, `typescript`, `eslint`, and build tools moved to `devDependencies`.
- [x] Pinned dependency override for `nodemailer` active.
- [x] `count-eslint-baselines.mjs` ratchet committed and recorded.
- [x] 100% test suite passing (308 tests across 44 test files).
- [x] Monorepo type-check 6/6 packages clean.
