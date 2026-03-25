import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";

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

function resolveUploadsDir(): string {
  const cwd = process.cwd();

  let projectRoot = cwd;
  let currentPath = cwd;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(currentPath, "package.json")) || existsSync(join(currentPath, "next.config.mjs"))) {
      projectRoot = currentPath;
      break;
    }
    const parentPath = join(currentPath, "..");
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }

  const customUploadPath = process.env.UPLOAD_DIR || process.env.IMAGES_UPLOAD_DIR;
  if (customUploadPath) {
    return customUploadPath.startsWith("/") ? customUploadPath : join(projectRoot, customUploadPath);
  }

  return join(projectRoot, "public", "images");
}

export async function GET(_: Request, ctx: { params: Promise<{ filename: string }> }) {
  try {
    const { filename: rawFilename } = await ctx.params;
    const filename = decodeURIComponent(String(rawFilename || "").trim());

    if (!isSafeFilename(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const uploadsDir = resolveUploadsDir();
    const filePath = join(uploadsDir, filename);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const file = await readFile(filePath);

    return new NextResponse(file, {
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
