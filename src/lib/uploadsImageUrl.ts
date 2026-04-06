/**
 * User-uploaded files are stored under `public/images` and served as static `/images/<filename>`.
 * DB values should be plain filenames; this also accepts legacy paths or `/images/...` prefixes.
 */
export function normalizePublicImageFilename(raw: string | null | undefined): string {
  let s = String(raw ?? "").trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";

  if (/^https?:\/\//i.test(s)) {
    try {
      const pathname = new URL(s).pathname;
      const seg = pathname.split("/").filter(Boolean).pop() ?? "";
      s = decodeURIComponent(seg);
    } catch {
      return s.trim();
    }
  }

  s = s.replace(/\\/g, "/").replace(/^\/+/, "");
  const sl = s.toLowerCase();
  if (sl.startsWith("public/images/")) s = s.slice("public/images/".length);
  else if (sl.startsWith("images/")) s = s.slice("images/".length);
  else if (sl.startsWith("api/uploads/images/")) s = s.slice("api/uploads/images/".length);
  else if (sl.startsWith("uploads/leadership/")) s = s.slice("uploads/leadership/".length);
  const lastSlash = s.lastIndexOf("/");
  if (lastSlash >= 0) s = s.slice(lastSlash + 1);

  return s.trim();
}

/**
 * Public URL for files stored under `public/images`.
 * Uses the API route so uploads work on production (immutable deploys / CDN) where plain `/images/*`
 * static files only include the build-time `public` folder, not runtime writes.
 */
export function uploadsImageUrl(filename: string): string {
  const f = normalizePublicImageFilename(filename);
  if (!f) return "";
  return `/api/uploads/images/${encodeURIComponent(f)}`;
}

