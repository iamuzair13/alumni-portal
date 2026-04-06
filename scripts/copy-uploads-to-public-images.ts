/**
 * Copy legacy files from public/uploads into public/images (does not delete sources).
 *
 * Use case: after switching uploads to public/images, old files may still live under
 * public/uploads (e.g. public/uploads/leadership/*). URLs like /images/<filename> expect
 * those files at public/images/<filename>.
 *
 * Idempotent: skips when destination exists with the same size as the source.
 * On basename collision with different content, copies to public/images/legacy_<relative-path-with-_>.
 *
 * Optional: LEGACY_UPLOADS_ROOT=absolute-or-relative-path (default: <project>/public/uploads).
 *
 * Run from repo root:
 *   npx tsx scripts/copy-uploads-to-public-images.ts
 *   npm run migrate-copy-uploads-to-images
 *
 * Database URL updates (run separately in PostgreSQL):
 *   scripts/migrate-upload-urls-to-images.sql
 */

import { mkdir, readdir, stat, copyFile } from "fs/promises";
import { join, relative, sep } from "path";
import { existsSync } from "fs";
import dotenv from "dotenv";

dotenv.config();

function resolveProjectRoot(): string {
  const cwd = process.cwd();
  let current = cwd;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(current, "package.json")) || existsSync(join(current, "next.config.mjs"))) {
      return current;
    }
    const parent = join(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return cwd;
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function sameSize(a: string, b: string): Promise<boolean> {
  try {
    const [sa, sb] = await Promise.all([stat(a), stat(b)]);
    return sa.size === sb.size;
  } catch {
    return false;
  }
}

async function main() {
  const projectRoot = resolveProjectRoot();
  const rawLegacy = process.env.LEGACY_UPLOADS_ROOT?.trim();
  const legacyRoot = rawLegacy
    ? rawLegacy.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rawLegacy)
      ? rawLegacy
      : join(projectRoot, rawLegacy)
    : join(projectRoot, "public", "uploads");
  const imagesDir = join(projectRoot, "public", "images");

  if (!existsSync(legacyRoot)) {
    console.log(`No legacy uploads directory at ${legacyRoot} — nothing to do.`);
    process.exit(0);
  }

  await mkdir(imagesDir, { recursive: true });

  const files = await walkFiles(legacyRoot);
  if (files.length === 0) {
    console.log(`Legacy uploads folder is empty: ${legacyRoot}`);
    process.exit(0);
  }

  let copied = 0;
  let skippedIdentical = 0;
  let renamed = 0;

  for (const srcPath of files) {
    const rel = relative(legacyRoot, srcPath);
    const base = rel.split(sep).pop() || rel;
    let destPath = join(imagesDir, base);
    let usedAltName = false;

    if (existsSync(destPath)) {
      if (await sameSize(srcPath, destPath)) {
        skippedIdentical += 1;
        continue;
      }
      // Same basename, different content — use path-based name so root uploads/foo.jpg ≠ leadership/foo.jpg
      const uniqueFromRel = `legacy_${rel.split(sep).join("_")}`;
      destPath = join(imagesDir, uniqueFromRel);
      usedAltName = true;
      if (existsSync(destPath) && (await sameSize(srcPath, destPath))) {
        skippedIdentical += 1;
        continue;
      }
    }

    await mkdir(join(destPath, ".."), { recursive: true });
    await copyFile(srcPath, destPath);
    copied += 1;
    if (usedAltName) renamed += 1;
    console.log(`Copied: ${rel} -> ${relative(projectRoot, destPath)}`);
  }

  console.log("");
  console.log(`Done. copied=${copied}, skipped_same_size=${skippedIdentical}, alt_name_due_to_collision=${renamed}`);
  console.log(`Source (unchanged): ${legacyRoot}`);
  console.log(`Destination: ${imagesDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
