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
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  
  const session = await auth();
  
  // First try to get SAP ID from session (if alumni logged in with SAP ID)
  const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
  const email = session?.user?.email ? String(session.user.email) : undefined;
  
  let sapRows: Array<{ alumniid: number; sapid: string }> = [];
  
  // If we have SAP ID from search params, use it
  if (sapid) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE sapid = ${sapid} LIMIT 1`;
    } catch {
      // Continue to other methods
    }
  }
  
  // If we have SAP ID from session, use it directly
  if (sapRows.length === 0 && sessionSapid) {
    try {
      sapRows = await sql/* sql */`
        SELECT alumniid, sapid FROM public.tbl_alumni 
        WHERE sapid = ${sessionSapid} LIMIT 1`;
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

export default async function AssociationPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
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
        <PageBanner title="Alumni Association" />
        <div className="min-w-screen mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Apply for Alumni Association</h1>
              <BackButton />
            </div>
            <div className="mb-7 max-w-4xl mx-auto">
              <h2 className="text-xl sm:text-2xl font-semibold text-blue-700 mb-2">
                Join the Alumni Association
              </h2>
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                The UOL Alumni Association brings graduates together to connect, engage, and contribute to the university community. You can join and connect with alumni across disciplines, and contribute to the growth of the network.
              </p>
            </div>
            <AlumniAssociationForm alumniId={alumniId} />
          </div>
        </div>
      </div>
    </>
  );
}
