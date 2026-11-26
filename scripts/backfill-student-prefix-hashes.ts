/**
 * Idempotent Backfill Script: Populate `students.name_prefix_hashes`
 *
 * Decrypts student names in bounded batches per tenant (`withTenant`) and
 * generates HMAC search hashes for 3+ char normalized prefixes of first, last,
 * and full name words so partial name search runs purely via GIN index without
 * decrypting rosters at request time.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-student-prefix-hashes.ts
 */

import crypto from "crypto";
import { eq, asc } from "drizzle-orm";
import { withPlatformContext, withTenant } from "../database/src/index";
import { schools, students } from "../database/src/schema/index";

const DEMO_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const KEY_HEX = process.env.ENCRYPTION_KEY || DEMO_ENCRYPTION_KEY;
const KEY_BUF = Buffer.from(KEY_HEX, "hex");
const DERIVED_SEARCH_KEY = crypto.hkdfSync(
  "sha256",
  KEY_BUF,
  Buffer.alloc(0),
  Buffer.from("schoolmitra-search-hash-v1", "utf-8"),
  32
);

function decryptName(encryptedText: string | null): string {
  if (!encryptedText) return "";
  try {
    if (encryptedText.startsWith("v2:")) {
      const parts = encryptedText.split(":");
      const ivHex = parts.length === 5 ? parts[2] : parts[1];
      const tagHex = parts.length === 5 ? parts[3] : parts[2];
      const cipherHex = parts.length === 5 ? parts[4] : parts[3];
      if (!ivHex || !tagHex || !cipherHex) return "";
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        KEY_BUF,
        Buffer.from(ivHex, "hex")
      );
      decipher.setAuthTag(Buffer.from(tagHex, "hex"));
      const dec = Buffer.concat([
        decipher.update(Buffer.from(cipherHex, "hex")),
        decipher.final(),
      ]);
      return dec.toString("utf8");
    }
    const parts = encryptedText.split(":");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return "";
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      KEY_BUF,
      Buffer.from(parts[0], "hex")
    );
    const dec = Buffer.concat([
      decipher.update(Buffer.from(parts[1], "hex")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

function hmacSearch(token: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(DERIVED_SEARCH_KEY))
    .update(token.trim().toLowerCase())
    .digest("hex");
}

export function buildPrefixHashes(firstName: string, lastName: string): string[] {
  const full = `${firstName} ${lastName}`.trim().toLowerCase().replace(/\s+/g, " ");
  if (!full) return [];
  const words = full.split(" ").filter(Boolean);
  const tokens = new Set<string>();

  for (const w of [...words, full]) {
    tokens.add(w);
    for (let len = 3; len <= w.length; len++) {
      tokens.add(w.slice(0, len));
    }
  }

  return Array.from(tokens).map(hmacSearch);
}

async function runBackfill() {
  const allSchools = await withPlatformContext(async (pdb) => {
    return pdb.query.schools.findMany({
      columns: { id: true, name: true },
    });
  });

  let totalUpdated = 0;
  const BATCH_SIZE = 200;

  for (const school of allSchools) {
    let offset = 0;
    while (true) {
      const updatedInBatch = await withTenant(school.id, async (tx) => {
        const rows = await tx.query.students.findMany({
          where: eq(students.schoolId, school.id),
          columns: {
            id: true,
            firstNameEncrypted: true,
            lastNameEncrypted: true,
            namePrefixHashes: true,
          },
          orderBy: [asc(students.id)],
          limit: BATCH_SIZE,
          offset,
        });

        if (rows.length === 0) return -1;

        let count = 0;
        for (const s of rows) {
          const fn = decryptName(s.firstNameEncrypted);
          const ln = decryptName(s.lastNameEncrypted);
          const hashes = buildPrefixHashes(fn, ln);
          if (hashes.length === 0) continue;

          const current = Array.isArray(s.namePrefixHashes) ? s.namePrefixHashes : [];
          if (
            current.length === hashes.length &&
            hashes.every((h) => current.includes(h))
          ) {
            continue;
          }

          await tx
            .update(students)
            .set({ namePrefixHashes: hashes, updatedAt: new Date() })
            .where(eq(students.id, s.id));
          count++;
        }

        return rows.length < BATCH_SIZE ? -2 - count : count;
      });

      if (updatedInBatch === -1) break;
      if (updatedInBatch < -1) {
        totalUpdated += Math.abs(updatedInBatch + 2);
        break;
      }
      totalUpdated += updatedInBatch;
      offset += BATCH_SIZE;
    }
  }

  console.log(
    `[backfill-student-prefix-hashes] Completed across ${allSchools.length} schools; updated ${totalUpdated} student records.`
  );
}

if (require.main === module) {
  runBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[backfill-student-prefix-hashes] Error:", err);
      process.exit(1);
    });
}

