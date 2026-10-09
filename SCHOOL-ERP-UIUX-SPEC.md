# School ERP: UI/UX Spec (v2.0)

**What this file is:** the rulebook for how every screen of the School ERP looks, feels and behaves.
**Who reads it:** the AI coding agent (Antigravity or similar) and the human team.
**Its partner file:** `SCHOOL-ERP-PERFORMANCE-SPEC.md` (speed, caching, servers, scale). This file says WHAT the user sees and does. That file says HOW FAST and HOW SAFE it runs.
**Based on:** the winning document ("Advanced UX & Performance Spec, Antigravity Rule Pack"), split, rewritten and extended.

---

## 0. How to read and use this file

### 0.1 Tags on facts and numbers

| Tag | Meaning |
|---|---|
| [V] | Checked against a source by the earlier document. Re-check at the official site before you depend on it. |
| [P] | A target we chose. Start here, then tune with real data. |
| [A] | A guess used for planning. Replace with real measurement. |
| [R] | A common rule of thumb. Not tested here. |

Never present a [P], [A] or [R] number as a proven fact.

### 0.2 Rule format

Every rule has an ID such as `UX-R12`. When the agent makes a choice, it must name the rule ID it followed. When it breaks a rule, it must say which one and why.

Each rule has: **Rule** (what to do), **Why** (the reason), **Test** (how to check), **Fallback** (what to do if the best way does not work).

### 0.3 Boundaries (Always / Ask first / Never)

**Always**
- Pick the user (teacher, parent, etc.) before designing any screen.
- Design all 6 states for every screen: empty, loading, error, offline, no-permission, partial failure.
- Show the true state of every save: waiting, saved, or failed.
- Use the same word for the same thing everywhere (see 2.5).

**Ask first**
- Adding a new library bigger than 20 KB (compressed).
- Changing the main menu or the words in it.
- Anything that collects data about a child that is not needed for school work.

**Never**
- Show "Saved" before the server (or the offline queue) really has the data.
- Hide a failed save.
- Use a gesture (swipe, drag) without a tap alternative.
- Put advertising or tracking tools in the student or parent app.
- Show another school's data to a user. Ever.

### 0.4 Priority when rules clash

1. Safety of school data and children's data
2. Access for all people (accessibility)
3. Speed budgets (see Performance Spec)
4. Everything else in this file

If a developer's instruction breaks 1, 2 or 3, the agent must say so and ask before going on.

### 0.5 Context pack (what to load for each job)

To save the agent's memory, load only what the job needs.

| Job | Load these sections |
|---|---|
| New screen | 0, 1, 2, 3, 4, 5, 6, 9 |
| Change a form or grid | 0, 3, 4, 5, 9 |
| Write words (buttons, errors, messages) | 0, 6.3 |
| Check accessibility | 0, 6.2, 9 |
| Plan research with users | 0, 7 |

Section 8 (the Definition of Done) is loaded for every UI job.

---

## 1. The people we build for (personas)

Design for the real person, not for a developer with a fast laptop.

| Person | Main device | Daily goal | Pain to remove |
|---|---|---|---|
| Teacher | Cheap Android phone (3 GB RAM or less is common) [A] | Take attendance, enter marks, send homework | Weak internet, little time between periods, glare outdoors |
| Front-office staff | Old desktop, shared | Admissions, fee desk, search students fast | Many records, long queues |
| Accountant | Desktop | Fees, receipts, reports | Money must be exactly right |
| Principal | Phone and desktop | See today at a glance, approve things | Too many screens |
| Parent | Phone, often shared or cheap | See attendance, fees, notices, results | Language, trust, paying safely |
| Student (older) | Phone | Homework, timetable, results | Simple and quick |

**UX-R01 Every screen names its persona.**
- Why: a screen for "everyone" works for no one.
- Test: the screen's spec has a "Persona" line.
- Fallback: if unsure, treat the user as a teacher on a cheap phone.

---

## 2. The -logies (thinking tools) for UI/UX

A "-logy" is a way of studying something. Each one below is turned into rules you can check. Each has a plain meaning, rules, an example, a fallback and a test.

### 2.1 Anthropology: study the real place where the app is used

