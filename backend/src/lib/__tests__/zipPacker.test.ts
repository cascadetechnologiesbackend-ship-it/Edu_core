import { describe, it, expect } from "vitest";
import { buildZipArchive, inspectZipEntries } from "../zipPacker";

describe("Zero-Dependency ZIP Packer", () => {
  it("builds a standard ZIP buffer containing multiple entries", () => {
    const files = [
      { name: "report_card_1001.pdf", content: "%PDF-1.4 sample content student 1" },
      { name: "report_card_1002.pdf", content: "%PDF-1.4 sample content student 2" },
      { name: "classes/class_10a_summary.csv", content: "id,name,percentage\n1,Aarav,92\n2,Rohan,88" },
    ];

    const zipBuffer = buildZipArchive(files);
    expect(Buffer.isBuffer(zipBuffer)).toBe(true);
    expect(zipBuffer.length).toBeGreaterThan(100);

    // Verify PKZip header
    expect(zipBuffer.readUInt32LE(0)).toBe(0x04034b50);

    // Inspect entries from central directory
    const entries = inspectZipEntries(zipBuffer);
    expect(entries.length).toBe(3);
    expect(entries.map((e) => e.name)).toEqual([
      "report_card_1001.pdf",
      "report_card_1002.pdf",
      "classes/class_10a_summary.csv",
    ]);
    expect(entries[0]!.uncompressedSize).toBe(files[0]!.content.length);
  });

  it("handles empty files array cleanly", () => {
    const zipBuffer = buildZipArchive([]);
    expect(zipBuffer.length).toBe(22); // EOCD only
    expect(zipBuffer.readUInt32LE(0)).toBe(0x06054b50); // EOCD signature
  });
});
