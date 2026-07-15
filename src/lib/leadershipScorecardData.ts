import { sql } from "@/lib/dbconnect";
import type { Session } from "next-auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isAdminUser, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { normalizeObtainedMark } from "@/lib/leadershipMarks";
import { associationPostRoleCondition, chapterPostRoleCondition } from "@/lib/leadershipRoleSql";

export type BulkScorecardCriterion = {
  id: number;
  label: string;
  description: string | null;
  criterionScore: number | null;
};

export type BulkScorecardApplicant = {
  applicationId: number;
  name: string;
  degreeTitle: string | null;
  status: string;
  bonusMarks: number;
  marksByCriterionId: Record<number, number | null>;
};

export type BulkScorecardPayload = {
  role: "president" | "vice_president" | "coordinator";
  leadershipType: "chapter" | "association";
  generatedAt: string;
  categoryLabel?: string | null;
  criteria: {
    mandatory: BulkScorecardCriterion[];
    optional: BulkScorecardCriterion[];
  };
  applicants: BulkScorecardApplicant[];
};

const ROLE_LABELS: Record<BulkScorecardPayload["role"], string> = {
  president: "President",
  vice_president: "Vice President",
  coordinator: "Coordinator",
};

export function bulkScorecardRoleLabel(role: BulkScorecardPayload["role"]): string {
  return ROLE_LABELS[role] ?? role;
}

function mapCriterionRow(row: Record<string, unknown>): BulkScorecardCriterion {
  const scoreRaw = row.criterion_score;
  const scoreNum = Number(scoreRaw);
  return {
    id: Number(row.id),
    label: String(row.label ?? ""),
    description: row.description ? String(row.description) : null,
    criterionScore: Number.isFinite(scoreNum) && scoreNum > 0 ? normalizeObtainedMark(scoreNum) : null,
  };
}

