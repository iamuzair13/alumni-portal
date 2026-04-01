/**
 * Runtime uploads are stored on disk (public/images or UPLOAD_DIR). Many production
 * hosts do not expose those files as static /images/*; serve them via the API instead.
 */
export function uploadsImageUrl(filename: string): string {
  const f = String(filename ?? "").trim();
  if (!f) return "";
  return `/api/uploads/images/${encodeURIComponent(f)}`;
}
