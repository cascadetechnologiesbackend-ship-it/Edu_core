import { authConfig } from "@/lib/auth/auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default (auth as any)((req: any) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/forgot-password");
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isProtectedRoute = !isAuthRoute && !isApiAuthRoute;

  // Handle Auth Redirects
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return;
  }

  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/trpc|_next/static|_next/image|favicon.ico).*)"],
};
