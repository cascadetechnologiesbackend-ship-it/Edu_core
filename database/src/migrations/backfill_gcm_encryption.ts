/**
 * Backfill Migration: AES-256-CBC to AES-256-GCM + HKDF Search Hash Backfill
 *
 * Scans all sensitive tables with encrypted PII columns. If ciphertext is in legacy
 * format (iv:ciphertext), it decrypts via AES-256-CBC, re-encrypts via authenticated
 * AES-256-GCM (v2:keyId:iv:tag:ciphertext), recomputes deterministic search hashes
 * using the distinct HKDF-derived key, and updates the row.
 *
 * Usage:
 *   npx tsx database/src/migrations/backfill_gcm_encryption.ts [--dry-run]
 */

import "dotenv/config";
import { db } from "../index";
import { sql } from "drizzle-orm";
import {
  encryptData,
  decryptData,
  computeSearchHash,
} from "../../../backend/src/lib/encryption";

interface TableConfig {
  tableName: string;
  idCol: string;
  encryptedCols: string[];
  searchHashCols?: { sourceCol: string; hashCol: string }[];
}

const TARGET_TABLES: TableConfig[] = [
  {
    tableName: "students",
    idCol: "id",
    encryptedCols: ["first_name_encrypted", "middle_name_encrypted", "last_name_encrypted"],
    searchHashCols: [
      { sourceCol: "first_name_encrypted", hashCol: "first_name_search_hash" },
      { sourceCol: "last_name_encrypted", hashCol: "last_name_search_hash" },
    ],
  },
  {
    tableName: "student_family_members",
    idCol: "id",
    encryptedCols: ["name_encrypted", "mobile_encrypted", "email_encrypted", "occupation_encrypted"],
  },
  {
    tableName: "persons",
    idCol: "id",
    encryptedCols: [
      "first_name_encrypted",
      "middle_name_encrypted",
      "last_name_encrypted",
      "primary_email_encrypted",
      "primary_mobile_encrypted",
    ],
    searchHashCols: [
      { sourceCol: "first_name_encrypted", hashCol: "first_name_search_hash" },
      { sourceCol: "last_name_encrypted", hashCol: "last_name_search_hash" },
    ],
  },
  {
    tableName: "staff",
    idCol: "id",
    encryptedCols: [
      "first_name_encrypted",
      "last_name_encrypted",
      "date_of_birth_encrypted",
      "gender_encrypted",
      "mobile_encrypted",
      "email_encrypted",
      "address_encrypted",
      "emergency_contact_encrypted",
    ],
  },
  {
    tableName: "drivers",
    idCol: "id",
    encryptedCols: ["name_encrypted", "mobile_encrypted", "licence_encrypted"],
  },
  {
    tableName: "vehicles",
    idCol: "id",
    encryptedCols: [
      "driver_name_encrypted",
      "driver_licence_encrypted",
      "driver_mobile_encrypted",
      "conductor_name_encrypted",
      "conductor_mobile_encrypted",
    ],
  },
];

async function runBackfill() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`\n======================================================`);
  console.log(`🚀 Starting AES-256-GCM + HKDF Search Hash Backfill`);
  console.log(`Mode: ${isDryRun ? "DRY-RUN (No changes will be written)" : "LIVE WRITE"}`);
  console.log(`======================================================\n`);

  let totalScanned = 0;
  let totalUpgraded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const config of TARGET_TABLES) {
    console.log(`\n📦 Processing table "${config.tableName}"...`);
    try {
      const selectCols = [
        `"${config.idCol}"`,
        ...config.encryptedCols.map((c) => `"${c}"`),
        ...(config.searchHashCols?.map((c) => `"${c.hashCol}"`) || []),
      ].join(", ");

      const rowsResult = await db.execute(
        sql.raw(`SELECT ${selectCols} FROM "${config.tableName}"`)
      );
      const rows = rowsResult.rows as Record<string, any>[];
      console.log(`  Found ${rows.length} rows in "${config.tableName}".`);

      for (const row of rows) {
        totalScanned++;
        const id = row[config.idCol];
        const updates: Record<string, string> = {};
        let needsUpgrade = false;

        // Check encrypted columns
        for (const col of config.encryptedCols) {
          const val = row[col];
          if (val && typeof val === "string") {
            if (!val.startsWith("v2:")) {
              const decrypted = decryptData(val);
              if (decrypted !== null) {
                const reEncrypted = encryptData(decrypted);
                updates[col] = reEncrypted;
                needsUpgrade = true;
              } else {
                // If it was mock unencrypted data (e.g. from test drill), encrypt it directly
                const reEncrypted = encryptData(val);
                updates[col] = reEncrypted;
                needsUpgrade = true;
              }
            }
          }
        }

        // Check search hash columns
        if (config.searchHashCols) {
          for (const hashPair of config.searchHashCols) {
            const encVal = row[hashPair.sourceCol];
            if (encVal && typeof encVal === "string") {
              const decrypted = decryptData(encVal) || encVal;
              if (decrypted) {
                const newHash = computeSearchHash(decrypted);
                if (row[hashPair.hashCol] !== newHash) {
                  updates[hashPair.hashCol] = newHash;
                  needsUpgrade = true;
                }
              }
            }
          }
        }

        if (needsUpgrade && Object.keys(updates).length > 0) {
          totalUpgraded++;
          if (!isDryRun) {
            const setClauses = Object.entries(updates)
              .map(([col, val]) => `"${col}" = '${val.replace(/'/g, "''")}'`)
              .join(", ");
            await db.execute(
              sql.raw(`UPDATE "${config.tableName}" SET ${setClauses} WHERE "${config.idCol}" = '${id}'`)
            );
          }
        } else {
          totalSkipped++;
        }
      }
    } catch (err: any) {
      console.error(`  ❌ Error querying table "${config.tableName}":`, err.message);
      totalErrors++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`🏁 Backfill Summary:`);
  console.log(`  Total Rows Scanned:  ${totalScanned}`);
  console.log(`  Total Rows Upgraded: ${totalUpgraded}`);
  console.log(`  Total Rows Skipped:  ${totalSkipped}`);
  console.log(`  Total Errors:        ${totalErrors}`);
  console.log(`  Execution Mode:      ${isDryRun ? "DRY-RUN" : "LIVE WRITE"}`);
  console.log(`======================================================\n`);
}

runBackfill()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Fatal backfill error:", e);
    process.exit(1);
  });