- **Plain meaning:** go and watch real users in their real place (a village school, a staff room, a fee counter with a power cut).
- **Rules:**
  - **UX-R02** Test every key screen on a cheap phone and a weak network, not only on a good laptop.
  - **UX-R03** Before building a big flow, watch at least 5 real people do the job today (see section 7).
- **Example:** a teacher marks 40 students in 60 seconds before the bell.
- **Fallback:** if you cannot visit, ask the school to record a short screen video of the daily routine.
- **Test:** the research notes file exists and is linked in the feature spec.

### 2.2 Phenomenology: how fast and smooth it FEELS

- **Plain meaning:** speed is not only numbers. It is how fast it feels.
- **Feel levels [R]:**
  - Up to 100 ms feels instant (a tap, a toggle).
  - Up to 400 ms keeps the person in flow.
  - Up to 1 second keeps the train of thought. Show a placeholder shape after 300 ms.
  - Over 1 second show progress. Over 10 seconds move the work to the background and tell the user when done.
- **Rules:**
  - **UX-R04** Every tap shows a visible response in 100 ms (pressed look, tick, or placeholder).
  - **UX-R05** If an answer is expected in under 300 ms, show nothing extra. Do not flash a placeholder.
  - **UX-R06** Prefer a progress bar or a placeholder shape over a spinning wheel. Use a spinner only as a last choice.
  - **UX-R07** Motion must show a change of state, not decorate. Only move things with transform and opacity. Respect "reduce motion" settings.
- **Fallback:** if motion is not supported or the phone is weak, switch states instantly with no animation.
- **Test:** record one interaction on a slow phone profile; first feedback frame within 100 ms. (Speed tools: see Performance Spec.)

### 2.3 Praxeology: design for what people DO, not for the database

- **Plain meaning:** screens follow the job, not the database tables.
- **Rules:**
  - **UX-R08** A common job takes at most 2 taps from the "Today" screen. [P]
  - **UX-R09** Do not make people open three screens to finish one job. Bring the needed data onto one screen.
- **Example:** to mark attendance, the teacher does not visit "Classes", then "Sections", then "Students". Today shows "Start attendance: Class 5A, Period 1".
- **Fallback:** if a job needs many steps, split it into clear steps with progress shown.
- **Test:** count taps for the top 5 tasks per persona.

### 2.4 Teleology: show only what helps reach the goal

- **Plain meaning:** show only the controls needed for the goal at that moment.
- **Rules:**
  - **UX-R10** One main action per screen or card. Secondary actions are smaller.
  - **UX-R11** Hide advanced options until needed (progressive disclosure), such as expandable panels.
- **Example:** a principal's card says "5 leave requests". One button: "Review". Details open on tap.
- **Fallback:** keep an "Advanced" or "More" area for power users.
- **Test:** each screen has exactly one primary button.

### 2.5 Ontology: one name for one thing

- **Plain meaning:** the app agrees what each thing in school life is called, and how things connect.
- **The school map:** Tenant (trust or chain) > Institution (school or branch) > Academic Year > Term > Class and Section > Enrollment > Student. Guardian links to Student (many to many). Also: Staff, Subject, Period and Timetable, Attendance Record, Assessment and Mark, Fee Structure > Fee Invoice > Payment, Notice.
- **Rules:**
  - **UX-R12** The screen word, the API name and the table name use the same noun. Do not mix "Pupil", "Learner" and "Student".
  - **UX-R13** Keep a glossary file. New words must be added there first.
  - **UX-R14** Records of consequence (attendance, marks, fees) are never hard-deleted. They are marked deleted and logged.
- **Example:** a guardian with children in two branches sees a family switcher, not two logins.
- **Fallback:** imported old data that does not fit goes to a "needs fixing" list with a row-by-row error report.
- **Test:** an automatic check rejects new words not in the glossary.

### 2.6 Taxonomy: how menus are grouped

- **Plain meaning:** how to sort screens into groups so people find things.
- **Rules:**
  - **UX-R15** Every role lands on a task-first "Today" screen.
  - **UX-R16** At most 5 main menu items per role. On phones, the bottom bar holds 3 to 5 items. [R]
  - **UX-R17** Menu words are task words or user words ("Fees", "Homework"), never table names ("fee_invoice").
