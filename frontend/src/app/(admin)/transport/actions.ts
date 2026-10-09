"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import {
  vehicles,
  routes,
  routeStops,
  studentBusPasses,
  gpsPings,
  students,
  drivers,
  users,
  roles,
  userRoles,
  persons,
} from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { encryptData, decryptData, computeSearchHash } from "@/lib/encryption";
import { assertConsent } from "@/server/middleware/consent";
import { logAuditEvent } from "@/lib/auditLogger";
import bcrypt from "bcryptjs";
import { sendSMS } from "@/lib/sms";

import { headers } from "next/headers";

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TRANSPORT_MANAGER",
] as const;

async function checkAuth() {
  const ctx = await requireAuth(ALLOWED_ROLES);
  const school = await requireSchool(ctx);
  return { ctx, school };
}

// Helper to construct context for logAuditEvent
function makeAuditCtx(ctx: any) {
  let ip = "127.0.0.1";
  let userAgent = "system/server-action";
  try {
    const h = headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
    userAgent = h.get("user-agent") || "system/server-action";
  } catch {}
  return {
    session: {
      user: {
        id: ctx.userId,
        email: ctx.email,
        role: ctx.role,
        schoolId: ctx.schoolId,
      },
    },
    userId: ctx.userId,
    userEmail: ctx.email,
    userRole: ctx.role,
    ip,
    userAgent,
  } as any;
}

export async function saveVehicle(data: {
  id?: string;
  busNumber: string;
  registrationNumber: string;
  capacity: number;
  make?: string;
  model?: string;
  yearOfManufacture?: number;
  driverName?: string;
  driverLicence?: string;
  driverMobile?: string;
  conductorName?: string;
  conductorMobile?: string;
}) {
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

  const values = {
    schoolId,
    busNumber: data.busNumber,
    registrationNumber: data.registrationNumber,
    capacity: data.capacity,
    make: data.make || null,
    model: data.model || null,
    yearOfManufacture: data.yearOfManufacture || null,
    driverNameEncrypted: data.driverName ? encryptData(data.driverName) : null,
    driverLicenceEncrypted: data.driverLicence ? encryptData(data.driverLicence) : null,
    driverMobileEncrypted: data.driverMobile ? encryptData(data.driverMobile) : null,
    conductorNameEncrypted: data.conductorName
      ? encryptData(data.conductorName)
      : null,
    conductorMobileEncrypted: data.conductorMobile
      ? encryptData(data.conductorMobile)
      : null,
    isActive: true,
  };

  let recordId = data.id || "";
  if (data.id) {
    await db
      .update(vehicles)
      .set(values)
      .where(and(eq(vehicles.id, data.id), eq(vehicles.schoolId, schoolId)));
  } else {
    const [inserted] = await db
      .insert(vehicles)
      .values(values)
      .returning({ id: vehicles.id });
    recordId = inserted?.id || "";
  }

  // Audit Log Write
  await logAuditEvent(makeAuditCtx(ctx), {
    action: data.id ? "WRITE" : "WRITE",
    tableName: "vehicles",
    recordId,
    purposeId: "transport",
    schoolId,
    metadata: { busNumber: data.busNumber },
  });

  return { success: true, recordId };
}

export async function registerDriver(data: {
  firstName: string;
  lastName: string;
  mobile: string;
  licenceNumber: string;
  vehicleId?: string;
}) {
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

  const mobileClean = data.mobile.trim();
  const emailDerived = `driver.${mobileClean.slice(-4)}@${school.id.slice(0, 8)}.edu`;

  return await db.transaction(async (tx) => {
    // 1. Check or create User
    let driverUser = await tx.query.users.findFirst({
      where: and(eq(users.schoolId, schoolId), eq(users.email, emailDerived)),
    });

    if (!driverUser) {
      const defaultPassword = `Driver@${mobileClean.slice(-4)}`;
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      const [u] = await tx
        .insert(users)
        .values({
          schoolId,
          email: emailDerived,
          mobileEncrypted: encryptData(mobileClean),
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        })
        .returning();
      driverUser = u;

      // Ensure DRIVER role
      let driverRole = await tx.query.roles.findFirst({
        where: and(eq(roles.schoolId, schoolId), eq(roles.name, "DRIVER")),
      });
      if (!driverRole) {
        const [r] = await tx
          .insert(roles)
          .values({
            schoolId,
            name: "DRIVER",
            displayName: "Bus Driver",
            isSystemRole: true,
          })
          .returning();
        driverRole = r;
      }
      if (driverRole && driverUser) {
        await tx.insert(userRoles).values({
          userId: driverUser.id,
          roleId: driverRole.id,
          schoolId,
        });
      }
    }

    if (!driverUser) throw new Error("Failed to create driver user account");

    // 2. Create canonical person row
    await tx.insert(persons).values({
      schoolId,
      userId: driverUser.id,
      primaryType: "DRIVER",
      firstNameEncrypted: encryptData(data.firstName.trim()),
      lastNameEncrypted: encryptData(data.lastName.trim()),
      firstNameSearchHash: computeSearchHash(data.firstName.trim()),
      lastNameSearchHash: computeSearchHash(data.lastName.trim()),
      gender: "OTHER",
      primaryMobileEncrypted: encryptData(mobileClean),
      isActive: true,
    });

    // 3. Create driver record
    const [d] = await tx
      .insert(drivers)
      .values({
        schoolId,
        userId: driverUser.id,
        vehicleId: data.vehicleId || null,
        nameEncrypted: encryptData(`${data.firstName} ${data.lastName}`.trim()),
        mobileEncrypted: encryptData(mobileClean),
        licenceEncrypted: encryptData(data.licenceNumber.trim()),
        isActive: true,
      })
      .returning();

    return { success: true, driverId: d?.id };
  });
}

