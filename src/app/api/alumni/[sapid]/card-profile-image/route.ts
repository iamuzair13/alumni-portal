import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify, isViewerUser } from "@/lib/alumniProfile";
import { pickAlumniProfilePhotoFilename } from "@/lib/alumniProfilePhoto";

type AlumniImageRow = {
  alumniid: unknown;
  sapid: unknown;
  registrationno: unknown;
  personalemail: unknown;
  universityemail: unknown;
  officialemail: unknown;
  image1: unknown;
  image2: unknown;
};

/**
 * Fresh tbl_alumni profile photo filenames for alumni card PDF (image2 preferred, then image1).
 * Maps to schema: public.tbl_alumni.image1, image2; primary key alumniid.
 */
export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedIdentifier = String(sapid || "").trim();

    let rows = await sql/* sql */`
      SELECT
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.personalemail,
        a.universityemail,
        a.officialemail,
        a.image1,
        a.image2
      FROM public.tbl_alumni a
      WHERE TRIM(COALESCE(a.sapid, '')) = ${normalizedIdentifier}
      LIMIT 1`;

    if (!rows[0]) {
      rows = await sql/* sql */`
        SELECT
          a.alumniid,
          a.sapid,
          a.registrationno,
          a.personalemail,
          a.universityemail,
          a.officialemail,
          a.image1,
          a.image2
        FROM public.tbl_alumni a
        WHERE TRIM(COALESCE(a.registrationno, '')) = ${normalizedIdentifier}
        LIMIT 1`;
    }

    if (!rows[0] && !Number.isNaN(Number(normalizedIdentifier))) {
      rows = await sql/* sql */`
        SELECT
          a.alumniid,
          a.sapid,
          a.registrationno,
          a.personalemail,
          a.universityemail,
          a.officialemail,
          a.image1,
          a.image2
        FROM public.tbl_alumni a
        WHERE a.alumniid = ${Number(normalizedIdentifier)}
        LIMIT 1`;
    }

    if (!rows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const row = rows[0] as AlumniImageRow;

    const userEmail = session.user.email ? String(session.user.email) : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid)
      : null;
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno
      ? String((session.user as { registrationno?: string | null }).registrationno)
      : null;
    const dbSapid = String(row.sapid ?? "").toLowerCase().trim();
    const dbRegNo = String(row.registrationno ?? "").toLowerCase().trim();

    const isOwnerBySapid = userSapid && dbSapid === userSapid.toLowerCase().trim();
    const isOwnerByRegNo = userRegNo && dbRegNo === userRegNo.toLowerCase().trim();
    const isOwnerByEmail =
      userEmail &&
      (String(row.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
        String(row.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
        String(row.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim());

    const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;
    const canAccess = canModify(session.user);
    const isViewer = isViewerUser(session.user);
    const isAdminOrViewer = canAccess || isViewer;

    if (isAdminOrViewer && !canAccess) {
      try {
        const { buildAccessFilterSQL } = await import("@/lib/userAccess");
        const accessFilter = await buildAccessFilterSQL(session, "");

        if (accessFilter.hasFilter && accessFilter.sql) {
          const alumniId = Number(row.alumniid);
          if (!alumniId) {
            return NextResponse.json({ error: "Invalid alumni record" }, { status: 400 });
          }
          const accessCheck = await sql/* sql */`
            SELECT a.alumniid FROM public.tbl_alumni a
            WHERE a.alumniid = ${alumniId}
            AND (${accessFilter.sql})
            LIMIT 1
          `;

          if (!accessCheck[0]) {
            return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
          }
        }
      } catch {
        // continue to canView check
      }
    }

    const canView = isOwner || canAccess || isViewer;
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const image1 = row.image1 == null ? null : String(row.image1);
    const image2 = row.image2 == null ? null : String(row.image2);
    const profilePhotoFilename = pickAlumniProfilePhotoFilename(image2, image1);

    return NextResponse.json(
      {
        alumniid: row.alumniid,
        image1,
        image2,
        profilePhotoFilename,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch profile image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
