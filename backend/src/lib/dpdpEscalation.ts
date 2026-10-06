import { db } from "@/db";
import { rightsRequests, dpdpGrievances, dataBreachLog, schools, users } from "@/db/schema";
import { eq, and, lte, or, inArray } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

export interface EscalationSummary {
  escalatedRequestsCount: number;
  escalatedGrievancesCount: number;
}

/**
 * Requirement 18.4:
 * "A scheduled job alerts school admins on rights requests approaching dueAt (within 5 days);
 * overdue requests auto-escalate to ESCALATED_TO_DPO"
 */
export async function runRightsRequestEscalationJob(): Promise<EscalationSummary> {
  const now = new Date();
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  // 1. Auto-escalate overdue or critical-deadline rights requests
  // If dueAt is past or within 5 days, auto-escalate status if currently SUBMITTED or UNDER_REVIEW
  const candidateRequests = await db.query.rightsRequests.findMany({
    where: and(
      inArray(rightsRequests.status, ["SUBMITTED", "IN_PROGRESS"]),
      lte(rightsRequests.dueAt, fiveDaysFromNow),
    ),
  });

  let escalatedRequestsCount = 0;
  for (const req of candidateRequests) {
    await db
      .update(rightsRequests)
      .set({
        status: "ESCALATED_TO_DPO",
        escalatedToDpoAt: now,
        updatedAt: now,
      })
      .where(eq(rightsRequests.id, req.id));

    escalatedRequestsCount++;

    // Notify School DPO / Admin via Email
    try {
      const adminUsers = await db.query.users.findMany({
        where: and(
          eq(users.schoolId, req.schoolId),
          eq(users.isActive, true),
        ),
      });

      for (const admin of adminUsers) {
        if (admin.email) {
          await sendEmail({
            to: admin.email,
            subject: `[DPDP URGENT ESCALATION] Rights Request ${req.ticketNumber} Escalated to DPO`,
            text: `Rights request ticket ${req.ticketNumber} (${req.requestType}) is approaching or has exceeded the 30-day statutory SLA under DPDP Act 2023. It has been automatically escalated to the Data Protection Officer. Immediate action required.`,
          });
        }
      }
    } catch (err) {
      console.error(`Failed to send escalation email for ticket ${req.ticketNumber}:`, err);
    }
  }

  // 2. Also check dpdpGrievances
  const candidateGrievances = await db.query.dpdpGrievances.findMany({
    where: and(
      inArray(dpdpGrievances.status, ["SUBMITTED", "IN_PROGRESS"]),
      lte(dpdpGrievances.dueAt, fiveDaysFromNow),
    ),
  });

  let escalatedGrievancesCount = 0;
  for (const grv of candidateGrievances) {
    await db
      .update(dpdpGrievances)
      .set({
        status: "ESCALATED_TO_DPO",
        escalatedToDpoAt: now,
        updatedAt: now,
      })
      .where(eq(dpdpGrievances.id, grv.id));

    escalatedGrievancesCount++;
  }

  return {
    escalatedRequestsCount,
    escalatedGrievancesCount,
  };
}

/**
 * Requirement 18.5:
 * "Creating any data_breach_log record with severity HIGH or CRITICAL triggers an immediate admin alert"
 */
export async function triggerBreachEmergencyAlert(breach: {
  schoolId: string;
  incidentReference: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  boardNotificationDeadline: Date;
}) {
  if (breach.severity !== "HIGH" && breach.severity !== "CRITICAL") {
    return;
  }

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, breach.schoolId),
  });

  const admins = await db.query.users.findMany({
    where: and(
      eq(users.schoolId, breach.schoolId),
      eq(users.isActive, true),
    ),
  });

  const emailSubject = `[CRITICAL SECURITY ALERT] ${breach.severity} Severity Data Breach Logged: ${breach.incidentReference}`;
  const emailText = `EMERGENCY DPDP NOTIFICATION:\n\nA data breach incident has been recorded for ${school?.name || "your school"}.\nIncident Reference: ${breach.incidentReference}\nSeverity: ${breach.severity}\nDescription: ${breach.description}\n\nSTATUTORY DEADLINE: Under DPDP Rules 2025 Rule 7, notice must be served to the Data Protection Board within 72 hours.\nBoard Notification Deadline: ${breach.boardNotificationDeadline.toISOString()}.\n\nPlease access the DPDP Compliance Centre immediately.`;

  for (const admin of admins) {
    if (admin.email) {
      try {
        await sendEmail({
          to: admin.email,
          subject: emailSubject,
          text: emailText,
        });
      } catch (err) {
        console.error(`Failed to alert admin ${admin.email} of breach:`, err);
      }
    }
  }
}
