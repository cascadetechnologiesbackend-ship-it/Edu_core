import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import net from "net";
import tls from "tls";
import path from "path";
import { fileURLToPath } from "url";
import { ensureSuperAdmin } from "./manage_super_admin";
import { getPoolConfig } from "./index";

const migrationUrl =
  process.env["MIGRATION_DATABASE_URL"] ??
  process.env["DATABASE_URL"] ??
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

const poolConfig = getPoolConfig(migrationUrl, { isMigration: true });
const activePool = new Pool(poolConfig);
const activeDb = drizzle(activePool);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sanitizeMigrationHistory(client: Pool) {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) AS exists;
    `);

    if (!tableCheck.rows[0]?.exists) {
      return;
    }

    const { rows } = await client.query(
      `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC;`
    );
    console.log(`[Migrate] Found ${rows.length} existing migration records in DB.`);

    // Normalize legacy timestamps that were renumbered in commit 95d99ea:
    // Migration 0006 was formerly 1791114978995 -> normalize to 1786958891444
    // Migration 0005 was formerly 1790800000000 -> normalize to 1786458891444
    // Migration 0004 was formerly 1790785323538 -> normalize to 1785958891444
    const fixResult = await client.query(`
      UPDATE drizzle.__drizzle_migrations 
      SET created_at = CASE 
        WHEN created_at = 1791114978995 THEN 1786958891444
        WHEN created_at = 1790800000000 THEN 1786458891444
        WHEN created_at = 1790785323538 THEN 1785958891444
        ELSE created_at
      END
      WHERE created_at IN (1791114978995, 1790800000000, 1790785323538);
    `);
    if ((fixResult.rowCount ?? 0) > 0) {
      console.log(`[Migrate] Normalized ${fixResult.rowCount} legacy migration timestamp(s).`);
    }

    // Check if account_ledger_transactions table exists in public schema
    const altCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'account_ledger_transactions'
      ) AS exists;
    `);
    const hasAlt = Boolean(altCheck.rows[0]?.exists);

    // If account_ledger_transactions does not exist, migration 0013 has not actually run
    // Delete any erroneous records with created_at >= 1790458891444 so Drizzle executes 0013+
    if (!hasAlt) {
      const delResult = await client.query(`
        DELETE FROM drizzle.__drizzle_migrations 
        WHERE created_at >= 1790458891444;
      `);
      if ((delResult.rowCount ?? 0) > 0) {
        console.log(`[Migrate] Pruned ${delResult.rowCount} unapplied migration record(s) so 0013+ can execute.`);
      }
    }
  } catch (err) {
    console.warn("[Migrate] Non-fatal notice during migration history check:", err);
  }
}

function maskHost(host: string): string {
  if (!host) return "<empty>";
  if (net.isIP(host)) return net.isIPv6(host) ? "<IPv6>" : "<IPv4>";
  if (host.startsWith("dpg-")) {
    const dot = host.indexOf(".");
    return dot === -1 ? "dpg-***" : `dpg-***${host.slice(dot)}`;
  }
  const dot = host.indexOf(".");
  return dot === -1 ? "***" : `***${host.slice(dot)}`;
}

function buildStartupPacket(user: string, database: string): Buffer {
  const fields = Buffer.from(`user\0${user}\0database\0${database}\0\0`, "utf8");
  const len = 4 + 4 + fields.length;
  const buf = Buffer.alloc(len);
  buf.writeInt32BE(len, 0);
  buf.writeInt32BE(196608, 4); // protocol 3.0
  fields.copy(buf, 8);
  return buf;
}

function parsePgErrorPacket(buf: Buffer): string {
  if (buf.length < 5 || buf[0] !== 0x45 /* 'E' */) return "";
  const parts: string[] = [];
  let i = 5;
  while (i < buf.length) {
    const code = buf[i++];
    if (!code) break;
    const end = buf.indexOf(0, i);
    if (end === -1) break;
    const key = String.fromCharCode(code);
    const val = buf.slice(i, end).toString("utf8");
    if (key === "S" || key === "C" || key === "M") {
      parts.push(`${key}=${val}`);
    }
    i = end + 1;
  }
  return parts.join(", ");
}

