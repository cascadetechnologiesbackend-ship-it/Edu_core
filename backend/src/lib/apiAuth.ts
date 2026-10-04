import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import crypto from "crypto";

export function withAuth(
  handler: (
    req: Request,
    session: Session,
  ) => Promise<NextResponse> | NextResponse,
) {
  return async (req: Request) => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return await handler(req, session as Session);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Internal Server Error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export function withCronAuth(
  handler: (req: Request) => Promise<NextResponse> | NextResponse,
) {
  return async (req: Request) => {
    try {
      const authHeader = req.headers.get("Authorization");
      const secret =
        process.env.CRON_SECRET ||
        (process.env.NODE_ENV !== "production"
          ? "dev-cron-secret-fallback"
          : null);

      if (!secret || !authHeader) {
        return NextResponse.json(
          { error: "Unauthorized cron request: valid Bearer token required" },
          { status: 401 },
        );
      }

      const expectedHeader = `Bearer ${secret}`;
      const expBuf = Buffer.from(expectedHeader, "utf8");
      const authBuf = Buffer.from(authHeader, "utf8");
      if (
        expBuf.length !== authBuf.length ||
        !crypto.timingSafeEqual(expBuf, authBuf)
      ) {
        return NextResponse.json(
          { error: "Unauthorized cron request: valid Bearer token required" },
          { status: 401 },
        );
      }

      return await handler(req);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Internal Server Error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
