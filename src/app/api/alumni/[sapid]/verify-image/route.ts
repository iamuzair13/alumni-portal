import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";

/**
 * GET /api/alumni/[sapid]/verify-image?filename=xxx
 * 
 * Test endpoint to verify if an uploaded image file exists and is accessible
 * This helps diagnose path issues on Plesk
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ sapid: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sapid } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json({ error: "Filename parameter required" }, { status: 400 });
    }

    const cwd = process.cwd();
    
    // Try to find project root
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
    let uploadsDir: string;
    
    if (customUploadPath) {
      uploadsDir = customUploadPath.startsWith("/") 
        ? customUploadPath 
        : join(projectRoot, customUploadPath);
    } else {
      uploadsDir = join(projectRoot, "public", "images");
    }

    const filePath = join(uploadsDir, filename);
    
    const fileExists = existsSync(filePath);
    
    if (!fileExists) {
      return NextResponse.json({
        exists: false,
        path: filePath,
        cwd,
        projectRoot,
        uploadsDir,
        error: "File not found at expected path"
      }, { status: 404 });
    }

    const stats = await stat(filePath);
    const fileContent = await readFile(filePath);
    
    return NextResponse.json({
      exists: true,
      path: filePath,
      cwd,
      projectRoot,
      uploadsDir,
      size: stats.size,
      isFile: stats.isFile(),
      permissions: stats.mode.toString(8),
      readable: true,
      firstBytes: Array.from(fileContent.slice(0, 10)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
      expectedUrl: `/images/${filename}`
    }, { status: 200 });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

