import { type NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "change-me-to-a-random-64-char-string-in-production",
  providers: [], // Providers like Credentials with DB access go in index.ts
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — ERP admin sessions are long-lived
    updateAge: 60 * 60,  // Only re-sign JWT token every 1 hour
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;

      // Always allow Next.js internal assets, static files, and auth API endpoints
      if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api/auth") ||
        pathname.includes(".")
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
      const isAuthRoute =
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password");

      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        // user is only available the first time JWT is created
        token.id = user.id;
        token.schoolId = user.schoolId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).schoolId = token.schoolId as string | null;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
