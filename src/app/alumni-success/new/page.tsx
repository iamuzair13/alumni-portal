export const dynamic = "force-dynamic";
import type { Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import Link from "next/link";
import AlumniSuccessForm from "@/components/forms/alumni-success";
import { pickStorySapId } from "@/lib/alumniStories";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import AppHeader from "@/layout/AppHeader";
import Alert from "@/components/ui/alert/Alert";
import { computeLoginBanner } from "@/lib/alumniProfile";
import BackButton from "@/components/ui/BackButton";

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

  const sessionAlumniId =
    session?.user && (session.user as { userId?: number | null })?.userId
      ? Number((session.user as { userId?: number | null }).userId)
      : undefined;
  const sessionSapid = session?.user
    ? (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid).trim()
      : undefined
    : undefined;

  type AlumniRow = {
    sapid: string | null;
    registrationno: string | null;
    alumniname: string | null;
    facultyname: string | null;
    departmentname: string | null;
    yearofending: number | null;
    contactno: string | null;
    personalemail: string | null;
    officialemail: string | null;
    universityemail: string | null;
  };

  let r: AlumniRow | undefined;

  if (sessionAlumniId) {
    const rows = await sql/* sql */`
      SELECT
        a.sapid,
        a.registrationno,
        a.alumniname,
        COALESCE(f.faculty_name, a.facultyname) AS facultyname,
        COALESCE(d.department_name, a.departmentname) AS departmentname,
        a.yearofending,
        a.contactno,
        a.personalemail,
        a.officialemail,
        a.universityemail
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      WHERE a.alumniid = ${sessionAlumniId}
      LIMIT 1`;
    r = rows[0] as AlumniRow | undefined;
  }

  if (!r && sessionSapid) {
    const rows = await sql/* sql */`
      SELECT
        a.sapid,
        a.registrationno,
        a.alumniname,
        COALESCE(f.faculty_name, a.facultyname) AS facultyname,
        COALESCE(d.department_name, a.departmentname) AS departmentname,
        a.yearofending,
        a.contactno,
        a.personalemail,
        a.officialemail,
        a.universityemail
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      WHERE TRIM(COALESCE(a.sapid, '')) = ${sessionSapid}
      LIMIT 1`;
    r = rows[0] as AlumniRow | undefined;
  }

  if (!r && email) {
    const rows = await sql/* sql */`
      SELECT
        a.sapid,
        a.registrationno,
        a.alumniname,
        COALESCE(f.faculty_name, a.facultyname) AS facultyname,
        COALESCE(d.department_name, a.departmentname) AS departmentname,
        a.yearofending,
        a.contactno,
        a.personalemail,
        a.officialemail,
        a.universityemail
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      WHERE a.personalemail = ${email} OR a.officialemail = ${email} OR a.universityemail = ${email}
      ORDER BY a.alumniid DESC
      LIMIT 1`;
    r = rows[0] as AlumniRow | undefined;
  }
  const sapId = pickStorySapId(r?.sapid, r?.registrationno, sessionSapid) ?? "";
  const name = String(r?.alumniname ?? session?.user?.name ?? "");
  const emailResolved = String(r?.personalemail ?? r?.officialemail ?? r?.universityemail ?? email);
  const faculty = String(r?.facultyname ?? "");
  const department = String(r?.departmentname ?? "");
  const passingYear = r?.yearofending ?? null;
  const contactNumber = String(r?.contactno ?? "");

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen dark:bg-gray-900">
        <div className="border bg-white relative z-50 dark:bg-gray-900 dark:border-gray-700">
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8 dark:bg-gray-900 dark:border-gray-700">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 dark:bg-gray-900 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-900">Submit Your Success Story</h1>
              <BackButton />
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