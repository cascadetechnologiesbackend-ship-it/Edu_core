# 21 — CI/CD Analysis
## SchoolMitra ERP

---

## Current State

```
Status: MISSING / CRITICALLY INCOMPLETE
```

No CI/CD pipeline configuration was found in the repository.

- No `.github/workflows/` directory
- No `.gitlab-ci.yml`
- No `Jenkinsfile`
- No other CI configuration files

---

## What Exists

### render.yaml (deployment only)

```yaml
services:
  - type: web
    name: educore-app
    runtime: node
    plan: starter
    buildCommand: pnpm install --ignore-scripts && pnpm --filter @schoolmitra/database db:migrate && pnpm -w run build
    preDeployCommand: pnpm --filter @schoolmitra/database db:migrate
    startCommand: pnpm -w run start
```

**What this does:**
- Install dependencies
- Run database migrations
- Build the application
- Start the server

**What this does NOT do:**
- Type checking
- Linting
- Unit tests
- E2E tests
- Security scanning
- Dockerfile verification
- Smoke test after deploy

### Husky + Commitlint (git hooks only)

```
.husky/ — pre-commit hooks present
commitlint.config.js — conventional commits enforced
```

This enforces commit message format locally. It does NOT prevent broken code from being deployed.

---

## Risk Assessment

| Risk | Severity | Scenario |
|------|----------|---------|
| Broken code deploys to production | P1 | TypeScript errors, runtime exceptions |
| Security regression deploys | P0 | TEST_AUTH_USER guard removed accidentally |
| Failed migration deploys with application | P1 | Schema and code diverge |
| Dependency vulnerability introduced | P2 | No npm audit gate |
| Dockerfile remains broken | P1 | No Docker build verification |
| E2E tests never run in CI | P1 | Regressions only caught manually |

---

## Recommended Pipeline

### Phase 1 — Pull Request Validation

```yaml
# .github/workflows/ci.yml
on: [pull_request]

jobs:
  validate:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm type-check
      - pnpm lint
      - pnpm test                    # Vitest unit tests
      - pnpm audit --audit-level=high  # Security scan
      - docker build frontend/       # Dockerfile verification
```

### Phase 2 — Staging Deployment + E2E

```yaml
# .github/workflows/staging.yml
on: [push to main]

jobs:
  deploy-staging:
    steps:
      - Deploy to Render.com staging service
      - Wait for health check
      - pnpm test:e2e                # Playwright against staging
      - Notify on failure
```

### Phase 3 — Production Deployment

```yaml
# .github/workflows/production.yml
on: [manual trigger or tag]

jobs:
  deploy-production:
    steps:
      - Verify staging E2E passed
      - Deploy to Render.com production
      - Smoke test /api/health
      - Notify on success/failure
```

---

## Migration Safety

The current `preDeployCommand: pnpm --filter @schoolmitra/database db:migrate` is a reasonable approach BUT:

1. If migration fails, does Render.com still start the application? This must be verified.
2. No rollback strategy if migration corrupts data.
3. Duplicate migration numbers (P0) will cause this to fail or produce wrong schema.

**Recommendation:** Add a migration dry-run step in CI that verifies migration files before deployment.
