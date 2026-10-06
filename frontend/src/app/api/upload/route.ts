import { requireAuth } from "@/lib/serverAuth";
import { getPresignedUploadUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    // Only allow authenticated users to generate upload URLs
    const session = await requireAuth([
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

    // Determine school namespace prefix: Super Admin without schoolId falls back to 'platform'
    const schoolPrefix = session.schoolId ?? "platform";
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_\-]/g, "");

    // Generate a unique, strictly school-scoped S3 key
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const key = `${schoolPrefix}/${cleanPrefix}/${uniqueSuffix}-${sanitizedName}`;

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
    // Only authenticated users can write uploads
    const session = await requireAuth();

    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return NextResponse.json(
        { success: false, message: "Missing key parameter" },
        { status: 400 }
      );
    }

    // Enforce tenant isolation: user's schoolId must match key prefix (unless SUPER_ADMIN)
    const expectedPrefix = session.schoolId ?? "platform";
    if (session.role !== "SUPER_ADMIN" && !key.startsWith(`${expectedPrefix}/`)) {
      return NextResponse.json(
        { success: false, message: "Cross-school storage access denied" },
        { status: 403 }
      );
    }

    // Extension whitelisting - reject executable and script formats
    const ext = path.extname(key).toLowerCase();
    const ALLOWED_EXTENSIONS = new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".pdf",
      ".csv",
      ".xlsx",
      ".docx",
      ".txt",
    ]);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, message: "File type not permitted" },
        { status: 400 }
      );
    }

    // Size limit check: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Strict path traversal mitigation: guarantee target is within public/uploads
    const uploadBase = path.resolve(process.cwd(), "public", "uploads");
    const sanitizedKey = key
      .split(/[\/\\]/)
      .map((segment) => segment.replace(/[^a-zA-Z0-9.\-_]/g, "_"))
      .filter((segment) => segment !== "." && segment !== "..")
      .join(path.sep);

    const resolvedPath = path.resolve(uploadBase, sanitizedKey);
    if (!resolvedPath.startsWith(uploadBase) || resolvedPath === uploadBase) {
      return NextResponse.json(
        { success: false, message: "Invalid file destination path" },
        { status: 400 }
      );
    }

    await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.promises.writeFile(resolvedPath, buffer);

    return NextResponse.json({ success: true, key });
  } catch (error: any) {
    console.error("Local file upload error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save file" },
      { status: 500 }
    );
  }
}
