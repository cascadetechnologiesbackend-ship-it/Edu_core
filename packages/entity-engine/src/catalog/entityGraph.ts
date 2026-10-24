import { CatalogEntity } from "./types";

export const ENTITY_GRAPH: Record<string, CatalogEntity> = {
  "schools": {
    "tableName": "schools",
    "drizzleExport": "schools",
    "domain": "CORE_IDENTITY",
    "displayName": "School Tenant",
    "description": "Multi-tenant root organization entity defining board affiliation, UDISE code, and campus details.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [
      "phone",
      "email",
      "principalName"
    ],
    "searchableFields": [
      "name",
      "slug",
      "udiseCode",
      "city"
    ],
    "tags": [
      "tenant",
      "school",
      "campus",
      "core"
    ],
    "relationships": [
      {
        "sourceTable": "schools",
        "targetTable": "academic_years",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "school_id",
        "onDelete": "RESTRICT",
        "description": "School has many academic calendar years."
      },
      {
        "sourceTable": "schools",
        "targetTable": "users",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "school_id",
        "onDelete": "RESTRICT",
        "description": "School owns user accounts."
      }
    ]
  },
  "users": {
    "tableName": "users",
    "drizzleExport": "users",
    "domain": "CORE_IDENTITY",
    "displayName": "User Account",
    "description": "System authentication identities for staff, parents, students, and administrators.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "email",
      "mobileEncrypted",
      "nameEncrypted"
    ],
    "searchableFields": [
      "email"
    ],
    "tags": [
      "auth",
      "user",
      "login",
      "account"
    ],
    "relationships": [
      {
        "sourceTable": "users",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "User belongs to a school tenant."
      },
      {
        "sourceTable": "users",
        "targetTable": "user_roles",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "user_id",
        "onDelete": "CASCADE",
        "description": "User holds RBAC roles."
      }
    ]
  },
  "roles": {
    "tableName": "roles",
    "drizzleExport": "roles",
    "domain": "CORE_IDENTITY",
    "displayName": "Security Role",
    "description": "RBAC security roles determining system and route access permissions.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "displayName"
    ],
    "tags": [
      "rbac",
      "permissions",
      "security",
      "role"
    ],
    "relationships": [
      {
        "sourceTable": "roles",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Role scoped to school tenant."
      }
    ]
  },
  "user_roles": {
    "tableName": "user_roles",
    "drizzleExport": "userRoles",
    "domain": "CORE_IDENTITY",
    "displayName": "User Role Mapping",
    "description": "Many-to-many relationship linking users to assigned security roles.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [],
    "tags": [
      "rbac",
      "mapping"
    ],
    "relationships": [
      {
        "sourceTable": "user_roles",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "user_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Assigned user."
      },
      {
        "sourceTable": "user_roles",
        "targetTable": "roles",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "role_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Assigned role."
      }
    ]
  },
  "audit_logs": {
    "tableName": "audit_logs",
    "drizzleExport": "auditLogs",
    "domain": "CORE_IDENTITY",
    "displayName": "Audit Log Entry",
    "description": "Immutable append-only record of security, consent, and administrative actions.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "ipAddress",
      "userAgent"
    ],
    "searchableFields": [
      "action",
      "resourceType"
    ],
    "tags": [
      "audit",
      "compliance",
      "security",
      "log"
    ],
    "relationships": [
      {
        "sourceTable": "audit_logs",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Actor who performed the audited operation."
      }
    ]
  },
  "academic_years": {
    "tableName": "academic_years",
    "drizzleExport": "academicYears",
    "domain": "ACADEMICS",
    "displayName": "Academic Year",
    "description": "School calendar fiscal and academic period (e.g. 2026-2027).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "label"
    ],
    "tags": [
      "calendar",
      "year",
      "session",
      "academics"
    ],
    "relationships": [
      {
        "sourceTable": "academic_years",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School owner of the academic year."
      },
      {
        "sourceTable": "academic_years",
        "targetTable": "classes",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "academic_year_id",
        "onDelete": "RESTRICT",
        "description": "Classes running in this academic year."
      }
    ]
  },
  "classes": {
    "tableName": "classes",
    "drizzleExport": "classes",
    "domain": "ACADEMICS",
    "displayName": "Class / Grade",
    "description": "Instructional cohort grade level (Nursery, Class 1 to Class 12).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "displayName",
      "gradeLevel"
    ],
    "tags": [
      "class",
      "grade",
      "cohort",
      "classroom"
    ],
    "relationships": [
      {
        "sourceTable": "classes",
        "targetTable": "academic_years",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "academic_year_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Associated academic year."
      },
      {
        "sourceTable": "classes",
        "targetTable": "sections",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "class_id",
        "onDelete": "CASCADE",
        "description": "Class sections (A, B, C)."
      }
    ]
  },
  "sections": {
    "tableName": "sections",
    "drizzleExport": "sections",
    "domain": "ACADEMICS",
    "displayName": "Class Section",
    "description": "Sub-cohort section division with class teacher assignment and room capacity.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "displayName"
    ],
    "tags": [
      "section",
      "division",
      "classroom"
    ],
    "relationships": [
      {
        "sourceTable": "sections",
        "targetTable": "classes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "class_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent class."
      }
    ]
  },
  "subjects": {
    "tableName": "subjects",
    "drizzleExport": "subjects",
    "domain": "ACADEMICS",
    "displayName": "Curriculum Subject",
    "description": "Scholastic course or subject (Mathematics, Science, English, etc.).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "code"
    ],
    "tags": [
      "subject",
      "course",
      "curriculum"
    ],
    "relationships": [
      {
        "sourceTable": "subjects",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School curriculum."
      }
    ]
  },
  "section_subject_teachers": {
    "tableName": "section_subject_teachers",
    "drizzleExport": "sectionSubjectTeachers",
    "domain": "ACADEMICS",
    "displayName": "Subject Teacher Mapping",
    "description": "Allocation of teaching staff to specific class sections and subjects.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [],
    "tags": [
      "teacher",
      "allocation",
      "timetable"
    ],
    "relationships": [
      {
        "sourceTable": "class_subject_teachers",
        "targetTable": "classes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "class_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Allocated class."
      },
      {
        "sourceTable": "class_subject_teachers",
        "targetTable": "subjects",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "subject_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Allocated subject."
      }
    ]
  },
  "students": {
    "tableName": "students",
    "drizzleExport": "students",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Student",
    "description": "Primary student record carrying encrypted demographic PII, admission numbers, and enrollment states.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "firstNameEncrypted",
      "lastNameEncrypted",
      "dateOfBirth",
      "gender",
      "aadhaarEncrypted",
      "penNumber",
      "apaarId",
      "bloodGroup",
      "medicalConditionsEncrypted",
      "emergencyContactEncrypted"
    ],
    "searchableFields": [
      "admissionNumber",
      "rollNumber",
      "firstNameSearchHash",
      "lastNameSearchHash"
    ],
    "tags": [
      "student",
      "pupil",
      "child",
      "enrollment",
      "profile"
    ],
    "relationships": [
      {
        "sourceTable": "students",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School where the student is enrolled."
      },
      {
        "sourceTable": "students",
        "targetTable": "student_class_history",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "student_id",
        "onDelete": "CASCADE",
        "description": "Yearly academic progression history."
      },
      {
        "sourceTable": "students",
        "targetTable": "student_subject_enrollments",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "student_id",
        "onDelete": "CASCADE",
        "description": "Mandatory and elective subject enrollments."
      }
    ]
  },
  "student_class_history": {
    "tableName": "student_class_history",
    "drizzleExport": "studentClassHistory",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Student Class History",
    "description": "Historical academic record tracking grade level, roll number, and section for each session.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "rollNumber"
    ],
    "tags": [
      "progression",
      "roll",
      "academic-history"
    ],
    "relationships": [
      {
        "sourceTable": "student_class_history",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Associated student."
      },
      {
        "sourceTable": "student_class_history",
        "targetTable": "classes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "class_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Enrolled class."
      }
    ]
  },
  "student_subject_enrollments": {
    "tableName": "student_subject_enrollments",
    "drizzleExport": "studentSubjectEnrollments",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Student Subject Enrollment",
    "description": "Mapping of enrolled subjects (mandatory core and optional electives) for an individual student.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [],
    "tags": [
      "enrollment",
      "electives",
      "curriculum"
    ],
    "relationships": [
      {
        "sourceTable": "student_subject_enrollments",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Enrolled student."
      },
      {
        "sourceTable": "student_subject_enrollments",
        "targetTable": "subjects",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "subject_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Enrolled subject."
      }
    ]
  },
  "school_counters": {
    "tableName": "school_counters",
    "drizzleExport": "schoolCounters",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "School Monotonic Sequence Counter",
    "description": "Atomic counter generating monotonic sequential admission numbers, application numbers, and invoice numbers.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "counterKey"
    ],
    "tags": [
      "sequences",
      "counters",
      "atomic",
      "numbers"
    ],
    "relationships": [
      {
        "sourceTable": "school_counters",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Counter tenant."
      }
    ]
  },
  "admission_applications": {
    "tableName": "admission_applications",
    "drizzleExport": "admissionApplications",
    "domain": "ADMISSIONS",
    "displayName": "Admission Application",
    "description": "Prospective student application moving through the admissions state machine (SUBMITTED -> UNDER_REVIEW -> ADMITTED).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "applicantNameEncrypted",
      "parentMobileEncrypted",
      "parentEmailEncrypted",
      "addressEncrypted"
    ],
    "searchableFields": [
      "applicationNumber",
      "status"
    ],
    "tags": [
      "admissions",
      "inquiry",
      "applicant"
    ],
    "relationships": [
      {
        "sourceTable": "admission_applications",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Admitting school."
      }
    ]
  },
  "student_attendance": {
    "tableName": "student_attendance",
    "drizzleExport": "studentAttendance",
    "domain": "ATTENDANCE",
    "displayName": "Student Attendance Record",
    "description": "Daily or session-based attendance statuses (PRESENT, ABSENT, LATE, HALF_DAY, LEAVE).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "date",
      "status"
    ],
    "tags": [
      "attendance",
      "roster",
      "daily",
      "roll-call"
    ],
    "relationships": [
      {
        "sourceTable": "student_attendance",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Marked student."
      }
    ]
  },
  "student_leave_requests": {
    "tableName": "student_leave_requests",
    "drizzleExport": "studentLeaveRequests",
    "domain": "ATTENDANCE",
    "displayName": "Student Leave Request",
    "description": "Parent-initiated leave applications, teacher approval queue, and attendance suppression.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "reason",
      "decisionNote"
    ],
    "searchableFields": [
      "reason",
      "status"
    ],
    "tags": [
      "leave",
      "absence",
      "attendance",
      "parent",
      "workflow"
    ],
    "relationships": [
      {
        "sourceTable": "student_leave_requests",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school tenant."
      },
      {
        "sourceTable": "student_leave_requests",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Student requesting leave."
      },
      {
        "sourceTable": "student_leave_requests",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "requested_by_parent_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Parent initiating request."
      }
    ]
  },
  "exam_types": {
    "tableName": "exam_types",
    "drizzleExport": "examTypes",
    "domain": "EXAMINATIONS",
    "displayName": "Examination Type",
    "description": "Assessment categories (UNIT_TEST, HALF_YEARLY, ANNUAL, PRACTICAL, INTERNAL_ASSESSMENT).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "code",
      "examType"
    ],
    "tags": [
      "exam-type",
      "blueprint",
      "assessment"
    ],
    "relationships": [
      {
        "sourceTable": "exam_types",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School owner of exam type."
      }
    ]
  },
  "exams": {
    "tableName": "exams",
    "drizzleExport": "exams",
    "domain": "EXAMINATIONS",
    "displayName": "Examination Term",
    "description": "Concrete assessment instance in an academic year with lock state and dates.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name"
    ],
    "tags": [
      "exam",
      "term",
      "test",
      "datesheet"
    ],
    "relationships": [
      {
        "sourceTable": "exams",
        "targetTable": "academic_years",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "academic_year_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Academic year."
      },
      {
        "sourceTable": "exams",
        "targetTable": "exam_types",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_type_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Type of exam."
      },
      {
        "sourceTable": "exams",
        "targetTable": "exam_schedules",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "exam_id",
        "onDelete": "CASCADE",
        "description": "Datesheet papers."
      }
    ]
  },
  "exam_schedules": {
    "tableName": "exam_schedules",
    "drizzleExport": "examSchedules",
    "domain": "EXAMINATIONS",
    "displayName": "Exam Schedule Paper",
    "description": "Scheduled subject exam paper with date, time, duration, room number, and invigilator.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "examDate",
      "roomNumber"
    ],
    "tags": [
      "timetable",
      "datesheet",
      "invigilator",
      "schedule"
    ],
    "relationships": [
      {
        "sourceTable": "exam_schedules",
        "targetTable": "exams",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent examination."
      },
      {
        "sourceTable": "exam_schedules",
        "targetTable": "subjects",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "subject_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Scheduled subject."
      },
      {
        "sourceTable": "exam_schedules",
        "targetTable": "classes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "class_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Class appearing for the exam."
      }
    ]
  },
  "mark_entries": {
    "tableName": "mark_entries",
    "drizzleExport": "markEntries",
    "domain": "EXAMINATIONS",
    "displayName": "Student Mark Entry",
    "description": "Individual student assessment scores across theory, practical, grades, and attendance states.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "grade"
    ],
    "tags": [
      "marks",
      "grading",
      "scores",
      "assessment"
    ],
    "relationships": [
      {
        "sourceTable": "mark_entries",
        "targetTable": "exams",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Exam instance."
      },
      {
        "sourceTable": "mark_entries",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Student graded."
      },
      {
        "sourceTable": "mark_entries",
        "targetTable": "subjects",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "subject_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Subject assessed."
      }
    ]
  },
  "result_snapshots": {
    "tableName": "result_snapshots",
    "drizzleExport": "resultSnapshots",
    "domain": "EXAMINATIONS",
    "displayName": "Result Snapshot",
    "description": "Immutable point-in-time calculation snapshot of student grades, totals, and CBSE report card data.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "payload"
    ],
    "searchableFields": [
      "version"
    ],
    "tags": [
      "snapshot",
      "report-card",
      "frozen-result",
      "cbse-grade"
    ],
    "relationships": [
      {
        "sourceTable": "result_snapshots",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Candidate whose result is frozen."
      }
    ]
  },
  "exam_components": {
    "tableName": "exam_components",
    "drizzleExport": "examComponents",
    "domain": "EXAMINATIONS",
    "displayName": "Exam Component Assessment",
    "description": "Assessment components (Theory, Practical, Viva, Internal, Assignment) with max marks and pass marks.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "code"
    ],
    "tags": [
      "component",
      "theory",
      "practical",
      "rubric"
    ],
    "relationships": [
      {
        "sourceTable": "exam_components",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School tenant."
      },
      {
        "sourceTable": "exam_components",
        "targetTable": "exam_types",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_type_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent examination type."
      }
    ]
  },
  "exam_class_scopes": {
    "tableName": "exam_class_scopes",
    "drizzleExport": "examClassScopes",
    "domain": "EXAMINATIONS",
    "displayName": "Exam Class Eligibility Scope",
    "description": "Class and grade level eligibility mapping for an examination term.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [],
    "tags": [
      "scope",
      "class-exam",
      "eligibility"
    ],
    "relationships": [
      {
        "sourceTable": "exam_class_scopes",
        "targetTable": "exams",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Enclosing examination."
      },
      {
        "sourceTable": "exam_class_scopes",
        "targetTable": "classes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "class_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Target participating class."
      }
    ]
  },
  "exam_marks_locks": {
    "tableName": "exam_marks_locks",
    "drizzleExport": "examMarksLocks",
    "domain": "EXAMINATIONS",
    "displayName": "Marks Entry Lock Status",
    "description": "Immutable publication lock preventing edits once mark sheets are locked by the Examination Head.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "isLocked",
      "lockedAt"
    ],
    "tags": [
      "security",
      "lock",
      "freeze",
      "tamper-proof"
    ],
    "relationships": [
      {
        "sourceTable": "exam_marks_locks",
        "targetTable": "exams",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Locked exam term."
      },
      {
        "sourceTable": "exam_marks_locks",
        "targetTable": "classes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "class_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Locked class roster."
      }
    ]
  },
  "cocurricular_areas": {
    "tableName": "cocurricular_areas",
    "drizzleExport": "cocurricularAreas",
    "domain": "EXAMINATIONS",
    "displayName": "Co-Curricular Assessment Area",
    "description": "Holistic 360 development areas (Work Education, Art Education, Health & Physical Education, Discipline).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "code"
    ],
    "tags": [
      "cocurricular",
      "cbse",
      "holistic",
      "rubric"
    ],
    "relationships": [
      {
        "sourceTable": "cocurricular_areas",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School tenant."
      }
    ]
  },
  "cocurricular_grades": {
    "tableName": "cocurricular_grades",
    "drizzleExport": "cocurricularGrades",
    "domain": "EXAMINATIONS",
    "displayName": "Co-Curricular Student Grade",
    "description": "Assigned co-curricular grade point and descriptive remarks for a student in an exam term.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "grade",
      "remarks"
    ],
    "tags": [
      "cocurricular",
      "grade",
      "remarks"
    ],
    "relationships": [
      {
        "sourceTable": "cocurricular_grades",
        "targetTable": "exams",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Assessment term."
      },
      {
        "sourceTable": "cocurricular_grades",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Evaluated student."
      }
    ]
  },
  "exam_admit_card_settings": {
    "tableName": "exam_admit_card_settings",
    "drizzleExport": "examAdmitCardSettings",
    "domain": "EXAMINATIONS",
    "displayName": "Admit Card Policy Setting",
    "description": "Hall ticket generation rules, fee clearance prerequisites, attendance minimums, and principal signature.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "title"
    ],
    "tags": [
      "admit-card",
      "hall-ticket",
      "policy"
    ],
    "relationships": [
      {
        "sourceTable": "admit_card_settings",
        "targetTable": "exams",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "exam_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Target examination."
      }
    ]
  },
  "report_card_setups": {
    "tableName": "report_card_setups",
    "drizzleExport": "reportCardSetups",
    "domain": "EXAMINATIONS",
    "displayName": "CBSE Report Card Template Setup",
    "description": "Report card visual layout, grading scales, attendance display toggles, and header/footer configurations.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "templateName"
    ],
    "tags": [
      "report-card",
      "cbse",
      "template",
      "marksheet"
    ],
    "relationships": [
      {
        "sourceTable": "report_card_setups",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School tenant."
      }
    ]
  },
  "fee_heads": {
    "tableName": "fee_heads",
    "drizzleExport": "feeHeads",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Head",
    "description": "Accounting revenue category for fees (Tuition Fee, Transport Fee, Admission Fee, Annual Charges).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "code"
    ],
    "tags": [
      "fees",
      "tuition",
      "accounting",
      "ledger"
    ],
    "relationships": [
      {
        "sourceTable": "fee_heads",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "School owner of fee head."
      }
    ]
  },
  "fee_structures": {
    "tableName": "fee_structures",
    "drizzleExport": "feeStructures",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Structure",
    "description": "Cohort and class-level fee configuration linking fee heads to amounts and installment due dates.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name"
    ],
    "tags": [
      "fees",
      "structure",
      "installment",
      "amount"
    ],
    "relationships": [
      {
        "sourceTable": "fee_structures",
        "targetTable": "fee_heads",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "fee_head_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Associated fee head category."
      },
      {
        "sourceTable": "fee_structures",
        "targetTable": "classes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "class_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Class to which structure applies."
      }
    ]
  },
  "fee_invoices": {
    "tableName": "fee_invoices",
    "drizzleExport": "feeInvoices",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Invoice",
    "description": "Payable bill issued to student account tracking balance, late fee, and payment status (PAID/OVERDUE).",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "invoiceNumber",
      "status",
      "dueDate"
    ],
    "tags": [
      "invoice",
      "bill",
      "due-fee",
      "payment-card"
    ],
    "relationships": [
      {
        "sourceTable": "fee_invoices",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Billed student."
      },
      {
        "sourceTable": "fee_invoices",
        "targetTable": "fee_payments",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "invoice_id",
        "onDelete": "RESTRICT",
        "description": "Payments made towards invoice."
      }
    ]
  },
  "fee_payments": {
    "tableName": "fee_payments",
    "drizzleExport": "feePayments",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Payment Receipt",
    "description": "Settled payment transaction (Cash, Cheque, UPI, Razorpay) with receipt generation.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "receiptNumber"
    ],
    "searchableFields": [
      "receiptNumber",
      "paymentMode"
    ],
    "tags": [
      "receipt",
      "settlement",
      "collection",
      "pos"
    ],
    "relationships": [
      {
        "sourceTable": "fee_payments",
        "targetTable": "fee_invoices",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "invoice_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Paid invoice."
      }
    ]
  },
  "staff": {
    "tableName": "staff",
    "drizzleExport": "staff",
    "domain": "HR_STAFF",
    "displayName": "Staff Member",
    "description": "Employee HR profile with designation, qualifications, encrypted mobile, and employment lifecycle.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "firstNameEncrypted",
      "lastNameEncrypted",
      "mobileEncrypted",
      "emailEncrypted",
      "panEncrypted",
      "aadhaarEncrypted",
      "bankAccountEncrypted",
      "bankIfscEncrypted"
    ],
    "searchableFields": [
      "employeeCode",
      "firstNameSearchHash",
      "lastNameSearchHash"
    ],
    "tags": [
      "hr",
      "staff",
      "employee",
      "teacher"
    ],
    "relationships": [
      {
        "sourceTable": "staff",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Employer school."
      },
      {
        "sourceTable": "staff",
        "targetTable": "users",
        "relationType": "ONE_TO_ONE",
        "sourceColumn": "user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Linked user login account."
      }
    ]
  },
  "routes": {
    "tableName": "routes",
    "drizzleExport": "routes",
    "domain": "TRANSPORT",
    "displayName": "Transport Bus Route",
    "description": "School bus operational route with defined vehicle, driver, and stop sequence.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "name",
      "routeNumber"
    ],
    "tags": [
      "bus",
      "route",
      "commute",
      "transport"
    ],
    "relationships": [
      {
        "sourceTable": "transport_routes",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Operating school."
      },
      {
        "sourceTable": "transport_routes",
        "targetTable": "route_stops",
        "relationType": "ONE_TO_MANY",
        "sourceColumn": "id",
        "targetColumn": "route_id",
        "onDelete": "CASCADE",
        "description": "Stops along the route."
      }
    ]
  },
  "route_stops": {
    "tableName": "route_stops",
    "drizzleExport": "routeStops",
    "domain": "TRANSPORT",
    "displayName": "Route Stop",
    "description": "Designated pickup and drop stop with GPS coordinates, stop order, and scheduled ETA.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "stopName"
    ],
    "tags": [
      "stop",
      "gps",
      "eta",
      "pickup"
    ],
    "relationships": [
      {
        "sourceTable": "route_stops",
        "targetTable": "transport_routes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "route_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent bus route."
      }
    ]
  },
  "notices": {
    "tableName": "notices",
    "drizzleExport": "notices",
    "domain": "COMMUNICATION",
    "displayName": "School Notice / Circular",
    "description": "Published administrative announcement or circular with target audience scoping and attachments.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "title",
      "content"
    ],
    "tags": [
      "notice",
      "circular",
      "announcement",
      "broadcast"
    ],
    "relationships": [
      {
        "sourceTable": "notices",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Publishing school."
      }
    ]
  },
  "ptm_events": {
    "tableName": "ptm_events",
    "drizzleExport": "ptmEvents",
    "domain": "COMMUNICATION",
    "displayName": "Parent-Teacher Meeting Event",
    "description": "PTM Event scheduling with teacher, class, venue, and slot booking window.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "venue"
    ],
    "tags": [
      "ptm",
      "meeting",
      "parent_teacher",
      "booking"
    ],
    "relationships": [
      {
        "sourceTable": "ptm_events",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Owning school."
      },
      {
        "sourceTable": "ptm_events",
        "targetTable": "events",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "event_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Master calendar event."
      },
      {
        "sourceTable": "ptm_events",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "teacher_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Host educator."
      }
    ]
  },
  "ptm_slots": {
    "tableName": "ptm_slots",
    "drizzleExport": "ptmSlots",
    "domain": "COMMUNICATION",
    "displayName": "PTM Meeting Slot",
    "description": "10-minute PTM slot inventory with optimistic lock concurrency control.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "status"
    ],
    "tags": [
      "ptm_slot",
      "inventory",
      "slot_booking",
      "schedule"
    ],
    "relationships": [
      {
        "sourceTable": "ptm_slots",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Owning school."
      },
      {
        "sourceTable": "ptm_slots",
        "targetTable": "ptm_events",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "ptm_event_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent PTM event."
      },
      {
        "sourceTable": "ptm_slots",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "teacher_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Host educator."
      }
    ]
  },
  "ptm_bookings": {
    "tableName": "ptm_bookings",
    "drizzleExport": "ptmBookings",
    "domain": "COMMUNICATION",
    "displayName": "PTM Slot Booking",
    "description": "Confirmed, held, or cancelled PTM booking by parent for student.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "teacherNote"
    ],
    "searchableFields": [
      "status",
      "teacherNote"
    ],
    "tags": [
      "ptm_booking",
      "appointment",
      "meeting_reservation"
    ],
    "relationships": [
      {
        "sourceTable": "ptm_bookings",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Owning school."
      },
      {
        "sourceTable": "ptm_bookings",
        "targetTable": "ptm_events",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "ptm_event_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent PTM event."
      },
      {
        "sourceTable": "ptm_bookings",
        "targetTable": "ptm_slots",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "slot_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Reserved slot."
      },
      {
        "sourceTable": "ptm_bookings",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "parent_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Booked by parent."
      },
      {
        "sourceTable": "ptm_bookings",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Subject student."
      }
    ]
  },
  "consent_records": {
    "tableName": "consent_records",
    "drizzleExport": "consentRecords",
    "domain": "DPDP_PRIVACY",
    "displayName": "DPDP Consent Record",
    "description": "Statutory proof of consent under the Indian Digital Personal Data Protection Act 2023.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "consenterIp",
      "consenterIdentifier"
    ],
    "searchableFields": [
      "purposeCode",
      "status"
    ],
    "tags": [
      "dpdp",
      "consent",
      "privacy",
      "compliance",
      "law"
    ],
    "relationships": [
      {
        "sourceTable": "consent_records",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Data fiduciary school."
      },
      {
        "sourceTable": "consent_records",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Consenting data principal."
      }
    ]
  },
  "books": {
    "tableName": "books",
    "drizzleExport": "books",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Library Book",
    "description": "Cataloged physical book accession with ISBN, author, classification, and availability.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "title",
      "author",
      "isbn",
      "accessionNumber"
    ],
    "tags": [
      "library",
      "book",
      "isbn",
      "circulation"
    ],
    "relationships": [
      {
        "sourceTable": "library_books",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Owning library."
      }
    ]
  },
  "fee_queries": {
    "tableName": "fee_queries",
    "drizzleExport": "feeQueries",
    "domain": "FEES_FINANCE",
    "displayName": "Parent Fee Query",
    "description": "Parent-initiated fee disputes, breakdown questions, waiver requests, and SLA tracking.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "message",
      "answer"
    ],
    "searchableFields": [
      "category",
      "status",
      "message"
    ],
    "tags": [
      "fee_query",
      "dispute",
      "finance",
      "workflow",
      "sla",
      "parent"
    ],
    "relationships": [
      {
        "sourceTable": "fee_queries",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school."
      },
      {
        "sourceTable": "fee_queries",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Target student ward."
      },
      {
        "sourceTable": "fee_queries",
        "targetTable": "fee_invoices",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "invoice_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Subject fee invoice."
      },
      {
        "sourceTable": "fee_queries",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "parent_user_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent who raised the query."
      },
      {
        "sourceTable": "fee_queries",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "answered_by_user_id",
        "targetColumn": "id",
        "onDelete": "SET_NULL",
        "description": "Accountant/admin responder."
      },
      {
        "sourceTable": "fee_queries",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "escalated_to_user_id",
        "targetColumn": "id",
        "onDelete": "SET_NULL",
        "description": "Principal or escalation target."
      }
    ]
  },
  "notice_acknowledgments": {
    "tableName": "notice_acknowledgments",
    "drizzleExport": "noticeAcknowledgments",
    "domain": "COMMUNICATION",
    "displayName": "Notice Acknowledgment",
    "description": "Parent user acknowledgments for high-importance circulars and compliance tracking.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "source"
    ],
    "tags": [
      "notice",
      "acknowledgment",
      "circular",
      "communication",
      "parent"
    ],
    "relationships": [
      {
        "sourceTable": "notice_acknowledgments",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school."
      },
      {
        "sourceTable": "notice_acknowledgments",
        "targetTable": "notices",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "notice_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Subject notice."
      },
      {
        "sourceTable": "notice_acknowledgments",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "parent_user_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent user who acknowledged."
      }
    ]
  },
  "bus_boarding_events": {
    "tableName": "bus_boarding_events",
    "drizzleExport": "busBoardingEvents",
    "domain": "TRANSPORT",
    "displayName": "Bus Boarding Event",
    "description": "Append-only driver boarding and alighting scan events for student commute tracking.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "direction"
    ],
    "tags": [
      "transport",
      "bus",
      "boarding",
      "alighting",
      "driver",
      "qr"
    ],
    "relationships": [
      {
        "sourceTable": "bus_boarding_events",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school."
      },
      {
        "sourceTable": "bus_boarding_events",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Boarding student."
      },
      {
        "sourceTable": "bus_boarding_events",
        "targetTable": "routes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "route_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Transport route."
      },
      {
        "sourceTable": "bus_boarding_events",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "scanned_by_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Driver or conductor scanning QR."
      }
    ]
  },
  "stop_change_requests": {
    "tableName": "stop_change_requests",
    "drizzleExport": "stopChangeRequests",
    "domain": "TRANSPORT",
    "displayName": "Stop Change Request",
    "description": "Parent workflow requests for shifting student bus pickup/drop stop.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "reason",
      "status"
    ],
    "tags": [
      "transport",
      "bus",
      "stop",
      "change",
      "parent",
      "workflow"
    ],
    "relationships": [
      {
        "sourceTable": "stop_change_requests",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school."
      },
      {
        "sourceTable": "stop_change_requests",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Subject student."
      },
      {
        "sourceTable": "stop_change_requests",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "parent_user_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent applicant."
      },
      {
        "sourceTable": "stop_change_requests",
        "targetTable": "student_bus_passes",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "bus_pass_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Current bus pass."
      },
      {
        "sourceTable": "stop_change_requests",
        "targetTable": "route_stops",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "requested_stop_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Desired new stop."
      }
    ]
  },
  "student_document_requests": {
    "tableName": "student_document_requests",
    "drizzleExport": "studentDocumentRequests",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Student Document Request",
    "description": "Document submission requests issued to parents with verification and expiry tracking.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "fileKeyEncrypted",
      "verificationNoteEncrypted"
    ],
    "searchableFields": [
      "title",
      "documentType",
      "status"
    ],
    "tags": [
      "students",
      "documents",
      "verification",
      "parent",
      "workflow",
      "dpdp"
    ],
    "relationships": [
      {
        "sourceTable": "student_document_requests",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school."
      },
      {
        "sourceTable": "student_document_requests",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Subject student."
      },
      {
        "sourceTable": "student_document_requests",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "requested_by_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Staff requesting document."
      },
      {
        "sourceTable": "student_document_requests",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "verified_by_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Staff verifying submission."
      }
    ]
  },
  "profile_change_requests": {
    "tableName": "profile_change_requests",
    "drizzleExport": "profileChangeRequests",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Profile Change Request",
    "description": "Parent-initiated demographic, address, or emergency contact change requests pending school approval.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [
      "oldValueEncrypted",
      "newValueEncrypted",
      "decisionReasonEncrypted"
    ],
    "searchableFields": [
      "field",
      "status"
    ],
    "tags": [
      "students",
      "profile",
      "change",
      "demographics",
      "parent",
      "workflow"
    ],
    "relationships": [
      {
        "sourceTable": "profile_change_requests",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school."
      },
      {
        "sourceTable": "profile_change_requests",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Subject student."
      },
      {
        "sourceTable": "profile_change_requests",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "parent_user_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Parent applicant."
      },
      {
        "sourceTable": "profile_change_requests",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "decided_by_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Staff deciding request."
      }
    ]
  },
  "teacher_feed_cards": {
    "tableName": "teacher_feed_cards",
    "drizzleExport": "teacherFeedCards",
    "domain": "COMMUNICATION",
    "displayName": "Teacher Feed Card",
    "description": "Active UI event cards cache table for Teacher PWA with tenant RLS policies and audience targeting.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "cardType",
      "tier"
    ],
    "tags": [
      "teacher",
      "feed",
      "cards",
      "communication",
      "events",
      "pwa"
    ],
    "relationships": [
      {
        "sourceTable": "teacher_feed_cards",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Owning school."
      },
      {
        "sourceTable": "teacher_feed_cards",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "teacher_user_id",
        "targetColumn": "id",
        "onDelete": "CASCADE",
        "description": "Target teacher user."
      }
    ]
  },
  "pii_audit_trails": {
    "tableName": "pii_audit_trails",
    "drizzleExport": "piiAuditTrails",
    "domain": "DPDP_PRIVACY",
    "displayName": "PII Audit Trail",
    "description": "Append-only audit log of content-scanning decisions (BLOCKED/MASKED/CONFIRMED_SEND/LOGGED_ONLY) for DPDP Act 2023 compliance. Stores SHA-256 content hashes and decision metadata only — raw PII and masked PII text are never stored here.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "surface",
      "decision",
      "riskLevel",
      "sourceTable"
    ],
    "tags": [
      "dpdp",
      "pii",
      "audit",
      "compliance",
      "scan",
      "privacy",
      "append-only"
    ],
    "relationships": [
      {
        "sourceTable": "pii_audit_trails",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Owning school tenant."
      },
      {
        "sourceTable": "pii_audit_trails",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "actor_user_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "User whose content triggered the scan."
      }
    ]
  },
  "domain_events": {
    "tableName": "domain_events",
    "drizzleExport": "domainEvents",
    "domain": "CORE_IDENTITY",
    "displayName": "Domain Events",
    "description": "Data entity representing domain events in the CORE_IDENTITY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "core_identity",
      "domain",
      "events"
    ],
    "relationships": []
  },
  "email_verification_tokens": {
    "tableName": "email_verification_tokens",
    "drizzleExport": "emailVerificationTokens",
    "domain": "CORE_IDENTITY",
    "displayName": "Email Verification Tokens",
    "description": "Data entity representing email verification tokens in the CORE_IDENTITY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "core_identity",
      "email",
      "verification",
      "tokens"
    ],
    "relationships": []
  },
  "password_reset_tokens": {
    "tableName": "password_reset_tokens",
    "drizzleExport": "passwordResetTokens",
    "domain": "CORE_IDENTITY",
    "displayName": "Password Reset Tokens",
    "description": "Data entity representing password reset tokens in the CORE_IDENTITY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "core_identity",
      "password",
      "reset",
      "tokens"
    ],
    "relationships": []
  },
  "permissions": {
    "tableName": "permissions",
    "drizzleExport": "permissions",
    "domain": "CORE_IDENTITY",
    "displayName": "Permissions",
    "description": "Data entity representing permissions in the CORE_IDENTITY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "core_identity",
      "permissions"
    ],
    "relationships": []
  },
  "platform_audit_logs": {
    "tableName": "platform_audit_logs",
    "drizzleExport": "platformAuditLogs",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Platform Audit Logs",
    "description": "Data entity representing platform audit logs in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "platform",
      "audit",
      "logs"
    ],
    "relationships": []
  },
  "role_permissions": {
    "tableName": "role_permissions",
    "drizzleExport": "rolePermissions",
    "domain": "CORE_IDENTITY",
    "displayName": "Role Permissions",
    "description": "Data entity representing role permissions in the CORE_IDENTITY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "core_identity",
      "role",
      "permissions"
    ],
    "relationships": []
  },
  "sessions": {
    "tableName": "sessions",
    "drizzleExport": "sessions",
    "domain": "CORE_IDENTITY",
    "displayName": "Sessions",
    "description": "Data entity representing sessions in the CORE_IDENTITY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "core_identity",
      "sessions"
    ],
    "relationships": []
  },
  "super_admin_users": {
    "tableName": "super_admin_users",
    "drizzleExport": "superAdminUsers",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Super Admin Users",
    "description": "Data entity representing super admin users in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "super",
      "admin",
      "users"
    ],
    "relationships": []
  },
  "consent_purposes": {
    "tableName": "consent_purposes",
    "drizzleExport": "consentPurposes",
    "domain": "DPDP_PRIVACY",
    "displayName": "Consent Purposes",
    "description": "Data entity representing consent purposes in the DPDP_PRIVACY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "dpdp_privacy",
      "consent",
      "purposes"
    ],
    "relationships": []
  },
  "data_breach_log": {
    "tableName": "data_breach_log",
    "drizzleExport": "dataBreachLog",
    "domain": "DPDP_PRIVACY",
    "displayName": "Data Breach Log",
    "description": "Data entity representing data breach log in the DPDP_PRIVACY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "dpdp_privacy",
      "data",
      "breach",
      "log"
    ],
    "relationships": []
  },
  "data_retention_policies": {
    "tableName": "data_retention_policies",
    "drizzleExport": "dataRetentionPolicies",
    "domain": "DPDP_PRIVACY",
    "displayName": "Data Retention Policies",
    "description": "Data entity representing data retention policies in the DPDP_PRIVACY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "dpdp_privacy",
      "data",
      "retention",
      "policies"
    ],
    "relationships": []
  },
  "dpdp_grievances": {
    "tableName": "dpdp_grievances",
    "drizzleExport": "dpdpGrievances",
    "domain": "DPDP_PRIVACY",
    "displayName": "Dpdp Grievances",
    "description": "Data entity representing dpdp grievances in the DPDP_PRIVACY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "dpdp_privacy",
      "dpdp",
      "grievances"
    ],
    "relationships": []
  },
  "privacy_notices": {
    "tableName": "privacy_notices",
    "drizzleExport": "privacyNotices",
    "domain": "DPDP_PRIVACY",
    "displayName": "Privacy Notices",
    "description": "Data entity representing privacy notices in the DPDP_PRIVACY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "dpdp_privacy",
      "privacy",
      "notices"
    ],
    "relationships": []
  },
  "rights_requests": {
    "tableName": "rights_requests",
    "drizzleExport": "rightsRequests",
    "domain": "DPDP_PRIVACY",
    "displayName": "Rights Requests",
    "description": "Data entity representing rights requests in the DPDP_PRIVACY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "dpdp_privacy",
      "rights",
      "requests"
    ],
    "relationships": []
  },
  "vendor_register": {
    "tableName": "vendor_register",
    "drizzleExport": "vendorRegister",
    "domain": "DPDP_PRIVACY",
    "displayName": "Vendor Register",
    "description": "Data entity representing vendor register in the DPDP_PRIVACY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "dpdp_privacy",
      "vendor",
      "register"
    ],
    "relationships": []
  },
  "admission_documents": {
    "tableName": "admission_documents",
    "drizzleExport": "admissionDocuments",
    "domain": "ADMISSIONS",
    "displayName": "Admission Documents",
    "description": "Data entity representing admission documents in the ADMISSIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "admissions",
      "admission",
      "documents"
    ],
    "relationships": []
  },
  "admission_workflow_steps": {
    "tableName": "admission_workflow_steps",
    "drizzleExport": "admissionWorkflowSteps",
    "domain": "ADMISSIONS",
    "displayName": "Admission Workflow Steps",
    "description": "Data entity representing admission workflow steps in the ADMISSIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "admissions",
      "admission",
      "workflow",
      "steps"
    ],
    "relationships": []
  },
  "waitlist": {
    "tableName": "waitlist",
    "drizzleExport": "waitlist",
    "domain": "ADMISSIONS",
    "displayName": "Waitlist",
    "description": "Data entity representing waitlist in the ADMISSIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "admissions",
      "waitlist"
    ],
    "relationships": []
  },
  "alumni": {
    "tableName": "alumni",
    "drizzleExport": "alumni",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Alumni",
    "description": "Data entity representing alumni in the STUDENTS_LIFECYCLE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "students_lifecycle",
      "alumni"
    ],
    "relationships": []
  },
  "student_documents": {
    "tableName": "student_documents",
    "drizzleExport": "studentDocuments",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Student Documents",
    "description": "Data entity representing student documents in the STUDENTS_LIFECYCLE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "students_lifecycle",
      "student",
      "documents"
    ],
    "relationships": []
  },
  "student_family_members": {
    "tableName": "student_family_members",
    "drizzleExport": "studentFamilyMembers",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Student Family Members",
    "description": "Data entity representing student family members in the STUDENTS_LIFECYCLE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "students_lifecycle",
      "student",
      "family",
      "members"
    ],
    "relationships": []
  },
  "student_medical_records": {
    "tableName": "student_medical_records",
    "drizzleExport": "studentMedicalRecords",
    "domain": "STUDENTS_LIFECYCLE",
    "displayName": "Student Medical Records",
    "description": "Data entity representing student medical records in the STUDENTS_LIFECYCLE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "students_lifecycle",
      "student",
      "medical",
      "records"
    ],
    "relationships": []
  },
  "academic_calendar_events": {
    "tableName": "academic_calendar_events",
    "drizzleExport": "academicCalendarEvents",
    "domain": "ACADEMICS",
    "displayName": "Academic Calendar Events",
    "description": "Data entity representing academic calendar events in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "academic",
      "calendar",
      "events"
    ],
    "relationships": []
  },
  "academic_terms": {
    "tableName": "academic_terms",
    "drizzleExport": "academicTerms",
    "domain": "ACADEMICS",
    "displayName": "Academic Terms",
    "description": "Data entity representing academic terms in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "academic",
      "terms"
    ],
    "relationships": []
  },
  "assessments": {
    "tableName": "assessments",
    "drizzleExport": "assessments",
    "domain": "ACADEMICS",
    "displayName": "Assessments",
    "description": "Data entity representing assessments in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "assessments"
    ],
    "relationships": []
  },
  "assignment_submissions": {
    "tableName": "assignment_submissions",
    "drizzleExport": "assignmentSubmissions",
    "domain": "ACADEMICS",
    "displayName": "Assignment Submissions",
    "description": "Data entity representing assignment submissions in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "assignment",
      "submissions"
    ],
    "relationships": []
  },
  "assignments": {
    "tableName": "assignments",
    "drizzleExport": "assignments",
    "domain": "ACADEMICS",
    "displayName": "Assignments",
    "description": "Data entity representing assignments in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "assignments"
    ],
    "relationships": []
  },
  "bell_schedule": {
    "tableName": "bell_schedule",
    "drizzleExport": "bellSchedule",
    "domain": "ACADEMICS",
    "displayName": "Bell Schedule",
    "description": "Data entity representing bell schedule in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "bell",
      "schedule"
    ],
    "relationships": []
  },
  "class_subjects": {
    "tableName": "class_subjects",
    "drizzleExport": "classSubjects",
    "domain": "ACADEMICS",
    "displayName": "Class Subjects",
    "description": "Data entity representing class subjects in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "class",
      "subjects"
    ],
    "relationships": []
  },
  "lesson_plans": {
    "tableName": "lesson_plans",
    "drizzleExport": "lessonPlans",
    "domain": "ACADEMICS",
    "displayName": "Lesson Plans",
    "description": "Data entity representing lesson plans in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "lesson",
      "plans"
    ],
    "relationships": []
  },
  "syllabus_chapters": {
    "tableName": "syllabus_chapters",
    "drizzleExport": "syllabusChapters",
    "domain": "ACADEMICS",
    "displayName": "Syllabus Chapters",
    "description": "Data entity representing syllabus chapters in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "syllabus",
      "chapters"
    ],
    "relationships": []
  },
  "syllabus_topics": {
    "tableName": "syllabus_topics",
    "drizzleExport": "syllabusTopics",
    "domain": "ACADEMICS",
    "displayName": "Syllabus Topics",
    "description": "Data entity representing syllabus topics in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "syllabus",
      "topics"
    ],
    "relationships": []
  },
  "syllabus_units": {
    "tableName": "syllabus_units",
    "drizzleExport": "syllabusUnits",
    "domain": "ACADEMICS",
    "displayName": "Syllabus Units",
    "description": "Data entity representing syllabus units in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "syllabus",
      "units"
    ],
    "relationships": []
  },
  "timetable_periods": {
    "tableName": "timetable_periods",
    "drizzleExport": "timetablePeriods",
    "domain": "ACADEMICS",
    "displayName": "Timetable Periods",
    "description": "Data entity representing timetable periods in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "timetable",
      "periods"
    ],
    "relationships": []
  },
  "timetable_substitutions": {
    "tableName": "timetable_substitutions",
    "drizzleExport": "timetableSubstitutions",
    "domain": "ACADEMICS",
    "displayName": "Timetable Substitutions",
    "description": "Data entity representing timetable substitutions in the ACADEMICS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "academics",
      "timetable",
      "substitutions"
    ],
    "relationships": []
  },
  "attendance_notifications": {
    "tableName": "attendance_notifications",
    "drizzleExport": "attendanceNotifications",
    "domain": "ATTENDANCE",
    "displayName": "Attendance Notifications",
    "description": "Data entity representing attendance notifications in the ATTENDANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "attendance",
      "attendance",
      "notifications"
    ],
    "relationships": []
  },
  "staff_attendance": {
    "tableName": "staff_attendance",
    "drizzleExport": "staffAttendance",
    "domain": "ATTENDANCE",
    "displayName": "Staff Attendance",
    "description": "Data entity representing staff attendance in the ATTENDANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "attendance",
      "staff",
      "attendance"
    ],
    "relationships": []
  },
  "admit_card_templates": {
    "tableName": "admit_card_templates",
    "drizzleExport": "admitCardTemplates",
    "domain": "EXAMINATIONS",
    "displayName": "Admit Card Templates",
    "description": "Data entity representing admit card templates in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "admit",
      "card",
      "templates"
    ],
    "relationships": []
  },
  "certificates": {
    "tableName": "certificates",
    "drizzleExport": "certificates",
    "domain": "EXAMINATIONS",
    "displayName": "Certificates",
    "description": "Data entity representing certificates in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "certificates"
    ],
    "relationships": []
  },
  "exam_admit_card_holds": {
    "tableName": "exam_admit_card_holds",
    "drizzleExport": "examAdmitCardHolds",
    "domain": "EXAMINATIONS",
    "displayName": "Exam Admit Card Holds",
    "description": "Data entity representing exam admit card holds in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "exam",
      "admit",
      "card",
      "holds"
    ],
    "relationships": []
  },
  "exam_mark_distributions": {
    "tableName": "exam_mark_distributions",
    "drizzleExport": "examMarkDistributions",
    "domain": "EXAMINATIONS",
    "displayName": "Exam Mark Distributions",
    "description": "Data entity representing exam mark distributions in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "exam",
      "mark",
      "distributions"
    ],
    "relationships": []
  },
  "grade_rules": {
    "tableName": "grade_rules",
    "drizzleExport": "gradeRules",
    "domain": "EXAMINATIONS",
    "displayName": "Grade Rules",
    "description": "Data entity representing grade rules in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "grade",
      "rules"
    ],
    "relationships": []
  },
  "medical_exemptions": {
    "tableName": "medical_exemptions",
    "drizzleExport": "medicalExemptions",
    "domain": "EXAMINATIONS",
    "displayName": "Medical Exemptions",
    "description": "Data entity representing medical exemptions in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "medical",
      "exemptions"
    ],
    "relationships": []
  },
  "public_result_lookups": {
    "tableName": "public_result_lookups",
    "drizzleExport": "publicResultLookups",
    "domain": "EXAMINATIONS",
    "displayName": "Public Result Lookups",
    "description": "Data entity representing public result lookups in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "public",
      "result",
      "lookups"
    ],
    "relationships": []
  },
  "report_card_jobs": {
    "tableName": "report_card_jobs",
    "drizzleExport": "reportCardJobs",
    "domain": "EXAMINATIONS",
    "displayName": "Report Card Jobs",
    "description": "Data entity representing report card jobs in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "report",
      "card",
      "jobs"
    ],
    "relationships": []
  },
  "report_cards": {
    "tableName": "report_cards",
    "drizzleExport": "reportCards",
    "domain": "EXAMINATIONS",
    "displayName": "Report Cards",
    "description": "Data entity representing report cards in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "report",
      "cards"
    ],
    "relationships": []
  },
  "result_holds": {
    "tableName": "result_holds",
    "drizzleExport": "resultHolds",
    "domain": "EXAMINATIONS",
    "displayName": "Result Holds",
    "description": "Data entity representing result holds in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "result",
      "holds"
    ],
    "relationships": []
  },
  "result_settings": {
    "tableName": "result_settings",
    "drizzleExport": "resultSettings",
    "domain": "EXAMINATIONS",
    "displayName": "Result Settings",
    "description": "Data entity representing result settings in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "result",
      "settings"
    ],
    "relationships": []
  },
  "uploaded_marksheets": {
    "tableName": "uploaded_marksheets",
    "drizzleExport": "uploadedMarksheets",
    "domain": "EXAMINATIONS",
    "displayName": "Uploaded Marksheets",
    "description": "Data entity representing uploaded marksheets in the EXAMINATIONS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "examinations",
      "uploaded",
      "marksheets"
    ],
    "relationships": []
  },
  "usage_events": {
    "tableName": "usage_events",
    "drizzleExport": "usageEvents",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Usage Events",
    "description": "Data entity representing usage events in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "usage",
      "events"
    ],
    "relationships": []
  },
  "fee_audit_logs": {
    "tableName": "fee_audit_logs",
    "drizzleExport": "feeAuditLogs",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Audit Logs",
    "description": "Data entity representing fee audit logs in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "audit",
      "logs"
    ],
    "relationships": []
  },
  "fee_carry_forwards": {
    "tableName": "fee_carry_forwards",
    "drizzleExport": "feeCarryForwards",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Carry Forwards",
    "description": "Data entity representing fee carry forwards in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "carry",
      "forwards"
    ],
    "relationships": []
  },
  "fee_challans": {
    "tableName": "fee_challans",
    "drizzleExport": "feeChallans",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Challans",
    "description": "Data entity representing fee challans in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "challans"
    ],
    "relationships": []
  },
  "fee_concessions": {
    "tableName": "fee_concessions",
    "drizzleExport": "feeConcessions",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Concessions",
    "description": "Data entity representing fee concessions in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "concessions"
    ],
    "relationships": []
  },
  "fee_discounts": {
    "tableName": "fee_discounts",
    "drizzleExport": "feeDiscounts",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Discounts",
    "description": "Data entity representing fee discounts in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "discounts"
    ],
    "relationships": []
  },
  "fee_due_slips": {
    "tableName": "fee_due_slips",
    "drizzleExport": "feeDueSlips",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Due Slips",
    "description": "Data entity representing fee due slips in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "due",
      "slips"
    ],
    "relationships": []
  },
  "fee_group_heads": {
    "tableName": "fee_group_heads",
    "drizzleExport": "feeGroupHeads",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Group Heads",
    "description": "Data entity representing fee group heads in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "group",
      "heads"
    ],
    "relationships": []
  },
  "fee_groups": {
    "tableName": "fee_groups",
    "drizzleExport": "feeGroups",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Groups",
    "description": "Data entity representing fee groups in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "groups"
    ],
    "relationships": []
  },
  "fee_refunds": {
    "tableName": "fee_refunds",
    "drizzleExport": "feeRefunds",
    "domain": "FEES_FINANCE",
    "displayName": "Fee Refunds",
    "description": "Data entity representing fee refunds in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "fee",
      "refunds"
    ],
    "relationships": []
  },
  "payment_gateway_logs": {
    "tableName": "payment_gateway_logs",
    "drizzleExport": "paymentGatewayLogs",
    "domain": "FEES_FINANCE",
    "displayName": "Payment Gateway Logs",
    "description": "Data entity representing payment gateway logs in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "payment",
      "gateway",
      "logs"
    ],
    "relationships": []
  },
  "account_ledger_transactions": {
    "tableName": "account_ledger_transactions",
    "drizzleExport": "accountLedgerTransactions",
    "domain": "FEES_FINANCE",
    "displayName": "Account Ledger Transactions",
    "description": "Data entity representing account ledger transactions in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "account",
      "ledger",
      "transactions"
    ],
    "relationships": []
  },
  "bank_accounts": {
    "tableName": "bank_accounts",
    "drizzleExport": "bankAccounts",
    "domain": "FEES_FINANCE",
    "displayName": "Bank Accounts",
    "description": "Data entity representing bank accounts in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "bank",
      "accounts"
    ],
    "relationships": []
  },
  "chart_of_accounts": {
    "tableName": "chart_of_accounts",
    "drizzleExport": "chartOfAccounts",
    "domain": "FEES_FINANCE",
    "displayName": "Chart Of Accounts",
    "description": "Data entity representing chart of accounts in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "chart",
      "of",
      "accounts"
    ],
    "relationships": []
  },
  "expense_heads": {
    "tableName": "expense_heads",
    "drizzleExport": "expenseHeads",
    "domain": "FEES_FINANCE",
    "displayName": "Expense Heads",
    "description": "Data entity representing expense heads in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "expense",
      "heads"
    ],
    "relationships": []
  },
  "expense_vouchers": {
    "tableName": "expense_vouchers",
    "drizzleExport": "expenseVouchers",
    "domain": "FEES_FINANCE",
    "displayName": "Expense Vouchers",
    "description": "Data entity representing expense vouchers in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "expense",
      "vouchers"
    ],
    "relationships": []
  },
  "income_heads": {
    "tableName": "income_heads",
    "drizzleExport": "incomeHeads",
    "domain": "FEES_FINANCE",
    "displayName": "Income Heads",
    "description": "Data entity representing income heads in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "income",
      "heads"
    ],
    "relationships": []
  },
  "income_vouchers": {
    "tableName": "income_vouchers",
    "drizzleExport": "incomeVouchers",
    "domain": "FEES_FINANCE",
    "displayName": "Income Vouchers",
    "description": "Data entity representing income vouchers in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "income",
      "vouchers"
    ],
    "relationships": []
  },
  "departments": {
    "tableName": "departments",
    "drizzleExport": "departments",
    "domain": "HR_STAFF",
    "displayName": "Departments",
    "description": "Data entity representing departments in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "departments"
    ],
    "relationships": []
  },
  "designations": {
    "tableName": "designations",
    "drizzleExport": "designations",
    "domain": "HR_STAFF",
    "displayName": "Designations",
    "description": "Data entity representing designations in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "designations"
    ],
    "relationships": []
  },
  "leave_balances": {
    "tableName": "leave_balances",
    "drizzleExport": "leaveBalances",
    "domain": "HR_STAFF",
    "displayName": "Leave Balances",
    "description": "Data entity representing leave balances in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "leave",
      "balances"
    ],
    "relationships": []
  },
  "leave_requests": {
    "tableName": "leave_requests",
    "drizzleExport": "leaveRequests",
    "domain": "HR_STAFF",
    "displayName": "Leave Requests",
    "description": "Data entity representing leave requests in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "leave",
      "requests"
    ],
    "relationships": []
  },
  "leave_types": {
    "tableName": "leave_types",
    "drizzleExport": "leaveTypes",
    "domain": "HR_STAFF",
    "displayName": "Leave Types",
    "description": "Data entity representing leave types in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "leave",
      "types"
    ],
    "relationships": []
  },
  "payroll_runs": {
    "tableName": "payroll_runs",
    "drizzleExport": "payrollRuns",
    "domain": "HR_STAFF",
    "displayName": "Payroll Runs",
    "description": "Data entity representing payroll runs in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "payroll",
      "runs"
    ],
    "relationships": []
  },
  "payslips": {
    "tableName": "payslips",
    "drizzleExport": "payslips",
    "domain": "HR_STAFF",
    "displayName": "Payslips",
    "description": "Data entity representing payslips in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "payslips"
    ],
    "relationships": []
  },
  "salary_components": {
    "tableName": "salary_components",
    "drizzleExport": "salaryComponents",
    "domain": "HR_STAFF",
    "displayName": "Salary Components",
    "description": "Data entity representing salary components in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "salary",
      "components"
    ],
    "relationships": []
  },
  "salary_templates": {
    "tableName": "salary_templates",
    "drizzleExport": "salaryTemplates",
    "domain": "HR_STAFF",
    "displayName": "Salary Templates",
    "description": "Data entity representing salary templates in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "salary",
      "templates"
    ],
    "relationships": []
  },
  "staff_documents": {
    "tableName": "staff_documents",
    "drizzleExport": "staffDocuments",
    "domain": "HR_STAFF",
    "displayName": "Staff Documents",
    "description": "Data entity representing staff documents in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "staff",
      "documents"
    ],
    "relationships": []
  },
  "staff_loans": {
    "tableName": "staff_loans",
    "drizzleExport": "staffLoans",
    "domain": "HR_STAFF",
    "displayName": "Staff Loans",
    "description": "Data entity representing staff loans in the HR_STAFF domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "hr_staff",
      "staff",
      "loans"
    ],
    "relationships": []
  },
  "book_copies": {
    "tableName": "book_copies",
    "drizzleExport": "bookCopies",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Book Copies",
    "description": "Data entity representing book copies in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "book",
      "copies"
    ],
    "relationships": []
  },
  "book_fines": {
    "tableName": "book_fines",
    "drizzleExport": "bookFines",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Book Fines",
    "description": "Data entity representing book fines in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "book",
      "fines"
    ],
    "relationships": []
  },
  "book_issues": {
    "tableName": "book_issues",
    "drizzleExport": "bookIssues",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Book Issues",
    "description": "Data entity representing book issues in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "book",
      "issues"
    ],
    "relationships": []
  },
  "library_members": {
    "tableName": "library_members",
    "drizzleExport": "libraryMembers",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Library Members",
    "description": "Data entity representing library members in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "library",
      "members"
    ],
    "relationships": []
  },
  "gps_pings": {
    "tableName": "gps_pings",
    "drizzleExport": "gpsPings",
    "domain": "TRANSPORT",
    "displayName": "Gps Pings",
    "description": "Data entity representing gps pings in the TRANSPORT domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "transport",
      "gps",
      "pings"
    ],
    "relationships": []
  },
  "student_bus_passes": {
    "tableName": "student_bus_passes",
    "drizzleExport": "studentBusPasses",
    "domain": "TRANSPORT",
    "displayName": "Student Bus Passes",
    "description": "Data entity representing student bus passes in the TRANSPORT domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "transport",
      "student",
      "bus",
      "passes"
    ],
    "relationships": []
  },
  "vehicles": {
    "tableName": "vehicles",
    "drizzleExport": "vehicles",
    "domain": "TRANSPORT",
    "displayName": "Vehicles",
    "description": "Data entity representing vehicles in the TRANSPORT domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "transport",
      "vehicles"
    ],
    "relationships": []
  },
  "drivers": {
    "tableName": "drivers",
    "drizzleExport": "drivers",
    "domain": "TRANSPORT",
    "displayName": "Drivers",
    "description": "Data entity representing drivers in the TRANSPORT domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "transport",
      "drivers"
    ],
    "relationships": []
  },
  "email_logs": {
    "tableName": "email_logs",
    "drizzleExport": "emailLogs",
    "domain": "COMMUNICATION",
    "displayName": "Email Logs",
    "description": "Data entity representing email logs in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "email",
      "logs"
    ],
    "relationships": []
  },
  "events": {
    "tableName": "events",
    "drizzleExport": "events",
    "domain": "COMMUNICATION",
    "displayName": "Events",
    "description": "Data entity representing events in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "events"
    ],
    "relationships": []
  },
  "parent_feed_cards": {
    "tableName": "parent_feed_cards",
    "drizzleExport": "parentFeedCards",
    "domain": "COMMUNICATION",
    "displayName": "Parent Feed Cards",
    "description": "Data entity representing parent feed cards in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "parent",
      "feed",
      "cards"
    ],
    "relationships": []
  },
  "parent_notification_preferences": {
    "tableName": "parent_notification_preferences",
    "drizzleExport": "parentNotificationPreferences",
    "domain": "COMMUNICATION",
    "displayName": "Parent Notification Preferences",
    "description": "Data entity representing parent notification preferences in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "parent",
      "notification",
      "preferences"
    ],
    "relationships": []
  },
  "parent_teacher_messages": {
    "tableName": "parent_teacher_messages",
    "drizzleExport": "parentTeacherMessages",
    "domain": "COMMUNICATION",
    "displayName": "Parent Teacher Messages",
    "description": "Data entity representing parent teacher messages in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "parent",
      "teacher",
      "messages"
    ],
    "relationships": []
  },
  "push_notification_logs": {
    "tableName": "push_notification_logs",
    "drizzleExport": "pushNotificationLogs",
    "domain": "COMMUNICATION",
    "displayName": "Push Notification Logs",
    "description": "Data entity representing push notification logs in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "push",
      "notification",
      "logs"
    ],
    "relationships": []
  },
  "sms_logs": {
    "tableName": "sms_logs",
    "drizzleExport": "smsLogs",
    "domain": "COMMUNICATION",
    "displayName": "Sms Logs",
    "description": "Data entity representing sms logs in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "sms",
      "logs"
    ],
    "relationships": []
  },
  "user_push_subscriptions": {
    "tableName": "user_push_subscriptions",
    "drizzleExport": "userPushSubscriptions",
    "domain": "COMMUNICATION",
    "displayName": "User Push Subscriptions",
    "description": "Data entity representing user push subscriptions in the COMMUNICATION domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "communication",
      "user",
      "push",
      "subscriptions"
    ],
    "relationships": []
  },
  "asset_assignments": {
    "tableName": "asset_assignments",
    "drizzleExport": "assetAssignments",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Asset Assignments",
    "description": "Data entity representing asset assignments in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "asset",
      "assignments"
    ],
    "relationships": []
  },
  "assets": {
    "tableName": "assets",
    "drizzleExport": "assets",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Assets",
    "description": "Data entity representing assets in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "assets"
    ],
    "relationships": []
  },
  "inventory_items": {
    "tableName": "inventory_items",
    "drizzleExport": "inventoryItems",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Inventory Items",
    "description": "Data entity representing inventory items in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "inventory",
      "items"
    ],
    "relationships": []
  },
  "purchase_orders": {
    "tableName": "purchase_orders",
    "drizzleExport": "purchaseOrders",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Purchase Orders",
    "description": "Data entity representing purchase orders in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "purchase",
      "orders"
    ],
    "relationships": []
  },
  "stock_movements": {
    "tableName": "stock_movements",
    "drizzleExport": "stockMovements",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Stock Movements",
    "description": "Data entity representing stock movements in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "stock",
      "movements"
    ],
    "relationships": []
  },
  "hostel_allocations": {
    "tableName": "hostel_allocations",
    "drizzleExport": "hostelAllocations",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Hostel Allocations",
    "description": "Data entity representing hostel allocations in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "hostel",
      "allocations"
    ],
    "relationships": []
  },
  "hostel_rooms": {
    "tableName": "hostel_rooms",
    "drizzleExport": "hostelRooms",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Hostel Rooms",
    "description": "Data entity representing hostel rooms in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "hostel",
      "rooms"
    ],
    "relationships": []
  },
  "visitor_logs": {
    "tableName": "visitor_logs",
    "drizzleExport": "visitorLogs",
    "domain": "INVENTORY_FACILITIES",
    "displayName": "Visitor Logs",
    "description": "Data entity representing visitor logs in the INVENTORY_FACILITIES domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "inventory_facilities",
      "visitor",
      "logs"
    ],
    "relationships": []
  },
  "persons": {
    "tableName": "persons",
    "drizzleExport": "persons",
    "domain": "CORE_IDENTITY",
    "displayName": "Persons",
    "description": "Data entity representing persons in the CORE_IDENTITY domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "core_identity",
      "persons"
    ],
    "relationships": []
  },
  "global_template_academic_years": {
    "tableName": "global_template_academic_years",
    "drizzleExport": "globalTemplateAcademicYears",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Academic Years",
    "description": "Data entity representing global template academic years in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "academic",
      "years"
    ],
    "relationships": []
  },
  "global_template_classes": {
    "tableName": "global_template_classes",
    "drizzleExport": "globalTemplateClasses",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Classes",
    "description": "Data entity representing global template classes in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "classes"
    ],
    "relationships": []
  },
  "global_template_fee_heads": {
    "tableName": "global_template_fee_heads",
    "drizzleExport": "globalTemplateFeeHeads",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Fee Heads",
    "description": "Data entity representing global template fee heads in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "fee",
      "heads"
    ],
    "relationships": []
  },
  "global_template_holidays": {
    "tableName": "global_template_holidays",
    "drizzleExport": "globalTemplateHolidays",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Holidays",
    "description": "Data entity representing global template holidays in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "holidays"
    ],
    "relationships": []
  },
  "global_template_profiles": {
    "tableName": "global_template_profiles",
    "drizzleExport": "globalTemplateProfiles",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Profiles",
    "description": "Data entity representing global template profiles in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "profiles"
    ],
    "relationships": []
  },
  "global_template_roles": {
    "tableName": "global_template_roles",
    "drizzleExport": "globalTemplateRoles",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Roles",
    "description": "Data entity representing global template roles in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "roles"
    ],
    "relationships": []
  },
  "global_template_salary_grades": {
    "tableName": "global_template_salary_grades",
    "drizzleExport": "globalTemplateSalaryGrades",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Salary Grades",
    "description": "Data entity representing global template salary grades in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "salary",
      "grades"
    ],
    "relationships": []
  },
  "global_template_subjects": {
    "tableName": "global_template_subjects",
    "drizzleExport": "globalTemplateSubjects",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Subjects",
    "description": "Data entity representing global template subjects in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "subjects"
    ],
    "relationships": []
  },
  "global_template_timetable": {
    "tableName": "global_template_timetable",
    "drizzleExport": "globalTemplateTimetable",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Global Template Timetable",
    "description": "Data entity representing global template timetable in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "global",
      "template",
      "timetable"
    ],
    "relationships": []
  },
  "impersonation_sessions": {
    "tableName": "impersonation_sessions",
    "drizzleExport": "impersonationSessions",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Impersonation Sessions",
    "description": "Data entity representing impersonation sessions in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "impersonation",
      "sessions"
    ],
    "relationships": []
  },
  "platform_announcement_reads": {
    "tableName": "platform_announcement_reads",
    "drizzleExport": "platformAnnouncementReads",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Platform Announcement Reads",
    "description": "Data entity representing platform announcement reads in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "platform",
      "announcement",
      "reads"
    ],
    "relationships": []
  },
  "platform_announcements": {
    "tableName": "platform_announcements",
    "drizzleExport": "platformAnnouncements",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Platform Announcements",
    "description": "Data entity representing platform announcements in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "platform",
      "announcements"
    ],
    "relationships": []
  },
  "worker_heartbeats": {
    "tableName": "worker_heartbeats",
    "drizzleExport": "workerHeartbeats",
    "domain": "SUPERADMIN_OPS",
    "displayName": "Worker Heartbeats",
    "description": "Data entity representing worker heartbeats in the SUPERADMIN_OPS domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "superadmin_ops",
      "worker",
      "heartbeats"
    ],
    "relationships": []
  },
  "student_fee_advance_allocations": {
    "tableName": "student_fee_advance_allocations",
    "drizzleExport": "studentFeeAdvanceAllocations",
    "domain": "FEES_FINANCE",
    "displayName": "Student Fee Advance Allocations",
    "description": "Data entity representing student fee advance allocations in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "student",
      "fee",
      "advance",
      "allocations"
    ],
    "relationships": []
  },
  "student_fee_advances": {
    "tableName": "student_fee_advances",
    "drizzleExport": "studentFeeAdvances",
    "domain": "FEES_FINANCE",
    "displayName": "Student Fee Advances",
    "description": "Data entity representing student fee advances in the FEES_FINANCE domain.",
    "primaryKey": [
      "id"
    ],
    "isTenantScoped": false,
    "piiColumns": [],
    "searchableFields": [
      "id"
    ],
    "tags": [
      "fees_finance",
      "student",
      "fee",
      "advances"
    ],
    "relationships": []
  },
  "class_teacher_assignments": {
    "tableName": "class_teacher_assignments",
    "drizzleExport": "classTeacherAssignments",
    "domain": "ACADEMICS",
    "displayName": "Class Teacher Assignments",
    "description": "Administrative class teacher allocations with academic year scoping, effective dating, and strict 1-to-1 invariants.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "notes"
    ],
    "tags": [
      "academics",
      "class_teacher",
      "homeroom",
      "allocations"
    ],
    "relationships": [
      {
        "sourceTable": "class_teacher_assignments",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Assignment belongs to school tenant."
      },
      {
        "sourceTable": "class_teacher_assignments",
        "targetTable": "academic_years",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "academic_year_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Assignment is scoped to an academic year."
      },
      {
        "sourceTable": "class_teacher_assignments",
        "targetTable": "sections",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "section_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Assignment designates class teacher for a section."
      },
      {
        "sourceTable": "class_teacher_assignments",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "teacher_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Assignment designates teacher user account."
      }
    ]
  },
  "homeroom_report_remarks": {
    "tableName": "homeroom_report_remarks",
    "drizzleExport": "homeroomReportRemarks",
    "domain": "ACADEMICS",
    "displayName": "Homeroom Report Remarks",
    "description": "Class teacher holistic report card remarks, conduct evaluations, and sign-offs for homeroom students.",
    "primaryKey": [
      "id"
    ],
    "tenantKey": "schoolId",
    "isTenantScoped": true,
    "piiColumns": [],
    "searchableFields": [
      "remarks"
    ],
    "tags": [
      "academics",
      "homeroom",
      "report_cards",
      "remarks",
      "conduct"
    ],
    "relationships": [
      {
        "sourceTable": "homeroom_report_remarks",
        "targetTable": "schools",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "school_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Remarks belong to school tenant."
      },
      {
        "sourceTable": "homeroom_report_remarks",
        "targetTable": "students",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "student_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Remarks apply to student."
      },
      {
        "sourceTable": "homeroom_report_remarks",
        "targetTable": "academic_years",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "academic_year_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Remarks are scoped to academic year."
      },
      {
        "sourceTable": "homeroom_report_remarks",
        "targetTable": "academic_terms",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "academic_term_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Remarks apply to academic term."
      },
      {
        "sourceTable": "homeroom_report_remarks",
        "targetTable": "users",
        "relationType": "MANY_TO_ONE",
        "sourceColumn": "signed_off_by_id",
        "targetColumn": "id",
        "onDelete": "RESTRICT",
        "description": "Remarks signed off by class teacher."
      }
    ]
  }
};
