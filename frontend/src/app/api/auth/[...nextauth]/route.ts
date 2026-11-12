import { handlers } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimiter";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (req.nextUrl.pathname.includes("/callback/")) {
    const allowed = await checkRateLimit(
      `rate:auth-login:${ip}`,
      RATE_LIMITS.LOGIN.max * 2,
      RATE_LIMITS.LOGIN.windowMs,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  return handlers.POST(req);
}
