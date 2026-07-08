import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { sendEmail } from "@/lib/email";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";

const VALID_ROLES = ["president", "vice_president", "coordinator"] as const;
type RecommendedRole = (typeof VALID_ROLES)[number];

function roleDisplayName(role: string): string {
  switch (role) {
    case "president":
      return "President";
    case "vice_president":
      return "Vice President";
    case "coordinator":
      return "Coordinator";
    default:
      return role;
  }
}

// GET: Fetch all recommendations (for the Recommended For sub-section)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await sql/* sql */`
      SELECT
        lr.id,
        lr.application_id,
        lr.application_type,
        lr.original_role,
        lr.recommended_role,
        lr.chapter_or_association_name,
        lr.alumni_response,
        lr.assigned,
        lr.created_at,
        lr.updated_at,
        CASE
          WHEN lr.application_type = 'chapter' THEN (
            SELECT a.alumniname FROM public.tbl_alumni a
            JOIN public.chapter_leadership cl ON cl.id = lr.application_id
            WHERE a.alumniid = cl.alumniid
            LIMIT 1
          )
          WHEN lr.application_type = 'association' THEN (
            SELECT a.alumniname FROM public.tbl_alumni a
            JOIN public.tblalumniassociation aa ON aa.id = lr.application_id
            WHERE a.alumniid = aa.alumni_id
            LIMIT 1
          )
        END AS alumni_name,
        CASE
          WHEN lr.application_type = 'chapter' THEN (
            SELECT a.sapid FROM public.tbl_alumni a
            JOIN public.chapter_leadership cl ON cl.id = lr.application_id
            WHERE a.alumniid = cl.alumniid
            LIMIT 1
          )
          WHEN lr.application_type = 'association' THEN (
            SELECT a.sapid FROM public.tbl_alumni a
            JOIN public.tblalumniassociation aa ON aa.id = lr.application_id
            WHERE a.alumniid = aa.alumni_id
            LIMIT 1
          )
        END AS sap_id,
        CASE
          WHEN lr.application_type = 'chapter' THEN (
            SELECT COALESCE(a.personalemail, a.officialemail, a.universityemail) FROM public.tbl_alumni a
            JOIN public.chapter_leadership cl ON cl.id = lr.application_id
            WHERE a.alumniid = cl.alumniid
            LIMIT 1
          )
          WHEN lr.application_type = 'association' THEN (
            SELECT COALESCE(a.personalemail, a.officialemail, a.universityemail) FROM public.tbl_alumni a
            JOIN public.tblalumniassociation aa ON aa.id = lr.application_id
            WHERE a.alumniid = aa.alumni_id
            LIMIT 1
          )
        END AS alumni_email,
        CASE
          WHEN lr.application_type = 'chapter' THEN (
            SELECT cl.alumniid FROM public.chapter_leadership cl WHERE cl.id = lr.application_id LIMIT 1
          )
          WHEN lr.application_type = 'association' THEN (
            SELECT aa.alumni_id FROM public.tblalumniassociation aa WHERE aa.id = lr.application_id LIMIT 1
          )
        END AS alumni_id
      FROM public.leadership_recommendations lr
      WHERE lr.assigned = false AND (lr.alumni_response IS NULL OR lr.alumni_response = 'accepted')
      ORDER BY lr.created_at DESC
    `;

    const items = (rows as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      applicationId: Number(r.application_id),
      applicationType: String(r.application_type),
      originalRole: String(r.original_role),
      recommendedRole: String(r.recommended_role),
      chapterOrAssociationName: r.chapter_or_association_name ? String(r.chapter_or_association_name) : null,
      alumniResponse: r.alumni_response ? String(r.alumni_response) : null,
      assigned: Boolean(r.assigned),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      alumniName: r.alumni_name ? String(r.alumni_name) : null,
      sapId: r.sap_id ? String(r.sap_id) : null,
      alumniEmail: r.alumni_email ? String(r.alumni_email) : null,
      alumniId: r.alumni_id ? Number(r.alumni_id) : null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch recommendations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Create a recommendation and send email
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      applicationId,
      applicationType,
      recommendedRole,
      originalRole,
      chapterOrAssociationName,
      alumniName,
      alumniEmail,
    } = body as {
      applicationId?: number;
      applicationType?: "chapter" | "association";
      recommendedRole?: string;
      originalRole?: string;
      chapterOrAssociationName?: string;
      alumniName?: string;
      alumniEmail?: string;
    };

    if (!applicationId || !applicationType || !recommendedRole || !originalRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!VALID_ROLES.includes(recommendedRole as RecommendedRole)) {
      return NextResponse.json({ error: "Invalid recommended role" }, { status: 400 });
    }

    if (applicationType !== "chapter" && applicationType !== "association") {
      return NextResponse.json({ error: "Invalid application type" }, { status: 400 });
    }

    // Insert recommendation
    const adminUserId = (session.user as { id?: number }).id ?? null;

    await sql/* sql */`
      INSERT INTO public.leadership_recommendations
        (application_id, application_type, original_role, recommended_role, chapter_or_association_name, recommended_by)
      VALUES
        (${applicationId}, ${applicationType}, ${originalRole}, ${recommendedRole}, ${chapterOrAssociationName || null}, ${adminUserId})
    `;

    // Send recommendation email
    if (alumniEmail && alumniName) {
      const tpl = generateAdminActionEmail({
        actionType: EMAIL_ACTION_TYPE.LEADERSHIP_RECOMMENDATION,
        alumniName,
      });

      const orgName = chapterOrAssociationName || (applicationType === "chapter" ? "your selected chapter" : "the Alumni Association");
      const emailHtml = tpl.html
        .replaceAll("{RECOMMENDED_ROLE}", roleDisplayName(recommendedRole))
        .replaceAll("{ORG}", orgName);

      await sendEmail({
        to: alumniEmail,
        subject: tpl.subject,
        html: emailHtml,
      });
    }

    await logAdminAction({
      session,
      req,
      input: {
        action: "leadership.recommend",
        entityType: applicationType === "chapter" ? "chapter_leadership" : "tblalumniassociation",
        entityId: applicationId,
        metadata: { originalRole, recommendedRole, chapterOrAssociationName, alumniName },
      },
    });

    return NextResponse.json({ success: true, message: "Recommendation created and email sent" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create recommendation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Update alumni response or assign role
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action, recommendationId } = body as {
      action?: "mark_accepted" | "mark_declined" | "assign";
      recommendationId?: number;
    };

    if (!action || !recommendationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch the recommendation
    const recRows = await sql/* sql */`
      SELECT * FROM public.leadership_recommendations WHERE id = ${recommendationId} LIMIT 1
    `;
    if (!recRows || recRows.length === 0) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    const rec = recRows[0] as Record<string, unknown>;

    if (action === "mark_accepted") {
      await sql/* sql */`
        UPDATE public.leadership_recommendations
        SET alumni_response = 'accepted', updated_at = NOW()
        WHERE id = ${recommendationId}
      `;

      await logAdminAction({
        session,
        req,
        input: {
          action: "leadership.recommend.mark_accepted",
          entityType: "leadership_recommendations",
          entityId: recommendationId,
        },
      });

      return NextResponse.json({ success: true, message: "Marked as accepted" });
    }

    if (action === "mark_declined") {
      await sql/* sql */`
        UPDATE public.leadership_recommendations
        SET alumni_response = 'declined', updated_at = NOW()
        WHERE id = ${recommendationId}
      `;

      await logAdminAction({
        session,
        req,
        input: {
          action: "leadership.recommend.mark_declined",
          entityType: "leadership_recommendations",
          entityId: recommendationId,
        },
      });

      return NextResponse.json({ success: true, message: "Marked as declined" });
    }

    if (action === "assign") {
      // Ensure alumni has accepted
      if (String(rec.alumni_response) !== "accepted") {
        return NextResponse.json({ error: "Cannot assign: alumni has not accepted the recommendation" }, { status: 400 });
      }
      if (rec.assigned === true) {
        return NextResponse.json({ error: "Already assigned" }, { status: 400 });
      }

      const applicationType = String(rec.application_type);
      const applicationId = Number(rec.application_id);
      const recommendedRole = String(rec.recommended_role);

      if (applicationType === "chapter") {
        // Update chapter_leadership post and status
        await sql/* sql */`
          UPDATE public.chapter_leadership
          SET post = ${roleDisplayName(recommendedRole)},
              status = 'approved',
              updated_at = NOW()
          WHERE id = ${applicationId}
        `;

        // Get alumni id from the application
        const clRows = await sql/* sql */`
          SELECT alumniid FROM public.chapter_leadership WHERE id = ${applicationId} LIMIT 1
        `;
        if (clRows && clRows.length > 0) {
          const alumniId = Number((clRows[0] as { alumniid: number }).alumniid);
          // Link to tbl_alumni
          await sql/* sql */`
            UPDATE public.tbl_alumni
            SET chapter_leadership = ${applicationId}
            WHERE alumniid = ${alumniId}
          `;
        }
      } else if (applicationType === "association") {
        // Update tblalumniassociation role and status
        await sql/* sql */`
          UPDATE public.tblalumniassociation
          SET q3 = ${roleDisplayName(recommendedRole)},
              status = 'approved'
          WHERE id = ${applicationId}
        `;

        // Get alumni id from the application
        const aaRows = await sql/* sql */`
          SELECT alumni_id FROM public.tblalumniassociation WHERE id = ${applicationId} LIMIT 1
        `;
        if (aaRows && aaRows.length > 0) {
          const alumniId = Number((aaRows[0] as { alumni_id: number }).alumni_id);
          // Link to tbl_alumni
          await sql/* sql */`
            UPDATE public.tbl_alumni
            SET association_job = ${applicationId}
            WHERE alumniid = ${alumniId}
          `;
        }
      }

      // Mark recommendation as assigned
      await sql/* sql */`
        UPDATE public.leadership_recommendations
        SET assigned = true, updated_at = NOW()
        WHERE id = ${recommendationId}
      `;

      await logAdminAction({
        session,
        req,
        input: {
          action: "leadership.recommend.assign",
          entityType: applicationType === "chapter" ? "chapter_leadership" : "tblalumniassociation",
          entityId: applicationId,
          metadata: { recommendationId, recommendedRole },
        },
      });

      return NextResponse.json({ success: true, message: "Role assigned successfully" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process recommendation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
