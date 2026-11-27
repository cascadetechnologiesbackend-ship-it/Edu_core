import "dotenv/config";
import { Client } from "pg";

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const s = await c.query("SELECT id, name FROM schools WHERE slug = 'demo-cbse'");
  const sid = s.rows[0]?.id;
  console.log("Target Demo School:", s.rows[0]);

  const tablesRes = await c.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const emptyTables: string[] = [];
  const populatedTables: Array<{ name: string; count: number }> = [];

  for (const row of tablesRes.rows) {
    const t = row.table_name;
    if (t.startsWith("__drizzle")) continue;

    const colCheck = await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'school_id'`,
      [t]
    );

    let count = 0;
    if (colCheck.rowCount && colCheck.rowCount > 0 && sid) {
      const r = await c.query(`SELECT count(*)::int AS cnt FROM "${t}" WHERE school_id = $1`, [sid]);
      count = r.rows[0].cnt;
    } else {
      const r = await c.query(`SELECT count(*)::int AS cnt FROM "${t}"`);
      count = r.rows[0].cnt;
    }

    if (count === 0) {
      emptyTables.push(t);
    } else {
      populatedTables.push({ name: t, count });
    }
  }

  console.log("\n=== POPULATED TABLES ===");
  for (const p of populatedTables) {
    console.log(`  ${p.name.padEnd(40)} : ${p.count}`);
  }

  console.log(`\n=== EMPTY TABLES (${emptyTables.length}) ===`);
  for (const e of emptyTables) {
    console.log(`  - ${e}`);
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
