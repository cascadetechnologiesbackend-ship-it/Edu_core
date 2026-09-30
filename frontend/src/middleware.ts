import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export default async function middleware(req: NextRequest) {
  return (auth as any)(req);
}

export const config = {
  matcher: ["/((?!api/trpc|_next/static|_next/image|favicon.ico).*)"],
};
