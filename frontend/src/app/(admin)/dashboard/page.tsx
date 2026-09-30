import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  books,
  bookIssues,
  vehicles,
  routes,
  studentBusPasses,
  students,
  studentAttendance,
  sections,
} from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  Users,
  IndianRupee,
  CalendarCheck,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Bus,
  Shield,
  Book,
  UserCheck,
  CheckCircle,
  Info,
  Navigation,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  subtext?: string;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  icon: any;
  iconBgClass: string;
  accentColor: string;
}

function MetricCard({
  title,
  value,
  subtext,
  trend,
  icon: Icon,
  iconBgClass,
  accentColor,
}: MetricCardProps) {
  return (
    <div className="metric-card group relative overflow-hidden bg-card border border-border p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tracking-tight">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                trend.direction === "up"
                  ? "text-secondary"
                  : trend.direction === "down"
                    ? "text-danger"
                    : "text-muted-foreground"
              }`}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="w-3 h-3" aria-hidden="true" />
              ) : trend.direction === "down" ? (
                <TrendingDown className="w-3 h-3" aria-hidden="true" />
              ) : null}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-4 ${iconBgClass}`}
        >
          <Icon className={`w-6 h-6 ${accentColor}`} aria-hidden="true" />
        </div>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 ${accentColor.replace("text-", "bg-")}`}
      />
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({
  label,
  href,
  className,
}: {
  label: string;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      {label}
    </a>
  );
}

// ─── Dashboard Component Renderers ──────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role || "STUDENT";
  const schoolId = session?.user?.schoolId || "";

  // 1. Core Counts & Queries (cached/shared where appropriate)
  const totalStudentsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(students)
    .where(eq(students.schoolId, schoolId));
  const totalStudents = totalStudentsCount[0]?.count || 0;

  // Render dashboard layout based on the active role
  if (role === "TEACHER") {
    // ─── TEACHER DASHBOARD ───
    const activeTeacherSections = await db.query.sections.findMany({
      where: eq(sections.classTeacherId, session?.user?.id || ""),
    });

    const metrics = [
      {
        title: "Assigned Classrooms",
        value: activeTeacherSections.length.toString(),
        subtext:
          activeTeacherSections.map((s) => s.name).join(", ") ||
          "No homeroom assigned",
        icon: UserCheck,
        iconBgClass: "bg-primary/10",
        accentColor: "text-primary",
      },
      {
        title: "Total Students under care",
        value:
          totalStudents > 0 ? Math.ceil(totalStudents / 10).toString() : "0", // Mock subset
        subtext: "Academic Year 2025-26",
        icon: Users,
        iconBgClass: "bg-secondary/10",
        accentColor: "text-secondary",
      },
      {
        title: "Marked Attendance today",
        value: activeTeacherSections.length > 0 ? "100%" : "0%",
        subtext: "Homeroom sections status",
        icon: CalendarCheck,
        iconBgClass: "bg-warning/20",
        accentColor: "text-warning",
      },
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back, Teacher 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage your classrooms, student attendance, and homework
              assignments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QuickAction
              label="Mark Attendance"
              href="/attendance"
              className="bg-primary text-white hover:bg-primary/90"
            />
            <QuickAction
              label="Academics Master"
              href="/academics"
              className="bg-secondary/10 text-secondary hover:bg-secondary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <MetricCard key={m.title} {...m} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" /> Active Tasks
            </h2>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <span>Check and grade homework assignments</span>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                  Pending
                </span>
              </li>
              <li className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <span>Update weekly lesson planning calendar</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                  Weekly
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (role === "LIBRARIAN") {
    // ─── LIBRARIAN DASHBOARD ───
    const booksCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(eq(books.schoolId, schoolId));
    const activeIssues = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookIssues)
      .where(
        and(eq(bookIssues.schoolId, schoolId), eq(bookIssues.status, "ISSUED")),
      );

    const metrics = [
      {
        title: "Total Catalog Books",
        value: (booksCount[0]?.count || 0).toString(),
        subtext: "Volumes registered in system",
        icon: Book,
        iconBgClass: "bg-primary/10",
        accentColor: "text-primary",
      },
      {
        title: "Issued Books",
        value: (activeIssues[0]?.count || 0).toString(),
        subtext: "Books out with students/staff",
        icon: BookOpen,
        iconBgClass: "bg-secondary/10",
        accentColor: "text-secondary",
      },
      {
        title: "Overdue Books",
        value: "0",
        subtext: "Fines applicable today",
        icon: AlertCircle,
        iconBgClass: "bg-danger/10",
        accentColor: "text-danger",
      },
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Library Dashboard 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage book inventories, member cards, and fine collections.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QuickAction
              label="Library Directory"
              href="/library"
              className="bg-primary text-white hover:bg-primary/90"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <MetricCard key={m.title} {...m} />
          ))}
        </div>
      </div>
    );
  }

  if (role === "TRANSPORT_MANAGER") {
    // ─── TRANSPORT MANAGER DASHBOARD ───
    const vehiclesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(vehicles)
      .where(eq(vehicles.schoolId, schoolId));
    const routesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(routes)
      .where(eq(routes.schoolId, schoolId));
    const activePasses = await db
      .select({ count: sql<number>`count(*)` })
      .from(studentBusPasses)
      .where(
        and(
          eq(studentBusPasses.schoolId, schoolId),
          eq(studentBusPasses.isActive, true),
        ),
      );

    const metrics = [
      {
        title: "Registered Buses",
        value: (vehiclesCount[0]?.count || 0).toString(),
        subtext: "Driver & Conductor encrypted",
        icon: Bus,
        iconBgClass: "bg-primary/10",
        accentColor: "text-primary",
      },
      {
        title: "Total Routes",
        value: (routesCount[0]?.count || 0).toString(),
        subtext: "Mapped locations & stops",
        icon: Navigation,
        iconBgClass: "bg-secondary/10",
        accentColor: "text-secondary",
      },
      {
        title: "Issued Bus Passes",
        value: (activePasses[0]?.count || 0).toString(),
        subtext: "DPDP Consent verified",
        icon: Shield,
        iconBgClass: "bg-warning/20",
        accentColor: "text-warning",
      },
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Transport Directory 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live bus simulations, route maps, and student mappings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QuickAction
              label="Transport Panel"
              href="/transport"
              className="bg-primary text-white hover:bg-primary/90"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <MetricCard key={m.title} {...m} />
          ))}
        </div>
      </div>
    );
  }

  // ─── ADMIN / PRINCIPAL / SCHOOL_ADMIN DASHBOARD ───
  const metrics = [
    {
      title: "Total Enrolment",
      value: totalStudents.toLocaleString(),
      subtext: "Class Nursery — 10",
      trend: { value: "+23 vs last year", direction: "up" as const },
      icon: Users,
      iconBgClass: "bg-primary/10",
      accentColor: "text-primary",
    },
    {
      title: "Today's Attendance",
      value: "94.2%",
      subtext: "Students marked present",
      trend: { value: "+1.3% vs yesterday", direction: "up" as const },
      icon: CalendarCheck,
      iconBgClass: "bg-secondary/10",
      accentColor: "text-secondary",
    },
    {
      title: "Fee Collected Today",
      value: "₹2,84,500",
      subtext: "47 transactions",
      trend: { value: "+₹38,000 vs yesterday", direction: "up" as const },
      icon: IndianRupee,
      iconBgClass: "bg-warning/20",
      accentColor: "text-warning",
    },
    {
      title: "Outstanding Dues",
      value: "₹18,43,200",
      subtext: "Defaulter invoices",
      trend: { value: "↓ ₹1,20,000 this week", direction: "down" as const },
      icon: AlertCircle,
      iconBgClass: "bg-danger/10",
      accentColor: "text-danger",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Good morning, Admin 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Saraswati Public School — Academic Year 2025-26
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuickAction
            label="+ Add Student"
            href="/admissions"
            className="bg-primary text-white hover:bg-primary/90"
          />
          <QuickAction
            label="Collect Fee"
            href="/fees"
            className="bg-secondary/10 text-secondary hover:bg-secondary/20"
          />
          <QuickAction
            label="Mark Attendance"
            href="/attendance"
            className="bg-muted text-foreground hover:bg-muted/80"
          />
        </div>
      </div>

      {/* Metric Cards */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Key Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div key={metric.title} className="relative overflow-hidden">
              <MetricCard {...metric} />
            </div>
          ))}
        </div>
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">
              Attendance Trend — Last 30 Days
            </h2>
            <select
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background"
              aria-label="Filter attendance by class"
              id="attendance-filter"
            >
              <option>All Classes</option>
              <option>Class 1–5</option>
              <option>Class 6–10</option>
            </select>
          </div>
          <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
            <p className="text-muted-foreground text-sm">
              Attendance chart loading…
            </p>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-card rounded-xl border p-6">
          <h2 className="font-semibold text-foreground mb-4">Pending Tasks</h2>
          <ul className="space-y-3" role="list" aria-label="Pending tasks">
            {[
              {
                label: "12 admission applications pending review",
                href: "/admissions",
                urgency: "warning",
              },
              {
                label: "3 leave requests awaiting approval",
                href: "/hr",
                urgency: "warning",
              },
              {
                label: "Fee reminder SMS due for 47 parents",
                href: "/fees",
                urgency: "danger",
              },
              {
                label: "2 Rights requests overdue (DPDP)",
                href: "/dpdp",
                urgency: "danger",
              },
              {
                label: "Timetable not set for Class 6B",
                href: "/academics",
                urgency: "info",
              },
            ].map((task) => (
              <li key={task.label}>
                <a
                  href={task.href}
                  className={`flex items-start gap-2 text-sm hover:underline p-2 rounded-lg transition-colors ${
                    task.urgency === "danger"
                      ? "text-danger hover:bg-danger/10"
                      : task.urgency === "warning"
                        ? "text-warning hover:bg-warning/10"
                        : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  {task.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* DPDP Compliance Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-sm">🔒</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            DPDP Act 2023 Compliance Status
          </p>
          <p className="text-xs text-muted-foreground">
            All student data processing is consent-gated.
          </p>
        </div>
        <a
          href="/dpdp"
          className="text-xs text-primary font-medium hover:underline flex-shrink-0"
        >
          View Dashboard →
        </a>
      </div>
    </div>
  );
}
