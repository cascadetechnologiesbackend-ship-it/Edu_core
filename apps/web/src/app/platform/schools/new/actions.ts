"use server";

import { auth } from "@/lib/auth";
import { db, provisionTenant, getTenantDb } from "@/db";
import { schools, users, roles, userRoles } from "@/db/schema";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";

export async function provisionNewSchool(formData: FormData) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      throw new Error("Unauthorized");
    }

    const name = formData.get("name") as string;
    const udiseCode = formData.get("udiseCode") as string;
    const adminEmail = formData.get("adminEmail") as string;
    const adminPassword = formData.get("adminPassword") as string;

    if (!name || !udiseCode || !adminEmail || !adminPassword) {
      return { success: false, message: "Missing required fields" };
    }

    // 1. Create the tenant record in the public schema
    const [school] = await db.insert(schools).values({
      name,
      udiseCode,
      board: "CBSE",
      address: "Update Address",
      city: "Update City",
      state: "Update State",
      pincode: "000000",
      phone: "0000000000",
      email: adminEmail,
      principalName: "Update Principal",
      establishedYear: new Date().getFullYear(),
      isActive: true,
      subscriptionTier: "STANDARD",
    }).returning();

    if (!school) throw new Error("Failed to create school record");

    // 2. Provision the Postgres schema for this tenant and run migrations
    await provisionTenant(udiseCode);

    // 3. Create initial SCHOOL_ADMIN in the public schema for global authentication
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    
    // We must execute these inserts in the PUBLIC schema so NextAuth can find them during login!
    const [adminUser] = await db.insert(users).values({
      schoolId: school.id,
      email: adminEmail,
      passwordHash,
      isActive: true,
      isEmailVerified: true,
    }).returning();

    // Ensure standard roles exist in public schema for this school
    const [adminRole] = await db.insert(roles).values({
      schoolId: school.id,
      name: "SCHOOL_ADMIN",
      displayName: "School Admin",
      description: "School Administrator",
      isSystemRole: true,
    }).returning();

    if (adminUser && adminRole) {
      await db.insert(userRoles).values({
        userId: adminUser.id,
        roleId: adminRole.id,
        schoolId: school.id,
      });
    }

    revalidatePath("/platform/schools");
    return { success: true, schoolId: school.id };
  } catch (error: any) {
    console.error("Provisioning error:", error);
    return { success: false, message: error.message };
  }
}
