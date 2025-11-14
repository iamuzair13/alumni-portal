import UserMetaCard from "@/components/user-profile/UserMetaCard";
import { Metadata } from "next";
import React from "react";
import { auth } from "@/auth";
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
  let sapid = Array.isArray(sapidParam) ? sapidParam[0] : sapidParam;
  if (!sapid) {
    const session = await auth();
    const email = session?.user?.email ? String(session.user.email) : undefined;
    if (email) {
      const rows = await sql/* sql */`
        SELECT sapid FROM public.tbl_alumni WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
      sapid = rows[0]?.sapid as string | undefined;
    }
  }
  const error = !sapid ? "Missing alumni ID (sapid). Open a profile via the alumni list or ensure you are signed in." : null;

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white  dark:border-gray-800 dark:bg-white/[0.03]">

        {/* Existing profile cards layout retained */}
        {sapid ? (
          <div className="">
            <UserMetaCard sapid={sapid} />
           
          </div>
        ) : (
          <div
            role="alert"
            className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
          >
            {error}
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
