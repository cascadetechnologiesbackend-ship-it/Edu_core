import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export function withAuth(
  handler: (req: Request, session: Session) => Promise<NextResponse> | NextResponse
) {
  return async (req: Request) => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return await handler(req, session as Session);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export function withCronAuth(
  handler: (req: Request) => Promise<NextResponse> | NextResponse
) {
  return async (req: Request) => {
    try {
      const authHeader = req.headers.get("Authorization");
      const secret = process.env.CRON_SECRET;
      
      if (process.env.NODE_ENV === "production" && (!secret || authHeader !== `Bearer ${secret}`)) {
         return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
      
      return await handler(req);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
