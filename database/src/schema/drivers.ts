// ─── Drivers Schema ──────────────────────────────────────────────────────────
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, users } from "./core";
import { vehicles } from "./transport";

export const drivers = pgTable(
  "drivers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    nameEncrypted: text("name_encrypted").notNull(),
    mobileEncrypted: text("mobile_encrypted").notNull(),
    licenceEncrypted: text("licence_encrypted").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("drivers_school_idx").on(t.schoolId),
    vehicleIdx: index("drivers_vehicle_idx").on(t.vehicleId),
    userIdx: index("drivers_user_idx").on(t.userId),
    userUnique: unique("drivers_user_unique").on(t.userId),
  }),
);

export const driversRelations = relations(drivers, ({ one }) => ({
  school: one(schools, {
    fields: [drivers.schoolId],
    references: [schools.id],
  }),
  vehicle: one(vehicles, {
    fields: [drivers.vehicleId],
    references: [vehicles.id],
  }),
  user: one(users, {
    fields: [drivers.userId],
    references: [users.id],
  }),
}));
