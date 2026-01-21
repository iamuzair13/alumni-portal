import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { sendAlumniCardOnHoldEmail, sendAlumniCardActivatedEmail } from "@/lib/email";
import { unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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
      SELECT c.cardid, c.alumniid, c.cnicno, c.cardaddress, c.status, c.cardpicture, c.card_image, c.createdat, c.reason_onhold, c.validity_date,
             a.sapid, a.personalemail, a.officialemail, a.universityemail
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
         OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
      LIMIT 1`;
    
    const r = rows[0];
    if (!r) return NextResponse.json({ message: "Not found" }, { status: 404 });
    
    // SECURITY: Verify authorization - user must own the card or be admin
    const userEmail = session.user.email ? String(session.user.email) : null;
    const userSapid = (session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null;
    const dbSapid = String(r.sapid ?? "").toLowerCase().trim();
    const isOwner = (userSapid && dbSapid === userSapid.toLowerCase().trim()) ||
                    (userEmail && (
                      String(r.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
                      String(r.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
                      String(r.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
                    ));
    const isAdmin = canModify(session.user);
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Return card data without sensitive fields from alumni table
    return NextResponse.json({ 
      card: {
        cardid: r.cardid,
        alumniid: r.alumniid,
        cnicno: r.cnicno,
        cardaddress: r.cardaddress,
        status: r.status,
        cardpicture: r.cardpicture,
        card_image: r.card_image,
        createdat: r.createdat,
        reason_onhold: r.reason_onhold,
        validity_date: r.validity_date,
      }
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
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

      return NextResponse.json({ error: "Forbidden: Only admins and superadmins can update card status" }, { status: 403 });
    }
    
    // Parse request body with better error handling
    let body: { status?: string; reason_onhold?: string } = {};
    try {
      const rawBody = await req.text();

      body = JSON.parse(rawBody);

    } catch (jsonError) {

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
    } catch (dbError) {

      return NextResponse.json({ 
        error: "Database error while fetching card information" 
      }, { status: 500 });
    }
    
    if (!currentCard[0]) {
      return NextResponse.json({ message: "Card not found for this SAP ID" }, { status: 404 });
    }
    
    const currentStatus = currentCard[0].status;
    const cardData = currentCard[0];

    const shouldSetDeliveredValidity =
      finalStatus === "Delivered" && String(currentStatus ?? "").trim() !== "Delivered";
    
    // Update status and reason_onhold if provided
    // If status is not "Onhold", clear reason_onhold
    // If status is "Onhold", add a default note to the comment field
    let rows: Array<{ cardid: number }>;
    try {
      if (finalStatus === "Onhold") {
        // Add default note about profile picture when status is set to Onhold
        const defaultNote = "Please update your profile picture to proceed with the Alumni Card application. You can upload your photo from the profile section.";
        
        rows = await sql/* sql */`
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
          RETURNING c.cardid
        ` as Array<{ cardid: number }>;
      } else {
        rows = await sql/* sql */`
          UPDATE public.tblcard c
          SET 
            status = ${finalStatus},
            reason_onhold = NULL,
            validity_date = CASE
              WHEN ${shouldSetDeliveredValidity} THEN (CURRENT_DATE + INTERVAL '3 years')::date
              ELSE c.validity_date
            END
          FROM public.tbl_alumni a
          WHERE a.alumniid = c.alumniid
            AND (
              TRIM(COALESCE(a.sapid, '')) = ${normalizedSapid}
              OR TRIM(COALESCE(a.registrationno, '')) = ${normalizedSapid}
            )
          RETURNING c.cardid
        ` as Array<{ cardid: number }>;
      }
    } catch (updateError) {


      return NextResponse.json({ 
        error: "Database error while updating card status" 
      }, { status: 500 });
    }
    
    if (!rows[0]) {
      return NextResponse.json({ message: "Card not found or update failed" }, { status: 404 });
    }
    
    // Send email notifications based on status change
    try {
      const alumniEmail = cardData.personalemail || cardData.officialemail || cardData.universityemail;
      const alumniName = cardData.alumniname || "Alumni";
      
      if (alumniEmail) {
        // Only send email if status actually changed
        if (currentStatus !== finalStatus) {
          if (finalStatus === "Onhold") {
            // Send "on hold" email when status becomes Onhold
            sendAlumniCardOnHoldEmail(alumniEmail, alumniName).catch((err) => {

            });
          } else if (finalStatus === "Delivered") {
            // Send "activated" email when status becomes Delivered
            sendAlumniCardActivatedEmail(alumniEmail, alumniName).catch((err) => {

            });
          }
          // Note: No email for other status changes, as they're internal admin actions
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails

    }
    
    return NextResponse.json({ cardid: rows[0].cardid }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
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
      return NextResponse.json({ error: "Forbidden: Only admins and superadmins can delete cards" }, { status: 403 });
    }
    
    const normalizedSapid = String(sapid || "").trim();
    
    // Get card data including image paths before deletion
    const cardRows = await sql/* sql */`
      SELECT c.cardid, c.alumniid, c.cardpicture, c.card_image
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
          await unlink(cardPicturePath).catch((err) => {

          });
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
          await unlink(cardImagePath).catch((err) => {

          });
        }
      }
    } catch (fileError) {
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
    
    return NextResponse.json({ 
      message: "Card deleted successfully",
      cardid: deleteRows[0].cardid 
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}