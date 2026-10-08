import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, userRoles, roles } from "@/db/schema/core";
import { eq, sql } from "drizzle-orm";

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      let token = await (authConfig.callbacks?.jwt ? authConfig.callbacks.jwt(params) : params.token);
      if (token?.id && token.mustChangePassword) {
        try {
          const [dbUser] = await db
            .select({ mustChangePassword: users.mustChangePassword })
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);
          if (dbUser && !dbUser.mustChangePassword) {
            token.mustChangePassword = false;
          }
        } catch {}
      }
      return token;
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "TOTP Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const totpCode = credentials.totpCode ? String(credentials.totpCode).trim() : null;

        // Check for lockout before hitting DB
        const { isAccountLocked, recordFailedAttempt, clearLockout } =
          await import("@/lib/accountLockout");

        if (await isAccountLocked(email)) {
          throw new Error(
            "Account is temporarily locked due to too many failed attempts. Please try again in 15 minutes.",
          );
        }

        // 1. Check super_admin_users first
        const { superAdminUsers } = await import("@/db/schema/core");
        const [superAdmin] = await db
          .select()
          .from(superAdminUsers)
          .where(sql`lower(${superAdminUsers.email}) = ${email}`)
          .limit(1);

        if (superAdmin && superAdmin.isActive) {
          const isValid = await bcrypt.compare(password, superAdmin.passwordHash);
          if (isValid) {
            // Check TOTP enforcement for SUPER_ADMIN
            if (superAdmin.totpEnabled) {
              if (!totpCode) {
                // Return partial credential signal or require TOTP
                throw new Error("TOTP_REQUIRED");
              }

              // Verify TOTP token using otplib
              const { authenticator } = await import("otplib");
              const { decryptData } = await import("@/lib/encryption");
              
              let secret = superAdmin.totpSecret;
              // Attempt decryption if secret was encrypted
              if (secret && secret.includes(":")) {
                const decrypted = decryptData(secret);
                if (decrypted) secret = decrypted;
              }

              const isTotpValid = secret ? authenticator.check(totpCode, secret) : false;
              if (!isTotpValid) {
                await recordFailedAttempt(email);
                throw new Error("INVALID_TOTP");
              }
            }

            await clearLockout(email);
            // Mint refresh session cookie
            try {
              const { cookies, headers } = await import("next/headers");
              const cookieStore = cookies();
              const headerStore = headers();
              const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
              const ua = headerStore.get("user-agent") ?? "unknown";
              const { createRefreshSession } = await import("./refreshToken");
              const rawToken = await createRefreshSession(superAdmin.id, ip, ua);
              cookieStore.set("schoolmitra_refresh", rawToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60,
                path: "/api/auth/refresh",
              });
            } catch {}

            return {
              id: superAdmin.id,
              email: superAdmin.email,
              name: superAdmin.fullName,
              schoolId: null, // Super admins have no school ID
              role: "SUPER_ADMIN",
            };
          } else {
            await recordFailedAttempt(email);
            return null;
          }
        }

        // 2. Fetch regular user
        const [user] = await db
          .select()
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
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

        // Fetch user roles and sort by privilege hierarchy
        const userRolesList = await db
          .select({ roleName: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, user.id));

        const ROLE_HIERARCHY: Record<string, number> = {
          SUPER_ADMIN: 100,
          SCHOOL_ADMIN: 90,
          PRINCIPAL: 80,
          HR_MANAGER: 70,
          ACCOUNTANT: 60,
          TEACHER: 50,
          LIBRARIAN: 40,
          TRANSPORT_MANAGER: 30,
          DRIVER: 20,
          PARENT: 10,
          STUDENT: 0,
        };

        const sortedRoles = userRolesList
          .map((r) => r.roleName)
          .sort((a, b) => (ROLE_HIERARCHY[b] ?? -1) - (ROLE_HIERARCHY[a] ?? -1));

        // DECIDE-18: Resolve primary role by staff.designation.mappedRole first; fall back to highest privilege
        let resolvedRole = sortedRoles[0] ?? "STUDENT";
        try {
          const { staff, designations } = await import("@/db/schema/hr");
          const [staffInfo] = await db
            .select({ mappedRole: designations.mappedRole })
            .from(staff)
            .innerJoin(designations, eq(staff.designationId, designations.id))
            .where(eq(staff.userId, user.id))
            .limit(1);

          if (staffInfo?.mappedRole && userRolesList.some((r) => r.roleName === staffInfo.mappedRole)) {
            resolvedRole = staffInfo.mappedRole as typeof resolvedRole;
          }
        } catch {}

        // Mint refresh session cookie
        try {
          const { cookies, headers } = await import("next/headers");
          const cookieStore = cookies();
          const headerStore = headers();
          const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
          const ua = headerStore.get("user-agent") ?? "unknown";
          const { createRefreshSession } = await import("./refreshToken");
          const rawToken = await createRefreshSession(user.id, ip, ua);
          cookieStore.set("schoolmitra_refresh", rawToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60,
            path: "/api/auth/refresh",
          });
        } catch {}

        // Return user object for NextAuth
        return {
          id: user.id,
          email: user.email,
          name: email.split("@")[0] ?? "Unknown",
          schoolId: user.schoolId,
          role: resolvedRole,
          mustChangePassword: user.mustChangePassword ?? false,
        };
      },
    }),
  ],
}) as any;
