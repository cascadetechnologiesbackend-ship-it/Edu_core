# DPDP Act 2023 Data Breach Incident Response Runbook
## SchoolMitra ERP

### 1. Statutory Mandate & Timelines
Under **Section 8(6) of the Digital Personal Data Protection Act, 2023** and **Rule 7 of DPDP Rules 2025**:
- In the event of a personal data breach, the Data Fiduciary (School / Platform Operator) **MUST** notify:
  1. The **Data Protection Board of India (DPBI)** within **72 hours** of becoming aware of the breach.
  2. Each affected **Data Principal (Parent / Legal Guardian)** in plain, understandable language without undue delay.

---

### 2. 72-Hour Breach Response Checklist

```
[T+0 to T+4 Hours: Detection & Containment]
[ ] Incident identified and logged in DPDP Centre (/dpdp) -> Generates unique BR-YYYY-NNN ID.
[ ] Immediate admin alert dispatched via triggerBreachEmergencyAlert.
[ ] Isolate affected system components (revoke API keys, isolate compromised database connections).
[ ] Convene Data Protection Officer (DPO) and Legal Incident Response Team.

[T+4 to T+24 Hours: Forensic Scoping & Impact Analysis]
[ ] Determine data categories compromised (e.g. Student PII, Aadhaar numbers, Financial records).
[ ] Calculate precise count of affected Data Principals and compile list of student IDs.
[ ] Verify whether AES-256 encrypted fields were compromised or if cryptographic keys were exposed.
[ ] Document containment and remediation actions taken in data_breach_log.

[T+24 to T+72 Hours: Statutory Notifications]
[ ] File Form 1 notification with the Data Protection Board of India (prior to boardNotificationDeadline).
[ ] Send personalized notification notices to affected parents/guardians via email/SMS.
[ ] Record boardNotifiedAt and parentsNotifiedAt in data_breach_log.
```

---

### 3. Notification Templates

#### Template A: Formal Notification to the Data Protection Board of India (DPBI)
```text
To:
The Secretary, Data Protection Board of India
Subject: Intimation of Personal Data Breach under Section 8(6) of the DPDP Act 2023

Incident Reference: BR-2026-[NUMBER]
Date & Time of Detection: [TIMESTAMP IST]
Data Fiduciary Name: SchoolMitra Technologies Pvt. Ltd. / [School Name]

1. Nature and Scope of Breach:
   [Detailed description of how the breach occurred and vulnerability exploited]

2. Categories of Personal Data Involved:
   [e.g., Student Contact Numbers, Enrolment Records, Parent Email Addresses]

3. Number of Data Principals Affected:
   Approximately [X] student families.

4. Immediate Containment Actions Taken:
   [e.g., Firewall rules updated, compromised API credentials revoked, session tokens invalidated]

5. Potential Consequences & Risks:
   [Assessment of potential risk to data principals]

6. Contact Details of Data Protection Officer:
   Name: [DPO Name]
   Email: dpo@schoolmitra.in | Phone: +91-XXXXX-XXXXX
```

#### Template B: Direct Notice to Affected Parents / Legal Guardians
```text
Subject: Important Privacy Notice regarding your SchoolMitra Account

Dear Parent / Guardian,

We are writing to inform you of a recent data security incident that may have affected information associated with your child at [School Name].

What Happened:
On [Date], our security monitoring detected unauthorized access affecting a subset of our portal records. We immediately took action to contain the incident and secure our systems.

What Information Was Involved:
The affected data was limited to [student name, class, contact phone number]. Please note that sensitive government identification (such as Aadhaar) is stored using AES-256 encryption and was NOT compromised.

What We Are Doing:
- We have neutralized the source of unauthorized access.
- We have informed the Data Protection Board of India as required by the DPDP Act 2023.
- We have implemented additional layers of security monitoring and key rotation.

What You Should Do:
Be cautious of any unexpected calls, emails, or messages claiming to be from the school requesting fee payments or sensitive verification codes.

If you have any questions or concerns, please contact our Data Protection Officer at dpo@schoolmitra.in.
```

---

### 4. DPDP Dashboard Deadline Visibility
In the SchoolMitra DPDP Compliance Centre (`/dpdp`):
- All breach records display a live countdown timer against `boardNotificationDeadline` (72 hours).
- Breaches with status other than `BOARD_NOTIFIED` turn high-visibility amber/red as the deadline approaches.
