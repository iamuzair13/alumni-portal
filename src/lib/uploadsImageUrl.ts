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

  s = s.trim();
  if (!s) return "";

  // Strip accidental duplicate `images/` prefix from legacy DB values.
  let sl2 = s.toLowerCase();
  while (sl2.startsWith("images/")) {
    s = s.slice("images/".length);
    sl2 = s.toLowerCase();
  }

  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Value stored in `tbl_events.image*` columns: `/images/<filename>` (filename only, no subdirs). */
export function eventImageStoredFromBasename(basename: string): string {
  const f = normalizePublicImageFilename(basename);
  if (!f) return "";
  return `/images/${f}`;
}

/** Canonical value for DB columns that reference user uploads: `/images/<filename>`. */
export function storedUploadUrlFromClient(raw: string | null | undefined, maxLen = 500): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const stored = eventImageStoredFromBasename(s);
  const value = stored || s;
  return value.slice(0, maxLen);
}

/**
 * Single-path browser URL: `/images/<filename>`.
 * Always re-normalize via `normalizePublicImageFilename` (fixes `/images/images/...` and legacy paths).
 */
export function eventImageUrlFromStored(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const f = normalizePublicImageFilename(u.pathname);
      return f ? `${u.origin}/images/${f}` : s;
    } catch {
      return s;
    }
  }
  const f = normalizePublicImageFilename(s);
  return f ? `/images/${f}` : "";
}

/**
 * Full URL for external API consumers: `https://host/images/<filename>` (one `/images` segment).
 * Prefers `NEXT_PUBLIC_APP_URL` so links stay correct behind reverse proxies.
 */
export function toAbsoluteEventImageUrl(
  request: Request,
  raw: string | null | undefined,
): string {
  const rel = eventImageUrlFromStored(raw);
  if (!rel) return "";
  if (/^https?:\/\//i.test(rel)) return rel;
  const env =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
      ? String(process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "")
      : "";
  const origin =
    env ||
    (() => {
      const forwardedProto = request.headers.get("x-forwarded-proto");
      const forwardedHost = request.headers.get("x-forwarded-host");
      if (forwardedHost) {
        const proto = (forwardedProto || "https").split(",")[0].trim() || "https";
        const host = forwardedHost.split(",")[0].trim();
        if (host) return `${proto}://${host}`;
      }

      const host = request.headers.get("host");
      if (host) {
        const proto = request.headers.get("x-forwarded-proto") || "https";
        return `${proto.split(",")[0].trim() || "https"}://${host}`;
      }

      try {
        return new URL(request.url).origin;
      } catch {
        return "";
      }
    })();
  if (!origin) return rel;
  return `${origin}${rel.startsWith("/") ? rel : `/${rel}`}`;
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

/** Public URL for a stored value (e.g. `/images/<file>` from the DB). Returns null if empty. */
export function publicUploadsUrlFromStored(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const url = uploadsImageUrl(s);
  return url || null;
}

/**
 * Use for links to user-uploaded files: plain `/images/*` often 404s on production (immutable deploys),
 * while `/api/uploads/images/*` reads from disk at runtime. Leaves absolute http(s) URLs unchanged.
 */
export function resolveStoredUploadUrl(stored: string | null | undefined): string {
  const s = String(stored ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return publicUploadsUrlFromStored(s) ?? s;
}

function withUploadQuery(url: string, key: "inline" | "download", value = "1"): string {
  const s = String(url ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      u.searchParams.set(key, value);
      return u.toString();
    } catch {
      return s;
    }
  }
  const sep = s.includes("?") ? "&" : "?";
  return `${s}${sep}${key}=${value}`;
}

/** Open in browser (inline preview) instead of forcing download. */
export function viewStoredUploadUrl(stored: string | null | undefined): string {
  const base = resolveStoredUploadUrl(stored);
  if (!base) return "";
  return withUploadQuery(base, "inline");
}

/** Force file download via Content-Disposition: attachment. */
export function downloadStoredUploadUrl(stored: string | null | undefined): string {
  const base = resolveStoredUploadUrl(stored);
  if (!base) return "";
  return withUploadQuery(base, "download");
}

