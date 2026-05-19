import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ sapid: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sapid } = await ctx.params;
    const userEmail = session?.user?.email ? String(session.user.email) : null;
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;
    const userRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null) : null;

    // Find alumni by SAP ID or registration number
    let alumniRows = await sql/* sql */`
      SELECT alumniid, sapid, registrationno, alumniname, personalemail, universityemail, officialemail
      FROM public.tbl_alumni
      WHERE sapid = ${sapid}
      LIMIT 1
    `;

    if (!alumniRows[0]) {
      alumniRows = await sql/* sql */`
        SELECT alumniid, sapid, registrationno, alumniname, personalemail, universityemail, officialemail
        FROM public.tbl_alumni
        WHERE registrationno = ${sapid}
        LIMIT 1
      `;
    }

    if (!alumniRows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const alumni = alumniRows[0] as {
      alumniid: number;
      sapid: string | null;
      registrationno: string | null;
      alumniname: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    };

    // Check ownership - user must be the owner or an admin
    const isOwnerBySapid = userSapid && String(alumni.sapid ?? "").toLowerCase().trim() === userSapid.toLowerCase().trim();
    const isOwnerByRegNo = userRegNo && String(alumni.registrationno ?? "").toLowerCase().trim() === userRegNo.toLowerCase().trim();
    const isOwnerByEmail = userEmail && (
      String(alumni.personalemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(alumni.universityemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim() ||
      String(alumni.officialemail ?? "").toLowerCase().trim() === userEmail.toLowerCase().trim()
    );
    const isOwner = isOwnerBySapid || isOwnerByRegNo || isOwnerByEmail;
    const isAdmin = (session.user as { type?: string })?.type === "superadmin" || (session.user as { type?: string })?.type === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all scholarship applications for this alumni
    const scholarshipApplications = await sql/* sql */`
      SELECT
        id,
        created_at,
        discount_type,
        kinship_firstname,
        kinship_lastname,
        kinship_cnic,
        apply_for,
        degree_title,
        admission_application_ref,
        COALESCE(status, 'pending') AS status,
        reason
      FROM public.alumni_scholarships
      WHERE id = ${alumni.alumniid}
      ORDER BY created_at DESC
    `;

    // Fetch all membership applications for this alumni
    const membershipApplications = await sql/* sql */`
      SELECT
        id,
        created_at,
        gym_membership_month,
        swimmingpool_membership_month,
        cricket_membership_month,
        facility_type,
        application_ref,
        membership_type,
        membership_start_date,
        preferred_timing,
        COALESCE(status, 'pending') AS status,
        reason
      FROM public.alumni_memberships
      WHERE alumniid = ${alumni.alumniid}
      ORDER BY created_at DESC
    `;

    const scholarshipItems = scholarshipApplications.map((app: any) => ({
      id: Number(app.id),
      type: "scholarship" as const,
      createdAt: app.created_at ? new Date(app.created_at).toISOString() : null,
      discountType: app.discount_type ?? null,
      kinshipFirstName: app.kinship_firstname ?? null,
      kinshipLastName: app.kinship_lastname ?? null,
      kinshipCnic: app.kinship_cnic ?? null,
      applyFor: app.apply_for ?? null,
      degreeTitle: app.degree_title ?? null,
      admissionApplicationRef: app.admission_application_ref ?? null,
      status: (app.status ?? "pending").toLowerCase(),
      rejectionReason: app.reason ?? null,
    }));

    const membershipItems = membershipApplications.map((app: any) => ({
      id: Number(app.id),
      type: "membership" as const,
      createdAt: app.created_at ? new Date(app.created_at).toISOString() : null,
      gymMembershipMonth: app.gym_membership_month ?? null,
      swimmingPoolMembershipMonth: app.swimmingpool_membership_month ?? null,
      cricketMembershipMonth: app.cricket_membership_month ?? null,
      facilityType: app.facility_type ?? null,
      applicationRef: app.application_ref ?? null,
      membershipType: app.membership_type ?? null,
      membershipStartDate: app.membership_start_date ?? null,
      preferredTiming: app.preferred_timing ?? null,
      status: (app.status ?? "pending").toLowerCase(),
      rejectionReason: app.reason ?? null,
    }));

    // Combine and sort by creation date (newest first)
    const allItems = [...scholarshipItems, ...membershipItems].sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ items: allItems }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch applications";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

