import { existsSync } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";

export const ALUMNI_CARD_ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;
export const ALUMNI_CARD_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const CARD_UPLOAD_DIR = join(process.cwd(), "public", "images");

function sanitizeIdentifier(input: string | null | undefined): string {
  const cleaned = String(input ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned || "alumni";
}

function normalizeExtension(file: File): string {
  const extFromName = String(file.name || "").split(".").pop()?.toLowerCase();
  if (extFromName === "jpeg") return "jpg";
  if (extFromName === "jpg" || extFromName === "png") return extFromName;
  const mime = String(file.type || "").toLowerCase();
  if (mime.includes("png")) return "png";
  return "jpg";
}

function isSafeImageFilename(filename: string | null | undefined): boolean {
  const value = String(filename ?? "").trim();
  if (!value) return false;
  return /^[a-zA-Z0-9_.-]+$/.test(value);
}

export function validateAlumniCardImage(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALUMNI_CARD_ALLOWED_MIME_TYPES.includes(file.type as (typeof ALUMNI_CARD_ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, error: "Invalid file type. Only JPG and PNG images are allowed." };
  }
  if (file.size > ALUMNI_CARD_MAX_FILE_SIZE) {
    return { ok: false, error: "File size exceeds 2MB limit." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Uploaded file is empty." };
  }
  return { ok: true };
}

export async function saveAlumniCardImage(file: File, identifier: string): Promise<string> {
  if (!existsSync(CARD_UPLOAD_DIR)) {
    await mkdir(CARD_UPLOAD_DIR, { recursive: true });
  }

  const extension = normalizeExtension(file);
  const safeIdentifier = sanitizeIdentifier(identifier);
  const filename = `${safeIdentifier}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(CARD_UPLOAD_DIR, filename), buffer);
  return filename;
}

export async function tryDeleteAlumniCardImage(filename: string | null | undefined): Promise<void> {
  const clean = String(filename ?? "").trim();
  if (!isSafeImageFilename(clean)) return;
  const filePath = join(CARD_UPLOAD_DIR, clean);
  if (!existsSync(filePath)) return;
  try {
    await unlink(filePath);
  } catch {
    // best effort cleanup
  }
}

export function pickCardImageWithFallback(
  cardImage: string | null | undefined,
  cardPicture: string | null | undefined,
  alumniImage2: string | null | undefined,
  alumniImage1: string | null | undefined
): string | null {
  const candidates = [cardImage, cardPicture, alumniImage2, alumniImage1];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value && value.toLowerCase() !== "null" && value.toLowerCase() !== "undefined") {
      return value;
    }
  }
  return null;
}
