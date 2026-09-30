import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// ⚠️  DEV-ONLY — This endpoint MUST NOT be accessible in production.
// It reveals internal session and user data. Always returns 404 in production.
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    return NextResponse.json({
      sessionUser: session.user,
      foundInDb: !!dbUser,
      dbUser: dbUser ? { id: dbUser.id, email: dbUser.email } : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
