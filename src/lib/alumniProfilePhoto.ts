/**
 * Profile photo filenames from tbl_alumni (image2 = most recent per app convention).
 */
const IMAGE_FILENAME_PATTERN = /\.(jpe?g|png|gif|webp)$/i;

export function isLikelyProfileImageFilename(filename: string | null | undefined): boolean {
  const s = String(filename ?? "").trim();
  if (!s) return false;
  return IMAGE_FILENAME_PATTERN.test(s);
}

export function pickAlumniProfilePhotoFilename(
  image2?: string | null,
  image1?: string | null
): string | null {
  const clean = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
    return s;
  };
  const i2 = clean(image2);
  const i1 = clean(image1);
  if (i2 && isLikelyProfileImageFilename(i2)) return i2;
  if (i1 && isLikelyProfileImageFilename(i1)) return i1;
  return null;
}
