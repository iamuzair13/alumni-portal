import { normalizePublicImageFilename } from "@/lib/uploadsImageUrl";

type CardImageInputs = {
  cardImage?: string | null;
  cardPicture?: string | null;
  alumniImage2?: string | null;
  alumniImage1?: string | null;
};

function clean(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const lowered = value.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return "";
  return value;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Retrieval priority:
 * 1) tblcard.card_image / cardpicture
 * 2) tbl_alumni.image2 / image1
 * 3) legacy stored paths (kept as-is)
 */
export function getCardImageCandidates(input: CardImageInputs): string[] {
  const cardImage = clean(input.cardImage);
  const cardPicture = clean(input.cardPicture);
  const alumniImage2 = clean(input.alumniImage2);
  const alumniImage1 = clean(input.alumniImage1);

  const priority = [cardImage, cardPicture, alumniImage2, alumniImage1];
  const normalized = priority
    .map((value) => {
      if (!value) return "";
      if (value.startsWith("http://") || value.startsWith("https://")) return value;
      const normalizedFilename = normalizePublicImageFilename(value);
      return normalizedFilename || value;
    })
    .filter(Boolean);

  return dedupe(normalized);
}

export function resolvePreferredCardImage(input: CardImageInputs): string | null {
  const candidates = getCardImageCandidates(input);
  return candidates[0] ?? null;
}

export function isCardPictureUpdateAllowed(statusRaw: string | null | undefined): boolean {
  const normalized = String(statusRaw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  return normalized === "underreview" || normalized === "under-review" || normalized === "onhold" || normalized === "on-hold";
}
