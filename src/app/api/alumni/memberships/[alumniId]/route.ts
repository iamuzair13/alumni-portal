import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { generateMembershipFormPDF } from "@/lib/pdfGenerator";
import {
  buildMembershipApplicationPreview,
  buildMembershipFormPDFData,
  type MembershipDbRow,
} from "@/lib/membershipApplicationPreview";

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
    const download = (searchParams.get("download") || "").toLowerCase();

    const membershipRows = await sql/* sql */`
      SELECT
        am.id,
        am.alumniid,
        am.created_at,
        COALESCE(am.status, 'pending') AS status,
        am.facility_type,
        am.application_ref,
        am.discount_type,
        am.membership_type,
        am.membership_start_date,
        am.preferred_timing,
        am.application_details,
        am.gym_membership_month,
        am.swimmingpool_membership_month,
        am.cricket_membership_month,
        a.alumniname,
        a.fathername,
        a.dateofbirth,
        a.cnicpassport,
        a.sapid,
        a.cgpa,
        a.yearofending,
        COALESCE(NULLIF(TRIM(a.facultyname), ''), f.faculty_name) AS faculty_name,
        COALESCE(NULLIF(TRIM(a.departmentname), ''), d.department_name) AS department_name,
        COALESCE(NULLIF(TRIM(a.degreetitle), ''), p.program_name) AS program_name,
        a.campusname,
        a.personalemail,
        a.universityemail,
        a.officialemail
      FROM public.alumni_memberships am
      JOIN public.tbl_alumni a ON a.alumniid = am.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE am.id = ${membershipIdNum}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    const row = membershipRows[0] as MembershipDbRow & {
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };

    const alumniEmail = String(
      row.personalemail || row.universityemail || row.officialemail || "",
    );
    row.email = alumniEmail || null;

    const application = buildMembershipApplicationPreview(row);
    const pdfData = buildMembershipFormPDFData(row);

    if (mode === "pdf" || mode === "form-pdf") {
      const pdfBuffer = await generateMembershipFormPDF(pdfData);
      const facilitySlug = application.facilityType;
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${download === "1" || download === "true" ? "attachment" : "inline"}; filename=Membership_Application_${facilitySlug}_${membershipIdNum}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfUrl = `/api/alumni/memberships/${membershipIdNum}?mode=form-pdf`;
    return NextResponse.json(
      {
        email: alumniEmail,
        pdfUrl,
        application,
      },
      { status: 200 },
    );
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

    const validStatuses = ["pending", "approved", "not-approved"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    if (status === "not-approved" && (!rejectionReason || rejectionReason.trim() === "")) {
      return NextResponse.json(
        { error: "Rejection reason is required when marking application as not approved" },
        { status: 400 }
      );
    }

    const membershipRows = await sql/* sql */`
      SELECT am.id
      FROM public.alumni_memberships am
      WHERE am.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    if (status === "not-approved") {
      await sql/* sql */`
        UPDATE public.alumni_memberships
        SET status = ${status}, reason = ${rejectionReason.trim()}
        WHERE id = ${alumniIdNum}
      `;
    } else {
      await sql/* sql */`
        UPDATE public.alumni_memberships
        SET status = ${status}, reason = NULL
        WHERE id = ${alumniIdNum}
      `;
    }

    return NextResponse.json({ success: true, status }, { status: 200 });
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

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const membershipId = parseInt(String(alumniId), 10);

    if (isNaN(membershipId) || membershipId <= 0) {
      return NextResponse.json({ error: "Invalid membership ID" }, { status: 400 });
    }

    const membershipRows = await sql/* sql */`
      SELECT id
      FROM public.alumni_memberships
      WHERE id = ${membershipId}
      LIMIT 1
    `;

    if (!membershipRows[0]) {
      return NextResponse.json({ error: "Membership application not found" }, { status: 404 });
    }

    await sql/* sql */`
      DELETE FROM public.alumni_memberships
      WHERE id = ${membershipId}
    `;

    return NextResponse.json(
      { success: true, message: "Membership application deleted successfully" },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete membership application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
