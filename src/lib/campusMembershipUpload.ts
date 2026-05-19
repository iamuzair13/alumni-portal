import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";
import { uploadsImageUrl } from "@/lib/uploadsImageUrl";
import { getUploadsImagesDir } from "@/lib/uploadsDir";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

export type SavedMembershipDocument = {
  label: string;
  url: string;
  filename: string;
  type: string;
  size: number;
};

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
  if (ALLOWED_EXTENSIONS.has(byName)) return byName;
  if (file.type === "application/pdf") return ".pdf";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return "";
}

export async function saveMembershipDocument(opts: {
  file: File;
  prefix: string;
  slot: string;
  label: string;
}): Promise<SavedMembershipDocument> {
  const { file, prefix, slot, label } = opts;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`${label}: unsupported file type. Upload PDF or image (JPG, PNG, WEBP).`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${label}: file size exceeds 5MB limit.`);
  }

  if (file.size === 0) {
    throw new Error(`${label}: file is empty.`);
  }

  const ext = safeExt(file);
  if (!ext) {
    throw new Error(`${label}: unsupported file extension.`);
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 9);
  const safeOriginal = sanitizeFilename(file.name);
  const baseNoExt = safeOriginal.replace(/\.[^.]+$/, "");
  const filename = `${prefix}-${slot}-${timestamp}-${randomSuffix}-${baseNoExt}${ext}`.slice(0, 180);

  const uploadsDir = getUploadsImagesDir();
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadsDir, filename), buffer);

  return {
    label,
    url: uploadsImageUrl(filename),
    filename,
    type: file.type,
    size: file.size,
  };
}
