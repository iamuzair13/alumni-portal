export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { sql } from "@/lib/dbconnect";
import AlumniCardForm from "@/components/forms/alumni-card";
import { auth } from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";
import BackButton from "@/components/ui/BackButton";

type Profile = {
  alumniname: string | null;
  facultyname: string | null;
  departmentname: string | null;
  degreetitle: string | null;
};

async function getProfile(searchParams: { sapid?: string }) {
  const sapid = searchParams?.sapid ? String(searchParams.sapid) : undefined;
  try {
    if (sapid) {
      const rows = await sql/* sql */`
        SELECT alumniname, facultyname, departmentname, degreetitle
        FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
      return rows[0] as Profile | undefined;
    }
    const session = await auth();
    
    // First try to get SAP ID from session (if alumni logged in with SAP ID)
    const sessionSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
    if (sessionSapid) {
      const rows = await sql/* sql */`
        SELECT alumniname, facultyname, departmentname, degreetitle
        FROM public.tbl_alumni WHERE sapid = ${sessionSapid} LIMIT 1`;
      if (rows[0]) return rows[0] as Profile | undefined;
    }
    
    // Fallback to email lookup (backward compatibility)
    const email = session?.user?.email ? String(session.user.email) : undefined;
    if (!email) return undefined;
    const rows = await sql/* sql */`
      SELECT alumniname, facultyname, departmentname, degreetitle
      FROM public.tbl_alumni 
      WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    return rows[0] as Profile | undefined;
  } catch {
    return undefined;
  }
}

type AlumniProfileSearchParams = { sapid?: string };

export default async function CardPage({ searchParams }: { searchParams: Promise<AlumniProfileSearchParams> }) {
  const sp = await searchParams;
  let p: Profile | undefined;
  let profileError: string | null = null;
  try {
    p = await getProfile(sp);
  } catch (e) {
    profileError = e instanceof Error ? e.message : "Failed to load profile";
  }
  const session = await auth();
  const name = p?.alumniname ?? "";
  const faculty = p?.facultyname ?? "";
  const dept = p?.departmentname ?? "";
  const program = p?.degreetitle ?? "";
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
  
  const sapId = String(sapRows[0]?.sapid ?? sp?.sapid ?? sessionSapid ?? "");
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
        {profileError && (
          <div className="mt-4">
            <Alert variant="error" title="Profile Load Failed" message={profileError} />
          </div>
        )}
        {sapError && (
          <div className="mt-2">
            <Alert variant="error" title="Account Lookup Failed" message={sapError} />
          </div>
        )}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Apply for Alumni Card</h1>
              <BackButton />
            </div>
            <AlumniCardForm
              alumniId={alumniId}
              name={name}
              sapId={sapId}
              faculty={faculty}
              department={dept}
              program={program}
            />
          </div>
        </div>
      </div>
    </>
  );
}