- **Example:** Teacher: Today, Attendance, Marks, Homework, Messages. Parent: Today, Child, Fees, Notices.
- **Fallback:** if unsure, run a card sort or a tree test before building the menu.
- **Test:** at least 80% of testers find the top 5 tasks in the menu. [P]

### 2.7 Morphology: shapes change with screen size

- **Plain meaning:** the same thing takes a different shape on different devices.
- **Table of shapes:**

| Part | Phone | Tablet | Desktop |
|---|---|---|---|
| Data list | Cards you can expand | Grid with pinned name column, scrolls sideways | Full grid plus side drawer |
| Form | Full-screen steps | Drawer, 60% width | Drawer, about 480 px |
| Menu | Bottom bar | Icon strip | Side menu plus command search |
| Detail view | New screen with back | Two panes | Two panes |

- **Rules:**
  - **UX-R18** Use container-based layout so a part adapts to the space it has, not only the screen width. [R]
  - **UX-R19** Three capability levels. Level A works on any browser with no special features. Level B uses modern web features. Level C adds extras (early page loading, background sync). Every feature must fall back to Level A. Never a blank screen.
- **Fallback:** if a modern feature is missing, use the simpler version.
- **Test:** screenshots at 360, 768 and 1280 px wide; one test with extra features switched off.

### 2.8 Ergonomics: the body and the hand

- **Plain meaning:** how a real hand and eye use the screen.
- **Rules:**
  - **UX-R20** Main actions sit in the lower third of a phone screen (thumb zone).
  - **UX-R21** Tap targets are 44 to 48 px for main actions. The minimum allowed by WCAG 2.2 AA is 24 px. [R]
  - **UX-R22** Text contrast at least 4.5 to 1. Contrast for buttons and borders at least 3 to 1. Teachers use phones outdoors in glare. [R]
  - **UX-R23** Every swipe or drag has a tap button as an alternative.
- **Example:** attendance screen with big Present and Absent buttons and a sticky "Done" bar.
- **Fallback:** if a gesture tool fails, the buttons still work.
- **Test:** automatic contrast and size checks; one-handed test on a 6-inch phone.

### 2.9 Semiology: signs and symbols mean one thing

- **Plain meaning:** colors, icons and shapes carry meaning. They must mean the same thing every time.
- **Rules:**
  - **UX-R24** One fixed meaning for each status color and icon (for example green = done, red = problem, amber = waiting). Keep it in the design tokens (one shared list of colors, sizes, spacing).
  - **UX-R25** Never use color alone. Add an icon or a word. (Some users cannot tell colors apart.)
  - **UX-R26** Do not put text inside images.
- **Fallback:** if a custom school color fails the contrast check, use the safe default color and log it.
- **Test:** an automatic check that every status uses a token, not a raw color.

### 2.10 Chronology: order and flow in time

- **Plain meaning:** screens change over time. Changes should feel connected, not jumpy.
- **Rules:**
  - **UX-R27** When a list item opens into a detail, keep the link visible (for example the card grows into the drawer). Use quick moves of 200 ms or less. [P]
  - **UX-R28** Never replace the whole page for a normal save. Stay where the user is (see UX-R40).
- **Fallback:** no animation if the device is weak or the user chose "reduce motion".
- **Test:** no jump or flash when a state changes in a recorded session.

### 2.11 Etiology: find the real cause of friction

- **Plain meaning:** when users struggle, find the root cause, not just the sign.
- **Rules:**
  - **UX-R29** Every key screen sends small usage events: what was opened, how long it took, what failed. No student names or IDs in these events.
  - **UX-R30** Watch for: repeated taps in the same place, forms left half-done, and errors that repeat.
- **Fallback:** if tracking is blocked, use the server logs and user interviews.
- **Test:** each key screen has events defined in its spec.

---

## 3. Core interaction patterns

Each pattern has a rule, a school example and a fallback.

