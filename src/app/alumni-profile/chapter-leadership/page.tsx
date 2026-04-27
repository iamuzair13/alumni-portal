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
  
  const sp = await searchParams;
  const identifier = sp?.sapid ? String(sp.sapid).trim() : undefined;

  // Get identifier from session first, then URL param, then from email lookup (legacy)
  const sessionSapid = session?.user
    ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined)
    : undefined;
  const sessionRegNo = session?.user
    ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined)
    : undefined;
  const email = session?.user?.email ? String(session.user.email) : undefined;

  let rows: Array<{ alumniid: number }> = [];
  let sapError: string | null = null;

  try {
    if (sessionSapid) {
      rows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE sapid IS NOT NULL AND TRIM(sapid) = ${sessionSapid}
        LIMIT 1`;
    }

    if (rows.length === 0 && sessionRegNo) {
      rows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE registrationno IS NOT NULL AND TRIM(registrationno) = ${sessionRegNo}
        LIMIT 1`;
    }

    if (rows.length === 0 && identifier) {
      rows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE (sapid IS NOT NULL AND TRIM(sapid) = ${identifier})
           OR (registrationno IS NOT NULL AND TRIM(registrationno) = ${identifier})
        LIMIT 1`;
    }

    if (rows.length === 0 && email) {
      // Fallback to email lookup (backward compatibility)
      rows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    }
  } catch (e) {
    sapError = e instanceof Error ? e.message : "Failed to load alumni ID";
  }

  const alumniId = String(rows[0]?.alumniid ?? "");

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen dark:bg-gray-900 dark:text-gray-100">
        <div className="border bg-white relative z-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
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
          <div className="bg-white max-w-4xl rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Apply for Chapter Leadership</h1>
              <BackButton />
            </div>
            <div className="mb-7 max-w-4xl mx-auto">
              
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
                Interested in taking on a leadership role in your chapter? Apply for a leadership position!
              </p>
            </div>
            <AlumniChapterLeadershipForm alumniId={alumniId} />
          </div>
        </div>
      </div>
    </>
  );
}

