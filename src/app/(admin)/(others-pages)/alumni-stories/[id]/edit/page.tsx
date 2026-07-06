export const dynamic = "force-dynamic";

import Link from "next/link";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import AlumniSuccessForm from "@/components/forms/alumni-success";
import Alert from "@/components/ui/alert/Alert";
import { eventImageUrlFromStored } from "@/lib/uploadsImageUrl";

export default async function AdminStoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error" title="Authentication Required" message="You must be logged in to edit a story." />
        <Link href="/alumni-stories?tab=viewStories" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
          Back to Stories
        </Link>
      </div>
    );
  }

  if (!canModify(session.user)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error" title="Access Denied" message="You do not have permission to edit success stories." />
        <Link href={`/alumni-stories/${encodeURIComponent(id)}`} className="mt-4 inline-block text-blue-600 hover:text-blue-700">
          Back to Story
        </Link>
      </div>
    );
  }

  const storyId = Number(id);
  if (isNaN(storyId)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error" title="Invalid Story ID" message="The story ID is invalid." />
        <Link href="/alumni-stories?tab=viewStories" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
          Back to Stories
        </Link>
      </div>
    );
  }

  const accessFilter = await buildAccessFilterSQL(session, "");
  const accessCondition =
    accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

  const storyRows = await sql/* sql */`
    SELECT
      s.alumnistories,
      s.storytitle,
      s.story_image,
      s.criteria_highlight,
      s.criteria_inspires,
      s.criteria_replicable,
      s.signature_confirmed,
      s.signature_confirmed_at,
      a.sapid,
      a.alumniname,
      a.facultyname,
      a.departmentname,
      a.yearofending,
      a.contactno,
      a.personalemail,
      a.officialemail,
      a.universityemail
    FROM public.tblalumnistories s
    INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
    WHERE s.id = ${storyId}
      ${accessCondition}
    LIMIT 1
  `;

  if (!storyRows[0]) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error" title="Story Not Found" message="The story you are trying to edit does not exist or you do not have access." />
        <Link href="/alumni-stories?tab=viewStories" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
          Back to Stories
        </Link>
      </div>
    );
  }

  const r = storyRows[0] as {
    alumnistories: string | null;
    storytitle: string | null;
    story_image: string | null;
    criteria_highlight: string | null;
    criteria_inspires: string | null;
    criteria_replicable: boolean | null;
    signature_confirmed: boolean | null;
    signature_confirmed_at: string | null;
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

  const imageUrl = eventImageUrlFromStored(r.story_image) || "";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Success Story</h1>
        <Link href={`/alumni-stories/${encodeURIComponent(id)}`} className="text-sm text-blue-600 hover:text-blue-700">
          Cancel
        </Link>
      </div>
      <AlumniSuccessForm
        mode="admin"
        storyId={id}
        sapId={String(r.sapid ?? "")}
        name={String(r.alumniname ?? "")}
        email={String(r.personalemail ?? r.officialemail ?? r.universityemail ?? "")}
        faculty={String(r.facultyname ?? "")}
        department={String(r.departmentname ?? "")}
        passingYear={r.yearofending ?? null}
        contactNumber={String(r.contactno ?? "")}
        existingStory={String(r.alumnistories ?? "")}
        existingTitle={String(r.storytitle ?? "")}
        existingImageUrl={imageUrl}
        existingCriteriaHighlight={String(r.criteria_highlight ?? "")}
        existingCriteriaInspires={String(r.criteria_inspires ?? "")}
        existingCriteriaReplicable={r.criteria_replicable}
        existingSignatureConfirmed={r.signature_confirmed}
        existingSignatureConfirmedAt={
          r.signature_confirmed_at ? new Date(r.signature_confirmed_at).toISOString() : null
        }
        redirectAfterSave={`/alumni-stories/${encodeURIComponent(id)}`}
      />
    </div>
  );
}
