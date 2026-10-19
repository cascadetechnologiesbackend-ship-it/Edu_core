import { describe, expect, it } from "vitest";
import {
  getAllDomainsMetadata,
  getAllEntities,
  getDomainMetadata,
  getEntitiesByDomain,
  getEntity,
  getForeignKeys,
  getPIIColumns,
  getReferencingTables,
  topologicalSort,
} from "../catalog";

describe("Database Schema Entity Catalog", () => {
  it("indexes entities across all 12 functional domains", () => {
    const all = getAllEntities();
    expect(all.length).toBeGreaterThanOrEqual(30);

    const domains = getAllDomainsMetadata();
    expect(domains.length).toBe(13); // includes SUPERADMIN_OPS

    const examEntities = getEntitiesByDomain("EXAMINATIONS");
    expect(examEntities.length).toBeGreaterThanOrEqual(10);
    expect(examEntities.some((e) => e.tableName === "exams")).toBe(true);
    expect(examEntities.some((e) => e.tableName === "mark_entries")).toBe(true);

    const feeEntities = getEntitiesByDomain("FEES_FINANCE");
    expect(feeEntities.some((e) => e.tableName === "fee_invoices")).toBe(true);
  });

  it("retrieves entity by table name", () => {
    const students = getEntity("students");
    expect(students).toBeDefined();
    expect(students?.domain).toBe("STUDENTS_LIFECYCLE");
    expect(students?.primaryKey).toEqual(["id"]);
    expect(students?.isTenantScoped).toBe(true);
    expect(students?.piiColumns).toContain("aadhaarEncrypted");
    expect(students?.piiColumns).toContain("bloodGroup");
  });

  it("identifies foreign keys and incoming referencing relationships", () => {
    const markEntriesFKs = getForeignKeys("mark_entries");
    expect(markEntriesFKs.length).toBeGreaterThanOrEqual(3);

    const examFK = markEntriesFKs.find((f) => f.targetTable === "exams");
    expect(examFK).toBeDefined();
    expect(examFK?.sourceColumn).toBe("exam_id");

    const schoolReferrers = getReferencingTables("schools");
    expect(schoolReferrers.length).toBeGreaterThanOrEqual(10);
  });

  it("extracts registered PII columns for data governance", () => {
    const userPII = getPIIColumns("users");
    expect(userPII).toContain("email");
    expect(userPII).toContain("mobileEncrypted");

    const nonPII = getPIIColumns("exam_marks_locks");
    expect(nonPII).toEqual([]);
  });

  it("computes topological sort order for database seeding/migrations", () => {
    const sorted = topologicalSort();
    const allTables = getAllEntities().map((e) => e.tableName);

    expect(sorted.length).toBe(allTables.length);

    // schools should precede dependent tables like classes, exams, users
    const schoolIdx = sorted.indexOf("schools");
    const userIdx = sorted.indexOf("users");
    const examIdx = sorted.indexOf("exams");
    const markEntryIdx = sorted.indexOf("mark_entries");

    expect(schoolIdx).toBeLessThan(userIdx);
    expect(schoolIdx).toBeLessThan(examIdx);
    expect(examIdx).toBeLessThan(markEntryIdx);
  });
});
