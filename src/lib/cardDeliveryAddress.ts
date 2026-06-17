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
