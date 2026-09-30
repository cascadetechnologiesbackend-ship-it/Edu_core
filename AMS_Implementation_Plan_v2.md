# Academic Management System — Implementation Plan v2
**SchoolMitra ERP** | Incorporating all 17 directive corrections

> [!IMPORTANT]
> This plan supersedes the previous analysis report. Every section below is a binding directive — not a suggestion.
> Scope: AMS-only. Do **not** touch non-AMS modules, auth, global sidebar, DPDP logger, or tenant architecture.

---

## Context Hierarchy (Rule #14 — used everywhere)

```
Tenant (schoolId from session)
  └── Academic Year (active year auto-resolved server-side)
        └── Class
              └── Section
                    └── Subject (classSubjectId)
                          └── Teacher (per section, not class-wide)
```

Every route and server action must resolve context from **left to right**. Never request context that was already established by a parent route.

---

## Route Map

```
/academics                              ← AMS Hub (existing, enhanced)
/academics/setup/calendar               ← NEW: Academic Calendar
/academics/classes/[classId]            ← Class Hub (existing page.tsx, enhanced)
/academics/classes/[classId]/subjects/[classSubjectId]   ← NEW: Subject Workspace
/academics/reports                      ← NEW: Academic Reports
```

---

## Phase 1 — Schema Additions (database/src/schema/academics.ts)

All additions are **AMS-scoped only**. Append to the existing file; do not restructure.

### 1.1 New Enums

```typescript
// NEW: Calendar event types
export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "HOLIDAY",
  "EVENT",
  "EXAM",
  "PTM",
  "SPORTS",
  "CULTURAL",
  "WORKING_SATURDAY",
  "VACATION",
]);

// NEW: Substitution request status
export const substitutionStatusEnum = pgEnum("substitution_status", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
]);

// NEW: Assessment types
export const assessmentTypeEnum = pgEnum("assessment_type", [
  "UNIT_TEST",
  "MIDTERM",
  "FINAL",
  "QUIZ",
  "PRACTICAL",
  "PROJECT",
  "FA",    // Formative Assessment (CBSE)
  "SA",    // Summative Assessment (CBSE)
]);

// NEW: Assessment status
export const assessmentStatusEnum = pgEnum("assessment_status", [
  "DRAFT",
  "SCHEDULED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
```

### 1.2 New Tables

#### `academic_terms`
```typescript
// Scoped to academic year. No global calendar architecture.
export const academicTerms = pgTable(
  "academic_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
    name: text("name").notNull(),           // "Term 1", "Quarter 2", "Half-Yearly"
    startDate: text("start_date").notNull(), // ISO date string "YYYY-MM-DD"
    endDate: text("end_date").notNull(),
    sortOrder: integer("sort_order").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolYearIdx: index("academic_terms_school_year_idx").on(t.schoolId, t.academicYearId),
    termNameUnique: unique("academic_terms_name_unique").on(t.schoolId, t.academicYearId, t.name),
  }),
);
```

#### `academic_calendar_events` (AMS-only — Rule #1)
```typescript
export const academicCalendarEvents = pgTable(
  "academic_calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "restrict" }), // nullable
    title: text("title").notNull(),
    eventType: calendarEventTypeEnum("event_type").notNull(),
    startDate: text("start_date").notNull(), // "YYYY-MM-DD"
    endDate: text("end_date").notNull(),
    description: text("description"),
    isWorkingDay: boolean("is_working_day").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolYearIdx: index("calendar_events_school_year_idx").on(t.schoolId, t.academicYearId),
    startDateIdx: index("calendar_events_start_date_idx").on(t.startDate),
  }),
);
```

#### `bell_schedule` — Configurable periods (Rule #2)
```typescript
// Replaces hardcoded 8-period / fixed-time assumption in TimetableTab.tsx
export const bellSchedule = pgTable(
  "bell_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    periodNumber: integer("period_number").notNull(), // 1, 2, 3...
    name: text("name").notNull(),                    // "Period 1", "Lunch", "Assembly"
    startTime: time("start_time").notNull(),          // "08:00"
    endTime: time("end_time").notNull(),              // "08:45"
    periodType: periodTypeEnum("period_type").notNull().default("REGULAR"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({
    schoolPeriodUnique: unique("bell_schedule_school_period_unique").on(t.schoolId, t.periodNumber),
    schoolIdx: index("bell_schedule_school_idx").on(t.schoolId),
  }),
);
```

