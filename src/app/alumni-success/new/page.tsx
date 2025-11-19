export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import Link from "next/link";
import AlumniSuccessForm from "@/components/forms/alumni-success";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";

export default async function Page() {
  const session = await auth();
  const email = session?.user?.email ? String(session.user.email) : undefined;
  
  if (!email) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <Alert variant="error" title="Authentication Required" message="You must be logged in to submit a success story." />
              <Link href="/alumni-success" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
                ← Back to Stories
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const rows = await sql/* sql */`
    SELECT sapid, alumniname, facultyname, departmentname, yearofending, contactno, personalemail, officialemail, universityemail
    FROM public.tbl_alumni 
    WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
    ORDER BY alumniid DESC LIMIT 1`;
  const r = rows[0] as {
    sapid: string | null;
    alumniname: string | null;
    facultyname: string | null;
    departmentname: string | null;
    yearofending: number | null;
    contactno: string | null;
    personalemail: string | null;
    officialemail: string | null;
    universityemail: string | null;
  } | undefined;
  const sapId = String(r?.sapid ?? "");
  const name = String(r?.alumniname ?? session?.user?.name ?? "");
  const emailResolved = String(r?.personalemail ?? r?.officialemail ?? r?.universityemail ?? email);
  const faculty = String(r?.facultyname ?? "");
  const department = String(r?.departmentname ?? "");
  const passingYear = r?.yearofending ?? null;
  const contactNumber = String(r?.contactno ?? "");

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Submit Your Success Story</h1>
              <Link
                href="/alumni-success"
                className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md px-3 py-2 transition-colors"
              >
                ← Back to Stories
              </Link>
            </div>
            <AlumniSuccessForm 
              sapId={sapId} 
              name={name} 
              email={emailResolved} 
              faculty={faculty} 
              department={department}
              passingYear={passingYear}
              contactNumber={contactNumber}
            />
          </div>
        </div>
      </div>
    </>
  );
}