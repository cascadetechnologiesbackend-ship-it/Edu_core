# SchoolMitra Non-Goals & Scope Boundaries

To ensure convergence on the Product Destination sentence, the following items are strictly outside the product's scope. Any attempt to introduce code or dependencies violating these non-goals requires an explicit charter amendment commit.

---

## 1. No Hardware Bundles, Biometric Devices, or RFID Turnstiles
SchoolMitra does not bundle, sell, or maintain hardware devices. School staff operate standard commercial smartphones, tablets, or desktop browsers. Biometric clocking machines and bus RFID scanners add field fragility and vendor lock-in that distract from the software operating core.

## 2. No EdTech Content or Curriculum Authoring
SchoolMitra is an administrative and operational operating system, not a content or LMS learning platform. We do not author animated videos, textbook material, or digital curriculum packs. Syllabus trackers model academic calendars and chapter progress as operational dates, not pedagogical lessons.

## 3. No Price-War Tier or Free Plan Chase
SchoolMitra targets mid-size private and independent schools (500–2,000 students) that value legal defensibility, financial auditability, and reliable communication. We do not compete at the bottom of the market with loss-making freemium tiers that compromise tenant isolation or engineering quality.

## 4. No New Role Apps Beyond the Existing Ten
The repository already contains role applications for:
- Super Admin (`/super-admin`)
- Office Admin (`/admin`)
- Accountant (`/accountant`)
- Principal (`/principal`)
- Teacher (`/teacher`)
- Parent (`/portal`)
- Student (`/s`)
- Driver (`/driver`)
- Transport Manager (`/transport-manager`)
- Librarian & HR Manager (`/librarian`, `/hr-manager`)

No additional standalone role applications will be introduced.

## 5. No Modules Outside the School's Operating Year
Capabilities unrelated to running the active academic term (such as alumni donation networks, endowment fundraising campaigns, or luxury hostel facility management) are out of scope.

## 6. No Generative AI / LLMs Inside Core Operational Workflows
The product's intelligence is built on deterministic calculations, verified accounting invariants, real-time event distribution, and automated honesty scanners. Attendance marking, marks submission, fee receipts, and parent communication must never depend on non-deterministic LLM hallucination.

## 7. No Feature Without a Journey Citation
Every pull request and spec must cite the exact journey (`J1` through `J10`) it advances and the corresponding persona job it finishes. Features without a journey citation are rejected by policy.

