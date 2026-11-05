const MISSING = "-";

function displayPart(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || MISSING;
}

/** Labeled delivery address lines, ordered house → street → society → city for display. */
export function formatCardDeliveryAddressLabeled(
  city: string | null | undefined,
  society: string | null | undefined,
  streetNo: string | null | undefined,
  houseNo: string | null | undefined
): Array<{ label: string; value: string }> {
  return [
    { label: "house", value: displayPart(houseNo) },
    { label: "street", value: displayPart(streetNo) },
    { label: "society", value: displayPart(society) },
    { label: "city", value: displayPart(city) },
  ];
}

/** Formatted single line: city, society, street number, house number. */
export function formatCardDeliveryAddressLine(
  city: string | null | undefined,
  society: string | null | undefined,
  streetNo: string | null | undefined,
  houseNo: string | null | undefined
): string {
  const parts = [city, society, streetNo, houseNo].map((p) => String(p ?? "").trim()).filter(Boolean);
  return parts.join(", ");
}

/** Canonical cardaddress string composed from structured delivery fields. */
export function composeCardDeliveryAddress(
  city: string,
  society: string,
  streetNo: string,
  houseNo: string
): string {
  return formatCardDeliveryAddressLine(city, society, streetNo, houseNo);
}
