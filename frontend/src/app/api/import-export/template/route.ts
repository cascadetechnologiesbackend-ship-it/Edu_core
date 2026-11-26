import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  DATASET_SCHEMAS,
  IMPORT_EXPORT_AUTH_ROLES,
  canRoleExportDataset,
  canRoleImportDataset,
  generateCsvTemplate,
  type ImportDatasetKey,
} from "@/lib/importExportEngine";

function mapAuthErrorStatus(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("unauthorized")) return 401;
  if (lower.includes("forbidden")) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth(IMPORT_EXPORT_AUTH_ROLES);
    await requireSchool(ctx);

    const { searchParams } = new URL(request.url);
    const datasetParam = (searchParams.get("dataset") || "").toUpperCase() as ImportDatasetKey;
    const formatParam = (searchParams.get("format") || "xlsx").toLowerCase();
    const schema = DATASET_SCHEMAS[datasetParam];

    if (!schema) {
      return NextResponse.json(
        { error: `Unknown or unsupported dataset: ${datasetParam || "missing"}` },
        { status: 400 }
      );
    }

    if (!canRoleImportDataset(ctx.role, datasetParam) && !canRoleExportDataset(ctx.role, datasetParam)) {
      return NextResponse.json(
        { error: `Forbidden: Role ${ctx.role} cannot access template for ${datasetParam}.` },
        { status: 403 }
      );
    }

    if (formatParam === "csv") {
      const csv = generateCsvTemplate(datasetParam);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${datasetParam.toLowerCase()}-import-template.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SchoolMitra ERP";
    workbook.created = new Date();

    // Sheet 1: Import Data
    const dataSheet = workbook.addWorksheet("Import Data");
    dataSheet.columns = schema.columns.map((col) => ({
      header: col.label,
      key: col.key,
      width: Math.max(col.label.length + 6, 20),
    }));

    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true };

    const sampleRow: Record<string, string> = {};
    for (const col of schema.columns) {
      sampleRow[col.key] = col.sampleValue;
    }
    dataSheet.addRow(sampleRow);

    // Sheet 2: Instructions
    const instructionsSheet = workbook.addWorksheet("Instructions");
    instructionsSheet.columns = [
      { header: "Field", key: "field", width: 28 },
      { header: "Required", key: "required", width: 12 },
      { header: "Type", key: "type", width: 14 },
      { header: "Notes / Allowed Values", key: "notes", width: 48 },
    ];
    instructionsSheet.getRow(1).font = { bold: true };
    for (const col of schema.columns) {
      instructionsSheet.addRow({
        field: col.label,
        required: col.required ? "YES" : "NO",
        type: col.type.toUpperCase(),
        notes: col.allowedEnums?.length
          ? `Allowed: ${col.allowedEnums.join(", ")}`
          : `Sample: ${col.sampleValue || "N/A"}`,
      });
    }

    // Sheet 3: Reference Values
    const refSheet = workbook.addWorksheet("Reference Values");
    refSheet.columns = [
      { header: "Column", key: "column", width: 28 },
      { header: "Allowed Values", key: "values", width: 60 },
    ];
    refSheet.getRow(1).font = { bold: true };
    const enumCols = schema.columns.filter((c) => c.allowedEnums && c.allowedEnums.length > 0);
    if (enumCols.length === 0) {
      refSheet.addRow({ column: "General", values: "No restricted enum values for this dataset." });
    } else {
      for (const col of enumCols) {
        refSheet.addRow({
          column: col.label,
          values: col.allowedEnums!.join(", "),
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${datasetParam.toLowerCase()}-import-template.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate template";
    return NextResponse.json({ error: message }, { status: mapAuthErrorStatus(message) });
  }
}
