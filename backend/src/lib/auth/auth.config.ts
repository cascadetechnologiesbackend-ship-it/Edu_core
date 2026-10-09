import { type NextAuthConfig } from "next-auth";
import { canRoleAccessRoute } from "../routeGuards";
import { ROLE_CONFIGS, type UserRole } from "../roleConfig";

function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.warn("⚠️ Warning: AUTH_SECRET or NEXTAUTH_SECRET is not set in environment. Falling back to default secret.");
    return "default-schoolmitra-auth-secret-key-32chars-min-len";
  }
  return secret;
}

export const authConfig: NextAuthConfig = {
  // trustHost: required for deployments behind a reverse proxy (Render, Vercel, Railway)
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
    authorized({ auth, request: { nextUrl } }) {
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

      // Webhook and health endpoints have internal cryptographic / key validation
      if (
        pathname.startsWith("/api/webhooks") ||
        pathname.startsWith("/api/health")
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

      const isLoggedIn = !!auth?.user;
      const mustChangePassword = (auth?.user as any)?.mustChangePassword;
      const isForcePasswordRoute = pathname.startsWith("/force-password-change");

      if (isLoggedIn && mustChangePassword) {
        if (!isForcePasswordRoute && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
          return Response.redirect(new URL("/force-password-change", nextUrl));
        }
      }

      if (isLoggedIn && !mustChangePassword && isForcePasswordRoute) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      const isAuthRoute =
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password");

      if (isAuthRoute) {
        if (isLoggedIn) {
          if (mustChangePassword) {
            return Response.redirect(new URL("/force-password-change", nextUrl));
          }
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (isLoggedIn) {
        const userRole = (auth?.user as any)?.role as UserRole | undefined;
        if (userRole && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
          const isAdminRoute =
            pathname.startsWith("/students") ||
            pathname.startsWith("/exams") ||
            pathname.startsWith("/admissions") ||
            pathname.startsWith("/academics") ||
            pathname.startsWith("/attendance") ||
            pathname.startsWith("/hr") ||
            pathname.startsWith("/library") ||
            pathname.startsWith("/transport") ||
            pathname.startsWith("/dpdp") ||
            pathname.startsWith("/settings") ||
            pathname.startsWith("/school/") ||
            pathname === "/dashboard";

          if (isAdminRoute && !canRoleAccessRoute(userRole, pathname)) {
            const redirectPath = ROLE_CONFIGS[userRole]?.defaultDashboard || "/login";
            return Response.redirect(new URL(redirectPath, nextUrl));
          }
        }
      }

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
