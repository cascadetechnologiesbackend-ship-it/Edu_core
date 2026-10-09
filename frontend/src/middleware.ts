import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export default async function middleware(req: NextRequest) {
  const start = performance.now();
  const res = await (auth as any)(req);
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  if (res && res.headers) {
    const existing = res.headers.get("Server-Timing");
    const timingHeader = `auth;dur=${durationMs};desc="Auth Gateway"`;
    res.headers.set("Server-Timing", existing ? `${existing}, ${timingHeader}` : timingHeader);
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/((?!api/trpc|_next/static|_next/image|favicon.ico|manifest.json|icon.svg).*)"],
};
