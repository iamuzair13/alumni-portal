"use client"

import type { AlumniListItem } from "@/app/queries/fetch-alumni";

export function normalizeVerifyToBool(input: unknown): boolean {
  const s = String(input ?? "false").toLowerCase();
  return s === "true" || s === "yes";
}

export function normalizeEmployment(input: unknown): "Employed" | "Unemployed" {
  const s = String(input ?? "Unemployed").toLowerCase();
  return s === "employed" ? "Employed" : "Unemployed";
}

export function applyVerifyToCache(
  list: AlumniListItem[] | undefined,
  sapid: string,
  verify: boolean
): AlumniListItem[] | undefined {
  if (!list) return list;
  return list.map((it) => (it.sapid === sapid ? { ...it, verify: verify ? "true" : "false" } : it));
}

export function removeFromCacheList(
  list: AlumniListItem[] | undefined,
  sapid: string
): AlumniListItem[] | undefined {
  if (!list) return list;
  return list.filter((it) => it.sapid !== sapid);
}