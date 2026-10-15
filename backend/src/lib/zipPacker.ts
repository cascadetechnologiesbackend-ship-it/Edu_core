import { crc32, deflateRawSync } from "zlib";

export interface ZipFileEntry {
  name: string;
  content: Buffer | Uint8Array | string;
}

/**
 * High-performance, zero-dependency ZIP archive builder.
 * Produces standard PKZip (2.0) archive buffers compliant with RFC 1951 / APPNOTE.TXT.
 * Designed for asynchronous batch assembly of report cards and bulk examination exports.
 */
export function buildZipArchive(files: ZipFileEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const rawContent =
      typeof file.content === "string"
        ? Buffer.from(file.content, "utf8")
        : Buffer.isBuffer(file.content)
          ? file.content
          : Buffer.from(file.content);

    const filenameBytes = Buffer.from(file.name.replace(/\\/g, "/"), "utf8");
    const compressedBytes = deflateRawSync(rawContent);
    const checksum = crc32(rawContent);

    // Standard DOS date/time (fixed epoch 2026-01-01 00:00:00 for reproducible builds)
    // Time: 00:00:00 -> 0x0000; Date: (2026 - 1980) << 9 | 1 << 5 | 1 -> 0x5C21
    const dosTime = 0x0000;
    const dosDate = 0x5c21;

    // ── 1. Local File Header (30 bytes + name + compressed content) ───────────
    const localHdr = Buffer.alloc(30);
    localHdr.writeUInt32LE(0x04034b50, 0); // Signature
    localHdr.writeUInt16LE(20, 4); // Min version (2.0)
    localHdr.writeUInt16LE(0, 6); // General purpose flags
    localHdr.writeUInt16LE(8, 8); // Compression: 8 = Deflate
    localHdr.writeUInt16LE(dosTime, 10);
    localHdr.writeUInt16LE(dosDate, 12);
    localHdr.writeUInt32LE(checksum, 14);
    localHdr.writeUInt32LE(compressedBytes.length, 18);
    localHdr.writeUInt32LE(rawContent.length, 22);
    localHdr.writeUInt16LE(filenameBytes.length, 26);
    localHdr.writeUInt16LE(0, 28); // Extra field length

    localHeaders.push(localHdr, filenameBytes, compressedBytes);

    // ── 2. Central Directory Header (46 bytes + name) ─────────────────────────
    const centralHdr = Buffer.alloc(46);
    centralHdr.writeUInt32LE(0x02014b50, 0); // Signature
    centralHdr.writeUInt16LE(20, 4); // Version made by
    centralHdr.writeUInt16LE(20, 6); // Min version needed
    centralHdr.writeUInt16LE(0, 8); // Flags
    centralHdr.writeUInt16LE(8, 10); // Compression method
    centralHdr.writeUInt16LE(dosTime, 12);
    centralHdr.writeUInt16LE(dosDate, 14);
    centralHdr.writeUInt32LE(checksum, 16);
    centralHdr.writeUInt32LE(compressedBytes.length, 20);
    centralHdr.writeUInt32LE(rawContent.length, 24);
    centralHdr.writeUInt16LE(filenameBytes.length, 28);
    centralHdr.writeUInt16LE(0, 30); // Extra field length
    centralHdr.writeUInt16LE(0, 32); // File comment length
    centralHdr.writeUInt16LE(0, 34); // Disk number start
    centralHdr.writeUInt16LE(0, 36); // Internal file attributes
    centralHdr.writeUInt32LE(0, 38); // External file attributes
    centralHdr.writeUInt32LE(currentOffset, 42); // Relative offset of local header

    centralHeaders.push(centralHdr, filenameBytes);

    currentOffset += localHdr.length + filenameBytes.length + compressedBytes.length;
  }

  const centralDirOffset = currentOffset;
  const centralDirSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);

  // ── 3. End of Central Directory Record (EOCD, 22 bytes) ─────────────────────
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Start disk
  eocd.writeUInt16LE(files.length, 8); // Total entries on disk
  eocd.writeUInt16LE(files.length, 10); // Total entries in central directory
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Validates and extracts file entries from a central directory for verification testing.
 */
export function inspectZipEntries(zipBuffer: Buffer): { name: string; uncompressedSize: number }[] {
  const entries: { name: string; uncompressedSize: number }[] = [];
  let pos = 0;

  while (pos < zipBuffer.length - 4) {
    const sig = zipBuffer.readUInt32LE(pos);
    if (sig === 0x02014b50) {
      // Central Directory Header
      const uncompressedSize = zipBuffer.readUInt32LE(pos + 24);
      const nameLen = zipBuffer.readUInt16LE(pos + 28);
      const extraLen = zipBuffer.readUInt16LE(pos + 30);
      const commentLen = zipBuffer.readUInt16LE(pos + 32);
      const name = zipBuffer.toString("utf8", pos + 46, pos + 46 + nameLen);
      entries.push({ name, uncompressedSize });
      pos += 46 + nameLen + extraLen + commentLen;
    } else {
      pos++;
    }
  }

  return entries;
}
