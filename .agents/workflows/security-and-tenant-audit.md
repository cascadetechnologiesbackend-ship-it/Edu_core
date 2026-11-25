---
description: Security, tenant isolation, secrets, and DPDP/GDPR audit checklist (Categories D, E, F).
---

# Security & Tenant Audit Workflow

Use this workflow for security reviews, auth changes, file uploads, and pre-release audits.

## 1. Authentication & Access Control (Category D)
- [ ] **Least Privilege & RBAC**: Verify Super Admin, Admin, Principal, Teacher, Accountant, Parent, and Student roles only access their permitted resources.
- [ ] **Session & Cookie Security**: Enforce `HttpOnly`, `Secure`, `SameSite` cookie flags, token expiration, and brute-force/account-lockout protections.
- [ ] **Demo / Minor Safety**: Ensure demo logins and student claim flows cannot bypass tenant boundaries or expose PII.

## 2. Vulnerability Prevention (Category E)
- [ ] **SQL Injection**: Use parameterized queries / Drizzle ORM; never interpolate user input into raw SQL.
- [ ] **XSS & CSP**: Sanitize/escape rendered content; maintain Content Security Policy and HTTP security headers.
- [ ] **CSRF & Clickjacking**: Verify CSRF protection on state-changing routes and `X-Frame-Options` / `frame-ancestors`.
- [ ] **SSRF, Path Traversal, Command Injection**: Validate URLs, file paths, and never pass unsanitized input to shell commands.
- [ ] **File Upload Security**: Validate MIME type, file extension, and size limits; store outside executable paths.
- [ ] **Dependency Vulnerabilities**: Check for known CVEs in third-party packages.

## 3. Secrets, Encryption & Privacy (Category F)
- [ ] **Secrets Management**: Confirm zero hardcoded API keys, passwords, or tokens in code; use env vars and periodic secret rotation.
- [ ] **Hashing & Encryption**: Use salted one-way hashing for passwords and encryption in transit (HTTPS/TLS) and at rest.
- [ ] **DPDP / GDPR & Audit Logs**: Minimize PII exposure, honor data privacy rules, and record administrative/security events in audit logs.
