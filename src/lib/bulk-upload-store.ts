import "server-only";

/**
 * In-memory store for parsed bulk upload data.
 * Keyed by a per-session upload ID so the client doesn't need to re-upload
 * the file for validation and import steps.
 *
 * Entries auto-expire after 30 minutes to prevent memory leaks.
 */

type StoredUpload = {
  uploadId: string;
  userId: number | string;
  rows: Array<Record<string, unknown>>;
  fileName: string;
  headers: string[];
  createdAt: number;
};

const store = new Map<string, StoredUpload>();
const TTL_MS = 30 * 60 * 1000; // 30 minutes

// Cleanup expired entries periodically
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(key);
    }
  }
}

export function storeUpload(
  uploadId: string,
  userId: number | string,
  rows: Array<Record<string, unknown>>,
  fileName: string,
  headers: string[]
): void {
  cleanup();
  store.set(uploadId, {
    uploadId,
    userId,
    rows,
    fileName,
    headers,
    createdAt: Date.now(),
  });
}

export function getUpload(
  uploadId: string,
  userId: number | string
): StoredUpload | null {
  cleanup();
  const entry = store.get(uploadId);
  if (!entry) return null;
  if (String(entry.userId) !== String(userId)) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(uploadId);
    return null;
  }
  return entry;
}

export function deleteUpload(uploadId: string): void {
  store.delete(uploadId);
}

export function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