| ID | Pattern | Rule | School example | Fallback |
|---|---|---|---|---|
| UX-P01 | Optimistic UI with a safe queue | Update the screen at once. Save the change in a local queue on the device. Show each row as waiting, saved or failed with a retry button. | Attendance on weak internet | No local storage: keep the queue in memory and warn before the tab closes |
| UX-P02 | Safe repeat saves and conflicts | Each save has a unique key so a repeat does not create a copy. Send the record version. If two people changed the same thing, show who changed what and let the user choose. | Two teachers edit one marks sheet | Last change wins, with a log entry, only for low-risk fields |
| UX-P03 | Works offline for core jobs | Cache the app shell. Attendance, marks and notices work offline. Sync when online returns. | Rural schools | A visible "Sync now" button |
| UX-P04 | Placeholder shapes while loading | Placeholder shape equals final layout, so nothing jumps. Load the top of the screen first. Never nest spinners. | Student profile | Plain text placeholder |
| UX-P05 | Undo instead of "Are you sure?" | Reversible actions finish at once with an 8-second Undo message. Ask for confirmation only for actions that cannot be undone or that affect many people. Big destructive actions need typed confirmation. | Remove a student from a class | A confirm box that names the result |
| UX-P06 | Spreadsheet-style grid | Arrow, Tab and Enter keys move around. Paste from Excel. Fill down. Check input as typed. Pinned name column. Saved views. Save per cell with a status. Works by keyboard alone. | Marks for 40 students | Phone: one card per student with a number keypad |
| UX-P07 | Command search | Ctrl or Cmd + K searches students, staff, fees and actions together. Recent items first. Also a visible search box for touch users. | Admin types "rahul 5b" | Search box in header only |
| UX-P08 | Smart defaults | Pre-fill the likely value (current period, last class used). Pre-fills are visible, can be changed, and are never sent silently. For attendance, "all present" is allowed only with a clear Done step and a summary ("36 present, 4 absent") before submit. The record stays "unconfirmed" until then. | Teacher opens app at 08:05 | No default. Mark each student |
| UX-P09 | Bulk actions with preview | Show "N selected". Allow select across pages. Show a preview first. Show a result per row. Retry only the failed rows. | Fee reminders to 120 parents | Run as a background job with a notification |
| UX-P10 | All states designed | Every list and form has empty, loading, error, offline and no-permission designs. | New school with no classes | Generic message plus an action button |
| UX-P11 | Notifications | Choose the channel per role (in-app, push, WhatsApp, SMS). Quiet hours. Daily digests. Link straight to the exact record. Show delivery status. | Absence alert to a parent | SMS if push fails |
| UX-P12 | Role-aware dashboards | At most 6 to 8 cards. One main action per card. Cards below the fold load later. | Principal overview | A simple summary table |
| UX-P13 | Print and export | Make PDFs on the server through a job queue. Add a print style. | Report cards for 1,200 students | CSV export |
| UX-P14 | Clear money state | Always show pending, paid, failed or refunded. Disable the Pay button after the first tap. Give a receipt at once. After a redirect, check payment status. | Parent pays term fee | A "Check status" button |
| UX-P15 | Family and branch switch | One login for guardians with several children or branches. The switcher is one tap away and shows who is active. | Guardian with two children in two schools | Separate sections on Today |

### 3.1 Form and CRUD rules

- **UX-R40** Create, edit and delete never take the user away from their place. Use inline edit, a side drawer, or a light overlay. Never a full page jump for a normal save.
- **UX-R41** One decision per step. Keep the fewest fields that make the step make sense (usually 3 to 5 on a phone). Test this with users. [P]
- **UX-R42** Forms with more than 5 fields become steps or tabs inside a drawer, not one long page. [P]
- **UX-R43** Check input while typing and say exactly what is wrong and how to fix it.
- **UX-R44** Allow paste in every field.
- **UX-R45** A success page is not needed. The exception is money and exports, where a confirmation is a document the user keeps.
- **UX-R46** Modals (boxes that block the screen) are only for destructive actions. Use drawers and sheets for everything else.

### 3.2 Tables on phones

- **UX-R47** Phones show cards. Tablets and larger show a pinned-column grid. The one allowed exception is marks entry, which may use a sideways-scrolling grid. This replaces the old rule "never use tables on mobile."

---

## 4. Navigation and layout rules

- **UX-R50** Layout keeps its shape when the role changes. An admin sees more options, but things do not jump around. Map permissions so adding a role does not shuffle the screen.
- **UX-R51** Use one design system: one shared library of buttons, forms, tables and menus. No one-off styles.
- **UX-R52** Branding per school changes only tokens (colors, logo). It never changes code. If custom tokens fail the contrast check, use the safe default.
- **UX-R53** Three density modes: compact, comfortable, spacious. The user's choice is saved.
- **UX-R54** Use logical CSS words (start and end, not left and right) so right-to-left languages work.

