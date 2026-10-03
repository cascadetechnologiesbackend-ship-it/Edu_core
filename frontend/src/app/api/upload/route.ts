import { requireAuth } from "@/lib/serverAuth";
import { getPresignedUploadUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    // Only allow authenticated users to generate upload URLs
    await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "HR_MANAGER",
      "TEACHER",
      "PARENT",
      "STUDENT",
      "LIBRARIAN",
      "TRANSPORT_MANAGER",
      "ACCOUNTANT",
    ]);

    const { filename, contentType, prefix = "uploads" } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { success: false, message: "Missing filename or contentType" },
        { status: 400 }
      );
    }

    // Generate a unique S3 key
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const key = `${prefix}/${uniqueSuffix}-${sanitizedName}`;

    const url = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({ success: true, url, key });
  } catch (error: any) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to generate upload URL",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return NextResponse.json(
        { success: false, message: "Missing key parameter" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    const safeKey = key.replace(/\.\./g, ""); // prevent path traversal
    const targetDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      path.dirname(safeKey)
    );
    await fs.promises.mkdir(targetDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(process.cwd(), "public", "uploads", safeKey),
      buffer
    );

    return NextResponse.json({ success: true, key: safeKey });
  } catch (error: any) {
    console.error("Local file upload error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save file" },
      { status: 500 }
    );
  }
}
