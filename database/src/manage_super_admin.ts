import "dotenv/config";
import { db } from "./index";
import { superAdminUsers, users } from "./schema/core";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🔍 Checking for SUPER_ADMIN users in database...\n");

  // 1. Check super_admin_users table
  const existingSuperAdmins = await db.select().from(superAdminUsers);
  console.log(`Found ${existingSuperAdmins.length} super admin(s) in super_admin_users table:`);
  existingSuperAdmins.forEach((sa) => {
    console.log(` - ID: ${sa.id}, Email: ${sa.email}, Name: ${sa.fullName}, Active: ${sa.isActive}`);
  });

  const targetEmail = "vaibhavbg8080@gmail.com";
  const targetPass = "9902850039";
  const passwordHash = await bcrypt.hash(targetPass, 12);

  // 2. Feed / Update Super Admin
  const existingTarget = existingSuperAdmins.find((sa) => sa.email.toLowerCase() === targetEmail.toLowerCase());

  if (existingTarget) {
    console.log(`\n🔄 Updating password for existing super admin: ${targetEmail}...`);
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
    console.log(`\n➕ Creating new SUPER_ADMIN user: ${targetEmail}...`);
    const [newSuperAdmin] = await db
      .insert(superAdminUsers)
      .values({
        email: targetEmail,
        passwordHash,
        fullName: "Super Admin (Vaibhav)",
        isActive: true,
      })
      .returning();
    console.log(`✅ Super Admin created successfully! ID: ${newSuperAdmin?.id}`);
  }

  // 3. Also check and update in regular users table if present (e.g. for school admin access)
  const [regularUser] = await db.select().from(users).where(eq(users.email, targetEmail));
  if (regularUser) {
    console.log(`\nℹ️ Found ${targetEmail} in users table (School Admin). Synchronizing password as well...`);
    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, regularUser.id));
    console.log(`✅ School Admin user password synchronized to ${targetPass}!`);
  }

  // 4. Verify login comparison
  const [finalCheck] = await db.select().from(superAdminUsers).where(eq(superAdminUsers.email, targetEmail));
  const isValid = finalCheck ? await bcrypt.compare(targetPass, finalCheck.passwordHash) : false;
  console.log(`\n🔒 Bcrypt verification test: ${isValid ? "PASSED ✅" : "FAILED ❌"}`);
  console.log(`\nCredentials configured:`);
  console.log(`Email: ${targetEmail}`);
  console.log(`Password: ${targetPass}`);
  console.log(`Role: SUPER_ADMIN`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error managing super admin:", err);
    process.exit(1);
  });
