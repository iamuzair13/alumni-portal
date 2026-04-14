import { existsSync } from "fs";
import { join, resolve, isAbsolute } from "path";

function normalizeEnvPath(raw: string | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  return isAbsolute(v) ? v : resolve(process.cwd(), v);
}

function detectProjectRootFromCwd(): string {
  const cwd = process.cwd();
  let currentPath = cwd;

  // Walk up a few levels to find a stable project root marker.
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(currentPath, "package.json")) || existsSync(join(currentPath, "next.config.mjs"))) {
      return currentPath;
    }
    const parentPath = join(currentPath, "..");
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }
  return cwd;
}

/**
 * Resolve the shared uploads directory used for runtime-written images.
 *
 * Resolution order:
 * 1) `UPLOADS_IMAGES_DIR` (absolute or relative path)
 * 2) `PROJECT_ROOT/public/images` when PROJECT_ROOT is set
 * 3) auto-detected project root from cwd, then `/public/images`
 */
export function getUploadsImagesDir(): string {
  const explicitUploadsDir = normalizeEnvPath(process.env.UPLOADS_IMAGES_DIR);
  if (explicitUploadsDir) return explicitUploadsDir;

  const explicitProjectRoot = normalizeEnvPath(process.env.PROJECT_ROOT);
  if (explicitProjectRoot) return join(explicitProjectRoot, "public", "images");

  const detectedRoot = detectProjectRootFromCwd();
  return join(detectedRoot, "public", "images");
}

