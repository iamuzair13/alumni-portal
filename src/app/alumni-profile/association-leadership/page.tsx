export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { sql } from "@/lib/dbconnect";
import AlumniAssociationForm from "@/components/forms/AlumniAssociationForm";
import { auth } from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";

type AlumniProfileSearchParams = { sapid?: string };

async function getAlumniId(searchParams: { sapid?: string }) {
  const identifier = searchParams?.sapid ? String(searchParams.sapid).trim() : undefined;
  
  const session = await auth();
  
  // First try to get identifier from session (sapid, then registrationno)
  const sessionSapid = session?.user
    ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined)
    : undefined;
  const sessionRegNo = session?.user
    ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined)
    : undefined;
  const email = session?.user?.email ? String(session.user.email) : undefined;
  
  let sapRows: Array<{ alumniid: number }> = [];
  
  // If we have identifier from search params, treat it as SAP ID OR Registration No
  if (identifier) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE (sapid IS NOT NULL AND TRIM(sapid) = ${identifier})
           OR (registrationno IS NOT NULL AND TRIM(registrationno) = ${identifier})
        LIMIT 1`;
    } catch {
      // Continue to other methods
    }
  }
  
  // If we have SAP ID from session, use it directly
  if (sapRows.length === 0 && sessionSapid) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE sapid IS NOT NULL AND TRIM(sapid) = ${sessionSapid}
        LIMIT 1`;
    } catch {
      // Continue to fallback
    }
  }

  // If we have Registration No from session, use it
  if (sapRows.length === 0 && sessionRegNo) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE registrationno IS NOT NULL AND TRIM(registrationno) = ${sessionRegNo}
        LIMIT 1`;
    } catch {
      // Continue to fallback
    }
  }
  
  // Fallback to email lookup (backward compatibility)
  if (sapRows.length === 0 && email) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
        ORDER BY alumniid DESC LIMIT 1`;
    } catch {
      // Return empty
    }
  }
  
  return String(sapRows[0]?.alumniid ?? "");
}

export default async function AssociationLeadershipPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const sp = await searchParams;
  let alumniId = "";
  let sapError: string | null = null;
  
  try {
    alumniId = await getAlumniId(sp);
  } catch (e) {
    sapError = e instanceof Error ? e.message : "Failed to load alumni ID";
  }
  
  const session = await auth();

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
        <PageBanner title="Association Leadership" />
        <div className="min-w-screen mx-auto flex justify-center  px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white max-w-4xl rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Apply for Association Leadership</h1>
              <BackButton />
            </div>
            <div className="mb-7 max-w-4xl mx-auto">
            
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed dark:text-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:outline-gray-700">
                Take on a leadership role in the Alumni Association to organize events, coordinate activities.
              </p>
            </div>
            <AlumniAssociationForm alumniId={alumniId} />
          </div>
        </div>
      </div>
    </>
  );
}
