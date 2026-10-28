import { describe, it, expect } from "vitest";
import {
  DATASET_SCHEMAS,
  ImportDatasetKey,
  generateCsvTemplate,
  parseCsvText,
  validateImportBatch,
  generateRejectedRowsCsv,
  sanitizeExportRecord,
} from "../lib/importExportEngine";

describe("Sprint S20: Universal Import / Export Pipeline & Security Sanitizer", () => {
  const allDatasetKeys: ImportDatasetKey[] = [
    "STUDENTS",
    "STAFF",
    "CLASSES",
    "SUBJECTS",
    "FEE_HEADS",
    "SALARY_TEMPLATES",
    "HOLIDAYS",
  ];

  describe("1. Template Generation", () => {
    it.each(allDatasetKeys)(
      "should generate a valid CSV template for dataset: %s",
      (datasetKey) => {
        const csv = generateCsvTemplate(datasetKey);
        expect(csv).toBeTruthy();

        const schema = DATASET_SCHEMAS[datasetKey];
        const lines = csv.trim().split("\n");
        expect(lines.length).toBe(2); // Header + Sample Row

        for (const col of schema.columns) {
          expect(lines[0]).toContain(col.label);
        }
      }
    );
  });

  describe("2. CSV Parsing", () => {
    it("should correctly parse standard and quoted CSV values", () => {
      const sampleCsv = `
"Admission Number","First Name","Last Name"
"ADM-001","Aarav","Sharma"
"ADM-002","Priya, Ananya","Verma"
"ADM-003","Rohan","""Lucky"" Singh"
      `.trim();

      const { headers, rows } = parseCsvText(sampleCsv);
      expect(headers).toEqual(["Admission Number", "First Name", "Last Name"]);
      expect(rows.length).toBe(3);
      expect(rows[0]?.["First Name"]).toBe("Aarav");
      expect(rows[1]?.["First Name"]).toBe("Priya, Ananya"); // Quoted comma handled
      expect(rows[2]?.["Last Name"]).toBe('"Lucky" Singh'); // Escaped quotes handled
    });
  });

  describe("3. Schema-Driven Dry-Run Batch Validation", () => {
    it("should accept valid student rows and permit commit", () => {
      const validRows = [
        {
          "Admission Number": "ADM-001",
          "First Name": "Aarav",
          "Last Name": "Sharma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-002",
          "First Name": "Diya",
          "Last Name": "Patel",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2013-08-20",
          "Class Name": "Class 9",
          Section: "B",
          "Parent / Guardian Name": "Kiran Patel",
          "Parent Phone": "+919876543211",
        },
      ];

      const result = validateImportBatch("STUDENTS", validRows);
      expect(result.canCommit).toBe(true);
      expect(result.validRowsCount).toBe(2);
      expect(result.invalidRowsCount).toBe(0);
    });

    it("should flag missing required fields, invalid enums, invalid dates, and duplicates", () => {
      const invalidRows = [
        {
          "Admission Number": "", // Missing required
          "First Name": "Aarav",
          "Last Name": "Sharma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-002",
          "First Name": "Diya",
          "Last Name": "Patel",
          Gender: "UNKNOWN_GENDER", // Invalid enum
          "Date of Birth (YYYY-MM-DD)": "invalid-date", // Invalid date
          "Class Name": "Class 9",
          Section: "B",
          "Parent / Guardian Name": "Kiran Patel",
          "Parent Phone": "+919876543211",
        },
        {
          "Admission Number": "ADM-002", // Duplicate key in batch
          "First Name": "Another",
          "Last Name": "Student",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-01-01",
          "Class Name": "Class 9",
          Section: "B",
          "Parent / Guardian Name": "Parent",
          "Parent Phone": "+919876543212",
        },
      ];

      const result = validateImportBatch("STUDENTS", invalidRows);
      expect(result.canCommit).toBe(false);
      expect(result.invalidRowsCount).toBe(3);
      expect(result.rows[0]?.errors[0]).toContain("Missing required field 'Admission Number'");
      expect(result.rows[1]?.errors.join(" ")).toContain("UNKNOWN_GENDER");
      expect(result.rows[1]?.errors.join(" ")).toContain("YYYY-MM-DD");
      expect(result.rows[2]?.errors[0]).toContain("Duplicate key 'ADM-002'");
    });

    it("should generate a rejected-rows CSV containing only failed rows with errors column", () => {
      const mixedRows = [
        {
          "Admission Number": "ADM-001",
          "First Name": "Aarav",
          "Last Name": "Sharma",
          Gender: "MALE",
          "Date of Birth (YYYY-MM-DD)": "2012-05-14",
          "Class Name": "Class 10",
          Section: "A",
          "Parent / Guardian Name": "Rajesh Sharma",
          "Parent Phone": "+919876543210",
        },
        {
          "Admission Number": "ADM-002",
          "First Name": "", // Missing required
          "Last Name": "Patel",
          Gender: "FEMALE",
          "Date of Birth (YYYY-MM-DD)": "2013-08-20",
          "Class Name": "Class 9",
          Section: "B",
          "Parent / Guardian Name": "Kiran Patel",
          "Parent Phone": "+919876543211",
        },
      ];

      const validation = validateImportBatch("STUDENTS", mixedRows);
      const rejectedCsv = generateRejectedRowsCsv(validation);

      expect(rejectedCsv).toContain('"Validation Errors"');
      expect(rejectedCsv).toContain("ADM-002");
      expect(rejectedCsv).not.toContain("ADM-001"); // Valid row must NOT be in rejected CSV
    });
  });

  describe("4. DPDP & Security Compliant Export Sanitizer", () => {
    it("should redact sensitive fields when exporting records", () => {
      const rawStaffRecord = {
        employeeCode: "EMP-101",
        firstName: "Vikram",
        lastName: "Rathore",
        email: "vikram@school.edu",
        phone: "+919876543210",
        department: "Administration",
        designation: "Head Clerk",
        role: "STAFF",
        passwordHash: "$2b$10$supersecretpasswordhash",
        bankAccountNumber: "12345678901234",
        panNumber: "ABCDE1234F",
      };

      const sanitized = sanitizeExportRecord("STAFF", rawStaffRecord);
      expect(sanitized["Employee Code"]).toBe("EMP-101");
      expect(sanitized["Official Email"]).toBe("vikram@school.edu");

      // Verify passwords and bank details are not leaked in plain text
      const sanitizedValues = Object.values(sanitized);
      expect(sanitizedValues).not.toContain("$2b$10$supersecretpasswordhash");
      expect(sanitizedValues).not.toContain("12345678901234");
    });
  });
});
