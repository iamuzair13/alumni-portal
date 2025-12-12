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
    
    // Fetch card data
    const rows = await sql/* sql */`
      SELECT c.cardid, c.alumniid, c.cnicno, c.cardaddress, c.status, c.cardpicture, c.card_image, c.createdat, c.reason_onhold,
             a.sapid, a.personalemail, a.officialemail, a.universityemail
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE a.sapid = ${normalizedSapid}
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
        reason_onhold: r.reason_onhold
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
    
    // SECURITY: Only admins can update card status
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can update card status" }, { status: 403 });
    }
    
    const body = await req.json().catch(() => ({}));
    const newStatus = String(body?.status || "");
    const reasonOnhold = body?.reason_onhold ? String(body.reason_onhold).trim() : null;
    
    // Database values: "Pending", "Process", "Active", "Delivered", "Onhold"
    if (!newStatus || !["Pending", "Process", "Active", "Delivered", "Onhold"].includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status. Must be one of: Pending, Process, Active, Delivered, Onhold" }, { status: 400 });
    }
    
    // If status is "Onhold", reason_onhold is required
    if (newStatus === "Onhold" && (!reasonOnhold || reasonOnhold.length === 0)) {
      return NextResponse.json({ error: "Reason is required when status is set to Onhold" }, { status: 400 });
    }
    
    const normalizedSapid = String(sapid || "").trim();
    
    // Get current status before update
    const currentCard = await sql/* sql */`
      SELECT c.cardid, c.status, a.alumniid, a.alumniname, a.personalemail, a.officialemail, a.universityemail
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE a.sapid = ${normalizedSapid}
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
    
    if (!currentCard[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    
    const currentStatus = currentCard[0].status;
    const cardData = currentCard[0];
    
    // Update status and reason_onhold if provided
    // If status is not "Onhold", clear reason_onhold
    const updateFields = newStatus === "Onhold" 
      ? sql`status = ${newStatus}, reason_onhold = ${reasonOnhold}`
      : sql`status = ${newStatus}, reason_onhold = NULL`;
    
    const rows = await sql/* sql */`
      UPDATE public.tblcard c
      SET ${updateFields}
      FROM public.tbl_alumni a
      WHERE a.alumniid = c.alumniid AND a.sapid = ${normalizedSapid}
      RETURNING c.cardid`;
    
    if (!rows[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    
    // Send email notifications based on status change
    try {
      const alumniEmail = cardData.personalemail || cardData.officialemail || cardData.universityemail;
      const alumniName = cardData.alumniname || "Alumni";
      
      if (alumniEmail) {
        // Only send email if status actually changed
        if (currentStatus !== newStatus) {
          if (newStatus === "Onhold") {
            // Send "on hold" email when status becomes Onhold
            sendAlumniCardOnHoldEmail(alumniEmail, alumniName).catch((err) => {
              console.error("[API] Failed to send alumni card on hold email:", err);
            });
          } else if (newStatus === "Delivered") {
            // Send "activated" email when status becomes Delivered
            sendAlumniCardActivatedEmail(alumniEmail, alumniName).catch((err) => {
              console.error("[API] Failed to send alumni card activated email:", err);
            });
          }
          // Note: No email for "Process" or "Active" status changes, as they're internal admin actions
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending alumni card status email:", emailError);
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
    
    // SECURITY: Only admins can delete cards
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden: Only admins can delete cards" }, { status: 403 });
    }
    
    const normalizedSapid = String(sapid || "").trim();
    
    // Get card data including image paths before deletion
    const cardRows = await sql/* sql */`
      SELECT c.cardid, c.alumniid, c.cardpicture, c.card_image
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE a.sapid = ${normalizedSapid}
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
            console.error("[API] Failed to delete cardpicture:", err);
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
            console.error("[API] Failed to delete card_image:", err);
          });
        }
      }
    } catch (fileError) {
      // Log but don't fail the request if file deletion fails
      console.error("[API] Error deleting card images:", fileError);
    }
    
    // Delete the card record from database
    const deleteRows = await sql/* sql */`
      DELETE FROM public.tblcard c
      USING public.tbl_alumni a
      WHERE a.alumniid = c.alumniid AND a.sapid = ${normalizedSapid}
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