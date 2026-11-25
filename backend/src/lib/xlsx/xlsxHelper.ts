import ExcelJS from "exceljs";

export type XLSXColumnType = "string" | "number" | "currency" | "date";

export interface XLSXColumnDef<T> {
  key: keyof T & string;
  header: string;
  type?: XLSXColumnType;
  minWidth?: number;
}

/**
 * Prevents spreadsheet formula injection by prefixing values starting with
 * '=', '+', '-', '@', '\t', or '\r' with a single quote (').
 */
export function sanitizeForSpreadsheet(value: string): string {
  if (!value) return value;
  const firstChar = value.charAt(0);
  if (
    firstChar === "=" ||
    firstChar === "+" ||
    firstChar === "-" ||
    firstChar === "@" ||
    firstChar === "\t" ||
    firstChar === "\r"
  ) {
    return `'${value}`;
  }
  return value;
}

/**
 * Builds a styled XLSX Buffer with frozen header row, autofilter,
 * content-aware column widths, #003E80 header fill, and formula-injection sanitization.
 */
export async function buildStyledXLSX<T extends object>(
  sheetName: string,
  columns: XLSXColumnDef<T>[],
  rows: T[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SchoolMitra ERP";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: Math.max(col.header.length + 4, col.minWidth ?? 12),
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF003E80" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  headerRow.height = 24;

  // Track max width per column
  const maxWidths = columns.map((col) =>
    Math.max(col.header.length + 4, col.minWidth ?? 12)
  );

  for (const row of rows) {
    const rowData: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      const raw = row[col.key];
      let val: unknown = raw;
      if (typeof raw === "string") {
        val = sanitizeForSpreadsheet(raw);
      }
      rowData[col.key] = val;

      const strLen = val === null || val === undefined ? 0 : String(val).length;
      if (strLen + 4 > maxWidths[idx]!) {
        maxWidths[idx] = Math.min(strLen + 4, 50);
      }
    });

    const addedRow = sheet.addRow(rowData);
    columns.forEach((col, idx) => {
      const cell = addedRow.getCell(idx + 1);
      if (col.type === "currency") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      } else if (col.type === "date") {
        cell.numFmt = "dd-mm-yyyy";
        cell.alignment = { horizontal: "right" };
      } else if (col.type === "number") {
        cell.alignment = { horizontal: "right" };
      }
    });
  }

  // Apply content-aware column widths
  columns.forEach((_, idx) => {
    const column = sheet.getColumn(idx + 1);
    column.width = maxWidths[idx]!;
  });

  // Enable autofilter on header row
  if (columns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
