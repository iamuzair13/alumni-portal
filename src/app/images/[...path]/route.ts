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
  return "application/octet-stream";
}

function isSafeFilename(filename: string): boolean {
  if (!filename) return false;
  if (filename.includes("..")) return false;
  if (filename.includes("/")) return false;
  if (filename.includes("\\")) return false;
  return true;
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

/** Same disk folder as /api/uploads/images; serves public /images/<file> for event assets. */
function collectUploadDirs(): string[] {
  const primary = getUploadsImagesDir();
  const cwdFallback = join(process.cwd(), "public", "images");
  return [...new Set([primary, cwdFallback])];
}

export async function GET(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const params = await ctx.params;
    const segments = Array.isArray(params.path) ? params.path : [];
    let filename = segments.map((s) => String(s ?? "")).join("/").trim();

    if (!filename) {
      const url = new URL(request.url);
      const prefix = "/images/";
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

    return new NextResponse(fileBuffer, {
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
