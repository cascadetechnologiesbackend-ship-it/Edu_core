import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { DATASET_SCHEMAS, ImportDatasetKey } from "@/lib/importExportEngine";

const VALID_FORMATS = new Set(["CSV", "XLSX", "PDF"]);
const VALID_SCOPES = new Set(["all", "filtered", "dateRange"]);

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "HR_MANAGER",
      "ACCOUNTANT",
    ] as const);
    const school = await requireSchool(ctx);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const datasetKey = String(body.datasetKey || "").toUpperCase() as ImportDatasetKey;
    const format = String(body.format || "").toUpperCase();
    const scope = String(body.scope || "all");
    const columns = Array.isArray(body.columns) ? body.columns.map(String) : [];

    if (!DATASET_SCHEMAS[datasetKey]) {
      return NextResponse.json(
        { error: `Invalid export datasetKey: ${datasetKey || "missing"}` },
        { status: 400 }
      );
    }

    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json(
        { error: `Invalid export format: ${format}. Must be CSV, XLSX, or PDF.` },
        { status: 400 }
      );
    }

    if (!VALID_SCOPES.has(scope)) {
      return NextResponse.json(
        { error: `Invalid export scope: ${scope}.` },
        { status: 400 }
      );
    }

    const jobId = randomUUID();
    const createdAt = new Date().toISOString();

    return NextResponse.json(
      {
        jobId,
        schoolId: school.id,
        datasetKey,
        format,
        scope,
        columns,
        status: "QUEUED",
        createdAt,
        downloadUrl: null,
      },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create export job";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