---

## 5. Language, India and local needs

| Topic | Rule | Fallback |
|---|---|---|
| Languages | Hindi plus the local languages of the launch states [A]. Language is chosen per user, not per device. All text comes from translation files with plural rules. | English plus the one local language already translated |
| Numbers and money | Use the Indian grouping (12,34,567). Use the browser's `Intl.NumberFormat('en-IN')` and currency INR. [R] | A hand-made formatter |
| Dates | Day, month, year. The school year often runs April to March but differs by board, so store start and end per school. [A] | Set per school |
| Longer text | Leave 30 to 40% more room for translated text. Never join translated pieces. No clipping without a tooltip. [R] | Truncate with a tooltip |
| Fonts | Host the fonts yourself. Load only the script the user needs. Keep layout from shifting when the font loads (see Performance Spec). | System fonts |
| Names | No forced first and last name split. Allow names in native script. Do not assume a surname. | One "Full name" field |
| Phone numbers and OTP | Check +91 and 10 digits starting 6 to 9. Let the phone fill the OTP. [R] | Type by hand with a resend timer |
| Number input | Use the number keypad for marks and phone fields. | Normal text input |
| Messages | WhatsApp, SMS and push each need consent, quiet hours and delivery status. | SMS last |

---

## 6. Access for all, and words that help

### 6.1 Rules for children's data (India)

The Digital Personal Data Protection Rules, 2025 were announced in November 2025 and start in phases over about 18 months. [V, secondary sources] Reported points: parent consent before using a child's data, an allowance for schools to process data needed for education and safety, a ban on tracking a child's behavior and on targeted ads, and a 72-hour limit to report a breach. **This is not legal advice. Check with a lawyer.**

- **UX-R60** A consent record: who, for which child, for what purpose, when, and whether it was withdrawn.
- **UX-R61** Anything outside core school work (photo sharing, marketing, outside tools) sits behind a clear consent screen.
- **UX-R62** No ad or cross-site tracking tools in student and parent apps. Keep usage tracking minimal and first-party.
- **UX-R63** Provide export and erase options, and a history log of who saw or changed child data.

### 6.2 Accessibility (WCAG 2.2 level AA is the floor) [R]

- **UX-R64** Text contrast 4.5 to 1. Button and border contrast 3 to 1. The focus outline must not be hidden under sticky bars.
- **UX-R65** Tap target at least 24 by 24 px. Use 44 to 48 px for main actions.
- **UX-R66** No drag-only actions. Sortable lists and sliders have button alternatives.
- **UX-R67** Login must allow paste and password managers. Do not make people copy codes or solve puzzles.
- **UX-R68** Page must work at 400% zoom without sideways scrolling (data grids excepted). Respect reduce-motion and dark mode settings.
- **UX-R69** Announce save and sync status to screen readers politely. Long lists must report the true row count.
- **Test:** automatic accessibility check in every build; a screen reader pass (TalkBack on Android) for the top 5 tasks each release; a keyboard-only pass on desktop.

### 6.3 Words on the screen (UX copy)

| Element | Pattern | School example |
|---|---|---|
| Button | Verb plus object | "Save attendance", "Send reminder to 12 parents" (not "Submit") |
| Error | What happened, why, how to fix | "Couldn't save attendance for Class 5B. You're offline. We'll send it when you reconnect. Your changes are safe on this device." |
| Empty state | What this is, why empty, how to start | "No homework yet. Add today's homework and parents will see it in the app." |
| Confirmation | Say the result. Buttons repeat the action | "Delete 3 students? Their attendance and marks will be removed. This can't be undone." Buttons: "Delete students" and "Keep students" |
| Loading | Set expectation | "Preparing 1,200 report cards. You can leave this page. We'll tell you when done." |
| Success | Short and calm | "Attendance saved for 5B." |
| No permission | Say who can do it | "Only accountants can edit fee structures. Ask your school admin for access." |

- **UX-R70** Plain, respectful words. No jargon. One word per idea (matches the glossary). Easy to read for a parent with little schooling.
- **UX-R71** Each translated string carries notes: length limit, placeholders, plural and gender rules, idioms to avoid.

---

## 6.4 Screen map: how the school day shapes the UI

