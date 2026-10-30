/**
 * S23 Role Console Truth Domain Engine
 *
 * Provides authoritative, live, tenant-scoped operational metrics for:
 * 1. Principal Executive Dashboard (sections, teaching faculty, student attendance rate, pending exam marks locks)
 * 2. Librarian Operations Console (book volume, available copies, active issues, overdue returns, categories)
 * 3. Transport Operations Console (fleet vehicles, routes, stops, student pass opt-ins, maintenance alerts, GPS recency)
 *
 * Invariants:
 * - Fail-closed multi-tenant isolation via withTenant(schoolId).
 * - Zero fabricated numbers: newly provisioned or empty tenants render honest zeros.
 * - Single source of truth: derives from canonical database tables without shadow write-paths.
 */

import {
  sections,
  staff,
  studentAttendance,
  staffAttendance,
  examMarksLocks,
  books,
  bookCopies,
  bookIssues,
  vehicles,
  routes,
  routeStops,
  studentBusPasses,
  gpsPings,
} from "@schoolmitra/database";
import { eq, and, isNull, inArray, desc, gte, lte } from "drizzle-orm";
import { withTenant } from "./tenant";

// ─── 1. Principal Executive Console Metrics ──────────────────────────────────

export interface PrincipalConsoleMetrics {
  activeSectionsCount: number;
  activeTeachingStaffCount: number;
  todayStudentAttendance: {
    totalMarked: number;
    presentCount: number;
    ratePercent: number | null;
    formattedPercent: string;
    isMarkedToday: boolean;
  };
  pendingExamVerificationsCount: number;
  staffAttendanceRate: {
    totalMarked: number;
    presentCount: number;
    ratePercent: number;
    formattedPercent: string;
  } | null;
}

export async function getPrincipalConsoleMetrics(
  schoolId: string,
  options?: { now?: Date }
): Promise<PrincipalConsoleMetrics> {
  return await withTenant(schoolId, async (tenantDb) => {
    const now = options?.now ?? new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      activeSections,
      activeStaffList,
      todayAttendanceRows,
      pendingLocks,
      todayStaffAttendanceRows,
    ] = await Promise.all([
      // 1. Active class sections
      tenantDb.query.sections.findMany({
        where: and(eq(sections.schoolId, schoolId), eq(sections.isActive, true)),
        columns: { id: true },
      }),

      // 2. Active staff members
      tenantDb.query.staff.findMany({
        where: and(
          eq(staff.schoolId, schoolId),
          eq(staff.isActive, true),
          isNull(staff.deletedAt)
        ),
        with: {
          designation: true,
        },
      }),

      // 3. Today's student attendance records
      tenantDb.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.schoolId, schoolId),
          gte(studentAttendance.attendanceDate, startOfDay),
          lte(studentAttendance.attendanceDate, endOfDay)
        ),
        columns: { id: true, status: true },
      }),

      // 4. Pending exam mark locks (SUBMITTED by teacher, waiting for principal lock/approval)
      tenantDb.query.examMarksLocks.findMany({
        where: and(
          eq(examMarksLocks.schoolId, schoolId),
          eq(examMarksLocks.status, "SUBMITTED")
        ),
        columns: { id: true },
      }),

      // 5. Today's staff attendance records (OD3: compute if populated)
      tenantDb.query.staffAttendance.findMany({
        where: and(
          eq(staffAttendance.schoolId, schoolId),
          gte(staffAttendance.attendanceDate, startOfDay),
          lte(staffAttendance.attendanceDate, endOfDay)
        ),
        columns: { id: true, status: true },
      }),
    ]);

    // Active sections count
    const activeSectionsCount = activeSections.length;

    // Filter teaching faculty: check if any designation explicitly flags isTeaching
    const hasTeachingFlags = activeStaffList.some((s) => s.designation?.isTeaching === true);
    const teachingStaff = hasTeachingFlags
      ? activeStaffList.filter((s) => s.designation?.isTeaching === true)
      : activeStaffList;
    const activeTeachingStaffCount = teachingStaff.length;

    // Calculate student attendance metrics
    let todayStudentAttendance: PrincipalConsoleMetrics["todayStudentAttendance"];
    if (todayAttendanceRows.length === 0) {
      todayStudentAttendance = {
        totalMarked: 0,
        presentCount: 0,
        ratePercent: null,
        formattedPercent: "Not Marked",
        isMarkedToday: false,
      };
    } else {
      const nonHolidays = todayAttendanceRows.filter((r) => r.status !== "HOLIDAY");
      const totalMarked = nonHolidays.length;
      const presentCount = nonHolidays.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE"
      ).length;
      const ratePercent = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 1000) / 10 : 0;
      todayStudentAttendance = {
        totalMarked,
        presentCount,
        ratePercent,
        formattedPercent: `${ratePercent.toFixed(1)}%`,
        isMarkedToday: true,
      };
    }

    // Pending marks verifications
    const pendingExamVerificationsCount = pendingLocks.length;

    // Calculate staff attendance rate (OD3: null if 0 records exist for today)
    let staffAttendanceRate: PrincipalConsoleMetrics["staffAttendanceRate"] = null;
    if (todayStaffAttendanceRows.length > 0) {
      const totalStaff = todayStaffAttendanceRows.length;
      const presentStaff = todayStaffAttendanceRows.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE"
      ).length;
      const staffRate = Math.round((presentStaff / totalStaff) * 1000) / 10;
      staffAttendanceRate = {
        totalMarked: totalStaff,
        presentCount: presentStaff,
        ratePercent: staffRate,
        formattedPercent: `${staffRate.toFixed(1)}%`,
      };
    }

    return {
      activeSectionsCount,
      activeTeachingStaffCount,
      todayStudentAttendance,
      pendingExamVerificationsCount,
      staffAttendanceRate,
    };
  });
}

