import UserMetaCard from "@/components/user-profile/UserMetaCard";
import AdminProfileForm from "@/components/forms/AdminProfileForm";
import ComponentCard from "@/components/common/ComponentCard";
import { Metadata } from "next";
import React from "react";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { isAdminUser, isViewerUser, isSuperAdminUser } from "@/lib/alumniProfile";

export const metadata: Metadata = {
  title: "Next.js Profile | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Profile page for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
};

type ProfilePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Profile({ searchParams }: ProfilePageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sapidParam = resolvedSearchParams?.sapid;
  
  // Check if user is admin/viewer/superadmin
  const isAdmin = isAdminUser(session?.user);
  const isViewer = isViewerUser(session?.user);
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAdminUserType = isAdmin || isViewer || isSuperAdmin;
  
  // If user is admin/viewer/superadmin, show admin profile form
  if (isAdminUserType) {
    return (
      <ComponentCard title="Edit Profile" className="overflow-visible">
        <AdminProfileForm />
      </ComponentCard>
    );
  }
  
  // Otherwise, show alumni profile (existing logic)
  let sapid = Array.isArray(sapidParam) ? sapidParam[0] : sapidParam;
  if (!sapid) {
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
    <ComponentCard title="Profile" className="">
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6">

        {/* Existing profile cards layout retained */}
        {sapid ? (
          <div className="">
            <UserMetaCard sapid={sapid} />
           
          </div>
        ) : (
          <div
            role="alert"
            className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
          >
            {error}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </div>
        )}

        {/* Schema-driven profile details */}
        
      </div>
    </ComponentCard>
  );
}