export async function fetchBulkLeadershipScorecardPayload(input: {
  session: Session;
  role: BulkScorecardPayload["role"];
  type: BulkScorecardPayload["leadershipType"];
  nationalChapterId?: number | null;
  internationalChapterId?: number | null;
  associationId?: number | null;
}): Promise<BulkScorecardPayload> {
  const { session, role, type } = input;
  const nationalChapterId =
    input.nationalChapterId && Number.isFinite(input.nationalChapterId) && input.nationalChapterId > 0
      ? input.nationalChapterId
      : null;
  const internationalChapterId =
    input.internationalChapterId && Number.isFinite(input.internationalChapterId) && input.internationalChapterId > 0
      ? input.internationalChapterId
      : null;
  const associationId =
    input.associationId && Number.isFinite(input.associationId) && input.associationId > 0
      ? input.associationId
      : null;

  let categoryLabel: string | null = null;

  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAdmin = isAdminUser(session?.user);
  const isViewer = isViewerUser(session?.user);
  const shouldApplyFilter = !isSuperAdmin && !isAdmin;
  const accessFilter = shouldApplyFilter
    ? await buildAccessFilterSQL(session, "")
    : { sql: null, hasFilter: false };

  const criteriaRows = await sql/* sql */`
    SELECT
      c.id,
      c.label,
      c.description,
      c.criterion_score,
      c.is_mandatory,
      c.sort_order
    FROM public.leadership_roles lr
    JOIN public.leadership_role_criteria c ON c.role_id = lr.id
    WHERE lr.leadership_type = ${type}
      AND lr.role_name = ${role}
    ORDER BY c.sort_order ASC, c.id ASC
  `;

  const allCriteria = (criteriaRows as Array<Record<string, unknown>>).map(mapCriterionRow);
  const mandatory = allCriteria.filter((_, idx) =>
    Boolean((criteriaRows as Array<Record<string, unknown>>)[idx]?.is_mandatory)
  );
  const optional = allCriteria.filter((_, idx) =>
    !Boolean((criteriaRows as Array<Record<string, unknown>>)[idx]?.is_mandatory)
  );

  const applicants: BulkScorecardApplicant[] = [];

  if (type === "chapter") {
    const chapterId = nationalChapterId ?? internationalChapterId;
    if (chapterId) {
      const chapterMeta = await sql/* sql */`
        SELECT
          TRIM(COALESCE(c.national_chapter, '')) AS national_chapter,
          TRIM(COALESCE(c.international_chapter, '')) AS international_chapter
        FROM public.tblchapters c
        WHERE c.id = ${chapterId}
        LIMIT 1
      `;
      if (chapterMeta?.length) {
        const row = chapterMeta[0] as Record<string, unknown>;
        const national = String(row.national_chapter || "").trim();
        const international = String(row.international_chapter || "").trim();
        categoryLabel = national || international || null;
      }
    }

    const chapterCategoryCondition = nationalChapterId
      ? sql` AND cl.chapter_id = ${nationalChapterId} AND TRIM(COALESCE(ch.national_chapter, '')) <> ''`
      : internationalChapterId
        ? sql` AND cl.chapter_id = ${internationalChapterId} AND TRIM(COALESCE(ch.international_chapter, '')) <> ''`
        : sql``;

    const chapterRows = await sql/* sql */`
      SELECT
        cl.id as application_id,
        cl.status,
        a.alumniname,
        TRIM(COALESCE(a.degreetitle, '')) AS degreetitle,
        cl.bonus_marks
      FROM public.chapter_leadership cl
      LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
      LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
      WHERE 1=1
        ${chapterPostRoleCondition(role)}
        ${chapterCategoryCondition}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = cl.alumniid
                AND (${accessFilter.sql})
            )`
          : sql``}
      ORDER BY a.alumniname ASC NULLS LAST, cl.id ASC
    `;

    const applicationIds = (chapterRows as Array<Record<string, unknown>>).map((r) =>
      Number(r.application_id)
    );

    const marksByApplication = new Map<number, Record<number, number | null>>();
    if (applicationIds.length > 0) {
      const marksRows = await sql/* sql */`
        SELECT chapter_application_id, criterion_id, obtained_marks
        FROM public.leadership_criteria_confirmations
        WHERE leadership_type = 'chapter'
          AND chapter_application_id = ANY(${applicationIds})
          AND actor_type = 'admin'
      `;
      for (const m of marksRows as Array<Record<string, unknown>>) {
        const appId = Number(m.chapter_application_id);
        if (!marksByApplication.has(appId)) marksByApplication.set(appId, {});
        const map = marksByApplication.get(appId)!;
        const criterionId = Number(m.criterion_id);
        const raw = m.obtained_marks;
        map[criterionId] =
          raw != null && raw !== "" && Number.isFinite(Number(raw))
            ? normalizeObtainedMark(Number(raw))
            : null;
      }
    }

    for (const row of chapterRows as Array<Record<string, unknown>>) {
      const applicationId = Number(row.application_id);
      const bonusRaw = Number(row.bonus_marks);
      const degreeRaw = String(row.degreetitle ?? "").trim();
      applicants.push({
        applicationId,
        name: String(row.alumniname ?? "Unknown"),
        degreeTitle: degreeRaw || null,
        status: String(row.status ?? "pending"),
        bonusMarks: Number.isFinite(bonusRaw) && bonusRaw >= 0 ? normalizeObtainedMark(bonusRaw) : 0,
        marksByCriterionId: marksByApplication.get(applicationId) ?? {},
      });
    }
  } else {
    if (associationId) {
      const assocMeta = await sql/* sql */`
        SELECT TRIM(COALESCE(f.faculty_name, '')) AS association_name
        FROM public.tbl_faculties f
        WHERE f.id = ${associationId}
        LIMIT 1
      `;
      if (assocMeta?.length) {
        categoryLabel = String((assocMeta[0] as Record<string, unknown>).association_name || "").trim() || null;
      }
    }

    const associationFilterCondition = associationId ? sql` AND ass.association_id = ${associationId}` : sql``;

    const associationRows = await sql/* sql */`
      SELECT
        ass.id as application_id,
        ass.status,
        a.alumniname,
        TRIM(COALESCE(a.degreetitle, '')) AS degreetitle,
        ass.bonus_marks
      FROM public.tblalumniassociation ass
      LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
      WHERE 1=1
        ${associationPostRoleCondition(role)}
        ${associationFilterCondition}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = ass.alumni_id
                AND (${accessFilter.sql})
            )`
          : sql``}
      ORDER BY a.alumniname ASC NULLS LAST, ass.id ASC
    `;

    const applicationIds = (associationRows as Array<Record<string, unknown>>).map((r) =>
      Number(r.application_id)
    );

    const marksByApplication = new Map<number, Record<number, number | null>>();
    if (applicationIds.length > 0) {
      const marksRows = await sql/* sql */`
        SELECT association_application_id, criterion_id, obtained_marks
        FROM public.leadership_criteria_confirmations
        WHERE leadership_type = 'association'
          AND association_application_id = ANY(${applicationIds})
          AND actor_type = 'admin'
      `;
      for (const m of marksRows as Array<Record<string, unknown>>) {
        const appId = Number(m.association_application_id);
        if (!marksByApplication.has(appId)) marksByApplication.set(appId, {});
        const map = marksByApplication.get(appId)!;
        const criterionId = Number(m.criterion_id);
        const raw = m.obtained_marks;
        map[criterionId] =
          raw != null && raw !== "" && Number.isFinite(Number(raw))
            ? normalizeObtainedMark(Number(raw))
            : null;
      }
    }

    for (const row of associationRows as Array<Record<string, unknown>>) {
      const applicationId = Number(row.application_id);
      const bonusRaw = Number(row.bonus_marks);
      const degreeRaw = String(row.degreetitle ?? "").trim();
      applicants.push({
        applicationId,
        name: String(row.alumniname ?? "Unknown"),
        degreeTitle: degreeRaw || null,
        status: String(row.status ?? "pending"),
        bonusMarks: Number.isFinite(bonusRaw) && bonusRaw >= 0 ? normalizeObtainedMark(bonusRaw) : 0,
        marksByCriterionId: marksByApplication.get(applicationId) ?? {},
      });
    }
  }

  return {
    role,
    leadershipType: type,
    generatedAt: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    categoryLabel,
    criteria: { mandatory, optional },
    applicants,
  };
}