// ─── 2. Librarian Operations Console Metrics ────────────────────────────────

export interface LibrarianConsoleMetrics {
  totalCopies: number;
  availableCopies: number;
  currentlyIssued: number;
  overdueCount: number;
  distinctCategoriesCount: number;
  topCategories: Array<{ category: string; count: number }>;
}

export async function getLibrarianConsoleMetrics(
  schoolId: string,
  options?: { now?: Date }
): Promise<LibrarianConsoleMetrics> {
  return await withTenant(schoolId, async (tenantDb) => {
    const now = options?.now ?? new Date();

    const [activeBooks, allIssues] = await Promise.all([
      // 1. Books and their physical copies
      tenantDb.query.books.findMany({
        where: and(eq(books.schoolId, schoolId), isNull(books.deletedAt)),
        columns: {
          id: true,
          totalCopies: true,
          availableCopies: true,
          category: true,
        },
        with: {
          copies: {
            where: isNull(bookCopies.deletedAt),
            columns: { id: true, isAvailable: true },
          },
        },
      }),

      // 2. Book checkout issues
      tenantDb.query.bookIssues.findMany({
        where: eq(bookIssues.schoolId, schoolId),
        columns: { id: true, status: true, dueDate: true, returnedAt: true },
      }),
    ]);

    // Total and available copies across inventory
    let totalCopies = 0;
    let availableCopies = 0;
    const categoryCountMap = new Map<string, number>();

    for (const b of activeBooks) {
      if (b.copies && b.copies.length > 0) {
        totalCopies += b.copies.length;
        availableCopies += b.copies.filter((c) => c.isAvailable).length;
      } else {
        totalCopies += b.totalCopies;
        availableCopies += b.availableCopies;
      }

      if (b.category && b.category.trim()) {
        const cat = b.category.trim();
        categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + 1);
      }
    }

    // Active issues and overdue checkouts
    const activeIssues = allIssues.filter(
      (i) => !i.returnedAt && i.status !== "RETURNED" && i.status !== "LOST"
    );
    const currentlyIssued = activeIssues.length;

    const overdueCount = activeIssues.filter(
      (i) => new Date(i.dueDate).getTime() < now.getTime() || i.status === "OVERDUE"
    ).length;

    const distinctCategoriesCount = categoryCountMap.size;
    const topCategories = Array.from(categoryCountMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalCopies,
      availableCopies,
      currentlyIssued,
      overdueCount,
      distinctCategoriesCount,
      topCategories,
    };
  });
}

// ─── 3. Transport Operations Console Metrics ────────────────────────────────

export interface TransportConsoleMetrics {
  activeVehiclesCount: number;
  activeRoutesCount: number;
  pickupStopsCount: number;
  optedInStudentsCount: number;
  maintenanceAlertsCount: number;
  vehiclesWithMaintenanceAlert: Array<{
    vehicleId: string;
    busNumber: string;
    issue: string;
  }>;
  activeGpsVehiclesCount: number;
  gpsStatus: {
    hasActivePings: boolean;
    lastPingAt: Date | null;
    pingRecencyLabel: string;
  };
}

