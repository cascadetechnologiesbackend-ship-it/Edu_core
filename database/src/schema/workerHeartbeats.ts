import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const workerHeartbeats = pgTable("worker_heartbeats", {
  id: uuid("id").defaultRandom().primaryKey(),
  workerName: text("worker_name").notNull().unique(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("alive"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
