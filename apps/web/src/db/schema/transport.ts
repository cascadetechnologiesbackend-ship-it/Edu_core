// ─── Transport Schema ─────────────────────────────────────────────────────────
import {
  pgTable, uuid, text, boolean, timestamp, integer, numeric, pgEnum, index, unique,
} from "drizzle-orm/pg-core";
import { schools } from "./core";

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  busNumber: text("bus_number").notNull(),
  registrationNumber: text("registration_number").notNull(),
  capacity: integer("capacity").notNull(),
  make: text("make"),
  model: text("model"),
  yearOfManufacture: integer("year_of_manufacture"),
  // Driver details — PII encrypted
  driverNameEncrypted: text("driver_name_encrypted").notNull(),
  driverLicenceEncrypted: text("driver_licence_encrypted").notNull(),
  driverMobileEncrypted: text("driver_mobile_encrypted").notNull(),
  // Conductor details
  conductorNameEncrypted: text("conductor_name_encrypted"),
  conductorMobileEncrypted: text("conductor_mobile_encrypted"),
  fitnessCertExpiryDate: timestamp("fitness_cert_expiry_date", { withTimezone: true }),
  insuranceExpiryDate: timestamp("insurance_expiry_date", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  schoolBusUnique: unique("vehicles_school_bus_unique").on(t.schoolId, t.busNumber),
  schoolIdx: index("vehicles_school_idx").on(t.schoolId),
}));

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "restrict" }),
  routeName: text("route_name").notNull(),
  routeCode: text("route_code"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  schoolIdx: index("routes_school_idx").on(t.schoolId),
}));

export const routeStops = pgTable("route_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id").notNull().references(() => routes.id, { onDelete: "restrict" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  stopName: text("stop_name").notNull(),
  stopOrder: integer("stop_order").notNull(),
  gpsLatitude: numeric("gps_latitude", { precision: 10, scale: 7 }),
  gpsLongitude: numeric("gps_longitude", { precision: 10, scale: 7 }),
  estimatedArrivalTime: text("estimated_arrival_time"), // "07:30"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  routeStopUnique: unique("route_stops_unique").on(t.routeId, t.stopOrder),
}));

export const studentBusPasses = pgTable("student_bus_passes", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  routeId: uuid("route_id").notNull().references(() => routes.id, { onDelete: "restrict" }),
  routeStopId: uuid("route_stop_id").notNull().references(() => routeStops.id, { onDelete: "restrict" }),
  passNumber: text("pass_number").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
  qrCodeData: text("qr_code_data").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  passUnique: unique("student_bus_passes_unique").on(t.schoolId, t.passNumber),
  studentIdx: index("student_bus_passes_student_idx").on(t.studentId),
}));

// GPS pings from tracker device (webhook stub)
export const gpsPings = pgTable("gps_pings", {
  id: uuid("id").primaryKey().defaultRandom(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "restrict" }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  speed: numeric("speed", { precision: 6, scale: 2 }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vehicleTimeIdx: index("gps_pings_vehicle_time_idx").on(t.vehicleId, t.recordedAt),
}));
