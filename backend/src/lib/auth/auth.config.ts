import { type NextAuthConfig } from "next-auth";
import { canRoleAccessRoute } from "../routeGuards";
import { ROLE_CONFIGS, type UserRole } from "../roleConfig";

function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "dummy-build-time-secret-at-least-32-chars-long";
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: AUTH_SECRET or NEXTAUTH_SECRET is required in production environment to prevent session forgery."
      );
    }
    console.warn("⚠️ Warning: AUTH_SECRET or NEXTAUTH_SECRET is not set in environment. Falling back to default secret.");
    return "default-schoolmitra-auth-secret-key-32chars-min-len";
  }
  return secret;
}

function getSafeRedirect(path: string, nextUrl: URL, headers?: Headers) {
  const host = headers?.get("x-forwarded-host") || headers?.get("host");
  const proto = headers?.get("x-forwarded-proto") || (nextUrl.protocol ? nextUrl.protocol.replace(":", "") : "http");
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return Response.redirect(new URL(path, `${proto}://${host}`));
  }
  if (host) {
    return Response.redirect(new URL(path, `${proto}://${host}`));
  }
  return Response.redirect(new URL(path, nextUrl));
}

export const authConfig: NextAuthConfig = {
  // trustHost: required for deployments behind a reverse proxy (Render, Vercel, Railway, AWS ALB)
  // NextAuth v5 validates the HOST header against AUTH_URL or requires trustHost: true.
  trustHost: true,
  secret: resolveAuthSecret(),
  providers: [], // Providers like Credentials with DB access go in index.ts
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours - ERP admin sessions are long-lived
    updateAge: 60 * 60,  // Only re-sign JWT token every 1 hour
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const parsed = new URL(url);
        const baseObj = new URL(baseUrl);
        if (parsed.origin === baseObj.origin || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
          return url;
        }
      } catch {}
      return baseUrl;
    },
    authorized({ auth, request: { nextUrl, headers } }) {
      const pathname = nextUrl.pathname;

      // Strictly match static asset extensions to prevent dot-truncation middleware auth bypass
      const isStaticAsset =
        /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?|ttf|eot|map|txt|json|webmanifest)$/i.test(
          pathname,
        ) || pathname === "/manifest.json";

      if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api/auth") ||
        isStaticAsset
      ) {
        return true;
      }

      // Webhook, health, telemetry, and pincode reference endpoints
      if (
        pathname.startsWith("/api/webhooks") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/api/telemetry") ||
        pathname.startsWith("/api/pincode")
      ) {
        return true;
      }

      // Public pages accessible without login (Landing page & Tenant Onboarding)
      const isPublicRoute =
        pathname === "/" ||
        pathname.startsWith("/onboard") ||
        pathname.startsWith("/api/onboard");

      if (isPublicRoute) {
        return true;
      }

      const isLoggedIn = !!auth?.user && !(auth?.user as any)?.isDeactivated;
      const mustChangePassword = (auth?.user as any)?.mustChangePassword;
      const isForcePasswordRoute = pathname.startsWith("/force-password-change");
      const userRole = (auth?.user as any)?.role as UserRole | undefined;
      const defaultDashboard = (userRole && ROLE_CONFIGS[userRole]?.defaultDashboard) || "/dashboard";

      if (isLoggedIn && mustChangePassword) {
        if (!isForcePasswordRoute && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
          return getSafeRedirect("/force-password-change", nextUrl, headers);
        }
      }

      if (isLoggedIn && !mustChangePassword && isForcePasswordRoute) {
        return getSafeRedirect(defaultDashboard, nextUrl, headers);
      }

      const isAuthRoute =
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password");

      if (isAuthRoute) {
        return true;
      }

      // Logged-in requests proceed to server layout and page guards where assertRouteAccess
      // securely enforces role permissions and persists UNAUTHORIZED_ROUTE_ATTEMPT to audit_logs.

      return isLoggedIn;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // user is only available the first time JWT is created
        token.id = user.id;
        token.schoolId = user.schoolId;
        token.role = user.role;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }
      if (trigger === "update" && session) {
        if (session.mustChangePassword !== undefined) {
          token.mustChangePassword = session.mustChangePassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).schoolId = token.schoolId as string | null;
        session.user.role = token.role as string;
        (session.user as any).mustChangePassword = (token.mustChangePassword as boolean) ?? false;
      }
      return session;
    },
  },
};
