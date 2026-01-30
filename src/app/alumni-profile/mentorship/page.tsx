export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { redirect } from "next/navigation";

type AlumniProfileSearchParams = { sapid?: string };

async function getSapId(searchParams: { sapid?: string }) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  if (sapid) return sapid;
  
  return "";
}

export default async function MentorshipPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const sp = await searchParams;
  const sap = await getSapId(sp);
  redirect(sap ? `/alumni-profile/talks?sapid=${encodeURIComponent(sap)}` : "/alumni-profile/talks");
}