#### `timetable_substitutions` — Rule #3
```typescript
export const timetableSubstitutions = pgTable(
  "timetable_substitutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
    date: text("date").notNull(),                        // "YYYY-MM-DD" (specific day)
    timetablePeriodId: uuid("timetable_period_id").notNull().references(() => timetablePeriods.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "restrict" }),
    originalTeacherId: uuid("original_teacher_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    substituteTeacherId: uuid("substitute_teacher_id").references(() => users.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "restrict" }),
    reason: text("reason"),
    status: substitutionStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dateSectionPeriodUnique: unique("substitutions_date_section_period_unique").on(
      t.date, t.sectionId, t.timetablePeriodId,
    ),
    schoolDateIdx: index("substitutions_school_date_idx").on(t.schoolId, t.date),
    originalTeacherIdx: index("substitutions_original_teacher_idx").on(t.originalTeacherId),
  }),
);
```

#### `section_subject_teachers` — Section-level teacher allocation (Rules #10, #14)
```typescript
// Resolves class_subjects teacher being class-wide (not section-specific).
// class_subjects.assignedTeacherId becomes the class-level DEFAULT.
// This table overrides per section, and preserves teacher change history.
export const sectionSubjectTeachers = pgTable(
  "section_subject_teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "restrict" }),
    teacherId: uuid("teacher_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    effectiveFrom: text("effective_from").notNull(),  // "YYYY-MM-DD"
    effectiveTo: text("effective_to"),                // null = currently active
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Only one active allocation per section+subject at a time
    activeSectionSubjectUnique: unique("section_subject_teachers_active_unique").on(
      t.classSubjectId, t.sectionId, t.effectiveTo, // effectiveTo=null = active
    ),
    classSubjectIdx: index("sst_class_subject_idx").on(t.classSubjectId),
    sectionIdx: index("sst_section_idx").on(t.sectionId),
    teacherIdx: index("sst_teacher_idx").on(t.teacherId),
  }),
);
```

#### `syllabus_units` — Curriculum tracker (Rule #8)
```typescript
export const syllabusUnits = pgTable(
  "syllabus_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id, { onDelete: "restrict" }),
    academicTermId: uuid("academic_term_id").references(() => academicTerms.id, { onDelete: "restrict" }), // nullable — Term 1 units, Term 2 units
    name: text("name").notNull(),           // "Unit 1: Number System"
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    classSubjectIdx: index("syllabus_units_class_subject_idx").on(t.classSubjectId),
  }),
);
```

#### `syllabus_chapters` — Rule #8
```typescript
export const syllabusChapters = pgTable(
  "syllabus_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id").notNull().references(() => syllabusUnits.id, { onDelete: "restrict" }),
    name: text("name").notNull(),           // "Chapter 1: Rational Numbers"
    ncertReference: text("ncert_reference"),
    sortOrder: integer("sort_order").notNull().default(1),  // NEW per Rule #8
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    unitIdx: index("syllabus_chapters_unit_idx").on(t.unitId),
  }),
);
```

#### `syllabus_topics` — Rule #8
```typescript
export const syllabusTopics = pgTable(
  "syllabus_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    chapterId: uuid("chapter_id").notNull().references(() => syllabusChapters.id, { onDelete: "restrict" }),
    name: text("name").notNull(),           // "1.1 Properties of Rational Numbers"
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(1),  // NEW per Rule #8
    estimatedPeriods: integer("estimated_periods").default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    chapterIdx: index("syllabus_topics_chapter_idx").on(t.chapterId),
  }),
);
```

#### `assessments` — Minimal foundation (Rule #5)
```typescript
// Minimum reusable foundation scoped to Class → Subject.
// Full examination module will extend this — do NOT build heavy exam logic here.
export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
    classSubjectId: uuid("class_subject_id").notNull().references(() => classSubjects.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id").references(() => sections.id, { onDelete: "restrict" }),  // nullable = class-wide exam
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "restrict" }),
    title: text("title").notNull(),           // "Unit Test 2 — Fractions"
    assessmentType: assessmentTypeEnum("assessment_type").notNull(),
    date: text("date"),                       // "YYYY-MM-DD"
    maxMarks: integer("max_marks").notNull().default(100),
    syllabusCoverage: text("syllabus_coverage"),  // free-text note about topics covered
    status: assessmentStatusEnum("status").notNull().default("DRAFT"),
    createdByTeacherId: uuid("created_by_teacher_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    classSubjectIdx: index("assessments_class_subject_idx").on(t.classSubjectId),
    schoolIdx: index("assessments_school_idx").on(t.schoolId),
    dateIdx: index("assessments_date_idx").on(t.date),
  }),
);
```

