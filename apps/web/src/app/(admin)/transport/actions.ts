"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { vehicles, routes, routeStops, studentBusPasses, gpsPings, students } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { encryptData, decryptData } from "@/lib/encryption";
import { assertConsent } from "@/server/middleware/consent";
import { logAuditEvent } from "@/lib/auditLogger";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"];

async function checkAuth() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

// Helper to construct a mock context for logAuditEvent
function makeAuditCtx(session: any) {
  return {
    session,
    ip: "127.0.0.1",
    userAgent: "SchoolMitra ERP Client",
  };
}

export async function saveVehicle(data: {
  id?: string;
  busNumber: string;
  registrationNumber: string;
  capacity: number;
  make?: string;
  model?: string;
  yearOfManufacture?: number;
  driverName: string;
  driverLicence: string;
  driverMobile: string;
  conductorName?: string;
  conductorMobile?: string;
}) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const values = {
    schoolId,
    busNumber: data.busNumber,
    registrationNumber: data.registrationNumber,
    capacity: data.capacity,
    make: data.make || null,
    model: data.model || null,
    yearOfManufacture: data.yearOfManufacture || null,
    driverNameEncrypted: encryptData(data.driverName),
    driverLicenceEncrypted: encryptData(data.driverLicence),
    driverMobileEncrypted: encryptData(data.driverMobile),
    conductorNameEncrypted: data.conductorName ? encryptData(data.conductorName) : null,
    conductorMobileEncrypted: data.conductorMobile ? encryptData(data.conductorMobile) : null,
    isActive: true,
  };

  let recordId = data.id || "";
  if (data.id) {
    await db
      .update(vehicles)
      .set(values)
      .where(and(eq(vehicles.id, data.id), eq(vehicles.schoolId, schoolId)));
  } else {
    const [inserted] = await db.insert(vehicles).values(values).returning({ id: vehicles.id });
    recordId = inserted?.id || "";
  }

  // Audit Log Write
  await logAuditEvent(makeAuditCtx(session) as any, {
    action: data.id ? "WRITE" : "WRITE",
    tableName: "vehicles",
    recordId,
    purposeId: "transport",
    schoolId,
    metadata: { busNumber: data.busNumber },
  });

  return { success: true, recordId };
}

export async function getVehicles() {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const list = await db.query.vehicles.findMany({
    where: and(eq(vehicles.schoolId, schoolId), isNull(vehicles.deletedAt)),
    orderBy: [vehicles.busNumber],
  });

  // Decrypt PII details
  const decryptedList = list.map((v) => ({
    ...v,
    driverName: decryptData(v.driverNameEncrypted) || "",
    driverLicence: decryptData(v.driverLicenceEncrypted) || "",
    driverMobile: decryptData(v.driverMobileEncrypted) || "",
    conductorName: v.conductorNameEncrypted ? decryptData(v.conductorNameEncrypted) || "" : "",
    conductorMobile: v.conductorMobileEncrypted ? decryptData(v.conductorMobileEncrypted) || "" : "",
  }));

  // Audit Log Read (PII accessed)
  if (decryptedList.length > 0) {
    await logAuditEvent(makeAuditCtx(session) as any, {
      action: "READ",
      tableName: "vehicles",
      recordId: decryptedList[0]?.id || "BULK",
      purposeId: "transport",
      schoolId,
      metadata: { count: decryptedList.length },
    });
  }

  return decryptedList;
}

export async function saveRoute(data: {
  id?: string;
  vehicleId?: string;
  routeName: string;
  routeCode?: string;
}) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const values = {
    schoolId,
    vehicleId: data.vehicleId || null,
    routeName: data.routeName,
    routeCode: data.routeCode || null,
    isActive: true,
  };

  let recordId = data.id || "";
  if (data.id) {
    await db
      .update(routes)
      .set(values)
      .where(and(eq(routes.id, data.id), eq(routes.schoolId, schoolId)));
  } else {
    const [inserted] = await db.insert(routes).values(values).returning({ id: routes.id });
    recordId = inserted?.id || "";
  }

  return { success: true, recordId };
}

