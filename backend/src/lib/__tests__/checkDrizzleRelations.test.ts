import { describe, it } from "vitest";
import { db } from "@schoolmitra/database";

describe("Drizzle Schema Relations Integrity", () => {
  it("initializes all relational queries without error", async () => {
    // Try accessing any table query builder to trigger Drizzle schema relational config extraction
    for (const [name, entity] of Object.entries(db.query)) {
      try {
        console.log(`Checking relational builder for: ${name}`);
        // Calling toSQL on an empty query triggers relational normalization
        (entity as any).findFirst();
      } catch (err: any) {
        console.error(`Failed on entity: ${name}`, err);
        throw err;
      }
    }
  });
});