### 1.3 Modify Existing Tables

#### `lesson_plans` — Fix schema/action mismatch (Rule #6)
```typescript
// Add syllabusTopicId to lesson_plans for linkage to curriculum tracker.
// Do NOT add sectionId — lesson plans are scoped to: Academic Year + classSubjectId + Teacher.
// If section-specific plans are ever required, a separate explicit migration must be created.
syllabusTopicId: uuid("syllabus_topic_id").references(() => syllabusTopics.id, { onDelete: "restrict" }), // nullable
```

#### `class_subjects` — Keep as class-level default; section override via `section_subject_teachers`
No structural change needed. `assignedTeacherId` remains the class-level fallback.

---

## Phase 2 — Server Actions

### 2.1 File Structure
```
frontend/src/app/(admin)/academics/
  actions.ts               ← Existing — keep: getClassrooms, saveClassroom, saveSection,
                             getSubjects, saveSubject, getClassSubjectsList, saveClassSubject,
                             getSectionTimetable, getAssignments, saveAssignment,
                             getAssignmentSubmissions, gradeSubmission, submitAssignment,
                             getLessonPlans, saveLessonPlan
                             ADD: new actions per sections below

  actions/
    calendar.actions.ts    ← NEW: terms + calendar events
    timetable.actions.ts   ← NEW: bell schedule, substitutions, enhanced saveTimetablePeriod
    syllabus.actions.ts    ← NEW: units/chapters/topics CRUD + archive
    assessment.actions.ts  ← NEW: assessments CRUD
    class-setup.actions.ts ← NEW: createClassSetup() orchestration (Rule #7)
    reports.actions.ts     ← NEW: syllabus progress, teacher workload queries
```

> [!NOTE]
> Splitting into subdirectory keeps the existing `actions.ts` intact and avoids breaking any currently working UI.

### 2.2 Authorization Pattern (Rule #11)

Every action must verify **server-side** that the requesting user has access to the resource being mutated:

```typescript
// Pattern for teacher access verification:
async function verifyTeacherAccessToClassSubject(
  session: Session,
  classSubjectId: string,
  sectionId?: string
): Promise<void> {
  if (["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role)) return;
  if (session.user.role === "TEACHER") {
    // Check section-level allocation first, fall back to class-level
    const sectionAllocation = sectionId
      ? await db.query.sectionSubjectTeachers.findFirst({
          where: and(
            eq(sectionSubjectTeachers.classSubjectId, classSubjectId),
            eq(sectionSubjectTeachers.sectionId, sectionId),
            eq(sectionSubjectTeachers.teacherId, session.user.id),
            eq(sectionSubjectTeachers.isActive, true),
          ),
        })
      : null;

    if (!sectionAllocation) {
      // Fall back to class-level assignment
      const classAssignment = await db.query.classSubjects.findFirst({
        where: and(
          eq(classSubjects.id, classSubjectId),
          eq(classSubjects.assignedTeacherId, session.user.id),
        ),
      });
      if (!classAssignment) throw new Error("Access Denied: You are not authorized for this subject.");
    }
  } else {
    throw new Error("Access Denied: Insufficient role.");
  }
}
```

**Never trust IDs from form input as proof of access.** Always cross-reference against the authenticated user's school + role + assignments.

### 2.3 `createClassSetup()` — Transactional orchestration (Rule #7)

```typescript
// NEW in class-setup.actions.ts
// Atomically: Create Class → Create Sections → Attach Subjects.
// Rollback on any failure.
export async function createClassSetup(data: {
  gradeLevel: GradeLevelEnum;
  displayName: string;
  sortOrder: number;
  sections: { name: string; capacity: number; classTeacherId?: string; roomNumber?: string }[];
  subjectIds: string[];  // existing subjects to attach
}): Promise<{ success: true; classId: string }> { ... }

// saveClassroom() — Keep for edit/update CRUD only (Rule #7)
```

### 2.4 Bell Schedule Actions (Rule #2)

```typescript
// NEW in timetable.actions.ts
export async function getBellSchedule(): Promise<BellScheduleEntry[]>
export async function saveBellSchedulePeriod(data: BellPeriodInput): Promise<{ success: true }>
export async function deleteBellSchedulePeriod(id: string): Promise<{ success: true }>
```

