import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { canModify } from "@/lib/alumniProfile";
import {
  saveAlumniCardImage,
  tryDeleteAlumniCardImage,
  validateAlumniCardImage,
} from "@/lib/alumniCardImage";

type CardOwnerRow = {
  alumniid: number;
  status: string | null;
  card_image: string | null;
  cardpicture: string | null;
  sapid: string | null;
  registrationno: string | null;
  personalemail: string | null;
  officialemail: string | null;
  universityemail: string | null;
};

function normalizeStatusKey(status: string | null | undefined): string {
  return String(status ?? "")
    .toUpperCase()
    .replace(/[\s_-]/g, "");
}

function isAllowedStatusForUpdate(status: string | null | undefined): boolean {
  const key = normalizeStatusKey(status);
  return key === "UNDERREVIEW" || key === "ONHOLD";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sapid } = await ctx.params;
    const identifier = String(sapid || "").trim();
    if (!identifier) {
      return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT
        c.alumniid,
        c.status,
        c.card_image,
        c.cardpicture,
        a.sapid,
        a.registrationno,
        a.personalemail,
        a.officialemail,
        a.universityemail
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE TRIM(COALESCE(a.sapid, '')) = ${identifier}
         OR TRIM(COALESCE(a.registrationno, '')) = ${identifier}
      ORDER BY c.cardid DESC
      LIMIT 1
    ` as CardOwnerRow[];

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Card application not found" }, { status: 404 });
    }

    const isAdmin = canModify(session.user);
    const userEmail = session.user.email ? String(session.user.email).toLowerCase().trim() : "";
    const userSapid = (session.user as { sapid?: string | null })?.sapid
      ? String((session.user as { sapid?: string | null }).sapid).toLowerCase().trim()
      : "";
    const userRegNo = (session.user as { registrationno?: string | null })?.registrationno
      ? String((session.user as { registrationno?: string | null }).registrationno).toLowerCase().trim()
      : "";

    const dbSapid = String(row.sapid ?? "").toLowerCase().trim();
    const dbRegNo = String(row.registrationno ?? "").toLowerCase().trim();
    const dbEmails = [
      String(row.personalemail ?? "").toLowerCase().trim(),
      String(row.officialemail ?? "").toLowerCase().trim(),
      String(row.universityemail ?? "").toLowerCase().trim(),
    ].filter(Boolean);

    const isOwner = Boolean(
      (userSapid && dbSapid && userSapid === dbSapid) ||
      (userRegNo && dbRegNo && userRegNo === dbRegNo) ||
      (userEmail && dbEmails.includes(userEmail))
    );

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isAllowedStatusForUpdate(row.status)) {
      return NextResponse.json(
        { error: "Card picture can only be updated when status is Under-review or On-hold." },
        { status: 409 }
      );
    }

    const formData = await req.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    const validation = validateAlumniCardImage(image);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const safeIdentifier = row.sapid || row.registrationno || String(row.alumniid);
    const storedFilename = await saveAlumniCardImage(image, safeIdentifier);

    const updatedRows = await sql/* sql */`
      UPDATE public.tblcard
      SET
        card_image = ${storedFilename},
        cardpicture = ${storedFilename}
      WHERE alumniid = ${row.alumniid}
        AND COALESCE(status, '') = ${row.status ?? ""}
      RETURNING alumniid, status, card_image
    ` as Array<{ alumniid: number; status: string | null; card_image: string | null }>;

    if (!updatedRows[0]) {
      await tryDeleteAlumniCardImage(storedFilename);
      return NextResponse.json(
        { error: "Card status changed during upload. Please refresh and try again." },
        { status: 409 }
      );
    }

    const oldImage = row.card_image || row.cardpicture;
    if (oldImage && oldImage !== storedFilename) {
      await tryDeleteAlumniCardImage(oldImage);
    }

    return NextResponse.json(
      {
        message: "Alumni card picture updated successfully.",
        image: storedFilename,
        card: updatedRows[0],
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update alumni card picture.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
