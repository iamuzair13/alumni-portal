import { toAbsoluteEventImageUrl } from "@/lib/uploadsImageUrl";

const EVENT_IMAGE_KEYS = ["image1", "image2", "image3", "image4", "image5"] as const;

/** Ensure event image fields are single https://…/images/<file> URLs for external API clients. */
export function mapEventRecordImageUrlsForExternalApi<T extends Record<string, unknown>>(
  request: Request,
  row: T,
): T {
  const o = { ...row } as Record<string, unknown>;
  for (const k of EVENT_IMAGE_KEYS) {
    if (k in o && o[k] != null && String(o[k]).trim() !== "") {
      o[k] = toAbsoluteEventImageUrl(request, String(o[k]));
    }
  }
  return o as T;
}
