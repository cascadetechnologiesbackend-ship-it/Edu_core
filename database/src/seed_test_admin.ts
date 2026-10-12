import "dotenv/config";
import { db } from "./index";
import { users, userRoles, roles, schools } from "./schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { ensureSuperAdmin } from "./manage_super_admin";

const REQUIRED_ROLES = [
  { name: "SCHOOL_ADMIN", displayName: "School Admin" },
  { name: "ACCOUNTANT", displayName: "Accountant" },
  { name: "TEACHER", displayName: "Teacher" },
  { name: "LIBRARIAN", displayName: "Librarian" },
  { name: "TRANSPORT_MANAGER", displayName: "Transport Manager" },
  { name: "PARENT", displayName: "Parent" },
  { name: "STUDENT", displayName: "Student" },
  { name: "DRIVER", displayName: "Driver" },
] as const;

const TEST_ACCOUNTS = [
  { email: "school_admin1@school.edu.in", role: "SCHOOL_ADMIN" },
  { email: "accountant1@school.edu.in", role: "ACCOUNTANT" },
  { email: "teacher1@school.edu.in", role: "TEACHER" },
  { email: "librarian1@school.edu.in", role: "LIBRARIAN" },
  { email: "transport1@school.edu.in", role: "TRANSPORT_MANAGER" },
  { email: "transport_manager1@school.edu.in", role: "TRANSPORT_MANAGER" },
  { email: "parent1@school.edu.in", role: "PARENT" },
  { email: "student1@school.edu.in", role: "STUDENT" },
  { email: "driver1@school.edu.in", role: "DRIVER" },
] as const;

async function main() {
  console.log("🌱 Starting Comprehensive E2E Test Accounts Seeder...");

  // 1. Ensure Super Admin account
  await ensureSuperAdmin(
    process.env.SUPER_ADMIN_EMAIL || "cascadetechnologiessolutions@gmail.com",
    process.env.SUPER_ADMIN_PASSWORD || "P4jkbnixj4@"
  );

  // 2. Fetch primary school instance
  const [school] = await db.select().from(schools).limit(1);
  if (!school) throw new Error("No school instance found in database. Run db:seed first.");

  // Ensure school has slug 'saraswati' for multitenancy tests
  if (!school.slug || school.slug !== "saraswati") {
    await db.update(schools).set({ slug: "saraswati" }).where(eq(schools.id, school.id));
    console.log("🏫 Updated school slug to 'saraswati'");
  }

  // 3. Ensure all required roles exist for this school
  const roleMap: Record<string, string> = {};
  for (const roleDef of REQUIRED_ROLES) {
    let [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.schoolId, school.id), eq(roles.name, roleDef.name as any)))
      .limit(1);

    if (!role) {
      const [newRole] = await db
        .insert(roles)
        .values({
          schoolId: school.id,
          name: roleDef.name as any,
          displayName: roleDef.displayName,
          isSystemRole: true,
        })
        .returning();
      role = newRole;
      console.log(`➕ Created role '${roleDef.name}' for school`);
    }
    if (role) {
      roleMap[roleDef.name] = role.id;
    }
  }

  // 4. Ensure test user accounts exist with standard testing credentials
  const passwordHash = await bcrypt.hash("schoolmitra_dev", 12);

  for (const acc of TEST_ACCOUNTS) {
    const roleId = roleMap[acc.role];
    if (!roleId) {
      throw new Error(`Role ${acc.role} not found in roleMap`);
    }

    const emailLower = acc.email.toLowerCase();
    let [existingUser] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${emailLower}`)
      .limit(1);

    let userId: string;
    if (existingUser) {
      await db
        .update(users)
        .set({
          passwordHash,
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
      userId = existingUser.id;
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          schoolId: school.id,
          email: emailLower,
          passwordHash,
          isActive: true,
          isEmailVerified: true,
          mustChangePassword: false,
        })
        .returning();
      if (!newUser) throw new Error(`Failed to insert user ${emailLower}`);
      userId = newUser.id;
    }

    // Link user to role
    const [existingUr] = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1);

    if (!existingUr) {
      await db.insert(userRoles).values({
        userId,
        roleId,
        schoolId: school.id,
      });
    }

    console.log(`✅ Seeded account: ${acc.email} (${acc.role})`);
  }

  console.log("🎉 All E2E test accounts seeded successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ E2E seeding failed:", err);
  process.exit(1);
});
