import { NextRequest, NextResponse } from "next/server";
import { getCachedSession } from "@/lib/serverAuth";
import { webPushSubscriptionSchema } from "@schoolmitra/validators";
import { db } from "@/db";
import { userPushSubscriptions } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getCachedSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = webPushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid subscription payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;
    const userAgent = req.headers.get("user-agent") || null;
    const userId = session.user.id;
    // Handle super-admin (no schoolId) vs tenant users (valid schoolId)
    const schoolId = session.user.schoolId || null;

    await db
      .insert(userPushSubscriptions)
      .values({
        userId,
        schoolId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      })
      .onConflictDoUpdate({
        target: userPushSubscriptions.endpoint,
        set: {
          userId,
          schoolId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
          updatedAt: sql`now()`,
        },
      });

    return NextResponse.json({
      success: true,
      message: "Push notifications successfully enabled.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to save push subscription", details: err?.message },
      { status: 500 }
    );
  }
}
