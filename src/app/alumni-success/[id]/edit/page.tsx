export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const dynamicParams = true;
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
import BackButton from "@/components/ui/BackButton";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
              <Alert variant="error" title="Authentication Required" message="You must be logged in to edit a story." />
              <Link href={`/alumni-success/${encodeURIComponent(id)}`} className="mt-4 inline-block text-blue-600 hover:text-blue-700">
                ← Back to Story
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const storyId = Number(id);
  
  if (isNaN(storyId)) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <Alert variant="error" title="Invalid Story ID" message="The story ID is invalid." />
              <Link href="/alumni-success" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
                ← Back to Stories
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Fetch story first to get alumni ID
  const storyRows = await sql/* sql */`
    SELECT
      s.alumniid,
      s.alumnistories,
      s.storytitle,
      s.criteria_highlight,
      s.criteria_inspires,
      s.criteria_replicable,
      s.achievements,
      a.sapid,
      a.alumniname,
      COALESCE(f.faculty_name, a.facultyname) AS facultyname,
      COALESCE(d.department_name, a.departmentname) AS departmentname,
      a.yearofending,
      a.contactno,
      a.personalemail,
      a.officialemail,
      a.universityemail
    FROM public.tblalumnistories s
    INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
    LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
    LEFT JOIN public.tbl_departments d ON d.id = a.department
    WHERE s.id = ${storyId}
    LIMIT 1
  `;
  
  if (!storyRows[0]) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <Alert variant="error" title="Story Not Found" message="The story you're trying to edit does not exist." />
              <Link href="/alumni-success" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
                ← Back to Stories
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  const storyData = storyRows[0] as {
    alumniid: number;
    alumnistories: string | null;
    storytitle: string | null;
    criteria_highlight: string | null;
    criteria_inspires: string | null;
    criteria_replicable: boolean | null;
    achievements: string | null;
    sapid: string | null;
    alumniname: string | null;
    facultyname: string | null;
    departmentname: string | null;
    yearofending: number | null;
    contactno: string | null;
    personalemail: string | null;
    officialemail: string | null;
    universityemail: string | null;
  };
  
  const storyAlumniId = Number(storyData.alumniid);
  
  // Verify ownership
  let isOwner = false;
  try {
    const userRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni 
      WHERE (personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email})
      AND alumniid = ${storyAlumniId}
      LIMIT 1`;
    isOwner = userRows.length > 0;
  } catch {
    isOwner = false;
  }

  if (!isOwner) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <Alert variant="error" title="Access Denied" message="You can only edit your own stories." />
              <Link href={`/alumni-success/${encodeURIComponent(id)}`} className="mt-4 inline-block text-blue-600 hover:text-blue-700">
                ← Back to Story
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Use data from story query
  const r = storyData;

  if (!r) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <Alert variant="error" title="Not Found" message="Story not found." />
              <Link href="/alumni-success" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
                ← Back to Stories
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const sapId = String(r?.sapid ?? "");
  const name = String(r?.alumniname ?? session?.user?.name ?? "");
  const emailResolved = String(r?.personalemail ?? r?.officialemail ?? r?.universityemail ?? email);
  const faculty = String(r?.facultyname ?? "");
  const department = String(r?.departmentname ?? "");
  const passingYear = r?.yearofending ?? null;
  const contactNumber = String(r?.contactno ?? "");
  const existingStory = String(r?.alumnistories ?? "");
  const existingTitle = String(r?.storytitle ?? "");

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
              <h1 className="text-2xl font-bold text-slate-900">Edit Your Success Story</h1>
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
              existingStory={existingStory}
              existingTitle={existingTitle}
              existingCriteriaHighlight={String(r?.criteria_highlight ?? "")}
              existingCriteriaInspires={String(r?.criteria_inspires ?? "")}
              existingCriteriaReplicable={r?.criteria_replicable ?? null}
              existingAchievements={String(r?.achievements ?? "")}
              storyId={id}
            />
          </div>
        </div>
      </div>
    </>
  );
}

