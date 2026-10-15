# Sprint S12.1 Layer 6: Branch Protection Governance Documentation

- **Specification**: `edu-core-s12-supplemental-security-and-release-closure` (v12.1.0)
- **Governance Requirement**: `REL-BRANCH-008` (P2: Branch protection rules cannot be configured programmatically via git CLI and require administrative configuration in GitHub Settings)
- **Target Repository**: `cascadetechnologiesbackend-ship-it/Edu_core`
- **Protected Branch**: `main`
- **Required Check Run**: `Build, Lint, Test & Security Validation`
- **Date**: 2026-10-15
- **Current Status**: `UNVERIFIED / ADMIN_ACTION_REQUIRED`

---

## 1. Context & Administrative Rationale

Branch protection rules enforce repository integrity by preventing direct pushes to production branches and guaranteeing that all changes pass automated testing and code review before merging.

Because GitHub branch protection rules cannot be established through local git commits or CLI commands alone without GitHub Personal Access Tokens possessing `admin:org` / `repo` permissions, this document establishes the formal compliance standard, documents the required ruleset, and provides an actionable guide for the repository administrator.

Until an administrator completes the GitHub UI procedure below, the branch protection governance status remains **`UNVERIFIED / ADMIN_ACTION_REQUIRED`**.

---

## 2. Required Branch Protection Specification

The repository owner / administrator must configure the following rules for branch `main`:

| Policy Area | Required Setting | Enforcement Mechanism | Rationale |
|---|---|---|---|
| **Pull Request Enforcement** | Require a pull request before merging | GitHub Branch Protection Rule | Disables direct `git push origin main` |
| **Approvals** | Require at least 1 approval | GitHub Pull Request Review | Guarantees peer review before integration |
| **Stale Review Dismissal** | Dismiss stale pull request approvals when new commits are pushed | GitHub Pull Request Review | Prevents post-approval injection of unvetted commits |
| **Required Status Checks** | Require status checks to pass before merging | GitHub Checks API | Enforces 100% CI pass rate |
| **Specific Check Run** | `Build, Lint, Test & Security Validation` | `.github/workflows/ci.yml` | Validates type-check, lint, migrations, backend tests, frontend tests, and security audit |
| **Branch Up-to-Date** | Require branches to be up to date before merging | GitHub Branch Protection Rule | Prevents race condition regressions against `main` |
| **Conversation Resolution** | Require conversation resolution before merging | GitHub Pull Request Review | Ensures all review feedback is resolved |
| **Linear History** | Require linear history (Squash or Rebase merge) | GitHub Repository Settings | Maintains clean, bisectable git history |
| **Administrator Exemption** | Do NOT allow bypassing the above settings | "Do not allow bypassing the above settings" checkbox | Enforces Rule Zero even for repo owners |

---

## 3. Step-by-Step Configuration Guide for Repository Administrator

To verify and activate branch protection on `cascadetechnologiesbackend-ship-it/Edu_core`:

1. Navigate to the GitHub repository in a web browser:
   `https://github.com/cascadetechnologiesbackend-ship-it/Edu_core/settings/branches`
2. Under **Branch protection rules**, click **Add branch ruleset** (or **Add rule**).
3. In **Branch name pattern**, enter:
   `main`
4. Enable the following checkboxes:
   - [x] **Require a pull request before merging**
     - [x] Require approvals: `1`
     - [x] Dismiss stale pull request approvals when new commits are pushed
     - [x] Require conversation resolution before merging
   - [x] **Require status checks to pass before merging**
     - [x] Require branches to be up to date before merging
     - Search for and select the following status check:
       - `Build, Lint, Test & Security Validation`
   - [x] **Require linear history**
   - [x] **Do not allow bypassing the above settings** (Enforce for administrators)
5. Click **Create** (or **Save changes**).

---

## 4. Verification Check

To empirically verify that branch protection is active, an administrator can execute:
```bash
# Attempt direct push of an empty commit to main (should be rejected)
git commit --allow-empty -m "test: verify branch protection"
git push origin main
# Expected output:
# remote: error: GH006: Protected branch update failed for refs/heads/main.
# remote: error: Changes must be made through a pull request.
```

Upon successful verification, update the status badge in this document to **`VERIFIED`**.
