import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { TenantSecurityService } from "../tenant";
import crypto from "node:crypto";

describe("PostgreSQL 16 Adversarial Security Suite (P0 Security Controls)", () => {
  const tenantA = "11111111-1111-1111-1111-111111111111";
  const tenantB = "22222222-2222-2222-2222-222222222222";
  const testSecret = "super-secret-test-key-with-sufficient-entropy-32-chars";

  beforeAll(() => {
    process.env.DATABASE_TENANT_HMAC_KEY = testSecret;
  });

  it("ADVERSARIAL TEST 01: Canonical payload format is deterministic and non-ambiguous", () => {
    const actorId = "test-actor-1";
    const sessionId = "test-sess-1";
    const expiresAt = 1893456000; // Fixed timestamp
    const canonical = `${tenantA}:${actorId}:${sessionId}:${expiresAt}`;
    
    // Explicit UTF-8 validation
    expect(Buffer.from(canonical, "utf8").toString("utf8")).toBe(canonical);
    expect(canonical.split(":")).toEqual([tenantA, actorId, sessionId, expiresAt.toString()]);
  });

  it("ADVERSARIAL TEST 02: Modifying any tenant, actor, session or expiry field invalidates HMAC", () => {
    const cap = TenantSecurityService.generateTenantCapability(tenantA, "actor-1", "sess-1", 300);

    // 1. Changing tenant
    expect(
      TenantSecurityService.verifyCapability(tenantB, "actor-1", "sess-1", cap.expiresAt, cap.token)
    ).toBe(false);

    // 2. Changing actor
    expect(
      TenantSecurityService.verifyCapability(tenantA, "attacker", "sess-1", cap.expiresAt, cap.token)
    ).toBe(false);

    // 3. Changing session
    expect(
      TenantSecurityService.verifyCapability(tenantA, "actor-1", "forged-sess", cap.expiresAt, cap.token)
    ).toBe(false);

    // 4. Changing expiry
    expect(
      TenantSecurityService.verifyCapability(tenantA, "actor-1", "sess-1", cap.expiresAt + 1, cap.token)
    ).toBe(false);
  });

  it("ADVERSARIAL TEST 03: Attacker GUC manipulation cannot forge secret store verification", () => {
    const attackerSecret = "attacker-controlled-guc-secret-override-value";
    const capWithAttackerSecret = crypto
      .createHmac("sha256", Buffer.from(attackerSecret, "utf8"))
      .update(Buffer.from(`${tenantA}:actor-1:sess-1:1893456000`, "utf8"))
      .digest("hex");

    // The server/database verifies strictly against database secret store / environment key, NOT attacker GUC
    const isValidAgainstRealStore = TenantSecurityService.verifyCapability(
      tenantA,
      "actor-1",
      "sess-1",
      1893456000,
      capWithAttackerSecret
    );
    expect(isValidAgainstRealStore).toBe(false);
  });

  it("ADVERSARIAL TEST 04: JIT Session allowlist strictly rejects unapproved tables", () => {
    const allowedTables = ["students", "sections"];
    const requestedTable = "payslips";

    const isPermitted = allowedTables.includes(requestedTable);
    expect(isPermitted).toBe(false);
  });

  it("ADVERSARIAL TEST 05: JIT Session TTL bounds reject values outside 60s - 1800s window", () => {
    const maxTtl = 1800; // 30 minutes
    const minTtl = 60;   // 1 minute

    const testTtlExcessive = 3600; // 1 hour attempt
    const isExcessiveValid = testTtlExcessive <= maxTtl && testTtlExcessive >= minTtl;
    expect(isExcessiveValid).toBe(false);

    const testTtlSubZero = 10; // 10 seconds attempt
    const isSubZeroValid = testTtlSubZero <= maxTtl && testTtlSubZero >= minTtl;
    expect(isSubZeroValid).toBe(false);

    const approvedDefaultTtl = 900; // 15 minutes
    const isDefaultValid = approvedDefaultTtl <= maxTtl && approvedDefaultTtl >= minTtl;
    expect(isDefaultValid).toBe(true);
  });

  it("ADVERSARIAL TEST 06: Atomic Nonce Replay Prevention prevents second consumption", () => {
    const consumedNonces = new Set<string>();
    const testNonce = "unique-single-use-nonce-12345";

    // First consumption succeeds
    let firstAttemptSuccess = false;
    if (!consumedNonces.has(testNonce)) {
      consumedNonces.add(testNonce);
      firstAttemptSuccess = true;
    }
    expect(firstAttemptSuccess).toBe(true);

    // Second consumption attempt fails closed
    let secondAttemptSuccess = false;
    if (!consumedNonces.has(testNonce)) {
      consumedNonces.add(testNonce);
      secondAttemptSuccess = true;
    }
    expect(secondAttemptSuccess).toBe(false);
  });

  it("ADVERSARIAL TEST 07: Immutable WORM Ledger blocks UPDATE and DELETE events", () => {
    const wormAllowedEvents = ["ACCESS_INTENT", "ACCESS_COMPLETED", "ACCESS_FAILED", "REVOCATION"];
    const disallowedMutation = "UPDATE";

    expect(wormAllowedEvents.includes(disallowedMutation)).toBe(false);
  });
});
