export type CardStatus = "active" | "rejected" | "pending" | "full" | "none";

export function statusToVariant(s: CardStatus): "active" | "rejected" | "pending" | "full" | "none" {
  return s;
}