import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse, type NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// Edge-safe per-IP sliding window guard for public abuse targets (DDoS/brute-force defense)
const edgeRateMap = new Map<string, number[]>();
const EDGE_WINDOW_MS = 60_000;
const EDGE_SENSITIVE_LIMIT = 40;

function isEdgeRateLimited(ip: string, bucket: string, limit: number): boolean {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const valid = (edgeRateMap.get(key) || []).filter((t) => t > now - EDGE_WINDOW_MS);
  if (valid.length >= limit) {
    return true;
  }
  valid.push(now);
  edgeRateMap.set(key, valid);
  if (edgeRateMap.size > 10_000) {
    edgeRateMap.clear();
  }
  return false;
}

export default async function middleware(req: NextRequest) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const rawPath = req.nextUrl.pathname;
  const pathname =
    basePath && rawPath.startsWith(basePath)
      ? rawPath.slice(basePath.length) || "/"
      : rawPath;

  const isSensitivePublicPost =
    req.method === "POST" &&
    (pathname.startsWith("/api/auth/callback") ||
      pathname.startsWith("/api/onboard") ||
      pathname.startsWith("/onboard") ||
      pathname.startsWith("/claim-account") ||
      pathname.startsWith("/claim-student-account"));

  if (isSensitivePublicPost) {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (isEdgeRateLimited(clientIp, pathname.split("/")[1] || "pub", EDGE_SENSITIVE_LIMIT)) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const start = performance.now();
  const res = await (auth as any)(req);
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  if (res && res.headers) {
    const existing = res.headers.get("Server-Timing");
    const timingHeader = `auth;dur=${durationMs};desc="Auth Gateway"`;
    res.headers.set("Server-Timing", existing ? `${existing}, ${timingHeader}` : timingHeader);

    // CRITICAL: Normalize redirect location header to keep corporate domain (cascade-erp.in)
    const location = res.headers.get("location");
    if (location) {
      const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
      const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
      if (forwardedHost) {
        try {
          const locUrl = new URL(location, `${forwardedProto}://${forwardedHost}`);
          if (locUrl.hostname.includes("onrender.com") || locUrl.hostname !== forwardedHost || (basePath && !locUrl.pathname.startsWith(basePath))) {
            locUrl.protocol = `${forwardedProto}:`;
            locUrl.host = forwardedHost;
            if (basePath && !locUrl.pathname.startsWith(basePath)) {
              locUrl.pathname = `${basePath}${locUrl.pathname}`;
            }
            if (locUrl.searchParams.has("callbackUrl")) {
              const cb = locUrl.searchParams.get("callbackUrl");
              if (cb) {
                try {
                  const cbUrl = new URL(cb, `${forwardedProto}://${forwardedHost}`);
                  if (cbUrl.hostname.includes("onrender.com") || cbUrl.hostname !== forwardedHost) {
                    cbUrl.protocol = `${forwardedProto}:`;
                    cbUrl.host = forwardedHost;
                  }
                  if (basePath && !cbUrl.pathname.startsWith(basePath)) {
                    cbUrl.pathname = `${basePath}${cbUrl.pathname}`;
                  }
                  locUrl.searchParams.set("callbackUrl", cbUrl.toString());
                } catch {}
              }
            }
            res.headers.set("location", locUrl.toString());
          }
        } catch {}
      }
    }

    return res;
  }

  return res;
}

export const config = {
  matcher: ["/((?!api/auth|api/trpc|_next/static|_next/image|favicon.ico|manifest.json|icon.svg).*)"],
};