### 2.5 Timetable — Enhanced `saveTimetablePeriod()` (Rules #2, #4)

Replace hardcoded period times with a lookup to `bell_schedule`. Add room conflict detection:

```typescript
// Conflict checks (in order):
// 1. Teacher double-booking (existing — keep)
// 2. Room conflict: same room, same section, same day+period → different section?
// 3. Invalid subject allocation: subjectId must belong to classSubjectId for this class
// 4. Invalid teacher allocation: teacherId must be authorized for classSubjectId + sectionId
```

### 2.6 Substitution Actions (Rule #3)

```typescript
// NEW in timetable.actions.ts
export async function getSubstitutionsForDate(date: string, sectionId?: string)
export async function createSubstitution(data: SubstitutionInput): Promise<{ success: true }>
export async function updateSubstitutionStatus(id: string, status: SubstitutionStatus): Promise<{ success: true }>
export async function getPendingSubstitutions(): Promise<PendingSubstitution[]>
// Used by AMS Overview dashboard card: "X substitutions need assignment today"
```

### 2.7 Syllabus CRUD + Safe Archive (Rules #9)

```typescript
// NEW in syllabus.actions.ts
// Units
export async function getSyllabusUnits(classSubjectId: string)
export async function saveSyllabusUnit(data: UnitInput)
export async function archiveSyllabusUnit(id: string)   // sets deletedAt — never DELETE
export async function restoreSyllabusUnit(id: string)   // clears deletedAt

// Chapters
export async function getSyllabusChapters(unitId: string)
export async function saveSyllabusChapter(data: ChapterInput)
export async function archiveSyllabusChapter(id: string)
export async function restoreSyllabusChapter(id: string)

// Topics
export async function getSyllabusTopics(chapterId: string)
export async function saveSyllabusTopic(data: TopicInput)
export async function archiveSyllabusTopic(id: string)
export async function restoreSyllabusTopic(id: string)

// Guard: Before archive, check if any lesson_plans or assessments reference this record.
// If yes: return a warning with reference count, require force=true to proceed.
```

### 2.8 Assessment Actions (Rule #5)

```typescript
// NEW in assessment.actions.ts
// Authorization: Teacher can only create for their assigned classSubjectId + sectionId
export async function getAssessments(classSubjectId: string, sectionId?: string)
export async function saveAssessment(data: AssessmentInput)
export async function archiveAssessment(id: string)
```

### 2.9 Lesson Plan — Fix (Rule #6)

Update `saveLessonPlan()` in the existing `actions.ts`:
- Add optional `syllabusTopicId?: string | null` to the input type
- Add corresponding DB write
- **Do NOT add `sectionId`** — lesson plans remain class+subject scoped

### 2.10 Section Teacher Allocation Actions (Rule #10)

```typescript
// NEW in class-setup.actions.ts or separate teacher-allocation.actions.ts
export async function getSectionTeacherAllocations(classSubjectId: string)
export async function assignSectionTeacher(data: {
  classSubjectId: string;
  sectionId: string;
  teacherId: string;
  effectiveFrom: string;
}): Promise<{ success: true }>
// Sets effectiveTo on the current active record before inserting the new one (preserves history)
```

### 2.11 Reports Actions (Rule #13)

```typescript
// NEW in reports.actions.ts
// All queries reuse existing AMS tables — no new reporting tables.
export async function getClassSyllabusProgress(classId: string): Promise<ClassSyllabusProgressReport>
export async function getSubjectSyllabusProgress(classSubjectId: string): Promise<SubjectProgressReport>
export async function getTeacherWorkloadReport(): Promise<TeacherWorkloadReport[]>
export async function getAssignmentCompletionReport(sectionId: string): Promise<AssignmentCompletionReport>
export async function getAcademicActivityReport(classId: string): Promise<ActivityReport>
```

---

## Phase 3 — Frontend Routes & Components

### 3.1 AMS Hub `/academics` (existing — enhanced)

**Current tabs retained and fixed:**
| Tab | Gap to fix |
|---|---|
| Classrooms & Sections | Add Edit Class + Edit Section buttons; show enrollment vs capacity |
| Subject Master | Wire Edit row → modal; Add Deactivate button |
| Subject Mapping | Replaced by Class Hub → Subjects (class-centric) |
| Timetable Grid | Now uses `bellSchedule` config — no hardcoded 8 periods |
| Assignments & Grading | Kept |
| Lesson Plans | Add `syllabusTopicId` picker |

