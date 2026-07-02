import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import AlumniStoryDetailClient from "./AlumniStoryDetailClient";

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

  return <AlumniStoryDetailClient id={id} isOwner={isOwner} />;
}
