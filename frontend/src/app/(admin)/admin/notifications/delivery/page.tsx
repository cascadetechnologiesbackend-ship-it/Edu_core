export const dynamic = "force-dynamic";

import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { db } from "@/db";
import { pushNotificationLogs, smsLogs, schools } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { withTenant } from "@/lib/tenant";
import { isWebPushConfigured } from "@schoolmitra/backend/lib/webPushDispatcher";
import { isSmsConfigured } from "@schoolmitra/backend/lib/sms";
import { isEmailConfigured } from "@schoolmitra/backend/lib/email";
import {
  Bell,
  MessageSquare,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Notification Delivery Health | Admin",
  description: "Live, tenant-scoped delivery health and channel configuration status",
};

export default async function NotificationDeliveryHealthPage() {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch {
    redirect("/login");
  }

  const role = ctx.role;
  const access = assertRouteAccess(role, "/admin", { id: ctx.userId, email: ctx.email });
  if (!access.allowed && role !== "SCHOOL_ADMIN" && role !== "SUPER_ADMIN" && role !== "PRINCIPAL") {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId;
  if (!schoolId) {
    redirect("/login");
  }

  // 1. Resolve date boundaries for 7-day metrics
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // 2. Query tenant-scoped notification logs inside withTenant
  const { pushStats, smsStats, schoolInfo, recentLogs } = await withTenant(schoolId, async (tx) => {
    // School info
    const schoolRow = await tx.query.schools.findFirst({
      where: eq(schools.id, schoolId),
      columns: { name: true, udiseCode: true },
    });

    // 7-day push notification logs
    const pushRows = await tx.query.pushNotificationLogs.findMany({
      where: and(
        eq(pushNotificationLogs.schoolId, schoolId),
        gte(pushNotificationLogs.createdAt, sevenDaysAgo),
      ),
      orderBy: [desc(pushNotificationLogs.createdAt)],
      limit: 100,
    });

    let pushDelivered = 0;
    let pushFailed = 0;
    let pushDeferred = 0;
    let pushSkipped = 0;

    for (const r of pushRows) {
      if (r.status === "DELIVERED") pushDelivered++;
      else if (r.status === "FAILED") pushFailed++;
      else if (r.status === "DEFERRED_QUIET_HOURS" || r.status === "QUEUED_QUIET_HOURS") pushDeferred++;
      else if (r.status === "SKIPPED_UNCONFIGURED" || r.status === "SKIPPED_NO_SUBSCRIPTION") pushSkipped++;
    }

    // 7-day SMS logs
    const smsRows = await tx.query.smsLogs.findMany({
      where: and(
        eq(smsLogs.schoolId, schoolId),
        gte(smsLogs.createdAt, sevenDaysAgo),
      ),
      orderBy: [desc(smsLogs.createdAt)],
      limit: 100,
    });

    let smsSent = 0;
    let smsFailed = 0;
    let smsQueued = 0;
    let smsTodaySent = 0;

    for (const s of smsRows) {
      if (s.status === "SENT") {
        smsSent++;
        if (s.createdAt >= startOfToday) {
          smsTodaySent++;
        }
      } else if (s.status === "FAILED") {
        smsFailed++;
      } else if (s.status === "QUEUED") {
        smsQueued++;
      }
    }

    return {
      schoolInfo: schoolRow,
      pushStats: {
        total: pushRows.length,
        delivered: pushDelivered,
        failed: pushFailed,
        deferred: pushDeferred,
        skipped: pushSkipped,
      },
      smsStats: {
        total: smsRows.length,
        sent: smsSent,
        failed: smsFailed,
        queued: smsQueued,
        todaySent: smsTodaySent,
        dailyCap: 500,
        remainingCap: Math.max(0, 500 - smsTodaySent),
      },
      recentLogs: {
        push: pushRows.slice(0, 5),
        sms: smsRows.slice(0, 5),
      },
    };
  });

  // 3. Channel configuration states
  const webPushOk = isWebPushConfigured();
  const smsOk = isSmsConfigured();
  const emailOk = isEmailConfigured();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 overflow-x-hidden text-foreground">
      {/* Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center min-h-[38px] min-w-[38px] p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Notification Delivery Health</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 ml-10">
            {schoolInfo?.name || "School"} &bull; Real-time tenant delivery metrics over the last 7 days
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto ml-10 sm:ml-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live DB Telemetry
          </span>
        </div>
      </div>

      {/* Channel Configuration Banners (Warning Cards) */}
      <div className="space-y-3" data-testid="channel-banners">
        {!webPushOk && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <strong className="font-semibold">Web Push (VAPID) is unconfigured: </strong>
              <span>
                Missing `NEXT_PUBLIC_VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY`. Push notifications will be recorded as
                `SKIPPED_UNCONFIGURED` and never faked as delivered. Run `npx web-push generate-vapid-keys` to provision keys.
              </span>
            </div>
          </div>
        )}

        {!smsOk && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <strong className="font-semibold">SMS Gateway is unconfigured: </strong>
              <span>
                Missing DLT / Twilio provider credentials. Queued SMS messages will be deferred safely in `QUEUED` state
                without consuming daily quotas and without fabricating `SENT` records.
              </span>
            </div>
          </div>
        )}

        {!emailOk && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <strong className="font-semibold">SMTP Email Transporter is unconfigured: </strong>
              <span>
                Missing `SMTP_HOST` or credentials. Production emails fail closed with structured unconfigured status
                instead of attempting to reach invalid defaults.
              </span>
            </div>
          </div>
        )}

        {webPushOk && smsOk && emailOk && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>All 3 notification channels (Web Push, SMS, Email) are actively configured.</span>
          </div>
        )}
      </div>

      {/* Channel Status Overview Cards */}
      <div
        data-tour="comm-broadcast-summary"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Web Push Card */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Bell className="w-5 h-5" />
              </div>
              <span className="font-semibold text-sm">Web Push</span>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                webPushOk
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              {webPushOk ? "Active" : "Unconfigured"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
            <div>
              <p className="text-muted-foreground font-medium">Delivered (7d)</p>
              <p className="text-xl font-bold text-foreground mt-0.5" data-testid="push-delivered-count">
                {pushStats.delivered}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Failed</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5" data-testid="push-failed-count">
                {pushStats.failed}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Deferred (Quiet)</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{pushStats.deferred}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Skipped</p>
              <p className="text-sm font-semibold text-muted-foreground mt-0.5">{pushStats.skipped}</p>
            </div>
          </div>
        </div>

        {/* SMS Card */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="font-semibold text-sm">SMS (DLT)</span>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                smsOk
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              {smsOk ? "Active" : "Unconfigured"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
            <div>
              <p className="text-muted-foreground font-medium">Sent (7d)</p>
              <p className="text-xl font-bold text-foreground mt-0.5" data-testid="sms-sent-count">
                {smsStats.sent}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Failed</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5" data-testid="sms-failed-count">
                {smsStats.failed}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Queued</p>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-0.5">{smsStats.queued}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Cap Left Today</p>
              <p className="text-sm font-semibold text-foreground mt-0.5" data-testid="sms-remaining-cap">
                {smsStats.remainingCap} / 500
              </p>
            </div>
          </div>
        </div>

        {/* Email Card */}
        <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <Mail className="w-5 h-5" />
              </div>
              <span className="font-semibold text-sm">Email (SMTP)</span>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                emailOk
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              {emailOk ? "Active" : "Unconfigured"}
            </span>
          </div>

          <div className="pt-2 border-t border-border text-xs space-y-2">
            <p className="text-muted-foreground">
              {emailOk
                ? `Transporter ready on ${process.env.SMTP_HOST || "configured host"}.`
                : "No SMTP host configured. Outgoing emails fail closed safely without errors."}
            </p>
            <p className="text-muted-foreground font-medium">
              Statutory SLA & Admin Alerts: <span className="text-foreground font-semibold">Active</span>
            </p>
          </div>
        </div>
      </div>

      {/* Daily SMS Quota Utilization Progress Card */}
      <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="font-semibold">Today's School SMS Quota Utilization (500 limit/day)</span>
          <span className="text-muted-foreground font-medium">
            {smsStats.todaySent} / {smsStats.dailyCap} messages sent
          </span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              smsStats.todaySent >= 450
                ? "bg-red-500"
                : smsStats.todaySent >= 300
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, (smsStats.todaySent / smsStats.dailyCap) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Quota counts strictly real `SENT` deliveries. Unconfigured or failed messages do not consume school allocation.
        </p>
      </div>

      {/* Recent Telemetry Log Cards (Reflowed Vertically per Mobile Law) */}
      <div
        data-tour="comm-status-table"
        className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold">Recent Dispatch Telemetry</h2>
          <span className="text-xs text-muted-foreground font-medium">Latest 5 events</span>
        </div>

        {recentLogs.push.length === 0 && recentLogs.sms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs sm:text-sm">
            No notification dispatch events recorded for this school in the past 7 days.
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.push.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-lg border border-border/80 bg-background/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      PUSH
                    </span>
                    <span className="font-semibold text-foreground">{log.title}</span>
                  </div>
                  <p className="text-muted-foreground line-clamp-1">{log.body}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <span
                    className={`px-2 py-1 rounded-full font-medium text-[11px] ${
                      log.status === "DELIVERED"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                        : log.status === "FAILED"
                        ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                        : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(log.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
