import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";

// Approve, reject, or delete leadership applications
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and superadmin can perform actions
    if (!canModify(session.user)) {
      await logAdminAction({
        session,
        req,
        input: {
          action: "leadership.action",
          entityType: "leadership",
          success: false,
          errorMessage: "FORBIDDEN",
        },
      });
      return NextResponse.json({ error: "Forbidden: Only admins can perform this action" }, { status: 403 });
    }

    const body = await req.json();
    const { action, applicationId, type, adminCriteriaIds } = body as {
      action?: "approve" | "reject" | "delete";
      applicationId?: number;
      type?: "chapter" | "association";
      adminCriteriaIds?: unknown;
    }; // action: "approve" | "reject" | "delete", type: "chapter" | "association"
    // rejectionReason is accessed from body.rejectionReason when needed

    if (!action || !applicationId || !type) {
      await logAdminAction({
        session,
        req,
        input: {
          action: "leadership.action",
          entityType: "leadership",
          entityId: applicationId ?? null,
          success: false,
          errorMessage: "MISSING_REQUIRED_FIELDS",
          metadata: { action, type },
        },
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (type === "chapter") {
      // First, verify the application exists
      const appRecord = await sql/* sql */`
        SELECT id, post FROM public.chapter_leadership
        WHERE id = ${Number(applicationId)}
        LIMIT 1
      `;
      
      if (!appRecord || appRecord.length === 0) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      // For delete action, we don't need alumniId - just delete directly
      if (action === "delete") {
        // Check if application is linked to tbl_alumni (approved) or just pending
        const linkedCheck = await sql/* sql */`
          SELECT COUNT(*) as count FROM public.tbl_alumni
          WHERE chapter_leadership = ${Number(applicationId)}
        `;
        
        const isLinked = Number((linkedCheck[0] as { count: number }).count) > 0;
        
        // Remove link from tbl_alumni if exists (for approved applications)
        if (isLinked) {
          await sql/* sql */`
            UPDATE public.tbl_alumni
            SET chapter_leadership = NULL
            WHERE chapter_leadership = ${Number(applicationId)}
          `;
        }

        // Delete the chapter_leadership record (works for both pending and approved)
        await sql/* sql */`
          DELETE FROM public.chapter_leadership
          WHERE id = ${Number(applicationId)}
        `;

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.delete",
            entityType: "chapter_leadership",
            entityId: Number(applicationId),
            metadata: { type: "chapter" },
          },
        });

        return NextResponse.json({ success: true, message: "Application deleted successfully" });
      }

      // For approve/reject actions, we need alumniId
      let alumniId: number | null = null;

      // Get alumniid from the column (aligned with schema - column name is alumniid, not alumni_id)
      try {
        const recordWithAlumniId = await sql/* sql */`
          SELECT alumniid FROM public.chapter_leadership
          WHERE id = ${Number(applicationId)}
          LIMIT 1
        `;
        if (recordWithAlumniId && recordWithAlumniId.length > 0) {
          const rawAlumniId = (recordWithAlumniId[0] as { alumniid?: number | null }).alumniid;
          if (rawAlumniId !== null && rawAlumniId !== undefined) {
            alumniId = Number(rawAlumniId);
          }
        }
      } catch {
        // Column doesn't exist yet - will use fallback below

      }
      
      // Fallback: Find alumni by checking which alumni has this chapter_leadership linked
      // (This works for approved applications that are already linked)
      if (!alumniId || isNaN(alumniId)) {
        const linkedAlumni = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni
          WHERE chapter_leadership = ${Number(applicationId)}
          LIMIT 1
        `;
        if (linkedAlumni && linkedAlumni.length > 0) {
          alumniId = Number((linkedAlumni[0] as { alumniid: number }).alumniid);
        }
      }

      // If still no alumniId found, it's likely a pending application without the migration
      if (!alumniId || isNaN(alumniId)) {
        return NextResponse.json({ 
          error: "Cannot process application: Could not determine alumni ID. Please ensure the migration script (migrate-leadership-status.sql) has been run." 
        }, { status: 500 });
      }

      if (action === "approve") {
        const roleText = String((appRecord[0] as { post?: unknown }).post ?? "");
        const roleName = roleText.toLowerCase().includes("vice")
          ? "vice_president"
          : roleText.toLowerCase().includes("coordinator")
            ? "coordinator"
            : "president";

        const confirmedAdminIds = Array.isArray(adminCriteriaIds)
          ? Array.from(
              new Set(
                adminCriteriaIds
                  .map((x) => Number(x))
                  .filter((n) => Number.isFinite(n) && n > 0)
              )
            )
          : [];

        const mandatoryRows = await sql/* sql */`
          SELECT c.id
          FROM public.leadership_roles r
          JOIN public.leadership_role_criteria c ON c.role_id = r.id
          WHERE r.leadership_type = 'chapter'
            AND r.role_name = ${roleName}
            AND c.is_mandatory = true
        `;
        const mandatoryIds = (mandatoryRows ?? []).map((r: Record<string, unknown>) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);

        if (mandatoryIds.length > 0) {
          const alumniConfirmedRows = await sql/* sql */`
            SELECT criterion_id
            FROM public.leadership_criteria_confirmations
            WHERE leadership_type = 'chapter'
              AND chapter_application_id = ${Number(applicationId)}
              AND actor_type = 'alumni'
              AND confirmed = true
          `;
          const alumniConfirmed = (alumniConfirmedRows ?? [])
            .map((r: Record<string, unknown>) => Number(r.criterion_id))
            .filter((n) => Number.isFinite(n) && n > 0);
          const missingAlumni = mandatoryIds.filter((id) => !alumniConfirmed.includes(id));
          if (missingAlumni.length > 0) {
            return NextResponse.json(
              { error: "Cannot approve: alumni must resubmit the application and confirm all mandatory criteria." },
              { status: 400 }
            );
          }

          const missingAdmin = mandatoryIds.filter((id) => !confirmedAdminIds.includes(id));
          if (missingAdmin.length > 0) {
            return NextResponse.json(
              { error: "Cannot approve: please confirm all mandatory criteria." },
              { status: 400 }
            );
          }

          if (confirmedAdminIds.length > 0) {
            await sql/* sql */`
              INSERT INTO public.leadership_criteria_confirmations (
                leadership_type,
                chapter_application_id,
                criterion_id,
                actor_type,
                confirmed,
                created_at
              )
              SELECT
                'chapter',
                ${Number(applicationId)},
                c.id,
                'admin',
                true,
                NOW()
              FROM public.leadership_role_criteria c
              WHERE c.id = ANY(${confirmedAdminIds}::bigint[])
              ON CONFLICT (chapter_application_id, criterion_id, actor_type) DO NOTHING
            `;
          }
        }

        // Update status to 'approved' and link to tbl_alumni
        await sql/* sql */`
          UPDATE public.chapter_leadership
          SET status = 'approved',
              updated_at = NOW(),
              rejection_reason = NULL
          WHERE id = ${Number(applicationId)}
        `;

        // Link to tbl_alumni (only if not already linked)
        await sql/* sql */`
          UPDATE public.tbl_alumni
          SET chapter_leadership = ${Number(applicationId)}
          WHERE alumniid = ${alumniId}
            AND (chapter_leadership IS NULL OR chapter_leadership != ${Number(applicationId)})
        `;

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.approve",
            entityType: "chapter_leadership",
            entityId: Number(applicationId),
            metadata: { type: "chapter", alumniId },
          },
        });

        return NextResponse.json({ success: true, message: "Application approved successfully" });
      } else if (action === "reject") {
        // Get rejection reason from body if provided (body was already parsed above)
        const rejectionReason = body.rejectionReason || null;
        
        // Update status to 'rejected' (do NOT link to tbl_alumni)
        await sql/* sql */`
          UPDATE public.chapter_leadership
          SET status = 'rejected',
              rejection_reason = ${rejectionReason},
              updated_at = NOW()
          WHERE id = ${Number(applicationId)}
        `;

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.reject",
            entityType: "chapter_leadership",
            entityId: Number(applicationId),
            metadata: { type: "chapter", alumniId, rejectionReason },
          },
        });

        return NextResponse.json({ success: true, message: "Application rejected successfully" });
      }
    } else if (type === "association") {
      // First, verify the application exists
      const appRecord = await sql/* sql */`
        SELECT id, q3 FROM public.tblalumniassociation
        WHERE id = ${Number(applicationId)}
        LIMIT 1
      `;
      
      if (!appRecord || appRecord.length === 0) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      // For delete action, we don't need alumniId - just delete directly
      if (action === "delete") {
        // Check if application is linked to tbl_alumni (approved) or just pending
        const linkedCheck = await sql/* sql */`
          SELECT COUNT(*) as count FROM public.tbl_alumni
          WHERE association_job = ${Number(applicationId)}
        `;
        
        const isLinked = Number((linkedCheck[0] as { count: number }).count) > 0;
        
        // Remove link from tbl_alumni if exists (for approved applications)
        if (isLinked) {
          await sql/* sql */`
            UPDATE public.tbl_alumni
            SET association_job = NULL
            WHERE association_job = ${Number(applicationId)}
          `;
        }

        // Delete the tblalumniassociation record (works for both pending and approved)
        await sql/* sql */`
          DELETE FROM public.tblalumniassociation
          WHERE id = ${Number(applicationId)}
        `;

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.delete",
            entityType: "tblalumniassociation",
            entityId: Number(applicationId),
            metadata: { type: "association" },
          },
        });

        return NextResponse.json({ success: true, message: "Application deleted successfully" });
      }

      // For approve/reject actions, we need alumniId
      let alumniId: number | null = null;

      // Try to get alumni_id from the column (if migration has been run)
      try {
        const recordWithAlumniId = await sql/* sql */`
          SELECT alumni_id FROM public.tblalumniassociation
          WHERE id = ${Number(applicationId)}
          LIMIT 1
        `;
        if (recordWithAlumniId && recordWithAlumniId.length > 0) {
          const rawAlumniId = (recordWithAlumniId[0] as { alumni_id?: number | null }).alumni_id;
          if (rawAlumniId !== null && rawAlumniId !== undefined) {
            alumniId = Number(rawAlumniId);
          }
        }
      } catch {
        // Column doesn't exist yet - will use fallback below

      }
      
      // Fallback: Find alumni by checking which alumni has this association_job linked
      // (This works for approved applications that are already linked)
      if (!alumniId || isNaN(alumniId)) {
        const linkedAlumni = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni
          WHERE association_job = ${Number(applicationId)}
          LIMIT 1
        `;
        if (linkedAlumni && linkedAlumni.length > 0) {
          alumniId = Number((linkedAlumni[0] as { alumniid: number }).alumniid);
        }
      }

      // If still no alumniId found, it's likely a pending application without the migration
      if (!alumniId || isNaN(alumniId)) {
        return NextResponse.json({ 
          error: "Cannot process application: Could not determine alumni ID. Please ensure the migration script (migrate-leadership-status.sql) has been run." 
        }, { status: 500 });
      }

      if (action === "approve") {
        const roleText = String((appRecord[0] as { q3?: unknown }).q3 ?? "");
        const roleName = roleText.toLowerCase().includes("vice")
          ? "vice_president"
          : roleText.toLowerCase().includes("coordinator")
            ? "coordinator"
            : "president";

        const confirmedAdminIds = Array.isArray(adminCriteriaIds)
          ? Array.from(
              new Set(
                adminCriteriaIds
                  .map((x) => Number(x))
                  .filter((n) => Number.isFinite(n) && n > 0)
              )
            )
          : [];

        const mandatoryRows = await sql/* sql */`
          SELECT c.id
          FROM public.leadership_roles r
          JOIN public.leadership_role_criteria c ON c.role_id = r.id
          WHERE r.leadership_type = 'association'
            AND r.role_name = ${roleName}
            AND c.is_mandatory = true
        `;
        const mandatoryIds = (mandatoryRows ?? []).map((r: Record<string, unknown>) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);

        if (mandatoryIds.length > 0) {
          const alumniConfirmedRows = await sql/* sql */`
            SELECT criterion_id
            FROM public.leadership_criteria_confirmations
            WHERE leadership_type = 'association'
              AND association_application_id = ${Number(applicationId)}
              AND actor_type = 'alumni'
              AND confirmed = true
          `;
          const alumniConfirmed = (alumniConfirmedRows ?? [])
            .map((r: Record<string, unknown>) => Number(r.criterion_id))
            .filter((n) => Number.isFinite(n) && n > 0);
          const missingAlumni = mandatoryIds.filter((id) => !alumniConfirmed.includes(id));
          if (missingAlumni.length > 0) {
            return NextResponse.json(
              { error: "Cannot approve: alumni must resubmit the application and confirm all mandatory criteria." },
              { status: 400 }
            );
          }

          const missingAdmin = mandatoryIds.filter((id) => !confirmedAdminIds.includes(id));
          if (missingAdmin.length > 0) {
            return NextResponse.json(
              { error: "Cannot approve: please confirm all mandatory criteria." },
              { status: 400 }
            );
          }

          if (confirmedAdminIds.length > 0) {
            await sql/* sql */`
              INSERT INTO public.leadership_criteria_confirmations (
                leadership_type,
                association_application_id,
                criterion_id,
                actor_type,
                confirmed,
                created_at
              )
              SELECT
                'association',
                ${Number(applicationId)},
                c.id,
                'admin',
                true,
                NOW()
              FROM public.leadership_role_criteria c
              WHERE c.id = ANY(${confirmedAdminIds}::bigint[])
              ON CONFLICT (association_application_id, criterion_id, actor_type) DO NOTHING
            `;
          }
        }

        // Update status to 'approved' and link to tbl_alumni
        // Note: tblalumniassociation doesn't have updated_at or rejection_reason in schema
        await sql/* sql */`
          UPDATE public.tblalumniassociation
          SET status = 'approved'
          WHERE id = ${Number(applicationId)}
        `;

        // Link to tbl_alumni (only if not already linked)
        await sql/* sql */`
          UPDATE public.tbl_alumni
          SET association_job = ${Number(applicationId)}
          WHERE alumniid = ${alumniId}
            AND (association_job IS NULL OR association_job != ${Number(applicationId)})
        `;

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.approve",
            entityType: "tblalumniassociation",
            entityId: Number(applicationId),
            metadata: { type: "association", alumniId },
          },
        });

        return NextResponse.json({ success: true, message: "Application approved successfully" });
      } else if (action === "reject") {
        // Update status to 'rejected' (do NOT link to tbl_alumni)
        // Note: tblalumniassociation doesn't have rejection_reason or updated_at in schema
        await sql/* sql */`
          UPDATE public.tblalumniassociation
          SET status = 'rejected'
          WHERE id = ${Number(applicationId)}
        `;

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.reject",
            entityType: "tblalumniassociation",
            entityId: Number(applicationId),
            metadata: { type: "association", alumniId },
          },
        });

        return NextResponse.json({ success: true, message: "Application rejected successfully" });
      }
    }

    return NextResponse.json({ error: "Invalid action or type" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to perform action";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