export async function saveRouteStop(data: {
  id?: string;
  routeId: string;
  stopName: string;
  stopOrder: number;
  gpsLatitude?: string;
  gpsLongitude?: string;
  estimatedArrivalTime?: string;
}) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  const values = {
    schoolId,
    routeId: data.routeId,
    stopName: data.stopName,
    stopOrder: data.stopOrder,
    gpsLatitude: data.gpsLatitude || null,
    gpsLongitude: data.gpsLongitude || null,
    estimatedArrivalTime: data.estimatedArrivalTime || null,
  };

  let recordId = data.id || "";
  if (data.id) {
    await db
      .update(routeStops)
      .set(values)
      .where(and(eq(routeStops.id, data.id), eq(routeStops.schoolId, schoolId)));
  } else {
    const [inserted] = await db.insert(routeStops).values(values).returning({ id: routeStops.id });
    recordId = inserted?.id || "";
  }

  return { success: true, recordId };
}

export async function saveBusPass(data: {
  id?: string;
  studentId: string;
  routeId: string;
  routeStopId: string;
  validFrom: string;
  validTo: string;
}) {
  const session = await checkAuth();
  const schoolId = session.user.schoolId!;

  // ─── DPDP CONSENT ENFORCEMENT ───
  // Section 9 / Standing Instructions: Check Consent before student PII assignment
  await assertConsent(data.studentId, "transport");

  // Fetch student roll number or admission number for pass format
  const studentRec = await db.query.students.findFirst({
    where: eq(students.id, data.studentId),
  });
  const admissionNumber = studentRec?.admissionNumber || "TEMP";

  const passNumber = `PASS/BUS/${admissionNumber}/${Date.now().toString().slice(-4)}`;
  const qrCodeData = JSON.stringify({
    passNumber,
    studentId: data.studentId,
    routeId: data.routeId,
    stopId: data.routeStopId,
    validFrom: data.validFrom,
    validTo: data.validTo,
  });

  const values = {
    schoolId,
    studentId: data.studentId,
    routeId: data.routeId,
    routeStopId: data.routeStopId,
    passNumber,
    validFrom: new Date(data.validFrom),
    validTo: new Date(data.validTo),
    qrCodeData,
    isActive: true,
  };

  let recordId = data.id || "";
  if (data.id) {
    await db
      .update(studentBusPasses)
      .set(values)
      .where(and(eq(studentBusPasses.id, data.id), eq(studentBusPasses.schoolId, schoolId)));
  } else {
    const [inserted] = await db
      .insert(studentBusPasses)
      .values(values)
      .returning({ id: studentBusPasses.id });
    recordId = inserted?.id || "";
  }

  // Audit Log Write (Student Bus Pass allocation)
  await logAuditEvent(makeAuditCtx(session) as any, {
    action: data.id ? "WRITE" : "WRITE",
    tableName: "student_bus_passes",
    recordId,
    purposeId: "transport",
    schoolId,
    metadata: { studentId: data.studentId, passNumber },
  });

  return { success: true, recordId, passNumber };
}

export async function submitGpsPing(data: {
  vehicleId: string;
  latitude: string;
  longitude: string;
  speed: string;
}) {
  // Webhook endpoint equivalent for simulation pings
  const session = await checkAuth();

  const [inserted] = await db.insert(gpsPings).values({
    vehicleId: data.vehicleId,
    latitude: data.latitude,
    longitude: data.longitude,
    speed: data.speed,
    recordedAt: new Date(),
  }).returning({ id: gpsPings.id });

  return { success: true, id: inserted?.id };
}

export async function getLiveGpsPing(vehicleId: string) {
  // Fetch latest ping for map
  const ping = await db.query.gpsPings.findFirst({
    where: eq(gpsPings.vehicleId, vehicleId),
    orderBy: [desc(gpsPings.recordedAt)], // Order desc
  });
  return ping;
}
