import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const CARD_UPLOAD_DIR = join(process.cwd(), "public", "images", "alumni-images", "card");
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function sanitizeSapId(input: string | null | undefined): string {
  if (!input) return "alumni";
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "");
  const suffix = cleaned.slice(-10);
  return suffix || "alumni";
}

function buildFilename(sapId: string, extension: string) {
  const safeSap = sanitizeSapId(sapId);
  return `${safeSap}-${Date.now()}.${extension}`;
}

async function ensureCardDirExists() {
  if (!existsSync(CARD_UPLOAD_DIR)) {
    await mkdir(CARD_UPLOAD_DIR, { recursive: true });
  }
}

async function saveCardImage(file: File, sapId: string) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Only JPEG, PNG, and GIF images are allowed.");
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

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle legacy JSON payloads (without file upload)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const alumniId = Number(body?.alumniId);
      if (!alumniId) return NextResponse.json({ error: "alumniId required" }, { status: 400 });
      const cnicno = String(body?.cnicno || "");
      const cardaddress = String(body?.cardaddress || "");
      const status = String(body?.status || "requested");
      const cardpicture = String(body?.cardpicture || "profile").slice(0, 50);
      
      if (status === "Deliver" && (!cardaddress || cardaddress.trim().length < 10)) {
        return NextResponse.json({ error: "Address is required and must be at least 10 characters when delivery is selected" }, { status: 400 });
      }
      const rows = await sql/* sql */`
        INSERT INTO public.tblcard (alumniid, cnicno, cardaddress, status, cardpicture, card_image, createdat)
        VALUES (${alumniId}, ${cnicno}, ${cardaddress}, ${status}, ${cardpicture}, ${cardpicture}, NOW())
        ON CONFLICT (alumniid) DO UPDATE
        SET cnicno = EXCLUDED.cnicno,
            cardaddress = EXCLUDED.cardaddress,
            status = EXCLUDED.status,
            cardpicture = EXCLUDED.cardpicture,
            card_image = EXCLUDED.card_image,
            createdat = NOW()
        RETURNING cardid`;
      return NextResponse.json({ cardid: rows[0]?.cardid }, { status: 201 });
    }

    // Default: handle multipart/form-data with image upload
    const formData = await req.formData();
    const alumniId = Number(formData.get("alumniId"));
    if (!alumniId) return NextResponse.json({ error: "alumniId required" }, { status: 400 });
    const cnicno = String(formData.get("cnicno") || "");
    const cardaddress = String(formData.get("cardaddress") || "");
    const status = String(formData.get("status") || "requested");
    const sapId = String(formData.get("sapId") || "");
    const image = formData.get("image");

    if (status === "Deliver" && (!cardaddress || cardaddress.trim().length < 10)) {
      return NextResponse.json({ error: "Address is required and must be at least 10 characters when delivery is selected" }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Profile image is required" }, { status: 400 });
    }

    const storedFilename = await saveCardImage(image, sapId || String(alumniId));

    const rows = await sql/* sql */`
      INSERT INTO public.tblcard (alumniid, cnicno, cardaddress, status, cardpicture, card_image, createdat)
      VALUES (${alumniId}, ${cnicno}, ${cardaddress}, ${status}, ${storedFilename}, ${storedFilename}, NOW())
      ON CONFLICT (alumniid) DO UPDATE
      SET cnicno = EXCLUDED.cnicno,
          cardaddress = EXCLUDED.cardaddress,
          status = EXCLUDED.status,
          cardpicture = EXCLUDED.cardpicture,
          card_image = EXCLUDED.card_image,
          createdat = NOW()
      RETURNING cardid`;
    return NextResponse.json({ cardid: rows[0]?.cardid, image: storedFilename }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create card";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}