export async function getVehicles() {
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

  const list = await db.query.vehicles.findMany({
    where: and(eq(vehicles.schoolId, schoolId), isNull(vehicles.deletedAt)),
    orderBy: [vehicles.busNumber],
  });

  // Query dedicated drivers assigned to these vehicles
  const dedicatedDrivers = await db.query.drivers.findMany({
    where: and(eq(drivers.schoolId, schoolId), isNull(drivers.deletedAt)),
  });

  const driverByVehicleId = new Map<string, any>();
  dedicatedDrivers.forEach((d) => {
    if (d.vehicleId) {
      driverByVehicleId.set(d.vehicleId, d);
    }
  });

  // Decrypt PII details, prioritizing dedicated drivers
  const decryptedList = list.map((v) => {
    const assignedDriver = driverByVehicleId.get(v.id);

    return {
      ...v,
      driverName: assignedDriver
        ? decryptData(assignedDriver.nameEncrypted) || "Driver"
        : v.driverNameEncrypted
        ? decryptData(v.driverNameEncrypted) || ""
        : "",
      driverLicence: assignedDriver
        ? decryptData(assignedDriver.licenceEncrypted) || ""
        : v.driverLicenceEncrypted
        ? decryptData(v.driverLicenceEncrypted) || ""
        : "",
      driverMobile: assignedDriver
        ? decryptData(assignedDriver.mobileEncrypted) || ""
        : v.driverMobileEncrypted
        ? decryptData(v.driverMobileEncrypted) || ""
        : "",
      conductorName: v.conductorNameEncrypted
        ? decryptData(v.conductorNameEncrypted) || ""
        : "",
      conductorMobile: v.conductorMobileEncrypted
        ? decryptData(v.conductorMobileEncrypted) || ""
        : "",
    };
  });

  // Audit Log Read (PII accessed)
  if (decryptedList.length > 0) {
    await logAuditEvent(makeAuditCtx(ctx), {
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
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

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
    const [inserted] = await db
      .insert(routes)
      .values(values)
      .returning({ id: routes.id });
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
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

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
      .where(
        and(eq(routeStops.id, data.id), eq(routeStops.schoolId, schoolId)),
      );
  } else {
    const [inserted] = await db
      .insert(routeStops)
      .values(values)
      .returning({ id: routeStops.id });
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
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

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
      .where(
        and(
          eq(studentBusPasses.id, data.id),
          eq(studentBusPasses.schoolId, schoolId),
        ),
      );
  } else {
    const [inserted] = await db
      .insert(studentBusPasses)
      .values(values)
      .returning({ id: studentBusPasses.id });
    recordId = inserted?.id || "";
  }

  // Audit Log Write (Student Bus Pass allocation)
  await logAuditEvent(makeAuditCtx(ctx), {
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
  await checkAuth();

  const [inserted] = await db
    .insert(gpsPings)
    .values({
      vehicleId: data.vehicleId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      recordedAt: new Date(),
    })
    .returning({ id: gpsPings.id });

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

export async function createDriver(data: {
  name: string;
  mobile: string;
  licenceNumber: string;
  vehicleId?: string | undefined;
  email?: string | undefined;
}) {
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

  const rawMobile = data.mobile.trim().replace(/[^0-9]/g, "");
  if (rawMobile.length < 10) {
    return { success: false, message: "Valid 10-digit mobile number is required." };
  }

  const loginEmail = data.email?.trim().toLowerCase() || `driver.${rawMobile.slice(-10)}@${schoolId.slice(0, 8)}.schoolmitra.local`;

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, loginEmail),
  });
  if (existingUser) {
    return { success: false, message: `A user account with email "${loginEmail}" already exists.` };
  }

  const defaultPassword = `Driver@${rawMobile.slice(-4)}`;
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  const [newUser] = await db
    .insert(users)
    .values({
      schoolId,
      email: loginEmail,
      passwordHash,
      mustChangePassword: true,
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!newUser) {
    return { success: false, message: "Failed to create driver login credentials." };
  }

  // Ensure DRIVER role exists for school
  let driverRole = await db.query.roles.findFirst({
    where: and(eq(roles.schoolId, schoolId), eq(roles.name, "DRIVER")),
  });

  if (!driverRole) {
    const [createdRole] = await db
      .insert(roles)
      .values({
        schoolId,
        name: "DRIVER",
        displayName: "Bus Driver",
        isSystemRole: true,
      })
      .returning();
    driverRole = createdRole;
  }

  if (driverRole) {
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleId: driverRole.id,
      schoolId,
    });
  }

  // Create driver entity
  const [newDriver] = await db
    .insert(drivers)
    .values({
      schoolId,
      vehicleId: data.vehicleId || null,
      userId: newUser.id,
      nameEncrypted: encryptData(data.name.trim()),
      mobileEncrypted: encryptData(data.mobile.trim()),
      licenceEncrypted: encryptData(data.licenceNumber.trim()),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // If vehicle was assigned, update vehicle record driver info
  if (data.vehicleId) {
    await db
      .update(vehicles)
      .set({
        driverNameEncrypted: encryptData(data.name.trim()),
        driverLicenceEncrypted: encryptData(data.licenceNumber.trim()),
        driverMobileEncrypted: encryptData(data.mobile.trim()),
        updatedAt: new Date(),
      })
      .where(and(eq(vehicles.id, data.vehicleId), eq(vehicles.schoolId, schoolId)));
  }

  // Send credentials via SMS/WhatsApp
  const formattedMobile = rawMobile.length === 10 ? `+91${rawMobile}` : `+${rawMobile}`;
  const pwaUrl = process.env.NEXT_PUBLIC_PWA_URL || "http://localhost:3002";
  await sendSMS(
    formattedMobile,
    `Welcome to ${school.name}!\n` +
      `Your Bus Driver login credentials:\n` +
      `Username/Email: ${loginEmail}\n` +
      `Password: ${defaultPassword}\n` +
      `Driver App: ${pwaUrl}\n` +
      `Please change your password upon first login.`
  );

  // Audit log
  await logAuditEvent(makeAuditCtx(ctx), {
    action: "WRITE",
    tableName: "drivers",
    recordId: newDriver?.id || "",
    purposeId: "transport",
    schoolId,
    metadata: { name: data.name, vehicleId: data.vehicleId },
  });

  return { success: true, driverId: newDriver?.id, loginEmail, defaultPassword };
}

export async function getDrivers() {
  const { ctx, school } = await checkAuth();
  const schoolId = school.id;

  const list = await db.query.drivers.findMany({
    where: and(eq(drivers.schoolId, schoolId), isNull(drivers.deletedAt)),
    with: {
      vehicle: true,
      user: true,
    },
    orderBy: [desc(drivers.createdAt)],
  });

  return list.map((d) => ({
    id: d.id,
    name: decryptData(d.nameEncrypted) || "Unknown",
    mobile: decryptData(d.mobileEncrypted) || "",
    licenceNumber: decryptData(d.licenceEncrypted) || "",
    vehicleId: d.vehicleId,
    vehicleBusNumber: d.vehicle?.busNumber || null,
    vehicleRegNumber: d.vehicle?.registrationNumber || null,
    loginEmail: d.user?.email || "",
    isActive: d.isActive,
    mustChangePassword: d.user?.mustChangePassword || false,
    createdAt: d.createdAt,
  }));
}

export async function toggleDriverStatus(driverId: string, isActive: boolean) {
  const { school } = await checkAuth();
  await db
    .update(drivers)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(drivers.id, driverId), eq(drivers.schoolId, school.id)));
  return { success: true };
}

export async function deleteDriver(driverId: string) {
  const { school } = await checkAuth();
  await db
    .update(drivers)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(drivers.id, driverId), eq(drivers.schoolId, school.id)));
  return { success: true };
}

