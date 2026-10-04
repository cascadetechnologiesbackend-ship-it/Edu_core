"use server";

import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/serverAuth";
import { eq } from "drizzle-orm";
import { getRoleConfig } from "@/lib/roleConfig";

export async function forceChangePassword(newPassword: string, confirmPassword: string) {
  try {
    const ctx = await requireAuth();

    if (!newPassword || newPassword.length < 8) {
      return { success: false, message: "Password must be at least 8 characters long." };
    }

    if (!/[A-Z]/.test(newPassword)) {
      return { success: false, message: "Password must contain at least one uppercase letter." };
    }

    if (!/[0-9]/.test(newPassword)) {
      return { success: false, message: "Password must contain at least one number." };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: "Passwords do not match." };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.userId));

    const roleConfig = getRoleConfig(ctx.role);

    return {
      success: true,
      message: "Password changed successfully! Redirecting to your dashboard...",
      redirectUrl: roleConfig.defaultDashboard,
    };
  } catch (err: any) {
    console.error("Failed to change password:", err);
    return {
      success: false,
      message: err.message || "An unexpected error occurred while updating your password.",
    };
  }
}
