/**
 * User-uploaded files are stored under `public/images` and served as static `/images/*`.
 */
export function uploadsImageUrl(filename: string): string {
  const f = String(filename ?? "").trim();
  if (!f) return "";
  return `/images/${encodeURIComponent(f)}`;
}
