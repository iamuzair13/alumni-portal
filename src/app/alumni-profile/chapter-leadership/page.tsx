export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { sql } from "@/lib/dbconnect";
import AlumniChapterLeadershipForm from "@/components/forms/AlumniChapterLeadershipForm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";

type AlumniProfileSearchParams = { sapid?: string };

export default async function ChapterLeadershipPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const session = await auth();
  
  // Redirect to signin if no session
  if (!session?.user) {
    redirect("/signin");
  }
  
  await searchParams; // Await to handle the promise, but we don't use it in this component
  
  // Get SAP ID from session first, then from search params, then from email lookup
  const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
  const email = session?.user?.email ? String(session.user.email) : undefined;
  
  let sapRows: Array<{ alumniid: number; sapid: string }> = [];
  let sapError: string | null = null;
  
  // If we have SAP ID from session, use it directly
  if (sessionSapid) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE sapid = ${sessionSapid} LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID from session";
    }
  } else if (email) {
    // Fallback to email lookup (backward compatibility)
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    } catch (e) {
      sapError = e instanceof Error ? e.message : "Failed to load SAP ID";
    }
  }
  
  const alumniId = String(sapRows[0]?.alumniid ?? "");

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen">
        <div className="border bg-white relative z-50">
          <AppHeader />
        </div>
        {(() => {
          const b = computeLoginBanner(session?.user);
          return b.show ? (
            <div className="mt-4">
              <Alert variant="error" title="Access Restricted" message={b.message} />
            </div>
          ) : null;
        })()}
        {sapError && (
          <div className="mt-2">
            <Alert variant="error" title="Account Lookup Failed" message={sapError} />
          </div>
        )}
        <PageBanner title="Chapter Leadership" />
        <div className="min-w-screen mx-auto flex justify-center px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white max-w-4xl rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Apply for Chapter Leadership</h1>
              <BackButton />
            </div>
            <div className="mb-7 max-w-4xl mx-auto">
              <h2 className="text-xl sm:text-2xl font-semibold text-blue-700 mb-2">
                Chapter Leadership Positions
              </h2>
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Interested in taking on a leadership role in your chapter? Apply for a leadership position to help organize events, coordinate activities, and represent your chapter. This is optional and separate from your chapter membership.
              </p>
            </div>
            <AlumniChapterLeadershipForm alumniId={alumniId} />
          </div>
        </div>
      </div>
    </>
  );
}

