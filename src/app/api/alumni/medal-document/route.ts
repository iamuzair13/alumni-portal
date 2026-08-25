import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminActivityLog";
import { getUploadsImagesDir } from "@/lib/uploadsDir";
import { uploadsImageUrl } from "@/lib/uploadsImageUrl";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
]);

function sanitizeFilename(name: string): string {
  const base = String(name || "file")
    .replace(/\\/g, "_")
    .replace(/\//g, "_")
    .replace(/\.+/g, ".")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  return base.length > 120 ? base.slice(-120) : base;
}

function safeExt(file: File): string {
  const byName = extname(file.name || "").toLowerCase();
  if (byName === ".pdf" || byName === ".docx" || byName === ".doc") return byName;

  if (file.type === "application/pdf") return ".pdf";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  if (file.type === "application/msword") return ".doc";
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const alumniIdRaw = formData.get("alumniId");
    const alumniId = alumniIdRaw ? Number(String(alumniIdRaw)) : null;

    if (!alumniId || !Number.isFinite(alumniId) || alumniId <= 0) {
      return NextResponse.json({ error: "Invalid alumniId" }, { status: 400 });
    }

    const file = formData.get("medalDocument") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Medal document file is required" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only PDF, DOCX, and DOC are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
    }

    const ext = safeExt(file);
    if (!ext) {
      return NextResponse.json({ error: "Unsupported file extension" }, { status: 400 });
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 9);
    const safeOriginal = sanitizeFilename(file.name);
    const baseNoExt = safeOriginal.replace(/\.[^.]+$/, "");
    const filename = `medal-${alumniId}-${timestamp}-${randomSuffix}-${baseNoExt}${ext}`.slice(0, 180);

    const uploadsDir = getUploadsImagesDir();
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Failed to save uploaded file to disk" }, { status: 500 });
    }

    const fileUrl = uploadsImageUrl(filename);

    // Update tbl_alumni with the medal document URL
    await sql/* sql */`
      UPDATE public.tbl_alumni
      SET medal_document = ${fileUrl}
      WHERE alumniid = ${alumniId}
    `;

    await logAdminAction({
      session,
      req,
      input: {
        action: "alumni.upload_medal_document",
        entityType: "tbl_alumni",
        entityId: String(alumniId),
        success: true,
        metadata: {
          sapid: String(alumniId),
          filename,
        },
      },
    });
    return NextResponse.json(
      { success: true, url: fileUrl, filename, size: file.size, type: file.type },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to upload medal document";
    await logAdminAction({
      session: await auth(),
      req,
      input: {
        action: "alumni.upload_medal_document",
        entityType: "tbl_alumni",
        success: false,
        errorMessage: msg,
      },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
