/**
 * Normalize multipart file fields from Request.formData().
 * Some runtimes expose parts as Blob rather than File; instanceof File alone can miss valid uploads.
 */
export function asImageUploadPart(
  entry: FormDataEntryValue | null
): (Blob & { name?: string }) | null {
  if (entry == null) return null;
  if (typeof entry === "string") return null;
  if (typeof Blob !== "undefined" && entry instanceof Blob) {
    if (entry.size <= 0) return null;
    return entry as Blob & { name?: string };
  }
  return null;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;

export function assertEventImageBlob(blob: Blob, label: string): void {
  const t = blob.type;
  if (!ALLOWED_IMAGE_TYPES.includes(t as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error(`Invalid file type for ${label}. Only JPEG and PNG are allowed.`);
  }
  const maxSize = 5 * 1024 * 1024;
  if (blob.size > maxSize) {
    throw new Error(`${label} exceeds 5MB size limit.`);
  }
}

export function extensionForEventImage(blob: Blob & { name?: string }): string {
  const n = typeof blob.name === "string" && blob.name.trim() !== "" ? blob.name : "";
  const fromName = n.split(".").pop();
  if (fromName && /^[a-zA-Z0-9]+$/u.test(fromName)) return fromName;
  if (blob.type === "image/png") return "png";
  return "jpg";
}
