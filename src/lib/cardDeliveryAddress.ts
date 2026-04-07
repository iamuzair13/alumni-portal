/** Formatted single line for admin UI: city, street number, house number. */
export function formatCardDeliveryAddressLine(
  city: string | null | undefined,
  streetNo: string | null | undefined,
  houseNo: string | null | undefined
): string {
  const parts = [city, streetNo, houseNo].map((p) => String(p ?? "").trim()).filter(Boolean);
  return parts.join(", ");
}
