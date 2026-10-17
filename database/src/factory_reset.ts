import "dotenv/config";
import { db } from "./index";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { superAdminUsers } from "./schema/core";
import { eq } from "drizzle-orm";

async function factoryReset() {
  console.log("⚠️  Starting Complete Database Clean (Preserving Super Admin)...");

  // Maintenance script override: allow up to 60s for bulk schema drops & truncations
  await db.execute(sql`SET statement_timeout = 60000;`);

  // 1. Drop all dynamic tenant schemas
  const tenantSchemasRes: any = await db.execute(sql`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'tenant_%';
  `);
  
  const tenantSchemas: string[] = (tenantSchemasRes.rows || tenantSchemasRes).map(
    (r: any) => r.schema_name
  );

  console.log(`🧹 Dropping ${tenantSchemas.length} tenant schema(s)...`);
  for (const schemaName of tenantSchemas) {
    console.log(`   - Dropping schema: ${schemaName}`);
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`));
  }

  // 2. Fetch all application tables in public schema except super_admin_users and migration tables
  const tablesRes: any = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
  `);

  const tables: string[] = (tablesRes.rows || tablesRes)
    .map((r: any) => r.table_name)
    .filter((t: string) => 
      t !== "super_admin_users" && 
      !t.startsWith("drizzle") &&
      !t.startsWith("__drizzle")
    );

  console.log(`🧹 Truncating all ${tables.length} tenant & application tables in public schema...`);
  
  if (tables.length > 0) {
    const formattedTableList = tables.map((t) => `"${t}"`).join(", ");
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${formattedTableList} RESTART IDENTITY CASCADE;`)
    );
  }

  // 3. Ensure Super Admin credentials are preserved & valid
  const superAdminsToEnsure = [
    {
      email: "vaibhavbg8080@gmail.com",
      pass: "9902850039",
      name: "Super Admin (Vaibhav)",
    },
    {
      email: (process.env.SUPER_ADMIN_EMAIL || "cascadetechnologiessolutions@gmail.com").trim().toLowerCase(),
      pass: process.env.SUPER_ADMIN_PASSWORD || "P4jkbnixj4@",
      name: "Platform Super Admin",
    },
  ];

  for (const admin of superAdminsToEnsure) {
    const passwordHash = await bcrypt.hash(admin.pass, 12);
    const [existingSA] = await db
      .select()
      .from(superAdminUsers)
      .where(sql`lower(${superAdminUsers.email}) = ${admin.email.toLowerCase()}`);

    if (existingSA) {
      console.log(`🔐 Verifying Super Admin (${admin.email})...`);
      await db
        .update(superAdminUsers)
        .set({
          passwordHash,
          isActive: true,
          totpEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(superAdminUsers.id, existingSA.id));
    } else {
      console.log(`➕ Seeding primary Super Admin (${admin.email})...`);
      await db.insert(superAdminUsers).values({
        email: admin.email.toLowerCase(),
        passwordHash,
        fullName: admin.name,
        isActive: true,
        totpEnabled: false,
      });
    }
  }

  // 4. Verification check
  console.log("🔍 Verifying post-clean database state...");

  const remainingTenants: any = await db.execute(sql`
    SELECT count(*) as count 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'tenant_%';
  `);
  const tenantCount = (remainingTenants.rows || remainingTenants)[0]?.count ?? "0";

  const schoolsRes: any = await db.execute(sql`SELECT count(*) as count FROM schools;`);
  const schoolsCount = (schoolsRes.rows || schoolsRes)[0]?.count ?? "0";

  const usersRes: any = await db.execute(sql`SELECT count(*) as count FROM users;`);
  const usersCount = (usersRes.rows || usersRes)[0]?.count ?? "0";

  const superAdminsRes: any = await db.execute(sql`SELECT count(*) as count FROM super_admin_users;`);
  const superAdminCount = (superAdminsRes.rows || superAdminsRes)[0]?.count ?? "0";

  const studentsRes: any = await db.execute(sql`SELECT count(*) as count FROM students;`);
  const studentsCount = (studentsRes.rows || studentsRes)[0]?.count ?? "0";

  console.log("==========================================");
  console.log("✅ DATABASE WIPE COMPLETE — ZERO DATA WITH SUPER ADMIN PRESERVED");
  console.log(`   - Tenant Schemas Remaining: ${tenantCount}`);
  console.log(`   - Schools in Database:     ${schoolsCount}`);
  console.log(`   - Regular Users in DB:     ${usersCount}`);
  console.log(`   - Super Admins Preserved:  ${superAdminCount}`);
  console.log(`   - Students in Database:    ${studentsCount}`);
  for (const admin of superAdminsToEnsure) {
    console.log(`Super Admin Login: ${admin.email} / ${admin.pass}`);
  }

  process.exit(0);
}

factoryReset().catch((err) => {
  console.error("❌ Database clean failed:", err);
  process.exit(1);
});
