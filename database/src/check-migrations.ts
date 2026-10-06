import fs from "fs";
import path from "path";

function validateMigrations() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found at ${migrationsDir}`);
    process.exit(1);
  }

  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Auditing ${sqlFiles.length} migration files in ${migrationsDir}...`);

  const prefixMap = new Map<string, string>();
  let hasErrors = false;

  for (const file of sqlFiles) {
    const prefixMatch = file.match(/^(\d{4})_/);
    if (!prefixMatch) {
      console.error(`❌ Migration file does not follow 4-digit sequence format: ${file}`);
      hasErrors = true;
      continue;
    }
    const prefix = prefixMatch[1];
    if (!prefix) continue;
    if (prefixMap.has(prefix)) {
      console.error(
        `❌ Sequence conflict detected! Prefix "${prefix}" is shared by:\n  - ${prefixMap.get(
          prefix,
        )}\n  - ${file}`,
      );
      hasErrors = true;
    } else {
      prefixMap.set(prefix, file);
    }
  }

  // Verify journal synchronization
  const journalPath = path.join(migrationsDir, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    console.error(`❌ Journal file missing at ${journalPath}`);
    hasErrors = true;
  } else {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const journalTags = new Set(journal.entries.map((e: any) => e.tag));

    for (const file of sqlFiles) {
      const tag = file.replace(/\.sql$/, "");
      if (!journalTags.has(tag)) {
        console.error(`❌ Migration file ${file} is not recorded in meta/_journal.json`);
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    console.error("Migration sequence verification failed!");
    process.exit(1);
  }

  console.log("✅ All migration sequence numbers are unique and synchronized with journal.");
}

validateMigrations();