| Time or event | Persona | What the screen must do |
|---|---|---|
| About 08:00 to 09:30 | Teacher | Today card starts attendance in one tap. Works offline. |
| Fee due dates | Parent, accountant | Clear money state. Safe pay button. Receipt at once. |
| Result day | Parent | Result opens fast from one link. Calm loading message if busy. |
| Parent-teacher meeting booking | Parent | Slot taken? Say "slot just taken" and show other slots. |
| Exam marks upload | Teacher | Import with a row-by-row check report. Can resume. |
| Year change | Admin | Dry-run preview first, then run in the background. |

---

## 7. Check the rules with real people

Rules are guesses until real users try them.

| Method | Use | People |
|---|---|---|
| Visits and interviews | Watch the real morning attendance and fee counter | 5 to 8 per persona |
| Task tests on the top 5 tasks | Time, errors, a satisfaction score (SUS) | 5 to 8 per persona |
| Card sort or tree test | Check menu words (2.6) | 15 to 30 for card sort |
| Diary study on weak internet | Find offline failures | 10 to 15 |
| Survey after launch | Measure satisfaction | 100 or more |
| A/B test | Only with enough traffic to be sure | By calculation |

In the product, track: time to finish tasks, errors and retries, how many saves are waiting offline and how long to sync, and where people quit.

---

## 8. Definition of Done for every screen

The agent must check each line, and report findings as critical, moderate or minor with a fix.

1. **First look:** purpose clear in 2 seconds. The eye lands on the main action.
2. **Persona:** named (UX-R01).
3. **Taps:** core task in at most 2 taps from Today (UX-R08). Attendance for 40 students in 60 seconds or less. [P]
4. **Consistency:** tokens for color, spacing and type. Same pattern for same job.
5. **States:** empty, loading, error, offline, no-permission and partial failure all designed.
6. **Words:** copy follows 6.3 and the glossary.
7. **Language:** works in Hindi, a regional language and English with no broken layout.
8. **Access:** all checks in 6.2 pass.
9. **Children's data:** nothing collected without a reason and consent (6.1).
10. **Speed:** the budgets in the Performance Spec are measured and recorded. If not measured, write "unmeasured" and give the command to measure.
11. **Device levels:** tested on phone, tablet and desktop and on Level A fallback (UX-R19).
12. **Events:** usage events defined (UX-R29).

---

## 9. Agent workflow for UI work

### 9.1 Steps for every UI task

1. **Classify:** persona, screen type, device level, how sensitive the data is.
2. **State the rules** you will follow (name the rule IDs) before writing code.
3. **Pick patterns** from section 3. If none fits, write a short decision record (what, why, other options, effects).
4. **Build** with a fallback for every optional or browser-specific feature, and test with that feature switched off.
5. **Check** with the tools you have (type check, tests, accessibility check, screenshots).
6. **Report:** what was measured and what was not, any broken rule, any new library and its size.

### 9.2 Commands

- `/new-screen`: capture persona and task, pick screen type and shapes, list data and how fresh it must be, design all states, apply access and copy rules, build, check, report with section 8.
- `/ux-review`: review a screen against section 8 and rate findings critical, moderate or minor.
- `/copy-review`: check every string against 6.3 and the glossary.
- `/a11y-review`: run the accessibility checks in 6.2 and list failures with fixes.

### 9.3 Questions for the product owner (open decisions)

Launch languages and boards. Offline scope for the first release. Messaging providers (WhatsApp, SMS). Payment gateway. Whether any school needs its own separate setup at launch.

---

## 10. What was changed from the source document

| Source rule | Problem | Fix here |
|---|---|---|
| Silent "no spinner" saves for attendance | A silent failure loses data | Show per-row state with a safe queue (UX-P01) |
| "Max 3 fields per step" | Too rigid | One decision per step (UX-R41) |
| "Never use tables on mobile" | Marks entry needs a grid | Cards on phones with one grid exception (UX-R47) |
| Four -logies only | Hard to test | Eleven -logies, each with rules and a test |
| No children's data rules | Real legal and trust risk | Section 6.1 |
| No language or India rules | Core users are Indian | Section 5 |

**What was NOT verified:** browser support for non-Chrome features, the exact DPDP start dates, and every [P] number. Confirm these in your own tools and with a lawyer.
