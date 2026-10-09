"use server";

import { requireAuth } from "@/lib/serverAuth";
import { db, provisionTenant } from "@/db";
import { schools, users, roles, userRoles, persons } from "@/db/schema";
import { encryptData, computeSearchHash } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";

export async function provisionNewSchool(formData: FormData) {
  try {
    await requireAuth(["SUPER_ADMIN"]);

    const name = formData.get("name") as string;
    const udiseCode = formData.get("udiseCode") as string;
    const adminEmail = (formData.get("adminEmail") as string)?.trim().toLowerCase();
    const adminPassword = formData.get("adminPassword") as string;
    const adminFirstName = (formData.get("adminFirstName") as string)?.trim() || "School";
    const adminLastName = (formData.get("adminLastName") as string)?.trim() || "Administrator";
    const adminPhone = (formData.get("adminPhone") as string)?.trim() || null;

    if (!name || !udiseCode || !adminEmail || !adminPassword) {
      return { success: false, message: "Missing required fields" };
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Atomically create tenant, admin user, canonical person identity, and user role
    const { schoolId } = await db.transaction(async (tx) => {
      // 1. Create the tenant record in the public schema
      const [school] = await tx
        .insert(schools)
        .values({
          name,
          udiseCode,
          board: "CBSE",
          address: "Update Address",
          city: "Update City",
          state: "Update State",
          pincode: "000000",
          phone: adminPhone || "0000000000",
          email: adminEmail,
          principalName: `${adminFirstName} ${adminLastName}`,
          establishedYear: new Date().getFullYear(),
          isActive: true,
          subscriptionTier: "STANDARD",
        })
        .returning();

      if (!school) throw new Error("Failed to create school record");

      // 2. Create initial SCHOOL_ADMIN user
      const [adminUser] = await tx
        .insert(users)
        .values({
          schoolId: school.id,
          email: adminEmail,
          passwordHash,
          isActive: true,
          isEmailVerified: true,
        })
        .returning();

      if (!adminUser) throw new Error("Failed to create admin user");

      // 3. Create canonical person row linked to admin user
      await tx.insert(persons).values({
        schoolId: school.id,
        userId: adminUser.id,
        primaryType: "STAFF",
        firstNameEncrypted: encryptData(adminFirstName),
        lastNameEncrypted: encryptData(adminLastName),
        firstNameSearchHash: computeSearchHash(adminFirstName),
        lastNameSearchHash: computeSearchHash(adminLastName),
        gender: "OTHER",
        primaryEmailEncrypted: encryptData(adminEmail),
        primaryMobileEncrypted: adminPhone ? encryptData(adminPhone) : null,
        isActive: true,
      });

      // 4. Ensure standard role exists and link
      const [adminRole] = await tx
        .insert(roles)
        .values({
          schoolId: school.id,
          name: "SCHOOL_ADMIN",
          displayName: "School Admin",
          description: "School Administrator",
          isSystemRole: true,
        })
        .returning();

      if (adminRole) {
        await tx.insert(userRoles).values({
          userId: adminUser.id,
          roleId: adminRole.id,
          schoolId: school.id,
        });
      }

      return { schoolId: school.id };
    });

    // 5. Provision tenant Postgres schema and run migrations
    await provisionTenant(udiseCode);

    revalidatePath("/platform/schools");
    return { success: true, schoolId };
  } catch (error: any) {
    console.error("Provisioning error:", error);
    return { success: false, message: error.message };
  }
}
