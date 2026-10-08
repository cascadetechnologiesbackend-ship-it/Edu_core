import "dotenv/config";
import { db } from "./index";
import { users, userRoles, roles, schools } from "./schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const [school] = await db.select().from(schools).limit(1);
  if (!school) throw new Error("No school found");

  const [adminRole] = await db.select().from(roles).where(and(eq(roles.schoolId, school.id), eq(roles.name, "SCHOOL_ADMIN"))).limit(1);
  if (!adminRole) throw new Error("No SCHOOL_ADMIN role found");

  const email = "school_admin1@school.edu.in";
  const passwordHash = await bcrypt.hash("schoolmitra_dev", 12);

  let [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);

  let userId: string;
  if (existing) {
    await db.update(users).set({ passwordHash, isActive: true, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, existing.id));
    userId = existing.id;
  } else {
    const [nu] = await db.insert(users).values({
      schoolId: school.id,
      email,
      passwordHash,
      isActive: true,
      isEmailVerified: true,
      mustChangePassword: false,
    }).returning();
    if (!nu) throw new Error("Failed to insert user");
    userId = nu.id;
  }

  const [existingUr] = await db.select().from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, adminRole.id))).limit(1);
  if (!existingUr) {
    await db.insert(userRoles).values({
      userId,
      roleId: adminRole.id,
      schoolId: school.id,
    });
  }

  console.log("Seeded test admin successfully:", email);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
