# SchoolMitra ERP — Official Documentation & Handbooks Suite

Welcome to the definitive technical manuals, architecture documentation, and operational playbooks for **SchoolMitra ERP**.

This documentation suite is organized into modular, deep-dive manuals covering every layer of the platform, from cloud infrastructure and database internals to daily school administration workflows.

---

## 📚 Documentation Library

```
docs/manuals/
├── README.md                                           # Master Documentation Portal (This Index)
├── 01_infrastructure_and_devops_manual.md             # AWS Cloud, ECS Fargate, ALB, RDS, S3, Docker, CI/CD
├── 02_system_architecture_and_design_patterns_manual.md # Multi-Tenancy, C4 Models, Auth, Drizzle, BullMQ, DPDP
├── 03_core_modules_deep_dive_manual.md                 # Academics, Admissions, Attendance, Fees, Exams, HR
├── 04_engineering_team_handbook_and_sops.md            # Onboarding, Code Standards, Git Gates, Migrations, Runbooks
└── 05_end_user_operations_manual.md                   # Super Admin, Principal, Teacher, Accountant, Parent PWA
```

---

## 🧭 Navigation Matrix & Reading Paths

Select your persona below to access the tailored reading track:

### 1. Cloud Architects & DevOps Engineers
Focuses on cloud networking, containerization, database scalability, observability, and deployments:
- **Primary**: [01. Infrastructure & DevOps Architecture Manual](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/01_infrastructure_and_devops_manual.md)
- **Secondary**: [04. Engineering Team Handbook & SOPs](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/04_engineering_team_handbook_and_sops.md) (Deployment & Rollback SOPs)
- **Reference**: [02. System Architecture Manual](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/02_system_architecture_and_design_patterns_manual.md) (Container & Async Workers)

### 2. Software Engineers & Full-Stack Developers
Focuses on monorepo structure, Drizzle ORM schemas, Server Actions, BullMQ workers, and code standards:
- **Primary**: [02. System Architecture & Design Patterns Manual](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/02_system_architecture_and_design_patterns_manual.md)
- **Secondary**: [03. Core Modules Deep-Dive Manual](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/03_core_modules_deep_dive_manual.md)
- **Operational SOPs**: [04. Engineering Team Handbook & SOPs](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/04_engineering_team_handbook_and_sops.md)

### 3. Product Managers & QA Engineers
Focuses on domain logic, student lifecycles, timetable collisions, fee calculation algorithms, and test cases:
- **Primary**: [03. Core Modules Deep-Dive Manual](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/03_core_modules_deep_dive_manual.md)
- **User Workflows**: [05. End-User Operations Manual & Role Playbooks](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/05_end_user_operations_manual.md)

### 4. School Administrators, Accountants & Teachers
Focuses on day-to-day operations, attendance registers, exam mark entries, fee invoice generation, and mobile PWA usage:
- **Primary**: [05. End-User Operations Manual & Role Playbooks](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/05_end_user_operations_manual.md)

---

## 🔍 Manual Overviews

| Document | Key Topics Covered | Target Readers |
| :--- | :--- | :--- |
| [**01. Infrastructure & DevOps Manual**](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/01_infrastructure_and_devops_manual.md) | • AWS VPC & Multi-AZ subnets<br>• ECS Fargate cluster & task definitions<br>• Application Load Balancer & health checks<br>• RDS PostgreSQL 16 connection pooling<br>• S3 storage & Presigned URL vaults<br>• Multi-stage Dockerfile engineering<br>• Amazon CloudWatch real-time alarms | DevOps, Cloud Engineers, SREs |
| [**02. System Architecture Manual**](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/02_system_architecture_and_design_patterns_manual.md) | • C4 Architecture Models (Levels 1 & 2)<br>• Multi-tenant `school_id` isolation<br>• Super admin impersonation sessions<br>• NextAuth.js v5 & RBAC permission matrix<br>• Drizzle ORM data access patterns<br>• BullMQ Redis async processing<br>• DPDP Act 2023 compliance & AES-256 GCM | System Architects, Tech Leads, Security Officers |
| [**03. Core Modules Deep-Dive**](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/03_core_modules_deep_dive_manual.md) | • Super Admin multi-school onboarding<br>• Academic years, terms, classes & sections<br>• Collision-free timetable scheduling engine<br>• Student admissions & document vault<br>• Morning attendance roll call & alerts<br>• Double-entry fees & Razorpay integration<br>• Examinations, grading & PDF report cards<br>• HR, Payroll, Fleet GPS, Library & Hostels | Developers, QA, Domain Specialists |
| [**04. Engineering Team Handbook**](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/04_engineering_team_handbook_and_sops.md) | • Workstation setup & Docker dependencies<br>• Turborepo monorepo workflows<br>• TypeScript strictness & RSC vs Client rules<br>• Conventional commits & Husky pre-commit gates<br>• Drizzle zero-downtime migration rules<br>• Production deployment & emergency rollback<br>• Incident triage & DPDP breach protocol | Engineering Team, New Hires |
| [**05. End-User Operations Manual**](file:///v:/Cascade/Edu_core/Edu_core/docs/manuals/05_end_user_operations_manual.md) | • Super Admin provisioning & DPDP audits<br>• Principal academic rollover & staff setup<br>• Teacher roll call marking & exam entries<br>• Accountant batch invoicing & challans<br>• Parent/Student PWA install (Android & iOS)<br>• Online UPI payments & consent portal | School Leaders, Teachers, Accountants, Parents |

---

## 🛠️ Maintaining This Documentation

- **Living Documents**: These documents are maintained alongside application code. Whenever a new feature, database migration, or infrastructure component is modified, the corresponding manual must be updated in the same Pull Request.
- **Accuracy Invariant**: Code samples, schema references, and environment variable listings must correspond directly with executable files in the repository.
