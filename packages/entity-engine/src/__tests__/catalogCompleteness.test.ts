import { describe, it, expect } from "vitest";
import * as schema from "../../../../database/src/schema/index";
import { isTable } from "drizzle-orm";
import { getAllEntities, getEntity } from "../catalog";

describe("Phase E7: Catalog Completeness & Zero-Orphan CI Guard (AC-E12)", () => {
  const drizzleTables = Object.entries(schema)
    .filter(([_, v]) => isTable(v))
    .map(([k, v]: [string, any]) => v[Symbol.for("drizzle:Name")] || v._?.name || k);

  const entities = getAllEntities();
  const entityNames = new Set(entities.map((e) => e.tableName));
  const drizzleSet = new Set(drizzleTables);

  it("asserts every table exported from database/src/schema is registered in ENTITY_GRAPH", () => {
    const missing = drizzleTables.filter((t) => !entityNames.has(t));
    expect(
      missing,
      `The following drizzle tables are missing from ENTITY_GRAPH: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("asserts every table registered in ENTITY_GRAPH exists in Drizzle schema (zero orphans)", () => {
    const orphans = entities
      .filter((e) => !drizzleSet.has(e.tableName))
      .map((e) => e.tableName);
    expect(
      orphans,
      `The following ENTITY_GRAPH tables do not exist in Drizzle schema: ${orphans.join(", ")}`
    ).toEqual([]);
  });

  it("asserts 100% coverage (at least 168 tables registered)", () => {
    expect(entities.length).toBeGreaterThanOrEqual(168);
    expect(drizzleTables.length).toBeGreaterThanOrEqual(168);
    expect(entities.length).toBe(drizzleTables.length);
  });

  it("verifies required catalog metadata on all registered entities", () => {
    for (const entity of entities) {
      expect(entity.tableName).toBeDefined();
      expect(entity.domain).toBeDefined();
      expect(entity.displayName).toBeDefined();
      expect(entity.primaryKey.length).toBeGreaterThan(0);
      expect(Array.isArray(entity.piiColumns)).toBe(true);
      expect(Array.isArray(entity.searchableFields)).toBe(true);
      expect(Array.isArray(entity.tags)).toBe(true);
      expect(Array.isArray(entity.relationships)).toBe(true);

      const retrieved = getEntity(entity.tableName);
      expect(retrieved).toBeDefined();
      expect(retrieved?.tableName).toBe(entity.tableName);
    }
  });
});
