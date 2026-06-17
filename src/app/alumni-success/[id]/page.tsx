import Link from "next/link";
import { headers } from "next/headers";
import AppHeader from "@/layout/AppHeader";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import SuccessStoryDetail from "@/components/alumni/SuccessStoryDetail";

type DetailItem = {
  id: string;
  date: string;
  title: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ? String(session.user.email) : undefined;

  let isOwner = false;
  if (email) {
    try {
      const storyId = Number(id);
      const storyRows = await sql/* sql */`
        SELECT s.alumniid 
        FROM public.tblalumnistories s
        WHERE s.id = ${storyId}
        LIMIT 1`;

      if (storyRows[0]) {
        const storyAlumniId = Number((storyRows[0] as { alumniid: number }).alumniid);
        const userRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE (personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email})
          AND alumniid = ${storyAlumniId}
          LIMIT 1`;
        isOwner = userRows.length > 0;
      }
    } catch {
      isOwner = false;
    }
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/alumni-stories/${encodeURIComponent(id)}`, { cache: "no-store" });

  if (!res.ok) {
    return (
      <>
        <div className="bg-slate-100 overflow-x-hidden min-h-screen">
          <div className="border bg-white relative z-50">
            <AppHeader />
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 mb-4">
                Failed to load story.
              </div>
              <Link href="/alumni-success" className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                Back to Stories
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const data = (await res.json()) as DetailItem;

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden min-h-screen">
        <div className="border bg-white relative z-50">
          <AppHeader />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
          <SuccessStoryDetail
            story={data}
            backHref="/alumni-success"
            backLabel="Back to Stories"
            editHref={isOwner ? `/alumni-success/${encodeURIComponent(id)}/edit` : null}
          />
        </div>
      </div>
    </>
  );
}
