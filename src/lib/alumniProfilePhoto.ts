/**
 * Profile photo filenames from tbl_alumni (image2 = most recent per app convention).
 */
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
  if (i2) return i2;
  if (i1) return i1;
  return null;
}
