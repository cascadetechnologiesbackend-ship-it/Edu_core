import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, userRoles, roles } from "@/db/schema/core";
import { eq } from "drizzle-orm";

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email);
        const password = String(credentials.password);

        // Check for lockout before hitting DB
        const { isAccountLocked, recordFailedAttempt, clearLockout } = await import("@/lib/accountLockout");
        
        if (await isAccountLocked(email)) {
          throw new Error("Account is temporarily locked due to too many failed attempts. Please try again in 15 minutes.");
        }

        // Fetch user
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.passwordHash || !user.isActive) {
          await recordFailedAttempt(email);
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          await recordFailedAttempt(email);
          return null;
        }

        // Clear lockout on success
        await clearLockout(email);

        // Fetch user roles
        const userRolesList = await db
          .select({ roleName: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, user.id));

        const roleNames = userRolesList.map((r) => r.roleName);

        // Return user object for NextAuth
        return {
          id: user.id,
          email: user.email,
          name: email.split("@")[0] ?? "Unknown", // Simple fallback name
          schoolId: user.schoolId,
          role: roleNames[0] ?? "STUDENT",
        };
      },
    }),
  ],
}) as any;
