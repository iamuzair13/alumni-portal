import { sql } from "@/lib/dbconnect";
import { pickStorySapId, sapIdNumericRegex } from "@/lib/alumniStories";

export type AlumniStorySubmitRow = {
  alumniid: number;
  sapid: string | null;
  registrationno: string | null;
  personalemail: string | null;
  officialemail: string | null;
  universityemail: string | null;
};

type SessionUser = {
  email?: string | null;
  sapid?: string | null;
  userId?: number | null;
};

export async function lookupAlumniForStorySubmit(
  sessionUser: SessionUser | null | undefined,
  payloadSapId: string,
  payloadEmail: string
): Promise<AlumniStorySubmitRow | null> {
  const trimmedPayloadSapId = payloadSapId.trim();
  if (sapIdNumericRegex.test(trimmedPayloadSapId)) {
    const rows = await sql/* sql */`
      SELECT
        alumniid,
        sapid,
        registrationno,
        personalemail,
        officialemail,
        universityemail
      FROM public.tbl_alumni
      WHERE TRIM(COALESCE(sapid, '')) = ${trimmedPayloadSapId}
      LIMIT 1`;
    if (rows[0]) return rows[0] as AlumniStorySubmitRow;
  }

  const sessionSapid = sessionUser?.sapid ? String(sessionUser.sapid).trim() : "";
  if (sapIdNumericRegex.test(sessionSapid)) {
    const rows = await sql/* sql */`
      SELECT
        alumniid,
        sapid,
        registrationno,
        personalemail,
        officialemail,
        universityemail
      FROM public.tbl_alumni
      WHERE TRIM(COALESCE(sapid, '')) = ${sessionSapid}
      LIMIT 1`;
    if (rows[0]) return rows[0] as AlumniStorySubmitRow;
  }

  const sessionAlumniId = sessionUser?.userId ? Number(sessionUser.userId) : NaN;
  if (Number.isFinite(sessionAlumniId)) {
    const rows = await sql/* sql */`
      SELECT
        alumniid,
        sapid,
        registrationno,
        personalemail,
        officialemail,
        universityemail
      FROM public.tbl_alumni
      WHERE alumniid = ${sessionAlumniId}
      LIMIT 1`;
    if (rows[0]) return rows[0] as AlumniStorySubmitRow;
  }

  const emails = [sessionUser?.email, payloadEmail]
    .map((value) => (value ? String(value).trim().toLowerCase() : ""))
    .filter(Boolean);

  for (const email of [...new Set(emails)]) {
    const rows = await sql/* sql */`
      SELECT
        alumniid,
        sapid,
        registrationno,
        personalemail,
        officialemail,
        universityemail
      FROM public.tbl_alumni
      WHERE LOWER(TRIM(COALESCE(personalemail, ''))) = ${email}
         OR LOWER(TRIM(COALESCE(officialemail, ''))) = ${email}
         OR LOWER(TRIM(COALESCE(universityemail, ''))) = ${email}
      ORDER BY alumniid DESC
      LIMIT 1`;
    if (rows[0]) return rows[0] as AlumniStorySubmitRow;
  }

  return null;
}

export function injectResolvedStorySapId(
  rawPayload: Record<string, unknown>,
  alumni: AlumniStorySubmitRow | null,
  sessionUser: SessionUser | null | undefined
): string | null {
  const resolved = pickStorySapId(
    String(rawPayload.sapId ?? ""),
    sessionUser?.sapid,
    alumni?.sapid,
    alumni?.registrationno
  );
  if (resolved) rawPayload.sapId = resolved;
  return resolved;
}
