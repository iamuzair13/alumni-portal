import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";

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

async function saveFileToUploads(opts: { file: File; prefix: string; slot: string }) {
  const { file, prefix, slot } = opts;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported file type. Only PDF, DOCX, and DOC are allowed.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 5MB limit");
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 9);
  const ext = safeExt(file);
  if (!ext) throw new Error("Unsupported file extension");

  const safeOriginal = sanitizeFilename(file.name);
  const baseNoExt = safeOriginal.replace(/\.[^.]+$/, "");
  const filename = `${prefix}-${slot}-${timestamp}-${randomSuffix}-${baseNoExt}${ext}`.slice(0, 180);

  const uploadsDir = join(process.cwd(), "public", "uploads", "leadership");
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filePath = join(uploadsDir, filename);
  await writeFile(filePath, buffer);

  return {
    filename,
    url: `/uploads/leadership/${filename}`,
    size: file.size,
    type: file.type,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const alumniIdRaw = formData.get("alumniId");
    const typeRaw = formData.get("type");

    const alumniId = alumniIdRaw ? Number(String(alumniIdRaw)) : null;
    const type = typeRaw ? String(typeRaw) : null;

    if (!alumniId || !Number.isFinite(alumniId) || alumniId <= 0) {
      return NextResponse.json({ error: "Invalid alumniId" }, { status: 400 });
    }

    if (type !== "chapter" && type !== "association") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const cv = formData.get("cv") as File | null;
    const file1 = formData.get("file1") as File | null;
    const file2 = formData.get("file2") as File | null;

    if (!cv || cv.size === 0) {
      return NextResponse.json({ error: "CV file is required" }, { status: 400 });
    }

    const prefix = `${type}-${alumniId}`;

    const cvSaved = await saveFileToUploads({ file: cv, prefix, slot: "cv" });
    const file1Saved = file1 && file1.size > 0 ? await saveFileToUploads({ file: file1, prefix, slot: "file1" }) : null;
    const file2Saved = file2 && file2.size > 0 ? await saveFileToUploads({ file: file2, prefix, slot: "file2" }) : null;

    return NextResponse.json(
      {
        success: true,
        cv: cvSaved,
        file1: file1Saved,
        file2: file2Saved,
      },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to upload files";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
