import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";
import { normalizeObtainedMark } from "@/lib/leadershipMarks";

function parseCriterionObtainedMarks(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k);
    if (!Number.isFinite(id) || id <= 0) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out[id] = normalizeObtainedMark(n);
  }
  return out;
}

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
    const { action, applicationId, type, adminCriteriaIds, optionalCriteriaProficiency, criterionObtainedMarks: criterionObtainedMarksBody, assessmentRemarks, unapprovalRemarks, strategyAssessmentMarks, achievementAssessmentMarks } = body as {
      action?: "assessment" | "approve" | "unapprove" | "delete" | "reject";
      applicationId?: number;
      type?: "chapter" | "association";
      adminCriteriaIds?: unknown;
      optionalCriteriaProficiency?: unknown;
      criterionObtainedMarks?: unknown;
      assessmentRemarks?: unknown;
      unapprovalRemarks?: unknown;
      strategyAssessmentMarks?: unknown;
      achievementAssessmentMarks?: unknown;
    }; // action: "approve" | "reject" | "delete", type: "chapter" | "association"
    // For backward compatibility, some clients may still send `rejectionReason`.

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

    const optionalCriteriaProficiencyObj =
      optionalCriteriaProficiency && typeof optionalCriteriaProficiency === "object"
        ? (optionalCriteriaProficiency as Record<string, unknown>)
        : null;

    const normalizedOptionalCriteriaProficiency = optionalCriteriaProficiencyObj
      ? Object.fromEntries(
          Object.entries(optionalCriteriaProficiencyObj)
            .map(([k, v]) => {
              const id = Number(k);
              const rating = Number(v);
              if (!Number.isFinite(id) || id <= 0) return null;
              if (!Number.isFinite(rating) || rating < 1) return null;
              const normalized = Math.min(5, Math.max(1, Math.round(rating)));
              return [String(id), normalized] as const;
            })
            .filter(Boolean) as Array<readonly [string, number]>
        )
      : null;

    const hasOptionalCriteriaProficiencyField = typeof optionalCriteriaProficiency !== "undefined";
    const optionalCriteriaProficiencyJson = hasOptionalCriteriaProficiencyField
      ? normalizedOptionalCriteriaProficiency && Object.keys(normalizedOptionalCriteriaProficiency).length > 0
        ? JSON.stringify(normalizedOptionalCriteriaProficiency)
        : null
      : undefined;

    const optionalCriteriaProficiencyJsonValue = optionalCriteriaProficiencyJson ?? null;

    const assessmentRemarksValue = typeof assessmentRemarks === "string" ? assessmentRemarks.trim() : null;
    const unapprovalRemarksValue = typeof unapprovalRemarks === "string" ? unapprovalRemarks.trim() : null;
    const strategyAssessmentMarksValue = Number(strategyAssessmentMarks);
    const achievementAssessmentMarksValue = Number(achievementAssessmentMarks);
    const hasValidStrategyMarks =
      Number.isFinite(strategyAssessmentMarksValue) && strategyAssessmentMarksValue >= 0 && strategyAssessmentMarksValue <= 15;
    const hasValidAchievementMarks =
      Number.isFinite(achievementAssessmentMarksValue) && achievementAssessmentMarksValue >= 0 && achievementAssessmentMarksValue <= 10;
    const bonusMarksValue = hasValidStrategyMarks && hasValidAchievementMarks
      ? normalizeObtainedMark(strategyAssessmentMarksValue + achievementAssessmentMarksValue)
      : NaN;
    const adminUserId = (session.user as any)?.userId ?? (session.user as any)?.id ?? null;

    if (type === "chapter") {
      // First, verify the application exists
      const appRecord = await sql/* sql */`
        SELECT id, post, status FROM public.chapter_leadership
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

      if (action === "approve" || action === "assessment") {
        const currentStatus = String((appRecord[0] as { status?: unknown })?.status ?? "pending").toLowerCase();

        // Approve only after assessment is completed.
        if (action === "approve") {
          if (currentStatus !== "assessed") {
            return NextResponse.json({ error: "Cannot approve: application must be assessed first." }, { status: 400 });
          }

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
        }

        // Assessment/re-assessment is allowed for pending or already assessed applications.
        if (currentStatus !== "pending" && currentStatus !== "assessed") {
          return NextResponse.json({ error: "Cannot assess: application must be pending or assessed." }, { status: 400 });
        }
        if (!hasValidStrategyMarks) {
          return NextResponse.json({ error: "Strategy & Planning marks must be between 0 and 15." }, { status: 400 });
        }
        if (!hasValidAchievementMarks) {
          return NextResponse.json({ error: "Additional Achievements marks must be between 0 and 10." }, { status: 400 });
        }
        if (!Number.isFinite(bonusMarksValue) || bonusMarksValue > 25) {
          return NextResponse.json({ error: "Bonus marks total must be between 0 and 25." }, { status: 400 });
        }

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

        const optionalRatedCriterionIds = normalizedOptionalCriteriaProficiency
          ? Object.keys(normalizedOptionalCriteriaProficiency)
              .map((k) => Number(k))
              .filter((n) => Number.isFinite(n) && n > 0)
          : [];

        const adminIdsToConfirm = Array.from(new Set([...confirmedAdminIds, ...optionalRatedCriterionIds]));

        const scoreRowsChapter = await sql/* sql */`
          SELECT c.id, c.criterion_score
          FROM public.leadership_roles r
          JOIN public.leadership_role_criteria c ON c.role_id = r.id
          WHERE r.leadership_type = 'chapter'
            AND r.role_name = ${roleName}
        `;

        if (!scoreRowsChapter || (Array.isArray(scoreRowsChapter) && scoreRowsChapter.length === 0)) {
          return NextResponse.json({ error: "Cannot assess: no criteria configured for this role." }, { status: 400 });
        }

        const criterionScoreByIdChapter = new Map<number, number>();
        for (const row of scoreRowsChapter ?? []) {
          const rec = row as Record<string, unknown>;
          const id = Number(rec.id);
          if (!Number.isFinite(id) || id <= 0) continue;
          const cs = Number(rec.criterion_score);
          criterionScoreByIdChapter.set(id, Number.isFinite(cs) ? cs : NaN);
        }

        const criterionObtainedMarks = parseCriterionObtainedMarks(criterionObtainedMarksBody);

        for (const cid of adminIdsToConfirm) {
          const maxScore = criterionScoreByIdChapter.get(cid) ?? NaN;
          if (Number.isFinite(maxScore) && maxScore >= 1) {
            const m = criterionObtainedMarks[cid];
            if (m === undefined) {
              return NextResponse.json(
                {
                  error:
                    "Cannot approve: enter obtained marks for each scored criterion (from 0 up to the criterion maximum).",
                },
                { status: 400 }
              );
            }
            if (m < 0 || m > maxScore) {
              return NextResponse.json(
                { error: `Cannot approve: obtained marks must be between 0 and ${maxScore} for each criterion.` },
                { status: 400 }
              );
            }
          }
        }

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
              AND COALESCE(response, CASE WHEN confirmed = true THEN 'YES' ELSE NULL END) IN ('YES','NO')
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
        }

        if (adminIdsToConfirm.length > 0) {
          await sql/* sql */`
            INSERT INTO public.leadership_criteria_confirmations (
              leadership_type,
              chapter_application_id,
              criterion_id,
              actor_type,
              confirmed,
              response,
              created_at
            )
            SELECT
              'chapter',
              ${Number(applicationId)},
              c.id,
              'admin',
              true,
              'YES',
              NOW()
            FROM public.leadership_role_criteria c
            WHERE c.id = ANY(${adminIdsToConfirm}::bigint[])
            ON CONFLICT (chapter_application_id, criterion_id, actor_type)
            DO UPDATE SET confirmed = EXCLUDED.confirmed, response = EXCLUDED.response
          `;
        }

        for (const cid of adminIdsToConfirm) {
          const maxScore = criterionScoreByIdChapter.get(cid) ?? NaN;
          if (!Number.isFinite(maxScore) || maxScore < 1) continue;
          const m = criterionObtainedMarks[cid];
          if (!Number.isFinite(m)) continue;
          await sql/* sql */`
            UPDATE public.leadership_criteria_confirmations
            SET obtained_marks = ${m}
            WHERE leadership_type = 'chapter'
              AND chapter_application_id = ${Number(applicationId)}
              AND criterion_id = ${cid}
              AND actor_type = 'admin'
          `;
        }

        // Update status to 'assessed'
        // Backward compatibility: assessment_remarks/assessed_* columns may not exist yet.
        const [hasAssessmentRemarksCol, hasAssessedByCol, hasAssessedAtCol] = await Promise.all([
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'chapter_leadership'
              AND column_name = 'assessment_remarks'
            LIMIT 1
          `,
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'chapter_leadership'
              AND column_name = 'assessed_by'
            LIMIT 1
          `,
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'chapter_leadership'
              AND column_name = 'assessed_at'
            LIMIT 1
          `,
        ]);

        const canStoreAssessmentFields = Boolean(hasAssessmentRemarksCol?.[0]) && Boolean(hasAssessedByCol?.[0]) && Boolean(hasAssessedAtCol?.[0]);

        if (canStoreAssessmentFields) {
          await sql/* sql */`
            UPDATE public.chapter_leadership
            SET status = 'assessed',
                updated_at = NOW(),
                rejection_reason = NULL,
                assessment_remarks = ${assessmentRemarksValue},
                assessed_by = ${adminUserId},
                assessed_at = NOW(),
                strategy_assessment_marks = ${normalizeObtainedMark(strategyAssessmentMarksValue)},
                achievement_assessment_marks = ${normalizeObtainedMark(achievementAssessmentMarksValue)},
                bonus_marks = ${bonusMarksValue}
                ${hasOptionalCriteriaProficiencyField ? sql`, optional_criteria_proficiency = ${optionalCriteriaProficiencyJsonValue}` : sql``}
            WHERE id = ${Number(applicationId)}
          `;
        } else {
          await sql/* sql */`
            UPDATE public.chapter_leadership
            SET status = 'assessed',
                updated_at = NOW(),
                rejection_reason = NULL,
                strategy_assessment_marks = ${normalizeObtainedMark(strategyAssessmentMarksValue)},
                achievement_assessment_marks = ${normalizeObtainedMark(achievementAssessmentMarksValue)},
                bonus_marks = ${bonusMarksValue}
                ${hasOptionalCriteriaProficiencyField ? sql`, optional_criteria_proficiency = ${optionalCriteriaProficiencyJsonValue}` : sql``}
            WHERE id = ${Number(applicationId)}
          `;
        }

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.assess",
            entityType: "chapter_leadership",
            entityId: Number(applicationId),
            metadata: { type: "chapter", alumniId },
          },
        });

        return NextResponse.json({ success: true, message: "Application assessed successfully" });
      } else if (action === "unapprove" || action === "reject") {
        // Only assessed applications can be unapproved.
        const currentStatus = String((appRecord[0] as { status?: unknown })?.status ?? "pending").toLowerCase();
        if (currentStatus !== "assessed") {
          return NextResponse.json({ error: "Cannot unapprove: application must be assessed first." }, { status: 400 });
        }

        const rejectionReason =
          unapprovalRemarksValue ?? (typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : null);

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
            action: "leadership.unapprove",
            entityType: "chapter_leadership",
            entityId: Number(applicationId),
            metadata: { type: "chapter", alumniId, rejectionReason },
          },
        });

        return NextResponse.json({ success: true, message: "Application unapproved successfully" });
      }
    } else if (type === "association") {
      // First, verify the application exists
      const appRecord = await sql/* sql */`
        SELECT id, q3, status FROM public.tblalumniassociation
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

      if (action === "approve" || action === "assessment") {
        const currentStatus = String((appRecord[0] as { status?: unknown })?.status ?? "pending").toLowerCase();

        // Approve only after assessment is completed.
        if (action === "approve") {
          if (currentStatus !== "assessed") {
            return NextResponse.json({ error: "Cannot approve: application must be assessed first." }, { status: 400 });
          }

          await sql/* sql */`
            UPDATE public.tblalumniassociation
            SET status = 'approved',
                rejection_reason = NULL
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
        }

        // Assessment/re-assessment is allowed for pending or already assessed applications.
        if (currentStatus !== "pending" && currentStatus !== "assessed") {
          return NextResponse.json({ error: "Cannot assess: application must be pending or assessed." }, { status: 400 });
        }
        if (!hasValidStrategyMarks) {
          return NextResponse.json({ error: "Strategy & Planning marks must be between 0 and 15." }, { status: 400 });
        }
        if (!hasValidAchievementMarks) {
          return NextResponse.json({ error: "Additional Achievements marks must be between 0 and 10." }, { status: 400 });
        }
        if (!Number.isFinite(bonusMarksValue) || bonusMarksValue > 25) {
          return NextResponse.json({ error: "Bonus marks total must be between 0 and 25." }, { status: 400 });
        }

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

        const optionalRatedCriterionIds = normalizedOptionalCriteriaProficiency
          ? Object.keys(normalizedOptionalCriteriaProficiency)
              .map((k) => Number(k))
              .filter((n) => Number.isFinite(n) && n > 0)
          : [];

        const adminIdsToConfirm = Array.from(new Set([...confirmedAdminIds, ...optionalRatedCriterionIds]));

        const scoreRowsAssoc = await sql/* sql */`
          SELECT c.id, c.criterion_score
          FROM public.leadership_roles r
          JOIN public.leadership_role_criteria c ON c.role_id = r.id
          WHERE r.leadership_type = 'association'
            AND r.role_name = ${roleName}
        `;

        if (!scoreRowsAssoc || (Array.isArray(scoreRowsAssoc) && scoreRowsAssoc.length === 0)) {
          return NextResponse.json({ error: "Cannot assess: no criteria configured for this role." }, { status: 400 });
        }

        const criterionScoreByIdAssoc = new Map<number, number>();
        for (const row of scoreRowsAssoc ?? []) {
          const rec = row as Record<string, unknown>;
          const id = Number(rec.id);
          if (!Number.isFinite(id) || id <= 0) continue;
          const cs = Number(rec.criterion_score);
          criterionScoreByIdAssoc.set(id, Number.isFinite(cs) ? cs : NaN);
        }

        const criterionObtainedMarksAssoc = parseCriterionObtainedMarks(criterionObtainedMarksBody);

        for (const cid of adminIdsToConfirm) {
          const maxScore = criterionScoreByIdAssoc.get(cid) ?? NaN;
          if (Number.isFinite(maxScore) && maxScore >= 1) {
            const m = criterionObtainedMarksAssoc[cid];
            if (m === undefined) {
              return NextResponse.json(
                {
                  error:
                    "Cannot approve: enter obtained marks for each scored criterion (from 0 up to the criterion maximum).",
                },
                { status: 400 }
              );
            }
            if (m < 0 || m > maxScore) {
              return NextResponse.json(
                { error: `Cannot approve: obtained marks must be between 0 and ${maxScore} for each criterion.` },
                { status: 400 }
              );
            }
          }
        }

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
        }

        if (adminIdsToConfirm.length > 0) {
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
            WHERE c.id = ANY(${adminIdsToConfirm}::bigint[])
            ON CONFLICT (association_application_id, criterion_id, actor_type)
            DO UPDATE SET confirmed = EXCLUDED.confirmed
          `;
        }

        for (const cid of adminIdsToConfirm) {
          const maxScore = criterionScoreByIdAssoc.get(cid) ?? NaN;
          if (!Number.isFinite(maxScore) || maxScore < 1) continue;
          const m = criterionObtainedMarksAssoc[cid];
          if (!Number.isFinite(m)) continue;
          await sql/* sql */`
            UPDATE public.leadership_criteria_confirmations
            SET obtained_marks = ${m}
            WHERE leadership_type = 'association'
              AND association_application_id = ${Number(applicationId)}
              AND criterion_id = ${cid}
              AND actor_type = 'admin'
          `;
        }

        // Update status to 'assessed'
        // Backward compatibility: assessment_remarks/assessed_* and rejection_reason columns may not exist yet.
        const [hasAssocAssessmentRemarksCol, hasAssocAssessedByCol, hasAssocAssessedAtCol, hasAssocRejectionReasonCol] = await Promise.all([
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'tblalumniassociation'
              AND column_name = 'assessment_remarks'
            LIMIT 1
          `,
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'tblalumniassociation'
              AND column_name = 'assessed_by'
            LIMIT 1
          `,
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'tblalumniassociation'
              AND column_name = 'assessed_at'
            LIMIT 1
          `,
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'tblalumniassociation'
              AND column_name = 'rejection_reason'
            LIMIT 1
          `,
        ]);

        const canStoreAssessmentFields = Boolean(hasAssocAssessmentRemarksCol?.[0]) && Boolean(hasAssocAssessedByCol?.[0]) && Boolean(hasAssocAssessedAtCol?.[0]);

        if (canStoreAssessmentFields) {
          await sql/* sql */`
            UPDATE public.tblalumniassociation
            SET status = 'assessed'
                ${hasOptionalCriteriaProficiencyField ? sql`, optional_criteria_proficiency = ${optionalCriteriaProficiencyJsonValue}` : sql``}
                ${hasAssocRejectionReasonCol?.[0] ? sql`, rejection_reason = NULL` : sql``}
                , assessment_remarks = ${assessmentRemarksValue},
                assessed_by = ${adminUserId},
                assessed_at = NOW(),
                strategy_assessment_marks = ${normalizeObtainedMark(strategyAssessmentMarksValue)},
                achievement_assessment_marks = ${normalizeObtainedMark(achievementAssessmentMarksValue)},
                bonus_marks = ${bonusMarksValue}
            WHERE id = ${Number(applicationId)}
          `;
        } else {
          await sql/* sql */`
            UPDATE public.tblalumniassociation
            SET status = 'assessed'
                ${hasOptionalCriteriaProficiencyField ? sql`, optional_criteria_proficiency = ${optionalCriteriaProficiencyJsonValue}` : sql``}
                ${hasAssocRejectionReasonCol?.[0] ? sql`, rejection_reason = NULL` : sql``}
                , strategy_assessment_marks = ${normalizeObtainedMark(strategyAssessmentMarksValue)}
                , achievement_assessment_marks = ${normalizeObtainedMark(achievementAssessmentMarksValue)}
                , bonus_marks = ${bonusMarksValue}
            WHERE id = ${Number(applicationId)}
          `;
        }

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.assess",
            entityType: "tblalumniassociation",
            entityId: Number(applicationId),
            metadata: { type: "association", alumniId },
          },
        });

        return NextResponse.json({ success: true, message: "Application assessed successfully" });
      } else if (action === "unapprove" || action === "reject") {
        // Only assessed applications can be unapproved.
        const currentStatus = String((appRecord[0] as { status?: unknown })?.status ?? "pending").toLowerCase();
        if (currentStatus !== "assessed") {
          return NextResponse.json({ error: "Cannot unapprove: application must be assessed first." }, { status: 400 });
        }

        const rejectionReason =
          unapprovalRemarksValue ?? (typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : null);

        // Update status to 'rejected' (do NOT link to tbl_alumni)
        const [hasAssocRejectionReasonCol] = await Promise.all([
          sql/* sql */`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'tblalumniassociation'
              AND column_name = 'rejection_reason'
            LIMIT 1
          `,
        ]);

        if (hasAssocRejectionReasonCol?.[0]) {
          await sql/* sql */`
            UPDATE public.tblalumniassociation
            SET status = 'rejected',
                rejection_reason = ${rejectionReason}
            WHERE id = ${Number(applicationId)}
          `;
        } else {
          await sql/* sql */`
            UPDATE public.tblalumniassociation
            SET status = 'rejected'
            WHERE id = ${Number(applicationId)}
          `;
        }

        await logAdminAction({
          session,
          req,
          input: {
            action: "leadership.unapprove",
            entityType: "tblalumniassociation",
            entityId: Number(applicationId),
            metadata: { type: "association", alumniId, rejectionReason },
          },
        });

        return NextResponse.json({ success: true, message: "Application unapproved successfully" });
      }
    }

    return NextResponse.json({ error: "Invalid action or type" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to perform action";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

