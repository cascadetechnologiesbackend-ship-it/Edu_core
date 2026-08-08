import { type NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "change-me-to-a-random-64-char-string-in-production",
  providers: [], // Providers like Credentials with DB access go in index.ts
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes
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
