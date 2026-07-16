import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { vehicles, routes, routeStops, studentBusPasses, students, consentRecords } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import TransportClientTabs from "./TransportClientTabs";

export const metadata: Metadata = {
  title: "Transport Management",
  description: "Manage routes, stops, vehicle tracking, and bus passes.",
};

export default async function TransportPage() {
  const session = await auth();
  const role = session?.user?.role || "STUDENT";
  const userId = session?.user?.id || "";
  const schoolId = session?.user?.schoolId || "";
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"].includes(role);

  // 1. Fetch vehicles and decrypt PII inline (avoids server action auth context issue)
  const rawVehicles = await db.query.vehicles.findMany({
    where: and(eq(vehicles.schoolId, schoolId), isNull(vehicles.deletedAt)),
    orderBy: [vehicles.busNumber],
  });

  const vehiclesList = rawVehicles.map((v) => ({
    ...v,
    driverName: decryptData(v.driverNameEncrypted) || "",
    driverLicence: decryptData(v.driverLicenceEncrypted) || "",
    driverMobile: decryptData(v.driverMobileEncrypted) || "",
    conductorName: v.conductorNameEncrypted ? decryptData(v.conductorNameEncrypted) || "" : "",
    conductorMobile: v.conductorMobileEncrypted ? decryptData(v.conductorMobileEncrypted) || "" : "",
  }));

  // 2. Fetch routes with stops and vehicles
  const routesList = await db.query.routes.findMany({
    where: and(eq(routes.schoolId, schoolId), isNull(routes.deletedAt)),
    with: {
      stops: true,
      vehicle: true,
    },
  });

  // 3. Fetch bus passes with relations
  const rawPasses = await db.query.studentBusPasses.findMany({
    where: eq(studentBusPasses.schoolId, schoolId),
    with: {
      route: true,
      stop: true,
      student: true,
    },
  });

  const passesList = rawPasses.map((p) => ({
    id: p.id,
    passNumber: p.passNumber,
    studentId: p.studentId,
    routeId: p.routeId,
    routeStopId: p.routeStopId,
    validFrom: p.validFrom.toISOString(),
    validTo: p.validTo.toISOString(),
    qrCodeData: p.qrCodeData,
    studentName: `${decryptData(p.student.firstNameEncrypted)} ${decryptData(p.student.lastNameEncrypted)}`,
    routeName: p.route.routeName,
    stopName: p.stop.stopName,
  }));

  // 4. Fetch students and consent statuses
  const rawStudents = await db.query.students.findMany({
    where: eq(students.schoolId, schoolId),
  });

  const consentRecordsList = await db.query.consentRecords.findMany({
    where: and(
      eq(consentRecords.schoolId, schoolId),
      eq(consentRecords.purposeId, "transport"),
      eq(consentRecords.granted, true),
      isNull(consentRecords.withdrawnAt)
    ),
  });

  const consentSet = new Set(consentRecordsList.map((c) => c.studentId));

  const studentsWithConsent = rawStudents.map((s) => ({
    id: s.id,
    name: `${decryptData(s.firstNameEncrypted)} ${decryptData(s.lastNameEncrypted)}`,
    hasTransportConsent: consentSet.has(s.id),
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Transport Management
        </h1>
        <p className="text-gray-500 mt-1">
          Monitor vehicles, assign bus passes under DPDP consent, and track route progress.
        </p>
      </div>

      <TransportClientTabs
        vehicles={vehiclesList}
        routesList={routesList}
        passes={passesList}
        students={studentsWithConsent}
        role={role}
        userId={userId}
        isAdmin={isAdmin}
      />
    </div>
  );
}

