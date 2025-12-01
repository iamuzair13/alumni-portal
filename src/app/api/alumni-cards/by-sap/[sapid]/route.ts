import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { sendAlumniCardOnHoldEmail, sendAlumniCardActivatedEmail } from "@/lib/email";

export async function GET(_: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const rows = await sql/* sql */`
      SELECT c.cardid, c.alumniid, c.cnicno, c.cardaddress, c.status, c.cardpicture, c.card_image, c.createdat
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE a.sapid = ${sapid}
      LIMIT 1`;
    const r = rows[0];
    if (!r) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ card: r }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const newStatus = String(body?.status || "");
    if (!newStatus || !["pending", "rejected", "delivered"].includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    
    // Get current status before update
    const currentCard = await sql/* sql */`
      SELECT c.cardid, c.status, a.alumniid, a.alumniname, a.personalemail, a.officialemail, a.universityemail
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      WHERE a.sapid = ${sapid}
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
    
    // Update status
    const rows = await sql/* sql */`
      UPDATE public.tblcard c
      SET status = ${newStatus}
      FROM public.tbl_alumni a
      WHERE a.alumniid = c.alumniid AND a.sapid = ${sapid}
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
          if (newStatus === "rejected") {
            // Send "on hold" email when status is rejected
            sendAlumniCardOnHoldEmail(alumniEmail, alumniName).catch((err) => {
              console.error("[API] Failed to send alumni card on hold email:", err);
            });
          } else if (newStatus === "delivered") {
            // Send "activated" email when status becomes delivered
            sendAlumniCardActivatedEmail(alumniEmail, alumniName).catch((err) => {
              console.error("[API] Failed to send alumni card activated email:", err);
            });
          }
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