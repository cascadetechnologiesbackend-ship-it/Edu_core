// ─── Transport Schema ─────────────────────────────────────────────────────────
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  index,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { schools, users } from "./core";

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    busNumber: text("bus_number").notNull(),
    registrationNumber: text("registration_number").notNull(),
    capacity: integer("capacity").notNull(),
    make: text("make"),
    model: text("model"),
    yearOfManufacture: integer("year_of_manufacture"),
    // Driver details — optional / managed via dedicated drivers table
    driverNameEncrypted: text("driver_name_encrypted"),
    driverLicenceEncrypted: text("driver_licence_encrypted"),
    driverMobileEncrypted: text("driver_mobile_encrypted"),
    // Conductor details
    conductorNameEncrypted: text("conductor_name_encrypted"),
    conductorMobileEncrypted: text("conductor_mobile_encrypted"),
    fitnessCertExpiryDate: timestamp("fitness_cert_expiry_date", {
      withTimezone: true,
    }),
    insuranceExpiryDate: timestamp("insurance_expiry_date", {
      withTimezone: true,
    }),
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
    schoolBusUnique: unique("vehicles_school_bus_unique").on(
      t.schoolId,
      t.busNumber,
    ),
    schoolIdx: index("vehicles_school_idx").on(t.schoolId),
  }),
);

export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "restrict",
    }),
    routeName: text("route_name").notNull(),
    routeCode: text("route_code"),
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
    schoolIdx: index("routes_school_idx").on(t.schoolId),
  }),
);

export const routeStops = pgTable(
  "route_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    stopName: text("stop_name").notNull(),
    stopOrder: integer("stop_order").notNull(),
    gpsLatitude: numeric("gps_latitude", { precision: 10, scale: 7 }),
    gpsLongitude: numeric("gps_longitude", { precision: 10, scale: 7 }),
    estimatedArrivalTime: text("estimated_arrival_time"), // "07:30"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    routeStopUnique: unique("route_stops_unique").on(t.routeId, t.stopOrder),
  }),
);

export const studentBusPasses = pgTable(
  "student_bus_passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "restrict" }),
    routeStopId: uuid("route_stop_id")
      .notNull()
      .references(() => routeStops.id, { onDelete: "restrict" }),
    passNumber: text("pass_number").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
    qrCodeData: text("qr_code_data").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    passUnique: unique("student_bus_passes_unique").on(
      t.schoolId,
      t.passNumber,
    ),
    studentIdx: index("student_bus_passes_student_idx").on(t.studentId),
  }),
);

// GPS pings from tracker device (webhook stub)
export const gpsPings = pgTable(
  "gps_pings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    speed: numeric("speed", { precision: 6, scale: 2 }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    vehicleTimeIdx: index("gps_pings_vehicle_time_idx").on(
      t.vehicleId,
      t.recordedAt,
    ),
  }),
);

import { relations } from "drizzle-orm";
import { students } from "./students";

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  routes: many(routes),
  gpsPings: many(gpsPings),
}));

export const routesRelations = relations(routes, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [routes.vehicleId],
    references: [vehicles.id],
  }),
  stops: many(routeStops),
  passes: many(studentBusPasses),
}));

export const routeStopsRelations = relations(routeStops, ({ one, many }) => ({
  route: one(routes, { fields: [routeStops.routeId], references: [routes.id] }),
  passes: many(studentBusPasses),
}));

export const studentBusPassesRelations = relations(
  studentBusPasses,
  ({ one }) => ({
    route: one(routes, {
      fields: [studentBusPasses.routeId],
      references: [routes.id],
    }),
    stop: one(routeStops, {
      fields: [studentBusPasses.routeStopId],
      references: [routeStops.id],
    }),
    student: one(students, {
      fields: [studentBusPasses.studentId],
      references: [students.id],
    }),
  }),
);

export const gpsPingsRelations = relations(gpsPings, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [gpsPings.vehicleId],
    references: [vehicles.id],
  }),
}));

export const busBoardingDirectionEnum = pgEnum("bus_boarding_direction", [
  "BOARDING",
  "ALIGHTING",
]);

export const stopChangeRequestStatusEnum = pgEnum("stop_change_request_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const busBoardingEvents = pgTable(
  "bus_boarding_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    direction: busBoardingDirectionEnum("direction").notNull(),
    scannedByUserId: uuid("scanned_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    scannedAt: timestamp("scanned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
    gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    studentScannedIdx: index("bus_boarding_student_scanned_idx").on(
      t.studentId,
      t.scannedAt
    ),
    routeScannedIdx: index("bus_boarding_route_scanned_idx").on(
      t.routeId,
      t.scannedAt
    ),
    schoolIdx: index("bus_boarding_school_idx").on(t.schoolId),
  })
);

export const stopChangeRequests = pgTable(
  "stop_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    busPassId: uuid("bus_pass_id")
      .notNull()
      .references(() => studentBusPasses.id, { onDelete: "cascade" }),
    requestedStopId: uuid("requested_stop_id")
      .notNull()
      .references(() => routeStops.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    status: stopChangeRequestStatusEnum("status").notNull().default("PENDING"),
    effectiveDate: timestamp("effective_date", { withTimezone: true }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolStatusIdx: index("stop_change_school_status_idx").on(
      t.schoolId,
      t.status
    ),
    parentIdx: index("stop_change_parent_idx").on(t.parentUserId),
    studentIdx: index("stop_change_student_idx").on(t.studentId),
  })
);

export const busBoardingEventsRelations = relations(busBoardingEvents, ({ one }) => ({
  school: one(schools, {
    fields: [busBoardingEvents.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [busBoardingEvents.studentId],
    references: [students.id],
  }),
  route: one(routes, {
    fields: [busBoardingEvents.routeId],
    references: [routes.id],
  }),
  scannedByUser: one(users, {
    fields: [busBoardingEvents.scannedByUserId],
    references: [users.id],
  }),
  vehicle: one(vehicles, {
    fields: [busBoardingEvents.vehicleId],
    references: [vehicles.id],
  }),
}));

export const stopChangeRequestsRelations = relations(stopChangeRequests, ({ one }) => ({
  school: one(schools, {
    fields: [stopChangeRequests.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [stopChangeRequests.studentId],
    references: [students.id],
  }),
  parentUser: one(users, {
    fields: [stopChangeRequests.parentUserId],
    references: [users.id],
  }),
  busPass: one(studentBusPasses, {
    fields: [stopChangeRequests.busPassId],
    references: [studentBusPasses.id],
  }),
  requestedStop: one(routeStops, {
    fields: [stopChangeRequests.requestedStopId],
    references: [routeStops.id],
  }),
  decidedByUser: one(users, {
    fields: [stopChangeRequests.decidedByUserId],
    references: [users.id],
  }),
}));
