import "dotenv/config";
import { db } from "./index";
import { superAdminUsers, users } from "./schema/core";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function ensureSuperAdmin(
  targetEmail = process.env.SUPER_ADMIN_EMAIL || "cascadetechnologiessolutions@gmail.com",
  targetPass = process.env.SUPER_ADMIN_PASSWORD || "P4jkbnixj4@"
) {
  console.log(`🔍 Ensuring SUPER_ADMIN user in database: ${targetEmail}...`);

  const passwordHash = await bcrypt.hash(targetPass, 12);
  const emailLower = targetEmail.trim().toLowerCase();

  // 1. Check super_admin_users table
  const existingSuperAdmins = await db.select().from(superAdminUsers);
  const existingTarget = existingSuperAdmins.find(
    (sa) => sa.email.toLowerCase() === emailLower
  );

  if (existingTarget) {
    console.log(`🔄 Updating password for existing super admin: ${targetEmail}...`);
    await db
      .update(superAdminUsers)
      .set({
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(superAdminUsers.id, existingTarget.id));
    console.log(`✅ Super Admin password updated successfully!`);
  } else {
    console.log(`➕ Creating new SUPER_ADMIN user: ${targetEmail}...`);
    const [newSuperAdmin] = await db
      .insert(superAdminUsers)
      .values({
        email: emailLower,
        passwordHash,
        fullName: "Platform Super Admin",
        isActive: true,
      })
      .returning();
    console.log(`✅ Super Admin created successfully! ID: ${newSuperAdmin?.id}`);
  }

  // 2. Also check and synchronize in regular users table if present
  const [regularUser] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${emailLower}`)
    .limit(1);

  if (regularUser) {
    console.log(`ℹ️ Found ${targetEmail} in users table. Synchronizing password...`);
    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, regularUser.id));
    console.log(`✅ School Admin user password synchronized!`);
  }

  // 3. Verify comparison
  const [finalCheck] = await db
    .select()
    .from(superAdminUsers)
    .where(sql`lower(${superAdminUsers.email}) = ${emailLower}`)
    .limit(1);

  const isValid = finalCheck
    ? await bcrypt.compare(targetPass, finalCheck.passwordHash)
    : false;

  console.log(`🔒 Bcrypt verification test: ${isValid ? "PASSED ✅" : "FAILED ❌"}`);
  console.log(`Credentials configured:`);
  console.log(`Email: ${targetEmail}`);
  console.log(`Password: ${targetPass}`);
  console.log(`Role: SUPER_ADMIN\n`);
  return { success: isValid, email: targetEmail };
}

// Allow direct CLI execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("manage_super_admin.ts")) {
  ensureSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error managing super admin:", err);
      process.exit(1);
    });
}