async function runConnectionDiagnostics(rawUrl: string): Promise<void> {
  const urlSource = process.env["MIGRATION_DATABASE_URL"]
    ? "MIGRATION_DATABASE_URL"
    : process.env["DATABASE_URL"]
      ? "DATABASE_URL"
      : "default";

  let host = "";
  let port = 5432;
  let user = "postgres";
  let database = "postgres";
  let queryKeys: string[] = [];
  let scheme = "unknown";
  let parseErr = "";

  try {
    const trimmed = rawUrl.trim();
    const quoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"));
    if (quoted) {
      parseErr = "URL is wrapped in quotes!";
    }
    const normalized = trimmed
      .replace(/^['"]|['"]$/g, "")
      .replace(/^postgresql:\/\//i, "http://")
      .replace(/^postgres:\/\//i, "http://");
    const u = new URL(normalized);
    scheme = trimmed.split("://")[0] ?? "unknown";
    host = u.hostname;
    port = u.port ? parseInt(u.port, 10) : 5432;
    user = decodeURIComponent(u.username || "postgres");
    database = decodeURIComponent((u.pathname || "/postgres").slice(1) || user);
    queryKeys = Array.from(u.searchParams.keys());
  } catch (err: any) {
    parseErr = err?.message || String(err);
  }

  console.error("[Migrate Diag] Config summary:", {
    node: process.version,
    urlSource,
    scheme,
    maskedHost: maskHost(host),
    port,
    queryKeys,
    parseErr: parseErr || undefined,
    env: {
      RENDER: Boolean(process.env["RENDER"]),
      VERCEL: Boolean(process.env["VERCEL"]),
      NODE_ENV: process.env["NODE_ENV"],
      DATABASE_SSL: process.env["DATABASE_SSL"],
      PGSSLMODE: process.env["PGSSLMODE"],
      PGSSLNEGOTIATION: process.env["PGSSLNEGOTIATION"],
    },
  });

  if (!host) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      console.error("[Migrate Diag] Raw probe timed out after 5000ms");
      socket.destroy();
      done();
    }, 5000);

    socket.once("error", (err) => {
      clearTimeout(timer);
      console.error("[Migrate Diag] TCP error:", err.message);
      done();
    });

    socket.once("connect", () => {
      console.error(
        `[Migrate Diag] Step 1 TCP connected (${socket.remoteFamily}, port ${socket.remotePort})`
      );
      // Send PostgreSQL SSLRequest (length=8, code=80877103)
      socket.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]));
    });

    socket.once("close", (hadError) => {
      console.error(`[Migrate Diag] Raw TCP socket closed (hadError=${hadError})`);
      clearTimeout(timer);
      done();
    });

    socket.once("data", (chunk) => {
      const code = chunk.toString("utf8", 0, 1);
      console.error(
        `[Migrate Diag] Step 2 SSLRequest reply: byte=${JSON.stringify(code)} len=${chunk.length}`
      );
      if (code === "E") {
        console.error("[Migrate Diag] Server error before TLS:", parsePgErrorPacket(chunk));
        socket.destroy();
        return;
      }
      if (code !== "S") {
        socket.destroy();
        return;
      }

      console.error("[Migrate Diag] Step 3 upgrading to TLS (rejectUnauthorized=false)...");
      const tlsSock = tls.connect({
        socket,
        rejectUnauthorized: false,
        servername: net.isIP(host) === 0 ? host : undefined,
      });

      tlsSock.once("error", (err) => {
        console.error("[Migrate Diag] TLS error:", err.message);
      });

      tlsSock.once("close", (hadError) => {
        console.error(`[Migrate Diag] TLS socket closed (hadError=${hadError})`);
      });

      tlsSock.once("secureConnect", () => {
        console.error(
          `[Migrate Diag] Step 4 TLS connected: protocol=${tlsSock.getProtocol()}, cipher=${tlsSock.getCipher()?.name}, authorized=${tlsSock.authorized}, authErr=${tlsSock.authorizationError ?? "none"}`
        );
        tlsSock.write(buildStartupPacket(user, database));
      });

      tlsSock.once("data", (pgResp) => {
        const msgType = pgResp.toString("utf8", 0, 1);
        const errInfo = msgType === "E" ? ` (${parsePgErrorPacket(pgResp)})` : "";
        console.error(
          `[Migrate Diag] Step 5 PG Startup reply: type=${JSON.stringify(msgType)} len=${pgResp.length}${errInfo}`
        );
        tlsSock.destroy();
      });
    });
  });
}

async function main() {
  console.log("Migration started");
  const migrationsFolder = path.resolve(__dirname, "migrations");
  console.log(`Using migrations folder: ${migrationsFolder}`);
  console.log(`[Migrate] SSL enabled: ${Boolean(poolConfig.ssl)}`);

  try {
    await activePool.query("SELECT 1");
  } catch (connErr) {
    console.error("[Migrate] Initial DB connection check failed:", (connErr as any)?.message || connErr);
    await runConnectionDiagnostics(migrationUrl);
    throw connErr;
  }

  await sanitizeMigrationHistory(activePool);

  // S6-T1 / S7-T1: Production credential closure and APP_DB_PASSWORD enforcement
  const appDbPassword = process.env["APP_DB_PASSWORD"];
  const isProduction = process.env["NODE_ENV"] === "production";

  if (isProduction) {
    const roleCheck = await activePool.query(`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login') AS exists;
    `);
    const roleExists = Boolean(roleCheck.rows[0]?.exists);

    if (!roleExists && !appDbPassword) {
      throw new Error(
        "[Migrate FATAL] Production environment requires APP_DB_PASSWORD to create schoolmitra_app_login role. Cannot use committed default credentials in production."
      );
    }
  }

  if (appDbPassword) {
    await activePool.query(`SELECT set_config('app.app_db_password', $1, false)`, [appDbPassword]);
    console.log("[Migrate] Injected APP_DB_PASSWORD into migration session context.");
  }

  await migrate(activeDb, { migrationsFolder });
  console.log("Migration completed");

  // S7-T1: In production, enforce NOLOGIN on schoolmitra_app_login to close the credential surface.
  // The application connection pool connects as the owner role and sets session role to schoolmitra_app.
  if (isProduction) {
    const roleExists = (await activePool.query(
      `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login') AS exists;`
    )).rows[0]?.exists;
    if (roleExists) {
      await activePool.query(`ALTER ROLE schoolmitra_app_login NOLOGIN;`);
      console.log("[Migrate] S7-T1: Hardened production - altered role schoolmitra_app_login to NOLOGIN.");
    }
  }

  try {
    console.log("Checking and seeding default super admin if required...");
    await ensureSuperAdmin();
  } catch (seedErr) {
    console.error("Warning: Failed to ensure super admin during migration:", seedErr);
  }

  await activePool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
