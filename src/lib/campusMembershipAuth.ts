import { sql } from "@/lib/dbconnect";
import type { Session } from "next-auth";

type AlumniRow = {
  alumniid: number;
  alumniname: string | null;
  personalemail: string | null;
  officialemail: string | null;
  universityemail: string | null;
};

export async function verifyAlumniForMembership(
  session: Session,
  alumniId: string | number,
): Promise<AlumniRow | null> {
  const email = session.user?.email ? String(session.user.email) : null;
  const userSapid = session.user
    ? (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid).trim()
      : null
    : null;
  const userRegNo = session.user
    ? (session.user as { registrationno?: string | null })?.registrationno
      ? String((session.user as { registrationno?: string | null }).registrationno).trim()
      : null
    : null;

  if (!email && !userSapid && !userRegNo) return null;

  const alumniIdNum = parseInt(String(alumniId), 10);
  if (!Number.isFinite(alumniIdNum) || alumniIdNum <= 0) return null;

  let alumRows: AlumniRow[] = [];

  if (userSapid) {
    alumRows = (await sql/* sql */`
      SELECT alumniid, alumniname, personalemail, officialemail, universityemail
      FROM public.tbl_alumni
      WHERE sapid = ${userSapid} AND alumniid = ${alumniIdNum}
      LIMIT 1`) as AlumniRow[];
  } else if (userRegNo) {
    alumRows = (await sql/* sql */`
      SELECT alumniid, alumniname, personalemail, officialemail, universityemail
      FROM public.tbl_alumni
      WHERE registrationno = ${userRegNo} AND alumniid = ${alumniIdNum}
      LIMIT 1`) as AlumniRow[];
  }

  if (alumRows.length === 0 && email) {
    alumRows = (await sql/* sql */`
      SELECT alumniid, alumniname, personalemail, officialemail, universityemail
      FROM public.tbl_alumni
      WHERE (
        personalemail = ${email}
        OR officialemail = ${email}
        OR universityemail = ${email}
        OR alumniemail = ${email}
      )
      AND alumniid = ${alumniIdNum}
      ORDER BY alumniid DESC
      LIMIT 1`) as AlumniRow[];
  }

  return alumRows[0] ?? null;
}
