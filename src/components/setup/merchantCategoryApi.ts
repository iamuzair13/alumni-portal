import type { MerchantCategory } from "@/app/api/merchant-categories/route";

export const MERCHANT_CATEGORIES_QUERY_KEY = ["merchant-categories"] as const;

export async function fetchMerchantCategories(): Promise<MerchantCategory[]> {
  const res = await fetch("/api/merchant-categories", { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Failed to fetch categories");
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function createMerchantCategory(payload: {
  name: string;
  color: string;
}): Promise<MerchantCategory> {
  const res = await fetch("/api/merchant-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to create category");
  return (data as { item: MerchantCategory }).item;
}

export async function updateMerchantCategory(
  id: number,
  payload: { name: string; color: string }
): Promise<MerchantCategory> {
  const res = await fetch("/api/merchant-categories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to update category");
  return (data as { item: MerchantCategory }).item;
}

export async function deleteMerchantCategory(id: number): Promise<void> {
  const res = await fetch(`/api/merchant-categories?id=${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to delete category");
}
