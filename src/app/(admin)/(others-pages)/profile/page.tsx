import UserMetaCard from "@/components/user-profile/UserMetaCard";
import { Metadata } from "next";
import React from "react";
import { sql } from "@/lib/dbconnect";

export const metadata: Metadata = {
  title: "Next.js Profile | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Profile page for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
};

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Profile({ searchParams }: ProfilePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sapidParam = resolvedSearchParams?.sapid;
  const sapid = Array.isArray(sapidParam) ? sapidParam[0] : sapidParam;

  let row: any | null = null;
  let error: string | null = null;

  if (!sapid) {
    error = "Missing alumni ID (sapid).";
  } else {
    try {
      const rows = await sql/* sql */`
        SELECT * FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
      row = rows?.[0] ?? null;
      if (!row) error = `No alumni found for ID: ${sapid}`;
    } catch (e: any) {
      error = e?.message ?? "Failed to load alumni profile.";
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">

        {/* Existing profile cards layout retained */}
        {sapid ? (
          <div className="space-y-6">
            <UserMetaCard sapid={sapid} />
           
          </div>
        ) : (
          <div
            role="alert"
            className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
          >
            Missing alumni ID (sapid). Open a profile via the alumni list.
          </div>
        )}

        {/* Error state */}
        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* Schema-driven profile details */}
        
      </div>
    </div>
  );
}
