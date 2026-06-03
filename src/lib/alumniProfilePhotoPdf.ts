import "server-only";

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { extname, join } from "path";
import { pickAlumniProfilePhotoFilename } from "@/lib/alumniProfilePhoto";
import { normalizePublicImageFilename } from "@/lib/uploadsImageUrl";
import { getUploadsImagesDir } from "@/lib/uploadsDir";

const PDF_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type PdfEmbedImage = {
  dataUrl: string;
  format: "PNG" | "JPEG";
};

function jsPdfFormatFromPath(filePath: string): "PNG" | "JPEG" | null {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "PNG";
  if (ext === ".jpg" || ext === ".jpeg") return "JPEG";
  return null;
}

function diskPathCandidates(filename: string): string[] {
  const norm = normalizePublicImageFilename(filename);
  if (!norm) return [];
  const dirs = [...new Set([getUploadsImagesDir(), join(process.cwd(), "public", "images")])];
  const paths = new Set<string>();
  for (const dir of dirs) {
    paths.add(join(dir, norm));
    paths.add(join(dir, "alumni-images", "thumbnail", norm));
    paths.add(join(dir, "alumni-images", "card", norm));
  }
  return [...paths];
}

async function readEmbedImage(filePaths: string[]): Promise<PdfEmbedImage | null> {
  for (const filePath of filePaths) {
    if (!existsSync(filePath)) continue;
    const format = jsPdfFormatFromPath(filePath);
    if (!format) continue;
    try {
      const buffer = await readFile(filePath);
      if (buffer.length === 0 || buffer.length > PDF_PHOTO_MAX_BYTES) continue;
      const mime = format === "PNG" ? "image/png" : "image/jpeg";
      return {
        dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
        format,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Placeholder when tbl_alumni has no usable image1/image2 (schema: public.tbl_alumni). */
async function loadPlaceholderPhoto(): Promise<PdfEmbedImage | null> {
  const placeholderPaths = [
    join(process.cwd(), "public", "images", "person.jpg"),
    join(process.cwd(), "public", "images", "placeholder-avatar.webp"),
  ];
  const jpgPaths = placeholderPaths.filter((p) => /\.(jpe?g|png)$/i.test(p));
  return readEmbedImage(jpgPaths.length ? jpgPaths : placeholderPaths);
}

/**
 * Resolves alumni profile photo for PDF export (image2 preferred, then image1 per app convention).
 */
export async function resolveAlumniProfilePhotoForPdf(
  image1?: string | null,
  image2?: string | null
): Promise<PdfEmbedImage> {
  const filename = pickAlumniProfilePhotoFilename(image2, image1);
  if (filename) {
    const loaded = await readEmbedImage(diskPathCandidates(filename));
    if (loaded) return loaded;
  }
  const placeholder = await loadPlaceholderPhoto();
  if (placeholder) return placeholder;
  return { dataUrl: "", format: "JPEG" };
}
