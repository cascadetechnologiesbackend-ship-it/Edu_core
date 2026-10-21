import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  evaluateDocumentExpiry,
  validateDocumentUpload,
  aggregatePendingConsents,
  formatProfileChangeSummary,
  validateProfileChangePayload,
  type DocumentRequestInput,
  type ConsentRecordInput,
  type ProfileChangeInput,
} from "../../../../../backend/src/lib/parentEventEngine/documentProfileEngine";
import { deriveParentFeed } from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import type {
  ParentDataSnapshot,
  DocumentRequestSnapshot,
  ProfileChangeSnapshot,
  PendingConsentSnapshot,
} from "../../../../../backend/src/lib/parentEventEngine/types";
import {
  evaluateNotificationEligibility,
  EVENT_KIND_TIER_MAP,
} from "../../../../../backend/src/lib/parentEventEngine/notificationMatrix";
import { ENTITY_GRAPH } from "../../../../../packages/entity-engine/src/catalog/entityGraph";

describe("Phase P15: Documents (OP6, AC-P24), Profile Changes (OP10), & Aggregated Consent (OP11, AC-P14)", () => {
  const studentId = "student-p15-test";
  const now = new Date(2026, 9, 21, 10, 0, 0); // 10:00 AM local

  // ─── 1. AC-P14: Database Migration, Journal & Schema Catalog Registration ─────
  describe("AC-P14: Migration 0049_documents_and_profile_changes Registration", () => {
    it("migration 0049 SQL file exists and contains student_document_requests and profile_change_requests", () => {
      const migrationPath = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/0049_documents_and_profile_changes.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      expect(sqlContent).toContain("student_document_requests");
      expect(sqlContent).toContain("student_document_request_status");
      expect(sqlContent).toContain("profile_change_requests");
      expect(sqlContent).toContain("ROW LEVEL SECURITY");
      expect(sqlContent).toContain('CREATE POLICY "tenant_select_policy" ON "student_document_requests"');
      expect(sqlContent).toContain('CREATE POLICY "tenant_select_policy" ON "profile_change_requests"');
    });

    it("migration journal records index 49 for 0049_documents_and_profile_changes", () => {
      const journalPath = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/meta/_journal.json"
      );
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const entry = journal.entries.find((e: any) => e.idx === 49);
      expect(entry).toBeDefined();
      expect(entry.tag).toBe("0049_documents_and_profile_changes");
    });

    it("catalog.ts registers 0049 under STUDENTS domain", () => {
      const catalogPath = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/catalog.ts"
      );
      const content = fs.readFileSync(catalogPath, "utf-8");
      expect(content).toContain("0049_documents_and_profile_changes.sql");
    });

    it("entityGraph.ts registers student_document_requests and profile_change_requests", () => {
      expect(ENTITY_GRAPH["student_document_requests"]).toBeDefined();
      expect(ENTITY_GRAPH["student_document_requests"]?.domain).toBe("STUDENTS_LIFECYCLE");
      expect(ENTITY_GRAPH["student_document_requests"]?.isTenantScoped).toBe(true);

      expect(ENTITY_GRAPH["profile_change_requests"]).toBeDefined();
      expect(ENTITY_GRAPH["profile_change_requests"]?.domain).toBe("STUDENTS_LIFECYCLE");
      expect(ENTITY_GRAPH["profile_change_requests"]?.isTenantScoped).toBe(true);
    });
  });

  // ─── 2. OP6: Document Submission & Expiry Workflow (AC-P24) ─────────────────
  describe("OP6: Document Upload & Expiry Engine", () => {
    it("validates document upload file constraints (size limit 10MB, allowed mimes)", () => {
      // Valid PDF
      const validPdf = validateDocumentUpload({
        filename: "immunization_record.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2 * 1024 * 1024,
      });
      expect(validPdf.valid).toBe(true);

      // Oversized file (> 10MB)
      const oversized = validateDocumentUpload({
        filename: "huge_scan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12 * 1024 * 1024,
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.error).toContain("10MB");

      // Disallowed format
      const invalidMime = validateDocumentUpload({
        filename: "executable.exe",
        mimeType: "application/octet-stream",
        sizeBytes: 5000,
      });
      expect(invalidMime.valid).toBe(false);

      // Empty file
      const empty = validateDocumentUpload({
        filename: "empty.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
      });
      expect(empty.valid).toBe(false);
    });

    it("evaluates document expiry and automatic re-request triggers", () => {
      // Active document expiring in 90 days
      const activeDoc: DocumentRequestInput = {
        id: "doc-1",
        studentId,
        documentType: "Aadhaar",
        title: "Aadhaar Copy",
        status: "VERIFIED",
        expiresAt: new Date(now.getTime() + 90 * 86400000),
      };
      const activeEval = evaluateDocumentExpiry(activeDoc, now);
      expect(activeEval.isExpired).toBe(false);
      expect(activeEval.isExpiringSoon).toBe(false);
      expect(activeEval.shouldAutoReRequest).toBe(false);

      // Expiring soon (15 days remaining)
      const soonDoc: DocumentRequestInput = {
        ...activeDoc,
        expiresAt: new Date(now.getTime() + 15 * 86400000),
      };
      const soonEval = evaluateDocumentExpiry(soonDoc, now);
      expect(soonEval.isExpired).toBe(false);
      expect(soonEval.isExpiringSoon).toBe(true);
      expect(soonEval.shouldAutoReRequest).toBe(true);

      // Expired document (expired 2 days ago)
      const expiredDoc: DocumentRequestInput = {
        ...activeDoc,
        expiresAt: new Date(now.getTime() - 2 * 86400000),
      };
      const expiredEval = evaluateDocumentExpiry(expiredDoc, now);
      expect(expiredEval.isExpired).toBe(true);
      expect(expiredEval.effectiveStatus).toBe("EXPIRED");
      expect(expiredEval.shouldAutoReRequest).toBe(true);
    });
  });

  // ─── 3. OP11: Aggregated DPDP Consent Checklist ────────────────────────────
  describe("OP11: Single Aggregated Consent Checklist Card", () => {
    it("aggregates multiple pending consents into a single checklist result", () => {
      const records: ConsentRecordInput[] = [
        {
          id: "c-1",
          purpose: "ANNUAL_STUDENT_PHOTO_DIRECTORY",
          isMandatory: false,
          granted: null,
          deadline: new Date(now.getTime() + 5 * 86400000), // 5 days out
        },
        {
          id: "c-2",
          purpose: "FIELD_TRIP_TRANSPORT",
          isMandatory: true,
          granted: null,
          deadline: new Date(now.getTime() + 24 * 3600000), // 24 hours out (urgent!)
        },
        {
          id: "c-3",
          purpose: "HEALTH_RECORD_SHARING",
          isMandatory: false,
          granted: true, // Already granted!
        },
      ];

      const agg = aggregatePendingConsents(records, now);

      // Only pending records are included
      expect(agg.totalPending).toBe(2);
      expect(agg.items).toHaveLength(2);
      expect(agg.items[0]?.purpose).toBe("ANNUAL_STUDENT_PHOTO_DIRECTORY");
      expect(agg.items[1]?.purpose).toBe("FIELD_TRIP_TRANSPORT");

      // Field trip deadline is <= 48h -> elevates tier to T1
      expect(agg.hasUrgent).toBe(true);
      expect(agg.feedTier).toBe("T1_action_required");
      expect(agg.priority).toBe(88);
    });

    it("returns zero items and calm state when all consents are granted", () => {
      const records: ConsentRecordInput[] = [
        { id: "c-1", purpose: "FIELD_TRIP_TRANSPORT", granted: true },
      ];
      const agg = aggregatePendingConsents(records, now);
      expect(agg.totalPending).toBe(0);
      expect(agg.items).toHaveLength(0);
    });
  });

  // ─── 4. OP10: Profile Change Requests ───────────────────────────────────────
  describe("OP10: Profile Change Request Validation & Summary", () => {
    it("validates profile change payload structure", () => {
      const valid = validateProfileChangePayload("address", {
        pincode: "560001",
        district: "Bengaluru Urban",
      });
      expect(valid.valid).toBe(true);

      const invalidField = validateProfileChangePayload("hobbies", { favoriteSport: "Cricket" });
      expect(invalidField.valid).toBe(false);

      const emptyValue = validateProfileChangePayload("address", {});
      expect(emptyValue.valid).toBe(false);
    });

    it("formats diff preview and handles 48h post-decision TTL (Zero-Clutter)", () => {
      const change: ProfileChangeInput = {
        id: "pcr-1",
        studentId,
        field: "address",
        oldValue: { pincode: "560001", district: "Old District" },
        newValue: { pincode: "560034", district: "New District" },
        status: "PENDING",
      };

      const summary = formatProfileChangeSummary(change, now);
      expect(summary.fieldDisplay).toBe("Residential Address");
      expect(summary.diffItems).toHaveLength(2);
      expect(summary.diffItems.find((d) => d.label === "Pincode")?.to).toBe("560034");

      // Recent decision (decided 12h ago -> isRecentDecision = true)
      const recentApplied: ProfileChangeInput = {
        ...change,
        status: "APPLIED",
        decidedAt: new Date(now.getTime() - 12 * 3600000),
      };
      const recentSummary = formatProfileChangeSummary(recentApplied, now);
      expect(recentSummary.isRecentDecision).toBe(true);

      // Old decision (decided 72h ago -> isRecentDecision = false -> Zero Clutter suppresses)
      const oldApplied: ProfileChangeInput = {
        ...change,
        status: "APPLIED",
        decidedAt: new Date(now.getTime() - 72 * 3600000),
      };
      const oldSummary = formatProfileChangeSummary(oldApplied, now);
      expect(oldSummary.isRecentDecision).toBe(false);
    });
  });

  // ─── 5. Feed Derivation (deriveParentFeed & Zero Clutter) ───────────────────
  describe("deriveParentFeed: Document, Profile & Aggregated Consent Cards", () => {
    it("never emits DocumentRequestCard when document status is VERIFIED (Zero-Clutter AC-P1)", () => {
      const snapshot: ParentDataSnapshot = {
        documentRequests: [
          {
            id: "doc-verified",
            documentType: "BirthCertificate",
            title: "Birth Certificate",
            status: "VERIFIED",
          },
        ],
      };

      const cards = deriveParentFeed(studentId, now, snapshot);
      const docCard = cards.find((c) => c.cardType === "DocumentRequestCard");
      expect(docCard).toBeUndefined();
    });

    it("emits DocumentRequestCard for PENDING and REJECTED requests with elevated tier if due soon", () => {
      const snapshot: ParentDataSnapshot = {
        documentRequests: [
          {
            id: "doc-due-soon",
            documentType: "MedicalForm",
            title: "Annual Medical Checkup Form",
            status: "PENDING",
            dueAt: new Date(now.getTime() + 24 * 3600000), // Due in 24h
          },
          {
            id: "doc-rejected",
            documentType: "AddressProof",
            title: "Proof of Address",
            status: "REJECTED",
            rejectionReason: "Electricity bill copy was blurred",
          },
        ],
      };

      const cards = deriveParentFeed(studentId, now, snapshot);
      const docCards = cards.filter((c) => c.cardType === "DocumentRequestCard");
      expect(docCards).toHaveLength(2);

      const dueSoonCard = docCards.find((c) => c.payload.requestId === "doc-due-soon");
      expect(dueSoonCard?.tier).toBe("T1_action_required");

      const rejectedCard = docCards.find((c) => c.payload.requestId === "doc-rejected");
      expect(rejectedCard?.tier).toBe("T1_action_required");
      expect(rejectedCard?.title.en).toContain("Resubmission Required");
    });

    it("emits ProfileChangeCard for PENDING changes and recent decisions, but suppresses old decisions (>48h)", () => {
      const snapshot: ParentDataSnapshot = {
        profileChanges: [
          {
            id: "change-pending",
            field: "address",
            oldValue: { pincode: "560001" },
            newValue: { pincode: "560002" },
            status: "PENDING",
          },
          {
            id: "change-recent-applied",
            field: "demographics",
            oldValue: { bloodGroup: "O+" },
            newValue: { bloodGroup: "A+" },
            status: "APPLIED",
            decidedAt: new Date(now.getTime() - 6 * 3600000), // 6h ago
          },
          {
            id: "change-old-applied",
            field: "medical",
            oldValue: null,
            newValue: { allergy: "Peanuts" },
            status: "APPLIED",
            decidedAt: new Date(now.getTime() - 80 * 3600000), // 80h ago (should be omitted)
          },
        ],
      };

      const cards = deriveParentFeed(studentId, now, snapshot);
      const profileCards = cards.filter((c) => c.cardType === "ProfileChangeCard");
      expect(profileCards).toHaveLength(2);
      expect(profileCards.map((c) => c.payload.requestId)).toContain("change-pending");
      expect(profileCards.map((c) => c.payload.requestId)).toContain("change-recent-applied");
      expect(profileCards.map((c) => c.payload.requestId)).not.toContain("change-old-applied");
    });

    it("emits a SINGLE ConsentCard checklist for multiple pending DPDP consents (OP11, never 1 per purpose)", () => {
      const snapshot: ParentDataSnapshot = {
        pendingConsents: [
          { id: "c1", title: "Year-Book Photo", purpose: "ANNUAL_STUDENT_PHOTO_DIRECTORY" },
          { id: "c2", title: "Bus Field Trip", purpose: "FIELD_TRIP_TRANSPORT" },
          { id: "c3", title: "Academic Partner", purpose: "ACADEMIC_DATA_SHARING" },
        ],
      };

      const cards = deriveParentFeed(studentId, now, snapshot);
      const consentCards = cards.filter((c) => c.cardType === "ConsentCard");

      // STRICT OP11 & Zero-Clutter check: exactly 1 card emitted!
      expect(consentCards).toHaveLength(1);
      expect(consentCards[0]?.payload.totalPending).toBe(3);
      expect(consentCards[0]?.payload.items).toHaveLength(3);
    });
  });

  // ─── 6. Notification Matrix ────────────────────────────────────────────────
  describe("Notification Matrix Event Kinds", () => {
    it("maps Phase P15 event kinds to correct tiers in EVENT_KIND_TIER_MAP", () => {
      expect(EVENT_KIND_TIER_MAP["DOCUMENT_REQUESTED"]).toBe("T2_informational");
      expect(EVENT_KIND_TIER_MAP["DOCUMENT_VERIFIED"]).toBe("T3_system_state");
      expect(EVENT_KIND_TIER_MAP["DOCUMENT_REJECTED"]).toBe("T2_informational");
      expect(EVENT_KIND_TIER_MAP["PROFILE_CHANGE_VERIFIED"]).toBe("T3_system_state");
      expect(EVENT_KIND_TIER_MAP["CONSENT_REMINDER"]).toBe("T1_action_required");
    });

    it("T3 system state events (DOCUMENT_VERIFIED, PROFILE_CHANGE_VERIFIED) suppress web push", () => {
      const decision = evaluateNotificationEligibility({
        studentId,
        parentUserId: "parent-1",
        tier: "T3_system_state",
        eventKind: "DOCUMENT_VERIFIED",
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      });
      expect(decision.outcome).toBe("SKIP_TIER_SYSTEM_STATE");
      expect(decision.shouldPushNow).toBe(false);
    });
  });

  // ─── 7. Bilingual Messages ─────────────────────────────────────────────────
  describe("Bilingual Dictionaries (en.json & hi.json)", () => {
    it("en.json and hi.json contain keys for documentRequestCard, profileChangeCard, and consentCard", () => {
      const enPath = path.resolve(__dirname, "../../../messages/en.json");
      const hiPath = path.resolve(__dirname, "../../../messages/hi.json");

      const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
      const hi = JSON.parse(fs.readFileSync(hiPath, "utf-8"));

      expect(en.documentRequestCard).toBeDefined();
      expect(hi.documentRequestCard).toBeDefined();
      expect(en.documentRequestCard.upload).toBe("Upload Document");
      expect(hi.documentRequestCard.upload).toBe("दस्तावेज़ अपलोड करें");

      expect(en.profileChangeCard).toBeDefined();
      expect(hi.profileChangeCard).toBeDefined();
      expect(en.profileChangeCard.pendingReview).toBe("Pending Review");
      expect(hi.profileChangeCard.pendingReview).toBe("समीक्षाधीन");

      expect(en.consentCard).toBeDefined();
      expect(hi.consentCard).toBeDefined();
    });
  });
});
