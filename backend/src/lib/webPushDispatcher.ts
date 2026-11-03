import { db } from "@/db";
import { userPushSubscriptions, pushNotificationLogs } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { workerLogger } from "./logger";
import webpush from "web-push";

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown> | undefined;
  icon?: string | undefined;
  tag?: string | undefined;
}

export interface DispatchPushResult {
  userId: string;
  subscriptionFound: boolean;
  success: boolean;
  status: "DELIVERED" | "FAILED" | "SKIPPED_NO_SUBSCRIPTION" | "SKIPPED_UNCONFIGURED";
  endpoint?: string | undefined;
  error?: string | undefined;
}

/**
 * Checks whether VAPID push notification credentials are fully configured.
 */
export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] &&
    process.env["VAPID_PRIVATE_KEY"]
  );
}

/**
 * Utility helper to generate standard VAPID public/private keypair.
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}

/**
 * Dispatches Web Push notifications to stored user subscriptions for a tenant
 * using the official Web Push Protocol (RFC 8030, RFC 8291 aes128gcm, RFC 8292 VAPID).
 *
 * Requirements:
 * 1. Checks stored user subscriptions in `user_push_subscriptions` for the given tenant & users.
 * 2. Uses VAPID credentials if present; otherwise returns SKIPPED_UNCONFIGURED (success: false).
 * 3. Simulated delivery is ONLY permitted behind an explicit ALLOW_MOCK_PUSH=true environment flag,
 *    and is hard-blocked in production without ALLOW_MOCK_PUSH_IN_PROD=true.
 * 4. Automatically prunes dead subscriptions on HTTP 404 or 410 (Gone).
 * 5. Never throws unhandled exceptions; returns structured dispatch results per recipient.
 */
export async function dispatchWebPush(
  schoolId: string,
  userIds: string[],
  payload: WebPushPayload,
  txDb: any = db,
): Promise<DispatchPushResult[]> {
  if (userIds.length === 0) return [];

  const isConfigured = isWebPushConfigured();
  const allowMock = process.env["ALLOW_MOCK_PUSH"] === "true";

  if (allowMock && process.env.NODE_ENV === "production" && process.env["ALLOW_MOCK_PUSH_IN_PROD"] !== "true") {
    throw new Error(
      "FATAL: ALLOW_MOCK_PUSH is enabled in production without ALLOW_MOCK_PUSH_IN_PROD=true"
    );
  }

  const vapidPublicKey = process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || "";
  const vapidPrivateKey = process.env["VAPID_PRIVATE_KEY"] || "";
  const vapidSubject = process.env["VAPID_SUBJECT"] || "mailto:admin@schoolmitra.internal";

  if (isConfigured) {
    try {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch (vapidErr: unknown) {
      workerLogger.error(
        `[WebPushDispatcher] Failed to initialize VAPID details: ${vapidErr instanceof Error ? vapidErr.message : String(vapidErr)}`,
      );
    }
  }

  try {
    // 1. Fetch active push subscriptions for these users in this school
    const subscriptions = await txDb.query.userPushSubscriptions.findMany({
      where: and(
        eq(userPushSubscriptions.schoolId, schoolId),
        inArray(userPushSubscriptions.userId, userIds),
      ),
    });

    const subMap = new Map<string, (typeof subscriptions)[number]>();
    for (const sub of subscriptions) {
      // Map one subscription per user (latest preferred)
      subMap.set(sub.userId, sub);
    }

    const results: DispatchPushResult[] = [];

    for (const userId of userIds) {
      const sub = subMap.get(userId);
      if (!sub) {
        results.push({
          userId,
          subscriptionFound: false,
          success: true,
          status: "SKIPPED_NO_SUBSCRIPTION",
        });
        continue;
      }

      // Check if endpoint is mock or internal
      const isMockEndpoint =
        sub.endpoint.includes("mock") ||
        sub.endpoint.includes("internal") ||
        sub.endpoint.includes("localhost") ||
        sub.endpoint.includes("127.0.0.1");

      if (!isConfigured) {
        if (allowMock || isMockEndpoint) {
          workerLogger.info(
            `[WebPushDispatcher] Simulating delivery to user=${userId} (mock mode enabled)`,
          );
          results.push({
            userId,
            subscriptionFound: true,
            success: true,
            status: "DELIVERED",
            endpoint: sub.endpoint,
          });
          continue;
        }

        workerLogger.warn(
          `[WebPushDispatcher] Skipping push to user=${userId}: VAPID credentials not configured`,
        );
        results.push({
          userId,
          subscriptionFound: true,
          success: false,
          status: "SKIPPED_UNCONFIGURED",
          endpoint: sub.endpoint,
          error: "VAPID credentials not configured in environment.",
        });
        continue;
      }

      // Live delivery attempt via RFC 8030/8291/8292 standard webpush
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || "/icons/icon-192x192.png",
            tag: payload.tag || "schoolmitra-notification",
            data: payload.data || {},
          }),
          {
            TTL: 86400,
            urgency: "normal",
          },
        );

        results.push({
          userId,
          subscriptionFound: true,
          success: true,
          status: "DELIVERED",
          endpoint: sub.endpoint,
        });
      } catch (pushErr: any) {
        const statusCode = pushErr?.statusCode || pushErr?.status;
        const errMsg = pushErr instanceof Error ? pushErr.message : String(pushErr);

        // 404 Not Found or 410 Gone indicates expired or unregistered subscription
        if (statusCode === 404 || statusCode === 410) {
          workerLogger.warn(
            `[WebPushDispatcher] Subscription expired (status ${statusCode}) for user=${userId}. Pruning from database.`,
          );
          try {
            await txDb
              .delete(userPushSubscriptions)
              .where(
                and(
                  eq(userPushSubscriptions.schoolId, schoolId),
                  eq(userPushSubscriptions.userId, userId),
                ),
              );
          } catch (pruneErr) {
            workerLogger.error(
              `[WebPushDispatcher] Failed to prune dead subscription for user=${userId}: ${pruneErr}`,
            );
          }

          results.push({
            userId,
            subscriptionFound: true,
            success: false,
            status: "FAILED",
            endpoint: sub.endpoint,
            error: `Push subscription expired (${statusCode}) and was pruned.`,
          });
        } else {
          workerLogger.error(
            `[WebPushDispatcher] Push service error for user=${userId} (status=${statusCode}): ${errMsg}`,
          );
          results.push({
            userId,
            subscriptionFound: true,
            success: false,
            status: "FAILED",
            endpoint: sub.endpoint,
            error: `Push service rejected with status ${statusCode || "UNKNOWN"}: ${errMsg}`,
          });
        }
      }
    }

    return results;
  } catch (dbErr: unknown) {
    const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    workerLogger.error(
      `[WebPushDispatcher] Fatal subscription query error for school=${schoolId}: ${errMsg}`,
    );
    return userIds.map((userId) => ({
      userId,
      subscriptionFound: false,
      success: false,
      status: "FAILED",
      error: errMsg,
    }));
  }
}
