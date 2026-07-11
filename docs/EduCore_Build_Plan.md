# EduCore — Production Prototype Build Plan

**Version:** 1.0.0
**Date:** July 2026
**Architecture Reference:** `EduCore_Simplified_Architecture.md`
**Full Feature Reference:** `EduCore_Master_Context.md`

> **How to use this document:** This is a sequential, dependency-ordered implementation blueprint. Each task block lists the exact files, schemas, endpoints, and acceptance criteria to be built. Complete Phase 1 fully and verify it with a pilot school before beginning Phase 2.

---

## Table of Contents

1. [Overview & Phasing Strategy](#1-overview--phasing-strategy)
2. [Phase 1 — MVP (Working End-to-End per Module)](#2-phase-1--mvp-working-end-to-end-per-module)
   - P1-1: [Project Scaffolding & DevOps Foundation](#p1-1-project-scaffolding--devops-foundation)
   - P1-2: [Database — Public Schema & Tenant Provisioning](#p1-2-database--public-schema--tenant-provisioning)
   - P1-3: [Authentication & Authorization](#p1-3-authentication--authorization)
   - P1-4: [Tenant Schema Migrations (Core 6 Tables)](#p1-4-tenant-schema-migrations-core-6-tables)
   - P1-5: [SIS — Student & Parent CRUD](#p1-5-sis--student--parent-crud)
   - P1-6: [Admissions — Inquiry to Student Conversion](#p1-6-admissions--inquiry-to-student-conversion)
   - P1-7: [Attendance — Bulk Checkbox Save](#p1-7-attendance--bulk-checkbox-save)
   - P1-8: [Examinations & Results](#p1-8-examinations--results)
   - P1-9: [Fees & Finance](#p1-9-fees--finance)
   - P1-10: [Communication — Circulars & Messages](#p1-10-communication--circulars--messages)
   - P1-11: [Frontend — Core Screens (Next.js)](#p1-11-frontend--core-screens-nextjs)
   - P1-12: [Reports — CSV & PDF Exports](#p1-12-reports--csv--pdf-exports)
   - P1-13: [DPDP — Consent & Audit Log](#p1-13-dpdp--consent--audit-log)
   - P1-14: [Pilot Deployment & Smoke Test](#p1-14-pilot-deployment--smoke-test)
3. [Phase 2 — Production-Ready Hardening](#3-phase-2--production-ready-hardening)
   - P2-1: [Security Hardening](#p2-1-security-hardening)
   - P2-2: [Multi-AZ RDS + Backup Validation](#p2-2-multi-az-rds--backup-validation)
   - P2-3: [Performance & Load Testing](#p2-3-performance--load-testing)
   - P2-4: [DPDP Full Compliance Pass](#p2-4-dpdp-full-compliance-pass)
   - P2-5: [Admin Tooling & Tenant Management](#p2-5-admin-tooling--tenant-management)
   - P2-6: [Phase 2 Module Candidates (HRM, Transport, Library)](#p2-6-phase-2-module-candidates-hrm-transport-library)
   - P2-7: [Flutter Mobile App (Post-Web Validation)](#p2-7-flutter-mobile-app-post-web-validation)
   - P2-8: [Monitoring, Alerting & On-Call Runbooks](#p2-8-monitoring-alerting--on-call-runbooks)
4. [Dependency Graph](#4-dependency-graph)
5. [Directory Structure](#5-directory-structure)
6. [Environment Configuration](#6-environment-configuration)
7. [Definition of Done](#7-definition-of-done)

---

## 1. Overview & Phasing Strategy

### 1.1 The Two Phases

| Phase | Goal | Duration (estimate) | Exit Criteria |
|---|---|---|---|
| **Phase 1 — MVP** | One working end-to-end flow per Core 6 module. Deployed to a single pilot school. Real users, real data. | 8–12 weeks (3-person team) | Pilot school runs daily operations for 30 days without critical bugs |
| **Phase 2 — Production-ready** | Security hardening, compliance verification, performance under load, multi-tenant scalability, monitoring | 4–6 weeks | Passes security audit, load test, DPDP compliance checklist, ready for onboarding additional schools |

### 1.2 Team Assumptions

- **Backend Engineer (1):** NestJS, PostgreSQL, TypeORM, AWS (RDS, ECS, S3, SES).
- **Frontend Engineer (1):** Next.js, TypeScript, responsive CSS.
- **Full-Stack / DevOps (1):** CI/CD, Terraform, Dockerfile, migrations, AWS console.

### 1.3 Build Order Rationale

The order within Phase 1 follows strict dependency ordering:

```
Foundation first:   Scaffolding → Database schemas → Auth
Then domain data:   SIS (students/parents) → Admissions
Then daily ops:     Attendance → Exams → Fees
Then comm layer:    Communication
Then UI:            Frontend screens (can be built in parallel with backend from P1-5 onward)
Then export:        Reports (depends on all domain data being in place)
Then compliance:    DPDP (consent + audit log, wired into all mutations)
Then deploy:        Pilot deployment
```

---

## 2. Phase 1 — MVP (Working End-to-End per Module)

---

### P1-1: Project Scaffolding & DevOps Foundation

**Goal:** A running, deployable skeleton. Both services boot, the CI/CD pipeline works, and the first Docker images are in ECR.

#### P1-1.1 Repository Structure

Create a monorepo (recommended) or two separate repositories:

```
educore/
+-- apps/
|   +-- api/            <- NestJS backend
|   +-- web/            <- Next.js frontend
+-- infra/              <- Terraform
+-- db/
|   +-- migrations/     <- Flyway SQL migration files
|   +-- seeds/          <- Seed data for dev/test
+-- docker/
|   +-- api.Dockerfile
|   +-- web.Dockerfile
+-- .github/
    +-- workflows/
        +-- ci.yml      <- Build + test on every PR
        +-- deploy.yml  <- Deploy to staging/prod on merge to main
```

#### P1-1.2 NestJS API Scaffold

```bash
npx @nestjs/cli new api --package-manager npm
```

Install dependencies:
```bash
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install bcrypt class-validator class-transformer
npm install @nestjs/config
npm install pdfkit archiver
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install @aws-sdk/client-ses   # for password reset emails
```

**Initial module structure:**
```
src/
+-- common/
|   +-- decorators/    (CurrentUser, Roles, TenantId)
|   +-- guards/        (JwtAuthGuard, RolesGuard)
|   +-- interceptors/  (AuditInterceptor, TenantInterceptor)
|   +-- middleware/    (TenantConnectionMiddleware)
|   +-- filters/       (HttpExceptionFilter)
|   +-- pipes/         (ValidationPipe config)
+-- config/
|   +-- permissions.config.ts
|   +-- database.config.ts
+-- modules/
|   +-- auth/
|   +-- tenants/
|   +-- users/
|   +-- students/
|   +-- parents/
|   +-- admissions/
|   +-- attendance/
|   +-- exams/
|   +-- fees/
|   +-- communication/
|   +-- reports/
|   +-- dpdp/
+-- app.module.ts
+-- main.ts
```

#### P1-1.3 Next.js Web Scaffold

```bash
npx create-next-app@latest web --typescript --tailwind --app --src-dir --import-alias "@/*"
```

> **Note:** TailwindCSS is chosen here for the Next.js app for rapid, mobile-first responsive UI development. This is an exception to the vanilla CSS default, justified by the mobile-first constraint and the 3-person team size.

**Initial page structure:**
```
src/app/
+-- (auth)/
|   +-- login/page.tsx
+-- (app)/                    <- protected layout
    +-- layout.tsx            <- nav, auth check
    +-- dashboard/page.tsx
    +-- students/
    |   +-- page.tsx          <- student list
    |   +-- [id]/page.tsx     <- student detail
    +-- attendance/page.tsx
    +-- exams/page.tsx
    +-- fees/page.tsx
    +-- communication/page.tsx
```

#### P1-1.4 Terraform Infrastructure

**Files to create:**
```
infra/
+-- main.tf
+-- variables.tf
+-- outputs.tf
+-- modules/
    +-- networking/     <- VPC, subnets, security groups, ALB
    +-- rds/            <- RDS PostgreSQL instance
    +-- ecs/            <- ECS cluster, task definitions, services
    +-- s3/             <- S3 buckets
    +-- ses/            <- SES identity verification
```

**Terraform resources (Phase 1 — dev/pilot):**

```hcl
# RDS PostgreSQL (single-AZ for pilot)
resource "aws_db_instance" "educore" {
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.medium"
  allocated_storage = 20
  multi_az          = false    # -> true in Phase 2
  encrypted         = true
  backup_retention_period = 30
}

# ECS Fargate cluster
resource "aws_ecs_cluster" "educore" { name = "educore-${var.env}" }

# Two Fargate services: api + web
# Defined in modules/ecs/
```

**Acceptance criteria:**
- [ ] `terraform apply` creates all infra without errors in a dev AWS account.
- [ ] `docker build` succeeds for both api and web Dockerfiles.
- [ ] GitHub Actions CI pipeline runs on every PR: lint, type-check, unit tests.
- [ ] GitHub Actions deploy pipeline pushes to ECR and updates ECS task on merge to `main`.
- [ ] Both services are reachable via ALB URL. API returns `{"status":"ok"}` on `GET /health`.

---

### P1-2: Database — Public Schema & Tenant Provisioning

**Goal:** The `public` schema exists. Creating a new tenant provisions their schema and runs all migrations automatically.

#### P1-2.1 Public Schema Migration (Flyway: `V001__public_schema.sql`)

```sql
-- V001__public_schema.sql
CREATE TABLE public.tenants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  schema_name  TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  contact_email TEXT NOT NULL,
  config       JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.migration_locks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT NOT NULL UNIQUE,
  locked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### P1-2.2 NestJS Tenant Provisioning Service

```typescript
// src/modules/tenants/tenant-provisioning.service.ts
@Injectable()
export class TenantProvisioningService {
  async provision(slug: string, name: string, email: string): Promise<void> {
    const schemaName = `school_${slug}`;
    // 1. INSERT into public.tenants
    // 2. CREATE SCHEMA school_<slug>
    // 3. Run Flyway migrations against the new schema
    //    (via child_process.execSync or a Flyway Java call)
    // 4. Seed default users (admin) into the new schema
  }
}
```

**CLI command for tenant creation:**
```bash
# apps/api/src/cli/create-tenant.ts
# Run as: npm run tenant:create -- --slug=greenwood --name="Greenwood Academy" --email=admin@greenwood.edu
```

#### P1-2.3 Tenant Middleware

```typescript
// src/common/middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const slug = req.hostname.split('.')[0];  // 'greenwood' from greenwood.educore.app
    const tenant = await this.tenantsService.findBySlug(slug);
    if (!tenant) throw new NotFoundException('Tenant not found');
    req['tenant'] = tenant;
    // Set PostgreSQL search_path for this request's connection
    await this.dataSource.query(`SET search_path TO ${tenant.schema_name}`);
    next();
  }
}
```

**Acceptance criteria:**
- [ ] `npm run tenant:create -- --slug=pilot --name="Pilot School"` creates schema `school_pilot` and runs all migrations.
- [ ] Subsequent API requests to `pilot.localhost:3000` have `search_path = school_pilot` set correctly.
- [ ] Requests to an unknown subdomain return `404`.

---

### P1-3: Authentication & Authorization

**Goal:** Login, logout, JWT refresh, and RBAC guards work. A teacher cannot access admin endpoints.

#### P1-3.1 Auth Endpoints

```
POST /auth/login          { email, password } -> { access_token, user }
POST /auth/refresh        (reads HttpOnly cookie) -> { access_token }
POST /auth/logout         (clears refresh token)
POST /auth/forgot-password { email } -> sends reset link via SES
POST /auth/reset-password { token, new_password }
```

#### P1-3.2 JWT Payload Structure

```typescript
interface JwtPayload {
  sub: string;         // user.id
  tenant_id: string;
  schema: string;      // 'school_greenwood'
  role: UserRole;      // 'ADMIN' | 'TEACHER' | 'PARENT' | etc.
  name: string;
  scope_data: {
    section_ids?: string[];   // for TEACHER role
    class_ids?: string[];     // for HOD role
    student_ids?: string[];   // for PARENT role (their children)
  };
  iat: number;
  exp: number;         // 15 minutes from issue
}
```

#### P1-3.3 Permissions Config

```typescript
// src/config/permissions.config.ts
export type Action = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
export type Resource = 'students' | 'attendance' | 'exams' | 'exam_results' |
                       'fee_structures' | 'fee_transactions' | 'circulars' |
                       'messages' | 'notifications' | 'audit_logs' | 'consent_records' | 'users';

export const PERMISSIONS: Record<Resource, Partial<Record<Action, UserRole[]>>> = {
  students: {
    CREATE: ['ADMIN', 'FRONT_OFFICE'],
    READ:   ['ADMIN', 'PRINCIPAL', 'HOD', 'TEACHER', 'ACCOUNTANT', 'FRONT_OFFICE', 'PARENT'],
    UPDATE: ['ADMIN', 'FRONT_OFFICE'],
    DELETE: ['ADMIN'],
  },
  attendance: {
    CREATE: ['TEACHER', 'ADMIN'],
    READ:   ['TEACHER', 'HOD', 'PRINCIPAL', 'ADMIN', 'PARENT'],
    UPDATE: ['TEACHER', 'ADMIN'],
  },
  exam_results: {
    CREATE: ['TEACHER', 'HOD', 'ADMIN'],
    READ:   ['TEACHER', 'HOD', 'PRINCIPAL', 'ADMIN', 'PARENT', 'STUDENT'],
    UPDATE: ['TEACHER', 'HOD', 'ADMIN'],
  },
  fee_structures: {
    CREATE: ['ADMIN', 'ACCOUNTANT'],
    READ:   ['ADMIN', 'ACCOUNTANT', 'PRINCIPAL'],
    UPDATE: ['ADMIN', 'ACCOUNTANT'],
    DELETE: ['ADMIN'],
  },
  fee_transactions: {
    CREATE: ['ADMIN', 'ACCOUNTANT'],
    READ:   ['ADMIN', 'ACCOUNTANT', 'PRINCIPAL', 'PARENT'],
    UPDATE: ['ADMIN', 'ACCOUNTANT'],
  },
  // ... (remaining resources)
};
```

#### P1-3.4 RolesGuard Implementation

```typescript
// src/common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { resource, action } = this.reflector.get<{resource: Resource, action: Action}>(
      'permission', context.getHandler()
    );
    const user: JwtPayload = context.switchToHttp().getRequest().user;
    const allowedRoles = PERMISSIONS[resource]?.[action] ?? [];
    return allowedRoles.includes(user.role);
  }
}

// Usage on a controller method:
@Get()
@Permission({ resource: 'students', action: 'READ' })
findAll() { ... }
```

**Acceptance criteria:**
- [ ] `POST /auth/login` with valid credentials returns `access_token` + sets `refresh_token` HttpOnly cookie.
- [ ] `POST /auth/login` with invalid password returns `401`.
- [ ] A request with an expired access token + valid refresh cookie returns a new access token via `POST /auth/refresh`.
- [ ] A TEACHER-role JWT cannot call `POST /students` (returns `403`).
- [ ] A PARENT-role JWT cannot call `GET /attendance` for a student that is not in their `scope_data.student_ids` (returns `403`).
- [ ] `POST /auth/forgot-password` sends a password reset email via SES (verify in dev with SES sandbox).

---

### P1-4: Tenant Schema Migrations (Core 6 Tables)

**Goal:** All Core 6 tables are defined in Flyway SQL migrations. Running the migration runner creates a complete, correct schema.

#### P1-4.1 Migration File Structure

```
db/migrations/
+-- V001__public_schema.sql          <- tenants, migration_locks
+-- V002__auth_tables.sql            <- users, refresh_tokens
+-- V003__classes_and_sections.sql   <- classes, sections, subjects, section_subjects
+-- V004__students_and_parents.sql   <- students, parents, student_guardian_map
+-- V005__admissions.sql             <- admission_inquiries
+-- V006__attendance.sql             <- attendance_records
+-- V007__exams.sql                  <- exams, exam_results
+-- V008__fees.sql                   <- fee_structures, fee_transactions
+-- V009__communication.sql          <- notifications, circulars, messages
+-- V010__dpdp.sql                   <- consent_records, audit_logs
+-- V011__indexes.sql                <- all secondary indexes
```

#### P1-4.2 Key Migration Details

**V003 — Classes, Sections, Subjects:**
```sql
-- V003__classes_and_sections.sql
CREATE TABLE classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  name          TEXT NOT NULL,
  numeric_level INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name, academic_year)
);

CREATE TABLE sections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  class_id           UUID NOT NULL REFERENCES classes(id),
  class_name         TEXT NOT NULL,
  name               TEXT NOT NULL,
  class_teacher_id   UUID,    -- FK added after users table; enforced at app layer in v1
  class_teacher_name TEXT,
  capacity           INTEGER DEFAULT 40,
  academic_year      TEXT NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, name)
);

CREATE TABLE subjects (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name      TEXT NOT NULL,
  code      TEXT,
  board     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE section_subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  section_id    UUID NOT NULL REFERENCES sections(id),
  subject_id    UUID NOT NULL REFERENCES subjects(id),
  subject_name  TEXT NOT NULL,
  teacher_id    UUID NOT NULL,
  teacher_name  TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(section_id, subject_id, academic_year)
);
```

**V011 — Indexes (all in one file for easy review):**
```sql
-- V011__indexes.sql
CREATE INDEX idx_users_tenant_role      ON users(tenant_id, role);
CREATE INDEX idx_students_class_section ON students(class_id, section_id);
CREATE INDEX idx_students_status        ON students(tenant_id, enrollment_status);
CREATE INDEX idx_attendance_section_date ON attendance_records(section_id, date);
CREATE INDEX idx_attendance_student      ON attendance_records(student_id, date DESC);
CREATE INDEX idx_exam_results_student   ON exam_results(student_id, exam_id);
CREATE INDEX idx_exam_results_exam      ON exam_results(exam_id, section_name);
CREATE INDEX idx_fee_tx_student         ON fee_transactions(student_id, due_date);
CREATE INDEX idx_fee_tx_status          ON fee_transactions(tenant_id, status, due_date);
CREATE INDEX idx_fee_tx_class           ON fee_transactions(tenant_id, class_name, academic_year);
CREATE INDEX idx_notifications_user     ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_messages_thread        ON messages(thread_key, created_at DESC);
CREATE INDEX idx_audit_resource         ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_occurred         ON audit_logs(occurred_at DESC);
CREATE INDEX idx_consent_subject        ON consent_records(data_subject_id);
```

**Acceptance criteria:**
- [ ] `flyway migrate` on a fresh `school_pilot` schema creates all 20+ tables with zero errors.
- [ ] `flyway migrate` on an existing schema with data is idempotent (no data loss).
- [ ] All foreign key constraints validate with a test INSERT + DELETE sequence.
- [ ] All indexes are created and used by the query planner (verified with `EXPLAIN ANALYZE` on the key queries).

---

### P1-5: SIS — Student & Parent CRUD

**Goal:** Admin and Front Office can create, view, update, and list students and parents. Parent can view their own child.

#### P1-5.1 API Endpoints

```
# Students
GET    /students?class_id=X&section_id=Y&status=ACTIVE&search=name    Student list (paginated)
POST   /students                                                        Create student
GET    /students/:id                                                    Student detail
PATCH  /students/:id                                                    Update student fields
PATCH  /students/:id/enroll    { class_id, section_id, academic_year } Assign/move class+section
PATCH  /students/:id/exit      { exit_date, exit_reason, status }      Mark alumni/transferred
GET    /students/:id/documents                                          List documents (S3 metadata)
POST   /students/:id/documents  { document_type }                      Get S3 presigned upload URL
GET    /students/:id/id-card                                            Generate ID card PDF

# Parents
GET    /parents/:id                                                     Parent detail
PATCH  /parents/:id                                                     Update parent fields
GET    /parents/:id/children                                            Parent's linked students (uses student_guardian_map)
POST   /students/:id/guardians { parent_id?, first_name, last_name, relation, phone, email }
                                                                        Link or create parent
```

#### P1-5.2 Key Service Logic — Enroll/Move Student

When a student is assigned to a new section, the service must update denormalized fields:

```typescript
async enroll(studentId: string, dto: EnrollStudentDto): Promise<void> {
  const section = await this.sectionsRepo.findOne(dto.section_id);
  const cls = await this.classesRepo.findOne(section.class_id);

  // Update the student's denormalized class/section fields:
  await this.studentsRepo.update(studentId, {
    class_id: cls.id,
    class_name: cls.name,
    section_id: section.id,
    section_name: section.name,
    academic_year: dto.academic_year,
  });

  // Update the guardian map's denormalized fields:
  await this.guardianMapRepo.update(
    { student_id: studentId },
    { class_name: cls.name, section_name: section.name }
  );

  // NOTE: Historical attendance and fee records are NOT updated —
  // they correctly reflect the section at time of recording.
  await this.auditLog('UPDATE', 'student', studentId, 'Enrolled to ' + cls.name + section.name);
}
```

#### P1-5.3 S3 Document Upload Flow

```typescript
// GET /students/:id/documents (presigned upload URL)
async getPresignedUploadUrl(studentId: string, documentType: string): Promise<string> {
  const key = `${tenantSlug}/students/${studentId}/${documentType}_${Date.now()}.pdf`;
  const command = new PutObjectCommand({ Bucket: DOCUMENTS_BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes
}
```

Frontend calls `GET /students/:id/documents?type=BIRTH_CERTIFICATE`, receives a presigned URL, then does a direct browser `PUT` to S3. No file bytes pass through the API server.

**Acceptance criteria:**
- [ ] Creating a student with all required fields returns `201` with the student record.
- [ ] `GET /students` for a TEACHER role only returns students in sections in their `scope_data.section_ids`.
- [ ] `GET /students` for a PARENT role only returns students in `scope_data.student_ids`.
- [ ] `GET /students/:id/documents` presigned URL is valid and a test file upload via `curl` succeeds.
- [ ] `PATCH /students/:id/enroll` updates `class_name` and `section_name` on the `students` table AND on `student_guardian_map`.

---

### P1-6: Admissions — Inquiry to Student Conversion

**Goal:** Front Office can manage the admission funnel from inquiry to enrolled student.

#### P1-6.1 API Endpoints

```
POST   /admissions/inquiries               Create inquiry
GET    /admissions/inquiries?status=X      List inquiries (filtered by status)
PATCH  /admissions/inquiries/:id           Update notes, status, assigned staff
POST   /admissions/inquiries/:id/convert   Convert to student
```

#### P1-6.2 Convert to Student — Transactional Service

The `convert` endpoint is the most critical in Admissions. It must be atomic:

```typescript
async convert(inquiryId: string, dto: ConvertInquiryDto): Promise<Student> {
  return await this.dataSource.transaction(async (manager) => {
    const inquiry = await manager.findOneOrFail(AdmissionInquiry, inquiryId);

    // 1. Create parent user account (status: PENDING_PASSWORD_RESET)
    const parentUser = await manager.save(User, {
      email: dto.parent_email,
      password_hash: await bcrypt.hash(randomBytes(16).toString('hex'), 12),
      role: 'PARENT',
      display_name: inquiry.parent_name,
      status: 'ACTIVE',
    });

    // 2. Create parent record
    const parent = await manager.save(Parent, {
      user_id: parentUser.id,
      first_name: dto.parent_first_name,
      last_name: dto.parent_last_name,
      relation: dto.relation,
      phone: inquiry.parent_phone,
      email: inquiry.parent_email,
    });

    // 3. Create student record (no class assignment yet; done via /students/:id/enroll)
    const student = await manager.save(Student, {
      admission_number: await this.generateAdmissionNumber(),
      first_name: dto.student_first_name,
      last_name: dto.student_last_name,
      date_of_birth: inquiry.date_of_birth,
      enrollment_status: 'ACTIVE',
      admission_date: new Date(),
    });

    // 4. Create student_guardian_map
    await manager.save(StudentGuardianMap, {
      student_id: student.id,
      parent_id: parent.id,
      student_name: student.full_name,
      class_name: '',       // set after enroll
      section_name: '',     // set after enroll
      relation: dto.relation,
    });

    // 5. Create consent_records entry (DPDP)
    await manager.save(ConsentRecord, {
      data_subject_id: student.id,
      guardian_id: parent.id,
      guardian_name: parent.first_name + ' ' + parent.last_name,
      purpose: 'STUDENT_ENROLLMENT',
      data_categories: ['name', 'dob', 'photo', 'academic_records', 'attendance'],
      consent_given_at: new Date(),
      consent_method: 'STAFF_VERIFIED_AT_ADMISSION',
    });

    // 6. Update inquiry status
    await manager.update(AdmissionInquiry, inquiryId, {
      status: 'CONVERTED',
      converted_to_student_id: student.id,
    });

    // 7. Send password-set email to parent via SES
    await this.emailService.sendPasswordSetEmail(dto.parent_email, parentUser.id);

    // 8. Audit log
    await this.auditService.log('CREATE', 'student', student.id, 'Admitted via inquiry ' + inquiryId);

    return student;
  });
}
```

**Acceptance criteria:**
- [ ] `POST /admissions/inquiries/:id/convert` in a single request: creates user, parent, student, guardian_map, consent_record, updates inquiry status, sends email — all or nothing.
- [ ] If the parent email already exists in the `users` table, the endpoint returns `409 Conflict` with a helpful message (prevent duplicate parent accounts).
- [ ] After conversion, the parent can log in via the password-set link and see their child in `GET /parents/:id/children`.
- [ ] The `consent_records` entry is linked correctly to the new student and parent.

---

### P1-7: Attendance — Bulk Checkbox Save

**Goal:** Teacher can fetch their section's student list with existing attendance, mark statuses, and save in one API call.

#### P1-7.1 API Endpoints

```
GET    /attendance?section_id=X&date=Y         Fetch attendance list for a section/date
POST   /attendance/bulk                         Save full section attendance (upsert)
GET    /attendance/student/:id?month=YYYY-MM    Monthly attendance calendar for a student
GET    /attendance/report/defaulters?section_id=X&month=YYYY-MM&threshold=75
                                                Defaulter report (attendance% < threshold)
```

#### P1-7.2 GET /attendance — The Core Read

```typescript
async getAttendanceList(sectionId: string, date: Date): Promise<AttendanceListDto> {
  const result = await this.dataSource.query(`
    SELECT
      s.id              AS student_id,
      s.full_name       AS student_name,
      a.id              AS attendance_record_id,
      COALESCE(a.status, 'PRESENT') AS status,
      a.notes
    FROM students s
    LEFT JOIN attendance_records a
      ON a.student_id = s.id AND a.date = $2
    WHERE s.section_id = $1
      AND s.enrollment_status = 'ACTIVE'
    ORDER BY s.full_name
  `, [sectionId, date]);

  return {
    date: date.toISOString().split('T')[0],
    section: await this.sectionsRepo.findOne(sectionId),  // one extra query; cached in practice
    records: result,
  };
}
```

> **DB traffic:** 2 queries max (section lookup + student/attendance LEFT JOIN). The section lookup can be eliminated by returning section info from a separate cheap query or embedding it in the JWT for class teachers.

#### P1-7.3 POST /attendance/bulk — The Core Write

```typescript
interface BulkAttendanceDto {
  section_id: string;
  date: string;   // 'YYYY-MM-DD'
  records: Array<{ student_id: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE'; notes?: string }>;
}

async bulkSave(dto: BulkAttendanceDto, actor: JwtPayload): Promise<void> {
  const section = await this.sectionsRepo.findOne(dto.section_id);

  // Build upsert values (denormalize all display fields at write time)
  const values = dto.records.map(r => ({
    tenant_id: actor.tenant_id,
    student_id: r.student_id,
    student_name: r.student_name,        // resolved from the GET response (client sends it back)
    section_id: dto.section_id,
    class_name: section.class_name,
    section_name: section.name,
    date: dto.date,
    status: r.status,
    marked_by_id: actor.sub,
    marked_by_name: actor.name,
    notes: r.notes ?? null,
  }));

  // Single upsert via TypeORM query builder
  await this.dataSource
    .createQueryBuilder()
    .insert()
    .into(AttendanceRecord)
    .values(values)
    .orUpdate(['status', 'marked_by_id', 'marked_by_name', 'notes', 'updated_at'], ['student_id', 'date'])
    .execute();

  // Audit log (one entry for the bulk operation)
  await this.auditService.log('CREATE', 'attendance', null,
    `Bulk attendance saved for ${section.class_name}${section.name} on ${dto.date}`);
}
```

**Acceptance criteria:**
- [ ] `GET /attendance?section_id=X&date=Y` returns all active students with status (`PRESENT` default if no record).
- [ ] `POST /attendance/bulk` with 40 student records executes in < 500ms (verify with `EXPLAIN ANALYZE`).
- [ ] A second `POST /attendance/bulk` for the same section/date updates existing records (upsert behavior).
- [ ] A TEACHER can only submit attendance for `section_id` values in their `scope_data.section_ids`.
- [ ] A PARENT calling `GET /attendance/student/:id?month=X` only sees data if the student is in their `scope_data.student_ids`.

---

### P1-8: Examinations & Results

**Goal:** Admin can create exams. Teachers can enter marks in a grid. Admin can publish. Parents can view results. Report card PDF downloads.

#### P1-8.1 API Endpoints

```
POST   /exams                                             Create exam
GET    /exams?class_id=X&academic_year=Y                  List exams
GET    /exams/:id                                         Exam detail
PATCH  /exams/:id                                         Update exam (name, dates, marks)
PATCH  /exams/:id/publish                                 Publish results (status -> PUBLISHED)

GET    /exams/:id/results?section_id=X&subject_id=Y       Marks-entry grid
POST   /exam-results/bulk                                 Save marks (upsert, same pattern as attendance)
PATCH  /exam-results/:id                                  Edit a single result (Admin/Principal override)

GET    /students/:id/results?academic_year=Y              All published results for a student
GET    /students/:id/report-card?academic_year=Y          Generate PDF report card (on-demand)
```

#### P1-8.2 Marks-Entry Grid Response

```typescript
// GET /exams/:id/results?section_id=X&subject_id=Y
async getMarksGrid(examId: string, sectionId: string, subjectId: string) {
  return await this.dataSource.query(`
    SELECT
      s.id              AS student_id,
      s.full_name       AS student_name,
      er.id             AS result_id,
      er.marks_obtained,
      er.is_absent,
      er.grade
    FROM students s
    LEFT JOIN exam_results er
      ON er.student_id = s.id
      AND er.exam_id = $1
      AND er.subject_id = $3
    WHERE s.section_id = $2
      AND s.enrollment_status = 'ACTIVE'
    ORDER BY s.full_name
  `, [examId, sectionId, subjectId]);
}
```

#### P1-8.3 Grade Computation (on save)

```typescript
function computeGrade(marks: number, total: number): string {
  const pct = (marks / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 45) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}
```

Grade is computed at write time and stored in the `exam_results` table. No computation on read.

#### P1-8.4 Report Card PDF (pdfkit)

```typescript
// GET /students/:id/report-card?academic_year=Y
async generateReportCard(studentId: string, academicYear: string): Promise<Buffer> {
  const student = await this.studentsRepo.findOne(studentId);
  const results = await this.examResultsRepo.find({
    where: { student_id: studentId, exam: { academic_year: academicYear, status: 'PUBLISHED' } }
  });
  const attendance = await this.getMonthlyAttendanceSummary(studentId, academicYear);

  // Build PDF with pdfkit:
  const doc = new PDFDocument({ size: 'A4' });
  // ... School header, student details, marks table, attendance summary, signature block
  return await streamToBuffer(doc);
}
```

**Acceptance criteria:**
- [ ] `GET /exams/:id/results?section_id=X&subject_id=Y` returns all students with existing marks or null.
- [ ] `POST /exam-results/bulk` saves marks for 40 students in one upsert. Grades are computed and stored.
- [ ] `PATCH /exams/:id/publish` sets exam status to `PUBLISHED`. Results are now visible to PARENT role.
- [ ] `GET /students/:id/report-card?academic_year=2025-26` returns a valid, non-empty PDF.
- [ ] A PARENT cannot see results for an exam that has not been published (`status != 'PUBLISHED'`).

---

### P1-9: Fees & Finance

**Goal:** Accountant can define fee structures, generate invoices, record payments (online + offline), and download receipts.

#### P1-9.1 API Endpoints

```
POST   /fee-structures                                    Create fee structure
GET    /fee-structures?academic_year=Y                    List fee structures
POST   /fee-structures/:id/generate-invoices             Generate INVOICE rows for a class
       { class_id, academic_year }

GET    /students/:id/fees                                 Student's fee ledger (all transactions)
POST   /fee-transactions/:id/pay-online                  Verify Razorpay + mark PAID
       { gateway_payment_id, gateway_order_id }
POST   /fee-transactions/:id/pay-offline                 Record manual payment
       { payment_mode, collected_by_id, amount_paid }
GET    /fee-transactions/:id/receipt                     Generate receipt PDF
GET    /fees/report/outstanding?class_id=X               Outstanding dues report for a class
GET    /fees/report/collection-summary?date_from=X&date_to=Y   Collection summary
```

#### P1-9.2 Generate Invoices — Bulk Insert

```typescript
async generateInvoices(feeStructureId: string, classId: string, academicYear: string): Promise<number> {
  const feeStructure = await this.feeStructuresRepo.findOne(feeStructureId);
  const students = await this.studentsRepo.find({
    where: { class_id: classId, enrollment_status: 'ACTIVE' }
  });

  const rows: Partial<FeeTransaction>[] = [];
  for (const student of students) {
    for (const head of feeStructure.fee_heads) {
      rows.push({
        student_id: student.id,
        student_name: student.full_name,
        class_name: student.class_name,
        section_name: student.section_name,
        fee_structure_id: feeStructureId,
        transaction_type: 'INVOICE',
        fee_head: head.name,
        academic_year: academicYear,
        amount: head.amount,
        due_date: head.due_date,
        status: 'PENDING',
      });
    }
  }

  // Skip students who already have INVOICE rows for this structure/year (idempotent)
  await this.dataSource.createQueryBuilder()
    .insert().into(FeeTransaction).values(rows)
    .orIgnore()  // ON CONFLICT DO NOTHING
    .execute();

  return rows.length;
}
```

#### P1-9.3 Razorpay Online Payment Flow

```
1. Parent clicks "Pay Now" on a fee invoice in the web app.
2. Frontend calls POST /fee-transactions/:id/initiate-payment
   -> API calls Razorpay Orders API to create an order { amount, currency: 'INR' }
   -> Returns { razorpay_order_id, razorpay_key_id, amount } to frontend.
3. Frontend opens Razorpay checkout widget with the order ID.
4. Parent completes payment. Razorpay returns { razorpay_payment_id, razorpay_signature }.
5. Frontend calls POST /fee-transactions/:id/pay-online { payment_id, order_id, signature }
   -> API verifies signature (HMAC-SHA256) against Razorpay key_secret.
   -> If valid: marks fee_transaction PAID, sets gateway_payment_id, generates receipt.
   -> Returns { receipt_url } to frontend.
```

**Acceptance criteria:**
- [ ] `POST /fee-structures/:id/generate-invoices` creates the correct number of `INVOICE` rows and is idempotent (running twice does not create duplicates).
- [ ] `GET /students/:id/fees` returns all invoices for the student in a single query (no joins — all display fields denormalized).
- [ ] Razorpay payment signature verification works correctly. An invalid signature returns `400`.
- [ ] `POST /fee-transactions/:id/pay-offline` marks the transaction PAID and creates an audit log entry.
- [ ] `GET /fee-transactions/:id/receipt` returns a valid PDF receipt.
- [ ] `GET /fees/report/outstanding?class_id=X` runs in < 200ms for a 500-student class (verify with `EXPLAIN ANALYZE`).

---

### P1-10: Communication — Circulars & Messages

**Goal:** Admin/Teacher can send circulars. Parents and teachers can message each other. Users see their notification feed.

#### P1-10.1 API Endpoints

```
POST   /circulars                            Send a circular (bulk INSERT notifications)
GET    /circulars?class_id=X                 List circulars visible to current user
GET    /notifications?since=TIMESTAMP        Unread notification feed (max 50)
PATCH  /notifications/mark-read             Mark all as read
POST   /messages                             Send a direct message
GET    /messages?with_user_id=X             Conversation thread (paginated)
GET    /messages/conversations              List all conversations for current user
```

#### P1-10.2 Send Circular — Resolve Recipients & Bulk INSERT

```typescript
async sendCircular(dto: CreateCircularDto, actor: JwtPayload): Promise<void> {
  const circular = await this.circularsRepo.save({ ...dto, sent_by_id: actor.sub, sent_by_name: actor.name });

  // Resolve recipient user IDs based on target_type:
  let recipientIds: string[] = [];
  if (dto.target_type === 'ALL') {
    recipientIds = await this.usersRepo.find({ where: { tenant_id: actor.tenant_id } })
      .then(users => users.map(u => u.id));
  } else if (dto.target_type === 'CLASS') {
    // Get all parent user_ids for students in the target class
    recipientIds = await this.getParentUserIdsForClass(dto.target_id);
  } else if (dto.target_type === 'SECTION') {
    recipientIds = await this.getParentUserIdsForSection(dto.target_id);
  } else if (dto.target_type === 'ROLE') {
    recipientIds = await this.usersRepo.find({ where: { role: dto.target_role } })
      .then(users => users.map(u => u.id));
  }

  // Bulk INSERT one notification per recipient (deduplication via ON CONFLICT DO NOTHING)
  const notifications = recipientIds.map(userId => ({
    user_id: userId, type: 'CIRCULAR', title: dto.title,
    body: dto.body?.substring(0, 200), source_id: circular.id,
  }));
  await this.dataSource.createQueryBuilder()
    .insert().into(Notification).values(notifications).orIgnore().execute();

  await this.auditService.log('CREATE', 'circular', circular.id,
    `Circular sent to ${recipientIds.length} recipients`);
}
```

#### P1-10.3 Notification Feed — Polling

The frontend polls `GET /notifications?since=<last_checked_timestamp>` on:
- Page load.
- Every 60 seconds (via `setInterval`).
- On window focus event.

```typescript
// GET /notifications?since=TIMESTAMP
async getNotifications(userId: string, since: Date): Promise<Notification[]> {
  return this.notificationsRepo.find({
    where: { user_id: userId, created_at: MoreThan(since) },
    order: { created_at: 'DESC' },
    take: 50,
  });
}
```

**Acceptance criteria:**
- [ ] `POST /circulars` with `target_type: 'CLASS'` creates exactly one `notifications` row per parent of that class.
- [ ] Running `POST /circulars` twice for the same circular does not create duplicate notifications (`ON CONFLICT DO NOTHING`).
- [ ] `GET /notifications?since=X` returns only notifications after the `since` timestamp.
- [ ] `PATCH /notifications/mark-read` marks all unread notifications for the current user as read in one `UPDATE` statement.
- [ ] A parent can only see messages in their own conversation threads.

---

### P1-11: Frontend — Core Screens (Next.js)

**Goal:** All Core 6 modules have working, mobile-responsive UI screens connected to the real API.

#### P1-11.1 Shared Components to Build First

```
src/components/
+-- layout/
|   +-- AppShell.tsx          <- nav sidebar + header + notification bell
|   +-- PageHeader.tsx        <- title + breadcrumb + primary action button
+-- ui/
|   +-- DataTable.tsx         <- sortable, paginated table (used everywhere)
|   +-- StatusBadge.tsx       <- coloured badge for status fields
|   +-- SearchInput.tsx       <- debounced search input
|   +-- ConfirmDialog.tsx     <- simple yes/no confirmation modal
|   +-- PdfDownloadButton.tsx <- triggers a GET request, downloads file
+-- forms/
|   +-- StudentForm.tsx
|   +-- AttendanceCheckboxList.tsx   <- THE key component
|   +-- MarksEntryGrid.tsx
|   +-- FeePaymentForm.tsx
```

#### P1-11.2 AttendanceCheckboxList — Key Component Spec

```tsx
// src/components/forms/AttendanceCheckboxList.tsx
interface AttendanceRecord {
  student_id: string;
  student_name: string;
  attendance_record_id: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE';
}

export function AttendanceCheckboxList({ sectionId, date }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Load attendance list on mount
  useEffect(() => { fetchAttendance(sectionId, date).then(setRecords); }, [sectionId, date]);

  const toggleStatus = (studentId: string, status: AttendanceRecord['status']) => {
    setRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, status } : r));
    setIsDirty(true);
  };

  const handleSave = async () => {
    // Optimistic: UI shows "Saved" immediately; roll back if API fails
    setIsDirty(false);
    try {
      await bulkSaveAttendance(sectionId, date, records);
    } catch {
      setIsDirty(true);  // revert dirty flag; show error
    }
  };

  return (
    <div>
      <div className="sticky top-0 bg-white p-2 border-b flex justify-between">
        <span>{date} — {records.length} students</span>
        <button onClick={handleSave} disabled={!isDirty}>Save</button>
      </div>
      {records.map(record => (
        <div key={record.student_id} className="flex items-center p-3 border-b">
          <span className="flex-1">{record.student_name}</span>
          {(['PRESENT', 'ABSENT', 'LATE'] as const).map(status => (
            <button
              key={status}
              onClick={() => toggleStatus(record.student_id, status)}
              className={record.status === status ? 'active-btn' : 'inactive-btn'}
            >
              {status[0]}  {/* P / A / L */}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

#### P1-11.3 Screen Checklist

| Screen | Path | Roles | Key Interaction |
|---|---|---|---|
| Login | `/login` | All | Email + password form |
| Dashboard | `/` | All | Summary cards (my class attendance today, pending fees count) |
| Student List | `/students` | Admin, FO, Teacher, HOD | Searchable, filterable table; click to detail |
| Student Detail | `/students/[id]` | Scoped | Profile, documents, attendance calendar, fee ledger, results tabs |
| Attendance | `/attendance` | Teacher | Section + date picker; checkbox list; Save button |
| Exam List | `/exams` | Admin, HOD, Teacher | List of exams; click to enter marks |
| Marks Entry | `/exams/[id]/marks` | Teacher | Section + subject selector; marks-entry grid |
| Fee Ledger (student) | `/students/[id]` (Fees tab) | Accountant, Parent | Invoice list; Pay button; Download receipt |
| Fee Structures | `/fee-structures` | Admin, Accountant | List + create + generate invoices |
| Circulars | `/communication` | Admin, Teacher, Parent | Send form; circular list; notification feed |
| Notifications | Bell in nav | All | Dropdown of last 10; mark all read |
| Reports | `/reports` | Scoped | List of report types; date/class filter; Download CSV/PDF |

**Acceptance criteria:**
- [ ] All screens render correctly on a 375px-wide mobile viewport (Chrome DevTools).
- [ ] The attendance checkbox list loads and saves for a 40-student section in < 2 seconds on a 3G throttled connection.
- [ ] The student detail page loads from one API call (no sequential waterfall of API calls).
- [ ] All forms have inline validation (required fields, numeric range for marks, etc.) before submission.
- [ ] The navigation correctly hides menu items that the current user's role cannot access.

---

### P1-12: Reports — CSV & PDF Exports

**Goal:** Key reports are available as downloadable CSV and PDF files from the Reports section.

#### P1-12.1 Report Endpoints

```
GET /reports/attendance-summary?section_id=X&month=YYYY-MM&format=csv|pdf
GET /reports/attendance-defaulters?class_id=X&month=YYYY-MM&threshold=75&format=csv|pdf
GET /reports/exam-results?exam_id=X&section_id=Y&format=csv|pdf
GET /reports/fee-outstanding?class_id=X&academic_year=Y&format=csv|pdf
GET /reports/fee-collection?date_from=X&date_to=Y&format=csv|pdf
```

#### P1-12.2 CSV Streaming

```typescript
async streamCsvReport(res: Response, rows: object[], filename: string): Promise<void> {
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.setHeader('Content-Type', 'text/csv');

  const csv = rows.map(row => Object.values(row).join(',')).join('\n');
  const header = Object.keys(rows[0]).join(',');
  res.send(header + '\n' + csv);
}
```

#### P1-12.3 PDF Reports (pdfkit tabular)

```typescript
async generateTablePdf(title: string, columns: string[], rows: string[][]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(chunk));

  doc.fontSize(16).text(title, { align: 'center' });
  doc.moveDown();

  const colWidth = (doc.page.width - 80) / columns.length;

  // Header row
  doc.fontSize(10).font('Helvetica-Bold');
  columns.forEach((col, i) => doc.text(col, 40 + i * colWidth, doc.y, { width: colWidth }));
  doc.moveDown(0.5);

  // Data rows
  doc.font('Helvetica').fontSize(9);
  for (const row of rows) {
    const y = doc.y;
    row.forEach((cell, i) => doc.text(cell, 40 + i * colWidth, y, { width: colWidth }));
    doc.moveDown(0.3);
  }

  doc.end();
  return Buffer.concat(await once(doc, 'end').then(() => chunks));
}
```

**Acceptance criteria:**
- [ ] All 5 report endpoints return valid CSV files with correct headers.
- [ ] All 5 report endpoints return valid PDF files with correct data.
- [ ] The `attendance-defaulters` report correctly filters students below the threshold percentage.
- [ ] Reports complete in < 3 seconds for a 500-student school.

---

### P1-13: DPDP — Consent & Audit Log

**Goal:** Consent records are created at the right moments. All mutations write audit log entries. Both are verified before pilot launch.

#### P1-13.1 AuditInterceptor

```typescript
// src/common/interceptors/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, body } = request;

    // Only audit mutating methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next.handle();

    const before = Date.now();
    return next.handle().pipe(
      tap(async (response) => {
        await this.auditService.log({
          actor_id: user?.sub,
          actor_name: user?.name,
          actor_role: user?.role,
          action: METHOD_TO_ACTION[method],
          resource_type: this.extractResource(url),
          resource_id: response?.id ?? request.params?.id,
          summary: `${user?.name ?? 'System'} ${method} ${url}`,
          ip_address: ip,
        });
      }),
    );
  }
}
```

This interceptor is registered globally and writes one `audit_logs` row for every mutating API call.

#### P1-13.2 Consent Record Verification

Before pilot launch, run the following SQL to verify consent coverage:

```sql
-- All active students should have a consent record
SELECT s.id, s.full_name, s.admission_number
FROM students s
WHERE s.enrollment_status = 'ACTIVE'
  AND s.consent_record_id IS NULL;
-- Expected: 0 rows
```

**Acceptance criteria:**
- [ ] Every POST/PATCH/DELETE request creates exactly one `audit_logs` row.
- [ ] The `audit_logs` table has no UPDATE or DELETE privileges for the application DB user (verify with `\dp audit_logs` in psql).
- [ ] Every student created via the conversion flow has a linked `consent_records` row.
- [ ] The consent verification SQL query returns 0 rows before pilot launch.

---

### P1-14: Pilot Deployment & Smoke Test

**Goal:** The application is running on AWS, accessible to the pilot school's staff and one parent, with no critical bugs.

#### P1-14.1 Deployment Steps

```bash
# 1. Provision infrastructure
cd infra/
terraform workspace new pilot
terraform apply -var="env=pilot" -var="school_slug=greenwood"

# 2. Run database migrations
aws ecs run-task \
  --cluster educore-pilot \
  --task-definition educore-flyway-migrate \
  --overrides '{"containerOverrides": [{"name": "flyway", "command": ["migrate"]}]}'

# 3. Create first tenant
aws ecs run-task \
  --cluster educore-pilot \
  --task-definition educore-api \
  --overrides '{"containerOverrides": [{"name": "api", "command": ["npm", "run", "tenant:create", "--", "--slug=greenwood", "--name=Greenwood Academy", "--email=admin@greenwood.edu"]}]}'

# 4. Deploy API and Web images
# (Triggered automatically by GitHub Actions on merge to main)

# 5. Verify
curl https://greenwood.educore.app/health
# -> {"status":"ok","db":"connected","schema":"school_greenwood"}
```

#### P1-14.2 Smoke Test Checklist

Run the following tests manually before handing to the pilot school:

| Test | Steps | Expected |
|---|---|---|
| Admin login | Login as admin@greenwood.edu | Dashboard loads |
| Create student | Fill student form, save | Student appears in list |
| Assign class | Open student, assign to Class 3B | Student list filters correctly |
| Mark attendance | Teacher login, open Attendance → Class 3B → today → toggle 2 absent → Save | Database has correct records |
| Enter exam marks | Admin creates exam, teacher enters marks, admin publishes | Marks visible to parent |
| Record fee payment | Accountant opens student fees, records offline payment | Transaction marked PAID, receipt downloadable |
| Send circular | Admin sends circular to "All" | Notification appears in teacher's and parent's feed |
| Parent login | Login as parent, check child's attendance calendar | Correct monthly view |
| Download report card | Open student, click Download Report Card | Valid PDF with marks |
| Download CSV report | Reports → Attendance Defaulters → Download CSV | Valid CSV file |

---

## 3. Phase 2 — Production-Ready Hardening

Phase 2 begins after the pilot school has run on Phase 1 for at least **30 continuous days** without a critical incident. The goal is to make the platform ready for onboarding additional schools safely.

---

### P2-1: Security Hardening

**Tasks:**

1. **Input validation audit:** Verify that all POST/PATCH endpoints use NestJS `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. No raw user input reaches the DB without validation.

2. **SQL injection audit:** All TypeORM queries use parameterized queries. Audit any raw SQL strings for concatenated user input. Run `sqlmap` against the API endpoints.

3. **Rate limiting:** Add `@nestjs/throttler` to limit: login attempts (5/min/IP), API calls (100/min/user), report generation (10/hour/user).

4. **HTTPS only:** Enforce HTTPS redirect at ALB level. Set HSTS header.

5. **Security headers:** Add `helmet` middleware in NestJS for: CSP, X-Frame-Options, X-Content-Type-Options.

6. **Secrets rotation:** Move all secrets (DB password, JWT secret, Razorpay keys) from `.env` to AWS Secrets Manager. Rotate the DB password.

7. **S3 security audit:** Verify all buckets have `Block Public Access` enabled. Verify presigned URL expiry is enforced. Scan for any accidentally public objects.

8. **Dependency audit:** Run `npm audit` on both api and web. Fix all critical/high CVEs.

9. **Penetration test:** Run a basic OWASP ZAP scan against the staging environment. Fix all high-severity findings.

---

### P2-2: Multi-AZ RDS + Backup Validation

**Tasks:**

1. Promote the pilot RDS instance to Multi-AZ (`aws rds modify-db-instance --multi-az`).
2. Conduct a failover drill: force a failover and verify the application recovers within 60 seconds.
3. Restore a database snapshot into a separate RDS instance and verify data integrity.
4. Verify S3 Object Lock is enabled on the `educore-backups-prod` bucket.
5. Document the recovery procedure in a runbook.

---

### P2-3: Performance & Load Testing

**Tools:** k6 (open-source load testing tool)

**Test scenarios:**

```javascript
// k6 load test: attendance bulk save under load
// 50 concurrent teachers saving attendance simultaneously
export const options = { vus: 50, duration: '2m' };

export default function () {
  const res = http.post(
    'https://pilot.educore.app/attendance/bulk',
    JSON.stringify(generateAttendancePayload(40)),  // 40 students per section
    { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
  );
  check(res, { 'status 200': (r) => r.status === 200, 'latency < 1s': (r) => r.timings.duration < 1000 });
}
```

**Targets:**
- Attendance bulk save (40 students): P95 < 500ms under 50 concurrent users.
- Student list (500 students): P95 < 300ms.
- Report generation (500 students): P95 < 3 seconds.

If any target is missed, add a RDS read replica and route read-heavy queries to it.

---

### P2-4: DPDP Full Compliance Pass

**Tasks:**

1. **Consent OTP flow:** Upgrade `STAFF_VERIFIED_AT_ADMISSION` consent method to `OTP_VERIFIED_MOBILE` by building the parent self-serve onboarding flow.
2. **Data erasure CLI:** Build and test the `npm run dpdp:anonymize` CLI script. Verify that running it clears all PII fields and sets `anonymized_at`.
3. **Retention schedule automation:** Add a scheduled ECS task (monthly cron) that: identifies expired records, runs anonymization.
4. **Data access request:** Build `GET /admin/students/:id/export-all` that returns a ZIP of all data for a student (for DPDP access requests).
5. **Privacy Policy link:** Add a footer link to the Privacy Policy on every page.
6. **Grievance Officer:** Add a configurable Grievance Officer name + email to the tenant's `config` JSONB and display it in the app footer.
7. **DPDP compliance checklist review:** Walk through the Section 12 checklist in `EduCore_Simplified_Architecture.md` and verify every item is met.

---

### P2-5: Admin Tooling & Tenant Management

**Tasks:**

1. **Platform admin portal:** A protected `/platform-admin` area (Super Admin only, IP-whitelisted) for:
   - Creating new tenants (wrapping the CLI command as a web form).
   - Viewing all tenants and their status.
   - Suspending a tenant.
   - Running migrations across all schemas.

2. **Tenant config UI:** Allow school admin to configure: academic year, pass percentage, school name, logo, fee late-fine rules — all stored in `tenants.config JSONB`.

3. **Bulk student import:** CSV upload to bulk-create students at onboarding time. Validate format, dry-run preview, then commit.

---

### P2-6: Phase 2 Module Candidates (HRM, Transport, Library)

These modules were excluded from Core 6 but are candidates for Phase 2 based on customer demand:

| Module | Simplified version | Prerequisite |
|---|---|---|
| **HRM & Payroll** | Staff CRUD + leave tracking + manual payroll calculation input (no statutory auto-generation in v1) | SIS (staff as users), Fees (salary as a fee head variant) |
| **Transportation** | Manual route/stop master + student route assignment + stop-wise student list (no GPS, no RFID) | SIS (students), Communication (parent notification) |
| **Library** | Catalogue CRUD + issue/return with due-date tracking + fine calculation | SIS (students), Fees (fines linked to fee transactions) |

Each Phase 2 module follows the same pattern as Core 6: Flyway migration → NestJS module → API endpoints → Next.js screens → acceptance criteria.

---

### P2-7: Flutter Mobile App (Post-Web Validation)

After the web app has been validated with real users for at least 60 days, begin the Flutter mobile app — starting with the highest-value parent-facing flows:

**Phase 2 Flutter scope:**
1. Login + OTP auth.
2. My child's attendance calendar.
3. Fee payment (Razorpay in-app browser).
4. Notification feed.
5. Report card PDF download.

**Teacher Flutter scope (can follow parent app):**
1. Attendance marking (checkbox list, identical UX to web).
2. Notification feed.

---

### P2-8: Monitoring, Alerting & On-Call Runbooks

**Monitoring stack (all within AWS free/low tier):**

| Signal | Tool | Alert Condition |
|---|---|---|
| API error rate | CloudWatch Logs Insights | > 1% 5xx in 5 minutes |
| DB connection count | RDS CloudWatch metrics | > 80% of max_connections |
| Fargate task health | ECS service health check | Task count < desired |
| Disk space | RDS CloudWatch | < 20% free storage |
| Backup success | RDS automated backup event | No backup in 25 hours |

**Runbooks to write before GA:**
- RDS failover runbook (force failover + verify recovery).
- ECS task restart runbook (manual task stop + restart).
- DB restore from snapshot runbook.
- DPDP breach response runbook (aligned with Section 7.6 of Master Context).

---

## 4. Dependency Graph

```
P1-1 (Scaffolding)
    |
    +-> P1-2 (Public Schema + Tenant Provisioning)
    |       |
    |       +-> P1-3 (Auth)
    |               |
    |               +-> P1-4 (Tenant Schema Migrations)
    |                       |
    |                       +-> P1-5 (SIS: Students + Parents)
    |                       |       |
    |                       |       +-> P1-6 (Admissions)
    |                       |       +-> P1-7 (Attendance)
    |                       |       +-> P1-8 (Exams)
    |                       |       +-> P1-9 (Fees)
    |                       |       +-> P1-10 (Communication)
    |                       |       |
    |                       |       +-> P1-11 (Frontend) [parallel with P1-5..10]
    |                       |       +-> P1-12 (Reports) [after P1-5..10]
    |                       |       +-> P1-13 (DPDP) [wired into P1-5..10]
    |                       |
    |                       +-> P1-14 (Pilot Deployment)
    |
    +-> P2 (All Phase 2 tasks in parallel or sequenced by dependency)
```

---

## 5. Directory Structure

```
educore/
+-- apps/
|   +-- api/
|   |   +-- src/
|   |   |   +-- common/
|   |   |   |   +-- decorators/    (CurrentUser, Permission, TenantId)
|   |   |   |   +-- guards/        (JwtAuthGuard, RolesGuard)
|   |   |   |   +-- interceptors/  (AuditInterceptor, TenantInterceptor)
|   |   |   |   +-- middleware/    (TenantConnectionMiddleware)
|   |   |   |   +-- filters/       (AllExceptionsFilter)
|   |   |   |   +-- pipes/         (ValidationPipe setup)
|   |   |   |   +-- services/      (AuditService, EmailService, S3Service, PdfService)
|   |   |   +-- config/
|   |   |   |   +-- permissions.config.ts
|   |   |   |   +-- database.config.ts
|   |   |   |   +-- jwt.config.ts
|   |   |   +-- modules/
|   |   |   |   +-- auth/           (login, refresh, logout, forgot-password)
|   |   |   |   +-- tenants/        (provisioning service, tenant middleware)
|   |   |   |   +-- users/          (user CRUD, password management)
|   |   |   |   +-- students/       (student CRUD, enroll, exit, documents)
|   |   |   |   +-- parents/        (parent CRUD, children list)
|   |   |   |   +-- admissions/     (inquiry CRUD, convert)
|   |   |   |   +-- classes/        (class/section/subject CRUD)
|   |   |   |   +-- attendance/     (bulk save, monthly summary, defaulters)
|   |   |   |   +-- exams/          (exam CRUD, marks entry, publish)
|   |   |   |   +-- fees/           (structure, invoices, payment, receipt)
|   |   |   |   +-- communication/  (circulars, messages, notifications)
|   |   |   |   +-- reports/        (all report endpoints)
|   |   |   |   +-- dpdp/           (consent records, erasure CLI)
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- Dockerfile
|   |   +-- package.json
|   +-- web/
|       +-- src/
|       |   +-- app/               (Next.js App Router pages)
|       |   +-- components/        (shared UI components)
|       |   +-- hooks/             (useAttendance, useFees, useNotifications)
|       |   +-- lib/               (api client, auth helpers)
|       |   +-- types/             (TypeScript interfaces)
|       +-- public/
|       +-- Dockerfile
|       +-- package.json
+-- db/
|   +-- migrations/               (V001..V011 SQL files)
|   +-- seeds/                    (dev seed data)
+-- infra/
|   +-- main.tf
|   +-- variables.tf
|   +-- modules/
|       +-- networking/
|       +-- rds/
|       +-- ecs/
|       +-- s3/
+-- docker/
|   +-- api.Dockerfile
|   +-- web.Dockerfile
+-- .github/
|   +-- workflows/
|       +-- ci.yml
|       +-- deploy-staging.yml
|       +-- deploy-prod.yml
+-- docs/
    +-- EduCore_Master_Context.md
    +-- EduCore_Simplified_Architecture.md
    +-- EduCore_Build_Plan.md           <- this file
```

---

## 6. Environment Configuration

```env
# .env.production (secrets in AWS Parameter Store; non-secrets here)

# App
NODE_ENV=production
PORT=3000
APP_URL=https://educore.app

# Database
DB_HOST=educore-prod.xxxx.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=educore
DB_USER=educore_app        # from Parameter Store: /educore/prod/db/user
DB_PASSWORD=               # from Parameter Store: /educore/prod/db/password
DB_SSL=true

# JWT
JWT_SECRET=                # from Parameter Store: /educore/prod/jwt/secret
JWT_ACCESS_EXPIRY=900      # 15 minutes in seconds
JWT_REFRESH_EXPIRY=604800  # 7 days in seconds

# AWS
AWS_REGION=ap-south-1
S3_DOCUMENTS_BUCKET=educore-documents-prod
S3_STATIC_BUCKET=educore-static-prod
SES_FROM_EMAIL=noreply@educore.app

# Razorpay (Phase 1: Fees module)
RAZORPAY_KEY_ID=           # from Parameter Store: /educore/prod/razorpay/key_id
RAZORPAY_KEY_SECRET=       # from Parameter Store: /educore/prod/razorpay/key_secret

# Notifications
NOTIFICATION_POLL_INTERVAL_MS=60000   # 60 seconds (frontend config via env)
```

---

## 7. Definition of Done

### Phase 1 — MVP

A task block (P1-X) is **Done** when:
- [ ] All API endpoints in the block return correct responses for happy path + key error cases.
- [ ] All acceptance criteria in the block are checked off.
- [ ] Unit tests exist for the service layer business logic (not just the controller).
- [ ] The corresponding frontend screen(s) are connected and functional.
- [ ] The AuditInterceptor writes a log entry for all mutating operations in the block.
- [ ] No `console.log` statements in production code.
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`).
- [ ] `npm run lint` passes with zero errors.

### Phase 2 — Production-Ready

Phase 2 is **Done** when:
- [ ] All P2-1 through P2-5 tasks are complete.
- [ ] Load test passes all P95 latency targets.
- [ ] Security scan (OWASP ZAP) reports zero high-severity findings.
- [ ] DPDP compliance checklist (Section 12, Simplified Architecture doc) is fully checked.
- [ ] Monitoring alerts are active in CloudWatch.
- [ ] All runbooks are written, reviewed, and stored in `docs/runbooks/`.
- [ ] At least one additional school has been onboarded after the pilot, using the Tenant Provisioning flow, without engineering intervention.

---

*End of EduCore Production Prototype Build Plan v1.0.0*

*Architecture reference: [EduCore_Simplified_Architecture.md](./EduCore_Simplified_Architecture.md)*
*Full feature reference: [EduCore_Master_Context.md](./EduCore_Master_Context.md)*
