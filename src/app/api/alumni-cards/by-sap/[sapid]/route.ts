import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getCardImageCandidates, resolvePreferredCardImage } from "@/lib/alumniCardImage";
import { ALUMNI_CARD_VALIDITY_ISO } from "@/lib/cardValidity";

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();

    // SECURITY: Verify authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedSapid = String(sapid || "").trim();

    // Fetch card data (by SAP ID or registration number)
    const rows = await sql/* sql */`
      SELECT c.cardid, c.alumniid, c.cnicno, c.cardaddress, c.delivery_city, c.delivery_society_name, c.delivery_street_no, c.delivery_house_no, c.status, c.cardpicture, c.card_image, c.createdat, c.reason_onhold, c.validity_date,
             a.sapid, a.personalemail, a.officialemail, a.universityemail,
             a.image1 AS alumni_image1, a.image2 AS alumni_image2
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
         OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
      LIMIT 1`;

    const r = rows[0];
    if (!r) return NextResponse.json({ message: "Not found" }, { status: 404 });

    // SECURITY: Verify authorization - user must own the card or be admin
    const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
    const dbSapid = String(r.sapid ?? "").toLowerCase().trim();
    const isOwner = (userSapid && dbSapid === userSapid.toLowerCase().trim());
    const isAdmin = canModify(session.user);

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rr = r as typeof r & { alumni_image1?: string | null; alumni_image2?: string | null };
    const cardImageCandidates = getCardImageCandidates({
      cardImage: r.card_image,
      cardPicture: r.cardpicture,
      alumniImage2: rr.alumni_image2,
      alumniImage1: rr.alumni_image1,
    });
    const resolvedCardImage = resolvePreferredCardImage({
      cardImage: r.card_image,
      cardPicture: r.cardpicture,
      alumniImage2: rr.alumni_image2,
      alumniImage1: rr.alumni_image1,
    });

    // Return card data without sensitive fields from alumni table; include fresh profile filenames for PDF/UI
    return NextResponse.json(
      {
        card: {
          cardid: r.cardid,
          alumniid: r.alumniid,
          email: (() => {
            const row = r as {
              personalemail?: string | null;
              officialemail?: string | null;
              universityemail?: string | null;
            };
            const resolved = String(
              row.personalemail || row.officialemail || row.universityemail || ""
            ).trim();
            return resolved || null;
          })(),
          cnicno: r.cnicno,
          cardaddress: r.cardaddress,
          delivery_city: (r as { delivery_city?: unknown }).delivery_city ?? null,
          delivery_society_name: (r as { delivery_society_name?: unknown }).delivery_society_name ?? null,
          delivery_street_no: (r as { delivery_street_no?: unknown }).delivery_street_no ?? null,
          delivery_house_no: (r as { delivery_house_no?: unknown }).delivery_house_no ?? null,
          status: r.status,
          cardpicture: resolvedCardImage ?? r.cardpicture,
          card_image: resolvedCardImage ?? r.card_image,
          image_candidates: cardImageCandidates,
          createdat: r.createdat,
          reason_onhold: r.reason_onhold,
          validity_date: r.validity_date,
        },
        alumni_profile: {
          image1: rr.alumni_image1 ?? null,
          image2: rr.alumni_image2 ?? null,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();

    // SECURITY: Verify authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Only admins and superadmins can update card status
    if (!canModify(session.user)) {
      await logAdminAction({
        session,
        req,
        input: {
          action: "alumni_cards.update_status",
          entityType: "tblcard",
          entityId: String(sapid || "").trim() || null,
          success: false,
          errorMessage: "FORBIDDEN",
        },
      });
      return NextResponse.json({ error: "Forbidden: Only admins and superadmins can update card status" }, { status: 403 });
    }

    // Parse request body with better error handling
    let body: { status?: string; reason_onhold?: string } = {};
    try {
      const rawBody = await req.text();
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ 
        error: "Invalid request body. Expected JSON with 'status' field." 
      }, { status: 400 });
    }

    // Validate status field exists
    if (!body || typeof body !== 'object' || !('status' in body)) {
      return NextResponse.json({ 
        error: "Missing required field: 'status'. Must be one of: UnderReview, UnderPrinting, Active, Onhold, Delivered" 
      }, { status: 400 });
    }

    const newStatus = String(body.status || "").trim();
    const reasonOnhold = body.reason_onhold ? String(body.reason_onhold).trim() : null;

    // Validate status is not empty
    if (!newStatus || newStatus.length === 0) {
      return NextResponse.json({ 
        error: "Status cannot be empty. Must be one of: UnderReview, UnderPrinting, Active, Onhold, Delivered" 
      }, { status: 400 });
    }

    const normalizedSapid = String(sapid || "").trim();

    if (!normalizedSapid || normalizedSapid.length === 0) {
      return NextResponse.json({ error: "Invalid SAP ID" }, { status: 400 });
    }

    // Database values: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
    // Normalize and migrate legacy statuses
    const normalizedStatus = newStatus.trim();
    const upperStatus = normalizedStatus.toUpperCase();

    // Map status to proper database format
    let finalStatus: string;
    if (upperStatus === "PENDING") {
      finalStatus = "UnderReview";
    } else if (upperStatus === "PROCESS") {
      finalStatus = "UnderPrinting";
    } else if (upperStatus === "UNDERREVIEW") {
      finalStatus = "UnderReview";
    } else if (upperStatus === "UNDERPRINTING") {
      finalStatus = "UnderPrinting";
    } else if (upperStatus === "ACTIVE") {
      finalStatus = "Active";
    } else if (upperStatus === "ONHOLD" || upperStatus === "ON HOLD" || upperStatus === "ON_HOLD") {
      finalStatus = "Onhold";
    } else if (upperStatus === "DELIVERED") {
      finalStatus = "Delivered";
    } else {
      return NextResponse.json({ 
        error: `Invalid status "${newStatus}". Must be one of: UnderReview, UnderPrinting, Active, Onhold, Delivered` 
      }, { status: 400 });
    }

    // Final validation
    const validStatuses = ["UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"];
    if (!validStatuses.includes(finalStatus)) {
      return NextResponse.json({ 
        error: `Invalid status "${newStatus}". Must be one of: UnderReview, UnderPrinting, Active, Onhold, Delivered` 
      }, { status: 400 });
    }

    // If status is "Onhold", reason_onhold is required
    if (finalStatus === "Onhold" && (!reasonOnhold || reasonOnhold.length === 0)) {
      return NextResponse.json({ error: "Reason is required when status is set to Onhold" }, { status: 400 });
    }

    // Get current status before update
    let currentCard: Array<{
      cardid: number;
      status: string | null;
      alumniid: number;
      alumniname: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
    }>;
    try {
      currentCard = await sql/* sql */`
        SELECT c.cardid, c.status, a.alumniid, a.alumniname, a.personalemail, a.officialemail, a.universityemail
        FROM public.tblcard c
        JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
        WHERE TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
           OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
        LIMIT 1
      ` as Array<{
        cardid: number;
        status: string | null;
        alumniid: number;
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      }>;
    } catch {
      return NextResponse.json({ 
        error: "Database error while fetching card information" 
      }, { status: 500 });
    }

    if (!currentCard[0]) {
      return NextResponse.json({ message: "Card not found for this SAP ID" }, { status: 404 });
    }

    const currentStatus = currentCard[0].status;

    const shouldSetDeliveredValidity =
      finalStatus === "Delivered" && String(currentStatus ?? "").trim() !== "Delivered";

    // Update status and reason_onhold if provided
    // If status is not "Onhold", clear reason_onhold
    // If status is "Onhold", add a default note to the comment field
    let dbCardRows: Array<{ cardid: number; alumniid: number; status: string | null; reason_onhold: string | null }> = [];
    try {
      if (finalStatus === "Onhold") {
        // Add default note about profile picture when status is set to Onhold
        const defaultNote = "Please update your profile picture to proceed with the Alumni Card application. You can upload your photo from the profile section.";

        dbCardRows = await sql/* sql */`
          UPDATE public.tblcard c
          SET 
            status = ${finalStatus}, 
            reason_onhold = ${reasonOnhold},
            comment = ${defaultNote}
          FROM public.tbl_alumni a
          WHERE a.alumniid = c.alumniid 
            AND (
              TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
              OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
            )
          RETURNING c.cardid, c.alumniid, c.status, c.reason_onhold
        ` as Array<{ cardid: number; alumniid: number; status: string | null; reason_onhold: string | null }>;
      } else {
        dbCardRows = await sql/* sql */`
          UPDATE public.tblcard c
          SET 
            status = ${finalStatus},
            reason_onhold = NULL,
            validity_date = CASE
              WHEN ${shouldSetDeliveredValidity} THEN ${ALUMNI_CARD_VALIDITY_ISO}::date
              ELSE c.validity_date
            END
          FROM public.tbl_alumni a
          WHERE a.alumniid = c.alumniid
            AND (
              TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
              OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
            )
          RETURNING c.cardid, c.alumniid, c.status, c.reason_onhold
        ` as Array<{ cardid: number; alumniid: number; status: string | null; reason_onhold: string | null }>;
      }
    } catch {
      return NextResponse.json({ 
        error: "Database error while updating card status" 
      }, { status: 500 });
    }

    if (!dbCardRows[0]) {
      return NextResponse.json({ message: "Card not found or update failed" }, { status: 404 });
    }

    await logAdminAction({
      session,
      req,
      input: {
        action: "alumni_cards.update_status",
        entityType: "tblcard",
        entityId: dbCardRows[0].cardid,
        metadata: {
          sapid: normalizedSapid,
          alumniId: dbCardRows[0].alumniid,
          previousStatus: currentStatus,
          newStatus: finalStatus,
          reasonOnhold: finalStatus === "Onhold" ? reasonOnhold : null,
        },
      },
    });

    return NextResponse.json({ cardid: dbCardRows[0].cardid }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const session = await auth();

    // SECURITY: Verify authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Only admins and superadmins can delete cards
    if (!canModify(session.user)) {
      await logAdminAction({
        session,
        req: _,
        input: {
          action: "alumni_cards.delete",
          entityType: "tblcard",
          entityId: String(sapid || "").trim() || null,
          success: false,
          errorMessage: "FORBIDDEN",
        },
      });
      return NextResponse.json({ error: "Forbidden: Only admins and superadmins can delete cards" }, { status: 403 });
    }

    const normalizedSapid = String(sapid || "").trim();

    // Get card data including image paths before deletion
    const cardRows = await sql/* sql */`
      SELECT c.cardid, c.alumniid, c.cardpicture, c.card_image, a.registrationno
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
         OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
      LIMIT 1
    ` as Array<{
      cardid: number;
      alumniid: number;
      cardpicture: string | null;
      card_image: string | null;
      registrationno: string | null;
    }>;

    if (!cardRows[0]) {
      return NextResponse.json({ message: "Card not found" }, { status: 404 });
    }

    const cardData = cardRows[0];

    // Delete card images from filesystem if they exist
    const CARD_UPLOAD_DIR = join(process.cwd(), "public", "images");
    try {
      if (cardData.cardpicture) {
        const cardPicturePath = join(CARD_UPLOAD_DIR, cardData.cardpicture);
        if (existsSync(cardPicturePath)) {
          await unlink(cardPicturePath);
        }
      }
      if (cardData.card_image) {
        // card_image might be a full path or just filename
        let cardImagePath: string;
        if (cardData.card_image.startsWith("/") || cardData.card_image.includes("\\")) {
          // Full path
          cardImagePath = cardData.card_image.startsWith(process.cwd()) 
            ? cardData.card_image 
            : join(process.cwd(), cardData.card_image.replace(/^\//, ""));
        } else {
          // Just filename
          cardImagePath = join(CARD_UPLOAD_DIR, cardData.card_image);
        }
        if (existsSync(cardImagePath)) {
          await unlink(cardImagePath);
        }
      }
    } catch {
      // Log but don't fail the request if file deletion fails

    }
    
    // Delete the card record from database
    const deleteRows = await sql/* sql */`
      DELETE FROM public.tblcard c
      USING public.tbl_alumni a
      WHERE a.alumniid = c.alumniid
        AND (
          TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
          OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
        )
      RETURNING c.cardid
    `;
    
    if (!deleteRows[0]) {
      return NextResponse.json({ message: "Card not found" }, { status: 404 });
    }

    await logAdminAction({
      session,
      req: _,
      input: {
        action: "alumni_cards.delete",
        entityType: "tblcard",
        entityId: deleteRows[0].cardid,
        metadata: {
          sapid: normalizedSapid,
          registrationno: cardData.registrationno,
          alumniId: cardData.alumniid,
        },
      },
    });
    
    return NextResponse.json({ 
      message: "Card deleted successfully",
      cardid: deleteRows[0].cardid 
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}