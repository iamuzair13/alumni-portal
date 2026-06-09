import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { extname, join } from "path";
import { getUploadsImagesDir } from "@/lib/uploadsDir";

function contentTypeFromFilename(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".doc") return "application/msword";
  return "application/octet-stream";
}

function isSafeFilename(filename: string): boolean {
  if (!filename) return false;
  if (filename.includes("..")) return false;
  if (filename.includes("/")) return false;
  if (filename.includes("\\")) return false;
  return true;
}

/** Same logical folder as writes; include legacy cwd-based path for older deployments. */
function collectUploadDirs(): string[] {
  const primary = getUploadsImagesDir();
  const cwdFallback = join(process.cwd(), "public", "images");
  return [...new Set([primary, cwdFallback])];
}

function decodeFilenameOnce(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const params = await ctx.params;
    const segments = Array.isArray(params.path) ? params.path : [];

    // Join catch-all segments (usually a single segment, e.g. "file.name.with.dots.pdf")
    let filename = segments.map((s) => String(s ?? "")).join("/").trim();

    // Fallback: derive from request URL if the matcher behaved oddly (e.g. dots in name)
    if (!filename) {
      const url = new URL(request.url);
      const prefix = "/api/uploads/images/";
      if (url.pathname.startsWith(prefix)) {
        filename = url.pathname.slice(prefix.length).replace(/\/+$/u, "");
      }
    }

    filename = decodeFilenameOnce(filename);

    if (!filename || !isSafeFilename(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    let fileBuffer: Buffer | null = null;
    for (const dir of collectUploadDirs()) {
      const filePath = join(dir, filename);
      if (existsSync(filePath)) {
        fileBuffer = await readFile(filePath);
        break;
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFromFilename(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
