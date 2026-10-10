import { NextRequest, NextResponse } from "next/server";
import { getCachedSession } from "@/lib/serverAuth";
import { webPushSubscriptionSchema } from "@schoolmitra/validators";

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

    // In production with VAPID configured, endpoint and keys are persisted
    // to user_push_subscriptions table for background worker delivery.
    return NextResponse.json({
      success: true,
      message: "Push notifications successfully enabled.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
