import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCachedSession } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { db } from "@/db";
import {
  vehicles,
  routes,
  routeStops,
  studentBusPasses,
  students,
  consentRecords,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import TransportClientTabs from "./TransportClientTabs";
import { getDrivers } from "./actions";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export const metadata: Metadata = {
  title: "Transport Management",
  description: "Manage routes, stops, vehicle tracking, and bus passes.",
};

export default async function TransportPage() {
  const session = await getCachedSession();
  if (!session?.user?.id) redirect("/login");

  const access = assertRouteAccess(session.user.role, "/transport", { id: session.user.id, email: session.user.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const role = session.user.role || "STUDENT";
  const userId = session.user.id || "";
  const schoolId = session?.user?.schoolId || "";
  const isAdmin = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TRANSPORT_MANAGER",
  ].includes(role);

  // Run all queries in parallel with timing and budget assertion (PF-R125)
  const { rawVehicles, routesList, rawPasses, rawStudents, consentRecordsList, driversList } =
    await withDataPhaseTiming("/transport", async () => {
      return assertQueryBudget(
        async () => {
          const [v, r, p, s, c, d] = await Promise.all([
            db.query.vehicles.findMany({
              where: and(eq(vehicles.schoolId, schoolId), isNull(vehicles.deletedAt)),
              orderBy: [vehicles.busNumber],
            }),
            db.query.routes.findMany({
              where: and(eq(routes.schoolId, schoolId), isNull(routes.deletedAt)),
              with: {
                stops: true,
                vehicle: true,
              },
            }),
            db.query.studentBusPasses.findMany({
              where: eq(studentBusPasses.schoolId, schoolId),
              with: {
                route: true,
                stop: true,
                student: true,
              },
            }),
            db.query.students.findMany({
              where: eq(students.schoolId, schoolId),
              columns: {
                id: true,
                firstNameEncrypted: true,
                lastNameEncrypted: true,
              },
              limit: 200,
            }),
            db.query.consentRecords.findMany({
              where: and(
                eq(consentRecords.schoolId, schoolId),
                eq(consentRecords.purposeId, "transport"),
                eq(consentRecords.granted, true),
                isNull(consentRecords.withdrawnAt),
              ),
              columns: { studentId: true },
            }),
            getDrivers().catch(() => []),
          ]);
          return {
            rawVehicles: v,
            routesList: r,
            rawPasses: p,
            rawStudents: s,
            consentRecordsList: c,
            driversList: d,
          };
        },
        { maxQueries: 6, label: "Transport Management" }
      );
    });

  const vehiclesList = rawVehicles.map((v) => ({
    ...v,
    driverName: decryptData(v.driverNameEncrypted) || "",
    driverLicence: decryptData(v.driverLicenceEncrypted) || "",
    driverMobile: decryptData(v.driverMobileEncrypted) || "",
    conductorName: v.conductorNameEncrypted
      ? decryptData(v.conductorNameEncrypted) || ""
      : "",
    conductorMobile: v.conductorMobileEncrypted
      ? decryptData(v.conductorMobileEncrypted) || ""
      : "",
  }));


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
          Monitor vehicles, assign bus passes under DPDP consent, and track
          route progress.
        </p>
      </div>

      <TransportClientTabs
        vehicles={vehiclesList}
        driversList={driversList}
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
