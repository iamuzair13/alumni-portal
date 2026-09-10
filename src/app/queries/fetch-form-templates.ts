"use client";

import { useQuery } from "@tanstack/react-query";

export type FormTemplate = {
  id: string;
  name: string;
};

async function getFormTemplates(signal?: AbortSignal): Promise<FormTemplate[]> {
  const res = await fetch("/api/form-templates", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch form templates");
  }
  const data = (await res.json()) as { items?: FormTemplate[] };
  return Array.isArray(data.items) ? data.items : [];
}

export function useFormTemplates(enabled = true) {
  return useQuery<FormTemplate[], Error>({
    queryKey: ["form-templates"],
    queryFn: ({ signal }) => getFormTemplates(signal),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
