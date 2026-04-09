import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { mkdir, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { isCardPictureUpdateAllowed } from "@/lib/alumniCardImage";
import { normalizePublicImageFilename } from "@/lib/uploadsImageUrl";

const CARD_UPLOAD_DIR = join(process.cwd(), "public", "images");
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024;

function sanitizeSapId(input: string | null | undefined): string {
  if (!input) return "alumni";
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "");
  const suffix = cleaned.slice(-10);
  return suffix || "alumni";
}

function buildFilename(sapId: string, extension: string) {
  return `${sanitizeSapId(sapId)}-${Date.now()}.${extension}`;
}

async function ensureCardDirExists() {
  if (!existsSync(CARD_UPLOAD_DIR)) {
    await mkdir(CARD_UPLOAD_DIR, { recursive: true });
  }
}

async function saveCardImage(file: File, sapId: string) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Only JPG, JPEG, and PNG are allowed.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("File size exceeds 5MB limit.");
  }

  await ensureCardDirExists();
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const filename = buildFilename(sapId, extension);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(CARD_UPLOAD_DIR, filename), buffer);
  return filename;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedSapid = String(sapid || "").trim();
    if (!normalizedSapid) {
      return NextResponse.json({ error: "Invalid SAP/registration identifier" }, { status: 400 });
    }

    const formData = await req.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.personalemail,
        a.universityemail,
        a.officialemail,
        c.status,
        c.card_image,
        c.cardpicture
      FROM public.tbl_alumni a
      LEFT JOIN public.tblcard c ON c.alumniid = a.alumniid
      WHERE TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
         OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
      LIMIT 1
    ` as Array<{
      alumniid: number;
      sapid: string | null;
      registrationno: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
      status: string | null;
      card_image: string | null;
      cardpicture: string | null;
    }>;

    const record = rows[0];
    if (!record) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    if (!record.status) {
      return NextResponse.json({ error: "Card application not found" }, { status: 404 });
    }

    const isAdmin = canModify(session.user);
    if (!isAdmin) {
      const userEmail = session.user.email ? String(session.user.email).toLowerCase().trim() : null;
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).toLowerCase().trim() : null;
      const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).toLowerCase().trim() : null;

      const dbSapid = record.sapid ? String(record.sapid).toLowerCase().trim() : "";
      const dbRegNo = record.registrationno ? String(record.registrationno).toLowerCase().trim() : "";
      const dbEmails = [
        record.personalemail ? String(record.personalemail).toLowerCase().trim() : "",
        record.universityemail ? String(record.universityemail).toLowerCase().trim() : "",
        record.officialemail ? String(record.officialemail).toLowerCase().trim() : "",
      ].filter(Boolean);

      const isOwnerBySapid = userSapid && dbSapid && dbSapid === userSapid;
      const isOwnerByRegNo = userRegNo && dbRegNo && dbRegNo === userRegNo;
      const isOwnerByEmail = userEmail && dbEmails.includes(userEmail);
      const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;

      if (!isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!isCardPictureUpdateAllowed(record.status)) {
      return NextResponse.json(
        { error: "Card picture can only be updated when status is Under-review or On-hold." },
        { status: 400 }
      );
    }

    const savedFilename = await saveCardImage(image, record.sapid || record.registrationno || String(record.alumniid));

    await sql/* sql */`
      UPDATE public.tblcard
      SET card_image = ${savedFilename},
          cardpicture = ${savedFilename}
      WHERE alumniid = ${record.alumniid}
    `;

    const previous = normalizePublicImageFilename(record.card_image ?? record.cardpicture);
    if (previous && previous !== savedFilename) {
      const previousPath = join(CARD_UPLOAD_DIR, previous);
      if (existsSync(previousPath)) {
        await unlink(previousPath).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true, image: savedFilename }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update card image";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
