import NextAuth, { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      schoolId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    schoolId?: string | null;
    role: string;
  }
}