export async function getTransportConsoleMetrics(
  schoolId: string,
  options?: { now?: Date }
): Promise<TransportConsoleMetrics> {
  return await withTenant(schoolId, async (tenantDb) => {
    const now = options?.now ?? new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [activeVehicles, activeRoutes, activePasses] = await Promise.all([
      // 1. Active vehicles
      tenantDb.query.vehicles.findMany({
        where: and(eq(vehicles.schoolId, schoolId), isNull(vehicles.deletedAt)),
        columns: {
          id: true,
          busNumber: true,
          registrationNumber: true,
          fitnessCertExpiryDate: true,
          insuranceExpiryDate: true,
          isActive: true,
        },
      }),

      // 2. Active routes with pickup stops
      tenantDb.query.routes.findMany({
        where: and(eq(routes.schoolId, schoolId), isNull(routes.deletedAt)),
        columns: { id: true, vehicleId: true, isActive: true },
        with: {
          stops: {
            columns: { id: true },
          },
        },
      }),

      // 3. Active student bus passes
      tenantDb.query.studentBusPasses.findMany({
        where: and(eq(studentBusPasses.schoolId, schoolId), eq(studentBusPasses.isActive, true)),
        columns: { id: true, studentId: true },
      }),
    ]);

    const activeVehiclesCount = activeVehicles.length;
    const activeRoutesCount = activeRoutes.length;
    const pickupStopsCount = activeRoutes.reduce((sum, r) => sum + (r.stops?.length ?? 0), 0);

    // Unique students opted into transport
    const optedInStudentsCount = new Set(activePasses.map((p) => p.studentId)).size;

    // Real maintenance alerts: expired or upcoming (<30d) fitness or insurance
    const vehiclesWithMaintenanceAlert: TransportConsoleMetrics["vehiclesWithMaintenanceAlert"] = [];
    for (const v of activeVehicles) {
      const issues: string[] = [];
      if (v.fitnessCertExpiryDate) {
        const fitDate = new Date(v.fitnessCertExpiryDate);
        if (fitDate < now) {
          issues.push("Fitness expired");
        } else if (fitDate < thirtyDaysFromNow) {
          issues.push("Fitness check due");
        }
      }
      if (v.insuranceExpiryDate) {
        const insDate = new Date(v.insuranceExpiryDate);
        if (insDate < now) {
          issues.push("Insurance expired");
        } else if (insDate < thirtyDaysFromNow) {
          issues.push("Insurance renewal due");
        }
      }

      if (issues.length > 0) {
        vehiclesWithMaintenanceAlert.push({
          vehicleId: v.id,
          busNumber: v.busNumber,
          issue: issues.join(", "),
        });
      }
    }
    const maintenanceAlertsCount = vehiclesWithMaintenanceAlert.length;

    // Real GPS telemetry recency per vehicle
    const vehicleIds = activeVehicles.map((v) => v.id);
    let latestPingAt: Date | null = null;
    let activeGpsVehiclesCount = 0;

    if (vehicleIds.length > 0) {
      const recentPings = await tenantDb.query.gpsPings.findMany({
        where: inArray(gpsPings.vehicleId, vehicleIds),
        orderBy: [desc(gpsPings.recordedAt)],
        limit: 50,
      });

      const activeGpsSet = new Set<string>();
      for (const p of recentPings) {
        const pDate = new Date(p.recordedAt);
        if (!latestPingAt || pDate > latestPingAt) {
          latestPingAt = pDate;
        }
        if (pDate >= fifteenMinsAgo) {
          activeGpsSet.add(p.vehicleId);
        }
      }
      activeGpsVehiclesCount = activeGpsSet.size;
    }

    let pingRecencyLabel = "No recent GPS signal";
    if (latestPingAt) {
      const diffMs = now.getTime() - latestPingAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) {
        pingRecencyLabel = "Live (just now)";
      } else if (diffMins < 60) {
        pingRecencyLabel = `Active (${diffMins}m ago)`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        pingRecencyLabel = `Last ping ${diffHours}h ago`;
      }
    }

    const gpsStatus = {
      hasActivePings: activeGpsVehiclesCount > 0,
      lastPingAt: latestPingAt,
      pingRecencyLabel,
    };

    return {
      activeVehiclesCount,
      activeRoutesCount,
      pickupStopsCount,
      optedInStudentsCount,
      maintenanceAlertsCount,
      vehiclesWithMaintenanceAlert,
      activeGpsVehiclesCount,
      gpsStatus,
    };
  });
}
