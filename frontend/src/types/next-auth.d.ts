import NextAuth, { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      schoolId: string | null;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    schoolId?: string | null;
    role: string;
    mustChangePassword?: boolean;
  }
}
