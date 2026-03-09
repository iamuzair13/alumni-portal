import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { sendAlumniCardApplicationReceivedEmail } from "@/lib/email";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

const CARD_UPLOAD_DIR = join(process.cwd(), "public", "images");
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
    // Authentication check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const contentType = req.headers.get("content-type") || "";

    // Handle legacy JSON payloads (without file upload)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const alumniId = Number(body?.alumniId);
      if (!alumniId) return NextResponse.json({ error: "alumniId required" }, { status: 400 });
      
      // Verify alumni exists and user has permission
      const alumniRows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail 
        FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId} 
        LIMIT 1
      ` as Array<{ alumniid: number; sapid: string | null; registrationno: string | null; personalemail: string | null; universityemail: string | null; officialemail: string | null }>;
      
      if (!alumniRows[0]) {
        return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
      }
      
      const alumni = alumniRows[0];
      const isAdmin = canModify(session.user);
      
      // Check if user owns this alumni record or is admin
      if (!isAdmin) {
        const userEmail = session.user.email ? String(session.user.email).toLowerCase().trim() : null;
        const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).toLowerCase().trim() : null;
        const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).toLowerCase().trim() : null;
        
        const dbSapid = alumni.sapid ? String(alumni.sapid).toLowerCase().trim() : "";
        const dbRegNo = alumni.registrationno ? String(alumni.registrationno).toLowerCase().trim() : "";
        const dbEmails = [
          alumni.personalemail ? String(alumni.personalemail).toLowerCase().trim() : "",
          alumni.universityemail ? String(alumni.universityemail).toLowerCase().trim() : "",
          alumni.officialemail ? String(alumni.officialemail).toLowerCase().trim() : ""
        ].filter(Boolean);
        
        const isOwnerBySapid = userSapid && dbSapid && dbSapid === userSapid;
        const isOwnerByRegNo = userRegNo && dbRegNo && dbRegNo === userRegNo;
        const isOwnerByEmail = userEmail && dbEmails.includes(userEmail);
        const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;
        
        if (!isOwner) {
          return NextResponse.json({ error: "Forbidden: You don't have permission to apply for this alumni card" }, { status: 403 });
        }
      }
      const cnicno = String(body?.cnicno || "");
      const cardaddress = String(body?.cardaddress || "");
      const cardpicture = String(body?.cardpicture || "profile").slice(0, 50);
      const validityDateStr = body?.validity_date ? String(body.validity_date) : null;
      // Calculate validity date (3 years from application date) if not provided
      let validityDate: string | null = validityDateStr;
      if (!validityDate) {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 3);
        validityDate = futureDate.toISOString().split("T")[0];
      }
      
      // Check if this is a new application (no existing record)
      const existingCard = await sql/* sql */`
        SELECT cardid, status FROM public.tblcard WHERE alumniid = ${alumniId} LIMIT 1
      `;
      const isNewApplication = existingCard.length === 0;
      
      // IMPORTANT: Do not mutate card status on any data update.
      // - New application: status must start at "UnderReview".
      // - Existing application: keep existing status unchanged (ignore any incoming status).
      const status = isNewApplication
        ? "UnderReview"
        : (existingCard[0]?.status ? String(existingCard[0].status) : "UnderReview");
      
      if (status === "Deliver" && (!cardaddress || cardaddress.trim().length < 10)) {
        return NextResponse.json({ error: "Address is required and must be at least 10 characters when delivery is selected" }, { status: 400 });
      }

      const rows = await sql/* sql */`
        INSERT INTO public.tblcard (alumniid, cnicno, cardaddress, status, cardpicture, card_image, createdat, validity_date)
        VALUES (${alumniId}, ${cnicno}, ${cardaddress}, ${status}, ${cardpicture}, ${cardpicture}, NOW(), ${validityDate})
        ON CONFLICT (alumniid) DO UPDATE
        SET cnicno = EXCLUDED.cnicno,
            cardaddress = EXCLUDED.cardaddress,
            status = public.tblcard.status,
            cardpicture = EXCLUDED.cardpicture,
            card_image = EXCLUDED.card_image,
            createdat = public.tblcard.createdat,
            validity_date = EXCLUDED.validity_date
        RETURNING cardid`;
      
      // Send email notification for new applications
      if (isNewApplication) {
        try {
          const alumniData = await sql/* sql */`
            SELECT alumniname, personalemail, officialemail, universityemail
            FROM public.tbl_alumni
            WHERE alumniid = ${alumniId}
            LIMIT 1
          ` as Array<{
            alumniname: string | null;
            personalemail: string | null;
            officialemail: string | null;
            universityemail: string | null;
          }>;
          
          const alumni = alumniData[0];
          if (alumni) {
            const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
            const alumniName = alumni.alumniname || "Alumni";
            
            if (alumniEmail) {
              // Send email asynchronously (don't wait for it to complete)
              sendAlumniCardApplicationReceivedEmail(alumniEmail, alumniName).catch(() => {
              });
            }
          }
        } catch {
          // Don't fail the request if email fails

        }
      }
      
      return NextResponse.json({ cardid: rows[0]?.cardid }, { status: 201 });
    }

    // Default: handle multipart/form-data with image upload
    const formData = await req.formData();
    const alumniId = Number(formData.get("alumniId"));
    if (!alumniId) return NextResponse.json({ error: "alumniId required" }, { status: 400 });
    
    // Verify alumni exists and user has permission
    const alumniRows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno, personalemail, universityemail, officialemail 
      FROM public.tbl_alumni 
      WHERE alumniid = ${alumniId} 
      LIMIT 1
    ` as Array<{ alumniid: number; sapid: string | null; registrationno: string | null; personalemail: string | null; universityemail: string | null; officialemail: string | null }>;
    
    if (!alumniRows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }
    
    const alumni = alumniRows[0];
    const isAdmin = canModify(session.user);
    
    // Check if user owns this alumni record or is admin
    if (!isAdmin) {
      const userEmail = session.user.email ? String(session.user.email).toLowerCase().trim() : null;
      const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).toLowerCase().trim() : null;
      const userRegNo = (session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).toLowerCase().trim() : null;
      
      const dbSapid = alumni.sapid ? String(alumni.sapid).toLowerCase().trim() : "";
      const dbRegNo = alumni.registrationno ? String(alumni.registrationno).toLowerCase().trim() : "";
      const dbEmails = [
        alumni.personalemail ? String(alumni.personalemail).toLowerCase().trim() : "",
        alumni.universityemail ? String(alumni.universityemail).toLowerCase().trim() : "",
        alumni.officialemail ? String(alumni.officialemail).toLowerCase().trim() : ""
      ].filter(Boolean);
      
      const isOwnerBySapid = userSapid && dbSapid && dbSapid === userSapid;
      const isOwnerByRegNo = userRegNo && dbRegNo && dbRegNo === userRegNo;
      const isOwnerByEmail = userEmail && dbEmails.includes(userEmail);
      const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;
      
      if (!isOwner) {
        return NextResponse.json({ error: "Forbidden: You don't have permission to apply for this alumni card" }, { status: 403 });
      }
    }
    
    const sapId = String(formData.get("sapId") || "");
    const image = formData.get("image");
    const comment = String(formData.get("comment") || "").trim() || null;
    const cardaddress = String(formData.get("cardaddress") || "").trim() || null;
    const validityDateStr = formData.get("validity_date") ? String(formData.get("validity_date")) : null;
    
    // Calculate validity date (3 years from application date) if not provided
    let validityDate: string | null = validityDateStr;
    if (!validityDate) {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 3);
      validityDate = futureDate.toISOString().split('T')[0];
    }

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Profile image is required" }, { status: 400 });
    }

    const storedFilename = await saveCardImage(image, sapId || String(alumniId));

    // Check if this is a new application (no existing record)
    const existingCard = await sql/* sql */`
      SELECT cardid, status FROM public.tblcard WHERE alumniid = ${alumniId} LIMIT 1
    `;
    const isNewApplication = existingCard.length === 0;

    // IMPORTANT: Do not mutate card status on any update.
    // - New application: status must start at "UnderReview".
    // - Existing application: keep existing status unchanged.
    const status = isNewApplication
      ? "UnderReview"
      : (existingCard[0]?.status ? String((existingCard[0] as any).status) : "UnderReview");

    // When updating card image, if status is "Onhold", automatically change to "UnderReview"
    const rows = await sql/* sql */`
      INSERT INTO public.tblcard (alumniid, status, cardpicture, card_image, createdat, comment, cardaddress, validity_date)
      VALUES (${alumniId}, ${status}, ${storedFilename}, ${storedFilename}, NOW(), ${comment}, ${cardaddress}, ${validityDate})
      ON CONFLICT (alumniid) DO UPDATE
      SET status = public.tblcard.status,
          cardpicture = EXCLUDED.cardpicture,
          card_image = EXCLUDED.card_image,
          createdat = NOW(),
          comment = EXCLUDED.comment,
          cardaddress = EXCLUDED.cardaddress,
          validity_date = EXCLUDED.validity_date
      RETURNING cardid`;
    
    // Send email notification for new applications
    if (isNewApplication) {
      try {
        const alumniData = await sql/* sql */`
          SELECT alumniname, personalemail, officialemail, universityemail
          FROM public.tbl_alumni
          WHERE alumniid = ${alumniId}
          LIMIT 1
        ` as Array<{
          alumniname: string | null;
          personalemail: string | null;
          officialemail: string | null;
          universityemail: string | null;
        }>;
        
        const alumni = alumniData[0];
        if (alumni) {
          const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
          const alumniName = alumni.alumniname || "Alumni";
          
          if (alumniEmail) {
            // Send email asynchronously (don't wait for it to complete)
            sendAlumniCardApplicationReceivedEmail(alumniEmail, alumniName).catch(() => {
            });
          }
        }
      } catch {
        // Don't fail the request if email fails

      }
    }
    
    return NextResponse.json({ cardid: rows[0]?.cardid, image: storedFilename }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create card";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}