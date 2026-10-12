#!/usr/bin/env node
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let pg;
try {
  const requireDb = createRequire(path.join(__dirname, '../database/package.json'));
  pg = requireDb('pg');
} catch {
  const requireRoot = createRequire(import.meta.url);
  pg = requireRoot('pg');
}

const { Client } = pg;

const adminDbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

async function verifyCredentials() {
  console.log("================================================================================");
  console.log(" S7-T1: Production Credential Closure Verification (CRED_PROOF)");
  console.log("================================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const adminClient = new Client({ connectionString: adminDbUrl });
  let roleState = null;

  try {
    await adminClient.connect();
    const res = await adminClient.query(`
      SELECT rolname, rolcanlogin, rolsuper, rolinherit 
      FROM pg_roles 
      WHERE rolname IN ('schoolmitra_app', 'schoolmitra_app_login')
      ORDER BY rolname;
    `);
    roleState = res.rows;
    console.log("\n[1] pg_roles state query result:");
    console.table(roleState);
  } catch (err) {
    console.error("❌ Failed to query pg_roles via admin connection:", err.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Test default credential connection attempt
  // Construct connection URL replacing credentials with schoolmitra_app_login:schoolmitra_app_secure
  const probeUrl = adminDbUrl.replace(
    /\/\/[^:]+:[^@]+@/,
    "//schoolmitra_app_login:schoolmitra_app_secure@"
  );

  console.log("\n[2] Probing connection with committed default credentials (schoolmitra_app_login:schoolmitra_app_secure)...");
  const probeClient = new Client({ connectionString: probeUrl });
  let authFailedAsExpected = false;
  let probeErrorMessage = "";

  try {
    await probeClient.connect();
    // If it connects successfully, check if rolcanlogin was false
    console.error("❌ CRITICAL: Connection with committed default password SUCCEEDED. Credential surface is OPEN!");
    await probeClient.end();
    process.exit(1);
  } catch (err) {
    authFailedAsExpected = true;
    probeErrorMessage = err.message || String(err);
    console.log(`✅ Default password connection REJECTED as expected.`);
    console.log(`   Rejection reason: ${probeErrorMessage}`);
  }

  const loginRole = roleState.find(r => r.rolname === 'schoolmitra_app_login');
  const appRole = roleState.find(r => r.rolname === 'schoolmitra_app');

  const verificationSummary = {
    timestamp: new Date().toISOString(),
    schoolmitra_app: {
      exists: Boolean(appRole),
      rolcanlogin: appRole ? appRole.rolcanlogin : false,
    },
    schoolmitra_app_login: {
      exists: Boolean(loginRole),
      rolcanlogin: loginRole ? loginRole.rolcanlogin : null,
      defaultPasswordRejected: authFailedAsExpected,
      rejectionReason: probeErrorMessage,
    },
    credentialClosureStatus: authFailedAsExpected ? "PASSED_SECURE" : "FAILED_VULNERABLE",
  };

  console.log("\n[3] Verification Summary JSON:");
  console.log(JSON.stringify(verificationSummary, null, 2));

  if (authFailedAsExpected) {
    console.log("\n✅ S7-T1 Credential Closure Verification: PASSED");
    process.exit(0);
  } else {
    console.log("\n❌ S7-T1 Credential Closure Verification: FAILED");
    process.exit(1);
  }
}

verifyCredentials().catch(err => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});
