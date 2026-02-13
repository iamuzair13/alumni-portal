import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { generateMembershipPDF } from "@/lib/pdfGenerator";

export async function GET(request: NextRequest, ctx: { params: Promise<{ alumniId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const membershipIdNum = parseInt(String(alumniId), 10);
    if (isNaN(membershipIdNum) || membershipIdNum <= 0) {
      return NextResponse.json({ error: "Invalid membership ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") || "").toLowerCase();

    const membershipRows = await sql/* sql */`
      SELECT
        am.id,
        am.alumniid,
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail
      FROM public.alumni_memberships am
      JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      WHERE am.id = ${membershipIdNum}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    const membership = membershipRows[0] as {
      gym_membership_month: string | null;
      swimmingpool_membership_month: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };

    const alumniName = String(membership.alumniname || "");
    const alumniEmail = String(membership.personalemail || membership.universityemail || membership.officialemail || "");
    const gymMonth = membership.gym_membership_month;
    const swimmingPoolMonth = membership.swimmingpool_membership_month;
    const membershipType = gymMonth ? "Gym" : swimmingPoolMonth ? "Swimming Pool" : "Membership";

    if (mode === "pdf") {
      const pdfBuffer = await generateMembershipPDF({
        alumniName,
        membershipType,
        gymMembershipMonth: gymMonth,
        swimmingPoolMembershipMonth: swimmingPoolMonth,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename=Membership_Application_${membershipIdNum}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfUrl = `/api/alumni/memberships/${membershipIdNum}?mode=pdf`;
    return NextResponse.json({ email: alumniEmail, pdfUrl }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch application preview";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ alumniId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update membership status
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const alumniIdNum = parseInt(String(alumniId), 10);
    
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status, rejectionReason } = body;

    // Validate status
    const validStatuses = ["pending", "approved", "not-approved"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // If status is "not-approved", rejectionReason is required
    if (status === "not-approved" && (!rejectionReason || rejectionReason.trim() === "")) {
      return NextResponse.json(
        { error: "Rejection reason is required when marking application as not approved" },
        { status: 400 }
      );
    }

    // Fetch membership and alumni details before updating
    const membershipRows = await sql/* sql */`
      SELECT
        am.id,
        am.alumniid,
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail
      FROM public.alumni_memberships am
      JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      WHERE am.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    const membership = membershipRows[0] as {
      gym_membership_month: string | null;
      swimmingpool_membership_month: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };

    const alumniName = String(membership.alumniname || "");
    const alumniEmail = String(membership.personalemail || membership.universityemail || membership.officialemail || "");
    const gymMonth = membership.gym_membership_month;
    const swimmingPoolMonth = membership.swimmingpool_membership_month;
    const membershipType = gymMonth ? "Gym" : swimmingPoolMonth ? "Swimming Pool" : "Membership";

    // Update membership status and rejection reason
    if (status === "not-approved") {
      await sql/* sql */`
        UPDATE public.alumni_memberships
        SET status = ${status}, reason = ${rejectionReason.trim()}
        WHERE id = ${alumniIdNum}
      `;
    } else {
      // Clear rejection reason when approving or setting to pending
      await sql/* sql */`
        UPDATE public.alumni_memberships
        SET status = ${status}, reason = NULL
        WHERE id = ${alumniIdNum}
      `;
    }

    return NextResponse.json(
      { 
        success: true, 
        status,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update membership status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ alumniId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete membership applications
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const membershipId = parseInt(String(alumniId), 10);
    
    if (isNaN(membershipId) || membershipId <= 0) {
      return NextResponse.json({ error: "Invalid membership ID" }, { status: 400 });
    }

    // Check if membership exists
    const membershipRows = await sql/* sql */`
      SELECT id
      FROM public.alumni_memberships
      WHERE id = ${membershipId}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    // Delete the membership application
    await sql/* sql */`
      DELETE FROM public.alumni_memberships
      WHERE id = ${membershipId}
    `;

    return NextResponse.json({ success: true, message: "Membership application deleted successfully" }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete membership application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
