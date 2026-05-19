import { sql } from "@/lib/dbconnect";
import type { Session } from "next-auth";

export type AlumniPageIds = {
  alumniId: string;
  sapId: string;
};

export async function resolveAlumniPageIds(
  session: Session | null,
  searchParams?: { sapid?: string },
): Promise<AlumniPageIds> {
  const spSapid = searchParams?.sapid ? String(searchParams.sapid).trim() : "";
  const sessionSapid = session?.user
    ? (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid).trim()
      : ""
    : "";
  const userRegNo = session?.user
    ? (session.user as { registrationno?: string | null })?.registrationno
      ? String((session.user as { registrationno?: string | null }).registrationno).trim()
      : ""
    : "";
  const email = session?.user?.email ? String(session.user.email).trim() : "";

  type AlumniRow = { alumniid: number; sapid: string | null; registrationno: string | null };
  let row: AlumniRow | undefined;

  const lookupByIdentifier = async (identifier: string): Promise<AlumniRow | undefined> => {
    if (!identifier) return undefined;
    const rows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno
      FROM public.tbl_alumni
      WHERE sapid = ${identifier} OR registrationno = ${identifier}
      ORDER BY alumniid DESC
      LIMIT 1`;
    return (rows[0] as AlumniRow | undefined) ?? undefined;
  };

  if (spSapid) {
    row = await lookupByIdentifier(spSapid);
  }
  if (!row && sessionSapid) {
    row = await lookupByIdentifier(sessionSapid);
  }
  if (!row && userRegNo) {
    row = await lookupByIdentifier(userRegNo);
  }
  if (!row && email) {
    const rows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno
      FROM public.tbl_alumni
      WHERE personalemail = ${email}
         OR officialemail = ${email}
         OR universityemail = ${email}
         OR alumniemail = ${email}
      ORDER BY alumniid DESC
      LIMIT 1`;
    row = rows[0] as AlumniRow | undefined;
  }

  const sapId = String(
    row?.sapid?.trim() || spSapid || sessionSapid || row?.registrationno?.trim() || userRegNo || "",
  ).trim();

  return {
    alumniId: row?.alumniid ? String(row.alumniid) : "",
    sapId,
  };
}