**New AMS Hub overview cards:**
- Active Academic Year badge
- `X substitutions need assignment today` (links to substitution view)
- Class setup completion summary

### 3.2 `/academics/setup/calendar` — New Route (Rule #1)

```
AcademicCalendarPage
  ├── TermsPanel (create/edit/delete academic terms)
  ├── CalendarGrid (month view of academic year)
  │     ├── HOLIDAY events → red
  │     ├── EXAM events → yellow
  │     ├── PTM events → blue
  │     └── WORKING_SATURDAY → green
  └── AddEventModal
```

### 3.3 Class Hub `/academics/classes/[classId]` (existing page — enhanced)

**Setup status bar (Rule #15):**
```
✓ Class Created
✓ Sections (3)
✓ Subjects (8)
○ Teachers (2/8 assigned)
○ Syllabus (0%)
○ Timetable (0/18 periods)
```

**Tabs inside Class Hub:**
1. **Overview** — Setup status + recent activity
2. **Sections** — Section list with class teacher and capacity
3. **Subjects** — Subject list with allocation status
4. **Timetable** — Section switcher → timetable grid (uses bell schedule)
   - **Substitution sub-view** — `Class → Timetable → Substitution` (Rule #3 UX location)
5. **Syllabus** — Unit → Chapter → Topic tree
6. **Assignments** — Assignment list + grading
7. **Lesson Plans** — Teacher lesson plan list linked to syllabus topics
8. **Assessments** — Minimal exam/test list (Rule #5)

### 3.4 Subject Workspace `/academics/classes/[classId]/subjects/[classSubjectId]` — New Route (Rules #5, #12)

```
SubjectWorkspacePage
  ├── Header: Mathematics | Class 6
  ├── Stats bar (Rule #12 example):
  │     Syllabus Progress: 72% | Lessons: 32/45 | Assignments: 24 | Pending Grading: 8
  │     Upcoming: Unit Test 2 | Current Topic: Equivalent Fractions | Next: Ratio & Proportion
  └── Tabs:
        Overview    — trajectory summary (Rule #12)
        Syllabus    — unit/chapter/topic tree with % completion
        Lesson Plans — teacher's plans linked to syllabus topics
        Assignments  — section-specific assignments
        Homework     — (can reuse Assignments with type filter)
        Assessments  — Rule #5: create/list assessments for this classSubject
        Performance  — placeholder for later full examination module
```

### 3.5 Timetable — Bell Schedule Configuration (Rule #2)

**Before building timetable UI**, provide a setup screen:
```
Bell Schedule Setup
  School: [name]
  [ Add Period ]
  ┌─────────────────────────────────────────┐
  │ # │ Name        │ Start │ End   │ Type   │
  │ 1 │ Assembly    │ 07:45 │ 08:00 │ ASSEMBLY│
  │ 2 │ Period 1    │ 08:00 │ 08:45 │ REGULAR │
  │ 3 │ Period 2    │ 08:45 │ 09:30 │ REGULAR │
  ...
  └─────────────────────────────────────────┘
```

The timetable grid then renders as many rows as `bellSchedule` has active entries — **no hardcoded 8 periods anywhere.**

### 3.6 Substitution UX (Rule #3)

Location: Class → Timetable → Substitution tab

```
Today's Substitutions: [date picker]
──────────────────────────────────────
Period 3 | Math | Section 6A
Original Teacher: Mr. Kumar (ABSENT)
[ Assign Substitute ] → Teacher dropdown → Confirm

─── AMS Hub ─── (Rule #3 surface at overview)
⚠ 3 substitutions require assignment today
[ Manage Substitutions → ]
```

### 3.7 Class Creation UX (Rule #15)

Multi-step progressive wizard:
```
Step 1: Class Name + Grade Level
Step 2: Add Sections (name, capacity, class teacher, room)
Step 3: Select Subjects (from subject master)
         [ + Create New Subject ] (inline)
─── [ Create Class ] ───────────────────────
→ Redirects to Class Hub
→ Shows setup status: ✓ ✓ ✓ ○ ○ ○
```

### 3.8 Academic Reports `/academics/reports` (Rule #13)

```
Report Cards:
  Class Syllabus Progress  → table: Class | Subject | % complete
  Subject Progress         → per subject breakdown
  Teacher Workload         → Teacher | # Periods/Week | # Assignments | # Lesson Plans
  Assignment Completion    → Section | Assignment | Submitted/Total | Graded/Total
  Academic Activity        → Calendar heatmap of lesson plan / assignment activity
```

---

## Phase 4 — Conflict Detection (Rule #4)

Implement in `saveTimetablePeriod()` in the order below:

```typescript
// 1. Teacher conflict (existing — KEEP)
// 2. Room conflict
if (data.roomNumber) {
  const roomConflict = await db.query.timetablePeriods.findFirst({
    where: and(
      eq(timetablePeriods.isActive, true),
      eq(timetablePeriods.academicYearId, activeYear.id),
      eq(timetablePeriods.dayOfWeek, data.dayOfWeek),
      eq(timetablePeriods.periodNumber, data.periodNumber),
      eq(timetablePeriods.roomNumber, data.roomNumber),
    ),
  });
  if (roomConflict && (!data.id || roomConflict.id !== data.id)) {
    throw new Error(`Conflict: Room ${data.roomNumber} is already booked for this period.`);
  }
}

// 3. Subject authorization: subjectId must exist in class_subjects for the section's class
// 4. Teacher authorization: teacherId must be authorized (via section_subject_teachers or class_subjects)
```

---

## Phase 5 — Final Validation Trajectory (Rule #17)

After implementation, this workflow must function end-to-end:

```
1. Admin creates Academic Year → activates it
2. Admin creates Terms (Term 1, Term 2) under the year
3. Admin adds calendar events (holidays, PTM, exams)
4. Admin runs Class Setup wizard:
     → Class 6 + Sections [6A, 6B] + Subjects [Math, English, Science]
5. Admin configures Bell Schedule (7 periods + lunch + assembly)
6. Admin assigns section teachers (6A-Math: Mrs. Sharma, 6B-Math: Mr. Gupta)
7. Admin builds timetable (conflict detection prevents double-booking + room clash)
8. Admin marks teacher absent → Substitution created + pending in AMS Hub alert
9. Teacher opens Subject Workspace → 6A → Math
     → Creates syllabus: Unit 1 → Chapter 1 → Topics 1.1, 1.2
     → Creates Lesson Plan for Topic 1.1 (linked to syllabusTopicId)
     → Marks lesson plan completed
     → Syllabus progress bar updates: 50% of Chapter 1
10. Teacher creates Assignment for 6A → Math
11. Student submits assignment
12. Teacher grades submission (DPDP audit logged)
13. Teacher creates Assessment: Unit Test 1 for 6A → Math
14. Principal views /academics/reports → Class 6 → Syllabus 50% complete, 1 assignment pending grading
```

---

## Scope Boundary (Rule #16)

| ✅ In Scope | ❌ Out of Scope |
|---|---|
| `database/src/schema/academics.ts` additions | `core.ts`, `students.ts`, `hr.ts`, etc. |
| `frontend/src/app/(admin)/academics/**` | Any other admin route |
| AMS server actions | Auth, sessions, DPDP logger, billing |
| New AMS schema migrations | Global calendar architecture |
| Shared UI components used only by AMS | Global sidebar changes |

---

## Implementation Order

Execute in this sequence to enable incremental validation at each step:

1. **DB**: Add all new tables to `academics.ts` + update `schema/index.ts` exports → run migration
2. **BE**: Add `calendar.actions.ts` (terms + events) → test
3. **BE**: Add `timetable.actions.ts` (bell schedule + substitutions + enhanced period save) → test
4. **BE**: Add `syllabus.actions.ts` (units/chapters/topics + archive) → test
5. **BE**: Add `assessment.actions.ts` → test
6. **BE**: Add `class-setup.actions.ts` (`createClassSetup()`) → test
7. **BE**: Add `reports.actions.ts` → test
8. **BE**: Update `saveLessonPlan()` in `actions.ts` with `syllabusTopicId` → test
9. **FE**: Build `/academics/setup/calendar` page
10. **FE**: Build Bell Schedule setup UI
11. **FE**: Enhance Class Hub (`[classId]/page.tsx`) — setup status + 8 tabs
12. **FE**: Build Subject Workspace (`[classId]/subjects/[classSubjectId]`) — 7 tabs
13. **FE**: Add Substitution tab inside Timetable view
14. **FE**: Replace old Class Creation modal with progressive wizard
15. **FE**: Build `/academics/reports` page
16. **FE**: Fix existing tab gaps (Edit Class, Edit Section, Edit Subject, Deactivate)
17. **Validate**: Walk through the full end-to-end trajectory from Phase 5

---

*Ready to execute. Confirm step or identify which phase to start first.*
