import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { generateScholarshipPDF } from "@/lib/pdfGenerator";

// Helper function to get discount label
function getDiscountLabel(discountType: string): string {
  switch (discountType) {
    case "kinship":
      return "Kinship Discount";
    case "alumni":
      return "Alumni Discount";
    default:
      return discountType;
  }
}

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
    const alumniIdNum = parseInt(String(alumniId), 10);
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") || "").toLowerCase();

    const applicationRows = await sql/* sql */`
      SELECT
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      WHERE asch.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!applicationRows[0]) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const app = applicationRows[0] as {
      kinship_firstname: string | null;
      kinship_lastname: string | null;
      kinship_cnic: string | null;
      apply_for: string | null;
      degree_title: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };

    const alumniName = String(app.alumniname || "");
    const alumniEmail = String(app.personalemail || app.universityemail || app.officialemail || "");

    if (mode === "pdf") {
      const kinshipFirstName = app.kinship_firstname;
      const kinshipLastName = app.kinship_lastname;
      const hasKinship = !!(kinshipFirstName && kinshipLastName);
      const discountType = hasKinship ? "kinship" : "alumni";

      const pdfBuffer = await generateScholarshipPDF({
        alumniName,
        discountType,
        applyingFor: String(app.apply_for || ""),
        degreeTitle: String(app.degree_title || ""),
        kinshipRelation: null,
        kinshipFirstName: kinshipFirstName || null,
        kinshipLastName: kinshipLastName || null,
        kinshipName: hasKinship ? `${kinshipFirstName} ${kinshipLastName}` : null,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename=Scholarship_Application_${alumniIdNum}.pdf`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfUrl = `/api/alumni/scholarships/${alumniIdNum}?mode=pdf`;
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

    // Only admins can update scholarship status
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

    // Fetch application and alumni details before updating
    const applicationRows = await sql/* sql */`
      SELECT
        asch.kinship_firstname,
        asch.kinship_lastname,
        asch.kinship_cnic,
        asch.apply_for,
        asch.degree_title,
        a.alumniname,
        a.personalemail,
        a.universityemail,
        a.officialemail,
        a.cnicpassport,
        a.father_cnic
      FROM public.alumni_scholarships asch
      JOIN public.tbl_alumni a ON a.alumniid = asch.id
      WHERE asch.id = ${alumniIdNum}
      LIMIT 1
    `;

    if (!applicationRows[0]) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const app = applicationRows[0] as {
      kinship_firstname: string | null;
      kinship_lastname: string | null;
      kinship_cnic: string | null;
      apply_for: string | null;
      degree_title: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
      cnicpassport: string | null;
      father_cnic: string | null;
    };

    const alumniName = String(app.alumniname || "");
    const alumniEmail = String(app.personalemail || app.universityemail || app.officialemail || "");
    const applyFor = String(app.apply_for || "");
    const degreeTitle = String(app.degree_title || "");
    const kinshipFirstName = app.kinship_firstname;
    const kinshipLastName = app.kinship_lastname;
    const kinshipCnic = app.kinship_cnic;
    const hasKinship = !!(kinshipFirstName && kinshipLastName);

    // Determine discount type based on kinship data
    const discountType = hasKinship ? "kinship" : "alumni";

    // Update scholarship status and rejection reason
    if (status === "not-approved") {
      await sql/* sql */`
        UPDATE public.alumni_scholarships
        SET status = ${status}, reason = ${rejectionReason.trim()}
        WHERE id = ${alumniIdNum}
      `;
    } else {
      // Clear rejection reason when approving or setting to pending
      await sql/* sql */`
        UPDATE public.alumni_scholarships
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

    const msg = err instanceof Error ? err.message : "Failed to update scholarship status";
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

    // Only admins can delete scholarship applications
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { alumniId } = await ctx.params;
    const scholarshipId = parseInt(String(alumniId), 10);
    
    if (isNaN(scholarshipId) || scholarshipId <= 0) {
      return NextResponse.json({ error: "Invalid scholarship ID" }, { status: 400 });
    }

    // Check if scholarship application exists
    const scholarshipRows = await sql/* sql */`
      SELECT id
      FROM public.alumni_scholarships
      WHERE id = ${scholarshipId}
      LIMIT 1
    `;

    if (!scholarshipRows[0]) {
      return NextResponse.json({ error: "Scholarship application not found" }, { status: 404 });
    }

    // Delete the scholarship application
    await sql/* sql */`
      DELETE FROM public.alumni_scholarships
      WHERE id = ${scholarshipId}
    `;

    return NextResponse.json({ success: true, message: "Scholarship application deleted successfully" }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete scholarship application";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
