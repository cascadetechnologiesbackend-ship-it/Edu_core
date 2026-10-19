import { describe, expect, it } from "vitest";
import {
  getAllMigrations,
  getMigrationByIndex,
  getMigrationByTag,
  getMigrationsByDomain,
  getMigrationsForTable,
  MIGRATIONS_CATALOG,
} from "../catalog";
import {
  getAllTableMetas,
  getTableDependencies,
  getTableDependents,
  getTableMeta,
  getTablesByDomain,
  topologicalTableSort,
} from "../schemaGraph";
import { queryMigrationNER } from "../ner";

describe("Database Migrations, Schema Graph & Migration NER", () => {
  describe("1. Migration Catalog Integrity", () => {
    it("catalogs all 44 migrations without sequence gaps", () => {
      const all = getAllMigrations();
      expect(all.length).toBe(44);

      // Verify strict 0 to 43 sequence
      for (let i = 0; i < 44; i++) {
        const m = all[i];
        expect(m).toBeDefined();
        expect(m?.index).toBe(i);
        expect(m?.tag).toMatch(new RegExp(`^00${String(i).padStart(2, "0")}_`));
      }
    });

    it("retrieves migration by index and by tag", () => {
      const initial = getMigrationByIndex(0);
      expect(initial?.tag).toBe("0000_dark_garia");
      expect(initial?.tablesCreated).toContain("schools");
      expect(initial?.tablesCreated).toContain("students");

      const examMig = getMigrationByTag("0036_examinations_new_tables");
      expect(examMig).toBeDefined();
      expect(examMig?.domain).toBe("EXAMINATIONS");
      expect(examMig?.tablesCreated).toContain("exams");
      expect(examMig?.tablesCreated).toContain("mark_entries");
    });

    it("maps tables to creating and altering migrations", () => {
      const feePaymentsMigs = getMigrationsForTable("fee_payments");
      expect(feePaymentsMigs.length).toBeGreaterThanOrEqual(4);
      expect(feePaymentsMigs[0]?.tag).toBe("0000_dark_garia");
    });

    it("filters migrations by functional domain", () => {
      const rlsMigs = getMigrationsByDomain("SECURITY_RLS");
      expect(rlsMigs.length).toBeGreaterThanOrEqual(7);
      expect(rlsMigs.some((m) => m.tag === "0028_enable_rls_tenant_isolation")).toBe(true);
      expect(rlsMigs.some((m) => m.tag === "0041_fail_closed_rls")).toBe(true);
    });
  });

  describe("2. Schema Table Relationship Graph & Topological Sort", () => {
    it("indexes primary keys, foreign keys, and bidirectional references", () => {
      const markEntries = getTableMeta("mark_entries");
      expect(markEntries).toBeDefined();
      expect(markEntries?.primaryKey).toEqual(["id"]);
      expect(markEntries?.createdInMigration).toBe("0036_examinations_new_tables");

      const deps = getTableDependencies("mark_entries");
      expect(deps).toContain("exams");
      expect(deps).toContain("students");
      expect(deps).toContain("subjects");

      const schoolDependents = getTableDependents("schools");
      expect(schoolDependents).toContain("users");
      expect(schoolDependents).toContain("students");
      expect(schoolDependents).toContain("classes");
    });

    it("computes topological DAG sort for safe table seeding order", () => {
      const sorted = topologicalTableSort();
      const allTables = getAllTableMetas().map((t) => t.tableName);

      expect(sorted.length).toBe(allTables.length);

      const schoolIdx = sorted.indexOf("schools");
      const userIdx = sorted.indexOf("users");
      const classIdx = sorted.indexOf("classes");
      const examIdx = sorted.indexOf("exams");
      const markEntryIdx = sorted.indexOf("mark_entries");

      expect(schoolIdx).toBeLessThan(userIdx);
      expect(schoolIdx).toBeLessThan(classIdx);
      expect(schoolIdx).toBeLessThan(examIdx);
      expect(examIdx).toBeLessThan(markEntryIdx);
    });
  });

  describe("3. Migration Named Entity Recognition (NER)", () => {
    it("identifies creating migration for a table", () => {
      const res = queryMigrationNER("which migration created exam_marks_locks");
      expect(res.intent).toBe("INSPECT_MIGRATION");
      expect(res.matchedEntities.some((e) => e.type === "TABLE" && e.value === "exam_marks_locks")).toBe(true);
      expect(res.targetTable?.tableName).toBe("exam_marks_locks");
      expect(res.data?.createdIn).toBe("0040_exam_integrity_closure");
    });

    it("traces foreign key relations from query", () => {
      const res = queryMigrationNER("trace relations of mark_entries");
      expect(res.intent).toBe("TRACE_RELATIONS");
      expect(res.data?.dependencies).toContain("exams");
      expect(res.data?.dependencies).toContain("students");
      expect(res.data?.dependencies).toContain("subjects");
    });

    it("resolves domain migrations", () => {
      const res = queryMigrationNER("show migrations for fees");
      expect(res.intent).toBe("LIST_DOMAIN_MIGRATIONS");
      expect(res.targetDomain).toBe("FEES_FINANCE");
      expect(res.data?.length).toBeGreaterThanOrEqual(5);
    });

    it("resolves topological sort requests", () => {
      const res = queryMigrationNER("topological sort of tables");
      expect(res.intent).toBe("TOPOLOGICAL_SORT");
      expect(res.data?.topologicalOrder).toBeDefined();
      expect(res.data?.topologicalOrder[0]).toBe("schools");
    });

    it("audits PII fields for data privacy", () => {
      const res = queryMigrationNER("audit pii in students");
      expect(res.intent).toBe("AUDIT_PII");
      expect(res.data?.piiColumns).toContain("aadhaarEncrypted");
      expect(res.data?.piiColumns).toContain("apaarIdEncrypted");
    });

    it("executes in < 5ms", () => {
      const res = queryMigrationNER("which migration created exam_schedules");
      expect(res.executionTimeMs).toBeLessThan(10);
    });
  });
});
