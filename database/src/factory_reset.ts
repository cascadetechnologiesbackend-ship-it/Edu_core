import "dotenv/config";
import { db } from "./index";
import { sql } from "drizzle-orm";

async function factoryReset() {
  console.log("⚠️  Starting Factory Reset & Hard Data Wipe...");

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

  // 2. Fetch all application tables in public schema
  const tablesRes: any = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
  `);

  const tables: string[] = (tablesRes.rows || tablesRes).map(
    (r: any) => r.table_name
  );

  console.log(`🧹 Truncating all ${tables.length} tables in public schema...`);
  
  if (tables.length > 0) {
    const formattedTableList = tables.map((t) => `"${t}"`).join(", ");
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${formattedTableList} RESTART IDENTITY CASCADE;`)
    );
  }

  // 3. Verification check
  console.log("🔍 Verifying zero-data state...");

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
  console.log("✅ FACTORY RESET COMPLETE - ABSOLUTE ZERO");
  console.log(`   - Tenant Schemas Remaining: ${tenantCount}`);
  console.log(`   - Schools in Database:     ${schoolsCount}`);
  console.log(`   - Users in Database:       ${usersCount}`);
  console.log(`   - Super Admins:            ${superAdminCount}`);
  console.log(`   - Students:                ${studentsCount}`);
  console.log("==========================================");

  process.exit(0);
}

factoryReset().catch((err) => {
  console.error("❌ Factory reset failed:", err);
  process.exit(1);
});
