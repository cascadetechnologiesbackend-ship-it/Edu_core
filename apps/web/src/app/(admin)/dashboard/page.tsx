import type { Metadata } from "next";
import { Suspense } from "react";
import { Users, IndianRupee, CalendarCheck, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  subtext?: string;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  icon: React.ComponentType<{ className?: string }>;
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
    <div className="metric-card group">
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
      {/* Bottom accent bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 ${accentColor.replace("text-", "bg-")}`}
      />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MetricCardSkeleton() {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-3 w-40" />
        </div>
        <div className="skeleton w-12 h-12 rounded-xl ml-4" />
      </div>
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

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  // In production, these would be fetched via tRPC Server Component queries
  const metrics = [
    {
      title: "Total Enrolment",
      value: "1,247",
      subtext: "Class Nursery — 10",
      trend: { value: "+23 vs last year", direction: "up" as const },
      icon: Users,
      iconBgClass: "bg-primary/10",
      accentColor: "text-primary",
    },
    {
      title: "Today's Attendance",
      value: "94.2%",
      subtext: "1,175 of 1,247 students present",
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
      subtext: "312 defaulter invoices",
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
          <h1 className="text-2xl font-bold text-foreground">
            Good morning, Admin 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Saraswati Public School — Academic Year 2025-26
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuickAction
            label="+ Add Student"
            href="/admin/students/new"
            className="bg-primary text-white hover:bg-primary-700"
          />
          <QuickAction
            label="Collect Fee"
            href="/admin/fees/collect"
            className="bg-secondary/10 text-secondary hover:bg-secondary/20"
          />
          <QuickAction
            label="Mark Attendance"
            href="/admin/attendance"
            className="bg-muted text-foreground hover:bg-muted/80"
          />
        </div>
      </div>

      {/* Metric Cards */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Key Metrics
        </h2>
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <MetricCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <div key={metric.title} className="relative overflow-hidden">
                <MetricCard {...metric} />
              </div>
            ))}
          </div>
        </Suspense>
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
          {/* Chart placeholder — Recharts loaded client-side */}
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
                href: "/admin/admissions",
                urgency: "warning",
              },
              {
                label: "3 leave requests awaiting approval",
                href: "/admin/hr/leaves",
                urgency: "warning",
              },
              {
                label: "Fee reminder SMS due for 47 parents",
                href: "/admin/fees/defaulters",
                urgency: "danger",
              },
              {
                label: "2 Rights requests overdue (DPDP)",
                href: "/admin/dpdp/rights-requests",
                urgency: "danger",
              },
              {
                label: "Timetable not set for Class 6B",
                href: "/admin/academics/timetable",
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
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
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
            All student data processing is consent-gated. 1,247/1,247 students have valid parental consent for mandatory purposes.
          </p>
        </div>
        <a
          href="/admin/dpdp"
          className="text-xs text-primary font-medium hover:underline flex-shrink-0"
        >
          View Dashboard →
        </a>
      </div>
    </div>
  );
}
