import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { detectProjectRootFromCwd, getUploadsImagesDir } from "@/lib/uploadsDir";
import { normalizePublicImageFilename } from "@/lib/uploadsImageUrl";

/** All directories that may contain runtime-written uploads (writes + legacy layouts). */
export function collectRuntimeUploadDirs(): string[] {
  const dirs = new Set<string>();
  const cwd = process.cwd();
  const detectedRoot = detectProjectRootFromCwd();

  dirs.add(getUploadsImagesDir());
  dirs.add(join(cwd, "public", "images"));
  dirs.add(join(detectedRoot, "public", "images"));
  dirs.add(join(cwd, "..", "public", "images"));
  dirs.add(join(detectedRoot, ".next", "standalone", "public", "images"));

  const projectRoot = normalizeEnvProjectRoot();
  if (projectRoot) dirs.add(join(projectRoot, "public", "images"));

  return [...dirs];
}

function normalizeEnvProjectRoot(): string | null {
  const raw = String(process.env.PROJECT_ROOT ?? "").trim();
  if (!raw) return null;
  return raw.startsWith("/") || /^[A-Za-z]:[\\/]/.test(raw) ? raw : join(process.cwd(), raw);
}

function basenameVariants(filename: string): string[] {
  const variants = new Set<string>();
  const base = String(filename ?? "").trim();
  if (!base) return [];

  variants.add(base);
  try {
    variants.add(decodeURIComponent(base));
  } catch {
    // keep original
  }

  const normalized = normalizePublicImageFilename(base);
  if (normalized) variants.add(normalized);

  return [...variants].filter(Boolean);
}

/**
 * Candidate on-disk paths for a stored upload reference (bare filename, `/images/...`,
 * `/api/uploads/images/...`, or legacy `/uploads/leadership/...`).
 */
export function uploadedFileCandidatePaths(raw: string | null | undefined): string[] {
  const rawStr = String(raw ?? "").trim().replace(/\\/g, "/");
  const normalized = normalizePublicImageFilename(raw);
  const names = new Set<string>();

  if (normalized) basenameVariants(normalized).forEach((n) => names.add(n));

  const rawBase = rawStr.split("/").filter(Boolean).pop() ?? "";
  if (rawBase) basenameVariants(rawBase).forEach((n) => names.add(n));

  const paths = new Set<string>();
  const dirs = collectRuntimeUploadDirs();
  const legacyRoot = join(process.cwd(), "public", "uploads");
  const fromLeadershipPath = rawStr.toLowerCase().includes("uploads/leadership/");

  for (const name of names) {
    if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) continue;

    for (const dir of dirs) {
      paths.add(join(dir, name));
      paths.add(join(dir, "alumni-images", "thumbnail", name));
      paths.add(join(dir, "alumni-images", "card", name));
      // scripts/copy-uploads-to-public-images.ts collision rename
      paths.add(join(dir, `legacy_leadership_${name}`));
      paths.add(join(dir, `legacy_${name}`));
      if (fromLeadershipPath) {
        paths.add(join(dir, `legacy_leadership_leadership_${name}`));
      }
    }

    paths.add(join(legacyRoot, "leadership", name));
    paths.add(join(legacyRoot, name));
  }

  return [...paths];
}

/** First existing file path for a stored upload reference, or null. */
export function findExistingUploadFilePath(raw: string | null | undefined): string | null {
  for (const filePath of uploadedFileCandidatePaths(raw)) {
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

function uploadsFallbackOrigin(): string | null {
  const explicit = String(process.env.UPLOADS_FALLBACK_ORIGIN ?? "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  if (process.env.NODE_ENV !== "development") return null;

  for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_BASE_URL"] as const) {
    const url = String(process.env[key] ?? "").trim();
    if (url && /^https?:\/\//i.test(url)) return url.replace(/\/+$/, "");
  }

  return null;
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const remoteFetchInFlight = new Set<string>();

async function fetchRemoteUploadFile(filename: string): Promise<Buffer | null> {
  const origin = uploadsFallbackOrigin();
  if (!origin) return null;

  // Avoid recursive self-requests when fallback origin is this dev server.
  if (process.env.NODE_ENV === "development" && isLocalDevOrigin(origin)) {
    return null;
  }

  if (remoteFetchInFlight.has(filename)) return null;
  remoteFetchInFlight.add(filename);

  try {
    const url = `${origin}/api/uploads/images/${encodeURIComponent(filename)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  } finally {
    remoteFetchInFlight.delete(filename);
  }
}

/** Read upload bytes from disk, optionally proxying from UPLOADS_FALLBACK_ORIGIN in dev. */
export async function readUploadFileBuffer(
  raw: string | null | undefined
): Promise<{ buffer: Buffer; source: "local" | "remote" } | null> {
  const localPath = findExistingUploadFilePath(raw);
  if (localPath) {
    const buffer = await readFile(localPath);
    return buffer.length > 0 ? { buffer, source: "local" } : null;
  }

  const filename = normalizePublicImageFilename(raw);
  if (!filename) return null;

  const remote = await fetchRemoteUploadFile(filename);
  if (remote) return { buffer: remote, source: "remote" };

  return null;
}
