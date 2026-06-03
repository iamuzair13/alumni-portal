import { sql } from "@/lib/dbconnect";
import type { Session } from "next-auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isAdminUser, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { normalizeObtainedMark } from "@/lib/leadershipMarks";

export type LeadershipScorecardCriterion = {
  label: string;
  obtainedMarks: number | null;
  totalMarks: number | null;
};

export type LeadershipScorecardPayload = {
  applicationId: number;
  leadershipType: "chapter" | "association";
  status: string;
  applicant: {
    name: string;
    membershipNumber: string;
    sapId: string;
    registrationNo: string | null;
    email: string;
    faculty: string | null;
    department: string | null;
    program: string | null;
  };
  position: string;
  applicationTypeLabel: string;
  categoryName: string | null;
  applicationDate: string | null;
  assessmentDate: string | null;
  assessedByName: string | null;
  assessedByEmail: string | null;
  criteria: LeadershipScorecardCriterion[];
  planStrategy: string | null;
  additionalAchievements: string | null;
  strategyAssessmentMarks: number;
  achievementAssessmentMarks: number;
  bonusMarks: number;
  assessmentRemarks: string | null;
};

function inferRoleNameFromPosition(position: string): "president" | "vice_president" | "coordinator" {
  const s = String(position || "").toLowerCase();
  if (s.includes("vice")) return "vice_president";
  if (s.includes("coordinator")) return "coordinator";
  return "president";
}

function formatDisplayDate(value: unknown): string | null {
  if (!value) return null;
  try {
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  } catch {
    return null;
  }
}

function categoryLabel(type: "chapter" | "association", categoryType: string | null, categoryName: string | null): string {
  if (type === "association") return categoryName ? `Association — ${categoryName}` : "Association";
  const t = String(categoryType || "").toLowerCase();
  const name = String(categoryName || "").trim();
  if (t === "national") return name ? `National Chapter — ${name}` : "National Chapter";
  if (t === "international") return name ? `International Chapter — ${name}` : "International Chapter";
  return name || "Chapter";
}

const assessorNameSql = sql`NULLIF(TRIM(CONCAT(COALESCE(assessor.firstname, ''), ' ', COALESCE(assessor.lastname, ''))), '') as assessor_name`;

export async function fetchLeadershipScorecardPayload(input: {
  session: Session;
  type: "chapter" | "association";
  applicationId: number;
  isAlumniSelfService?: boolean;
}): Promise<LeadershipScorecardPayload | null> {
  const { session, type, applicationId } = input;
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAdmin = isAdminUser(session?.user);
  const isViewer = isViewerUser(session?.user);
  const isStaff = isSuperAdmin || isAdmin || isViewer;
  const isAlumni = !isStaff || Boolean(input.isAlumniSelfService);

  const sessionAlumniIdRaw = (session.user as { userId?: number | null })?.userId;
  const sessionAlumniId =
    sessionAlumniIdRaw && Number.isFinite(Number(sessionAlumniIdRaw)) ? Number(sessionAlumniIdRaw) : null;

  const shouldApplyFilter = !isAlumni && !isSuperAdmin && !isAdmin;
  const accessFilter = shouldApplyFilter
    ? await buildAccessFilterSQL(session, "")
    : { sql: null, hasFilter: false };

  if (type === "chapter") {
    const [hasAssessedByCol, hasAssessedAtCol, hasAssessmentRemarksCol] = await Promise.all([
      sql/* sql */`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chapter_leadership' AND column_name = 'assessed_by'
        LIMIT 1
      `,
      sql/* sql */`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chapter_leadership' AND column_name = 'assessed_at'
        LIMIT 1
      `,
      sql/* sql */`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chapter_leadership' AND column_name = 'assessment_remarks'
        LIMIT 1
      `,
    ]);
    const chapterAssessedAtSelect = hasAssessedAtCol?.[0] ? sql`cl.assessed_at` : sql`NULL::timestamptz as assessed_at`;
    const chapterAssessmentRemarksSelect = hasAssessmentRemarksCol?.[0]
      ? sql`cl.assessment_remarks`
      : sql`NULL::text as assessment_remarks`;
    const chapterAssessorJoin =
      hasAssessedByCol?.[0]
        ? sql`LEFT JOIN public.users assessor ON assessor.id = cl.assessed_by`
        : sql``;
    const chapterAssessorSelect = hasAssessedByCol?.[0]
      ? sql`${assessorNameSql}, assessor.email as assessor_email`
      : sql`NULL::text as assessor_name, NULL::text as assessor_email`;

    const rows = await sql/* sql */`
      SELECT
        cl.id as application_id,
        cl.post,
        cl.status,
        cl.created_at,
        ${chapterAssessedAtSelect},
        ${chapterAssessmentRemarksSelect},
        cl.plan_strategy,
        cl.additional_achievements,
        cl.strategy_assessment_marks,
        cl.achievement_assessment_marks,
        cl.bonus_marks,
        ch.national_chapter,
        ch.international_chapter,
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.alumniname,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        f.faculty_name as facultyname,
        d.department_name as departmentname,
        p.program_name as program_name,
        a.degreetitle,
        ${chapterAssessorSelect}
      FROM public.chapter_leadership cl
      LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
      ${chapterAssessorJoin}
      WHERE cl.id = ${applicationId}
        ${isAlumni && sessionAlumniId ? sql` AND cl.alumniid = ${sessionAlumniId}` : sql``}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = cl.alumniid
                AND (${accessFilter.sql})
            )`
          : sql``}
      LIMIT 1
    `;

    if (!rows?.length) return null;

    const r = rows[0] as Record<string, unknown>;
    const position = String(r.post ?? "");
    const roleName = inferRoleNameFromPosition(position);
    const categoryType = r.national_chapter ? "national" : r.international_chapter ? "international" : null;
    const categoryName = r.national_chapter
      ? String(r.national_chapter)
      : r.international_chapter
        ? String(r.international_chapter)
        : null;

    const criteriaRows = await sql/* sql */`
      SELECT
        c.label,
        c.criterion_score,
        ad.obtained_marks
      FROM public.leadership_roles lr
      JOIN public.leadership_role_criteria c ON c.role_id = lr.id
      LEFT JOIN public.leadership_criteria_confirmations ad
        ON ad.leadership_type = 'chapter'
       AND ad.chapter_application_id = ${applicationId}
       AND ad.criterion_id = c.id
       AND ad.actor_type = 'admin'
      WHERE lr.leadership_type = 'chapter'
        AND lr.role_name = ${roleName}
      ORDER BY c.sort_order ASC, c.id ASC
    `;

    const reg = r.registrationno ? String(r.registrationno) : null;
    const sap = String(r.sapid ?? "");

    return {
      applicationId,
      leadershipType: "chapter",
      status: String(r.status ?? "pending"),
      applicant: {
        name: String(r.alumniname ?? ""),
        membershipNumber: reg || sap || "-",
        sapId: sap,
        registrationNo: reg,
        email:
          (r.personalemail ? String(r.personalemail) : null) ||
          (r.officialemail ? String(r.officialemail) : null) ||
          (r.universityemail ? String(r.universityemail) : null) ||
          "",
        faculty: r.facultyname ? String(r.facultyname) : null,
        department: r.departmentname ? String(r.departmentname) : null,
        program: r.program_name ? String(r.program_name) : r.degreetitle ? String(r.degreetitle) : null,
      },
      position,
      applicationTypeLabel: categoryLabel("chapter", categoryType, categoryName),
      categoryName,
      applicationDate: formatDisplayDate(r.created_at),
      assessmentDate: formatDisplayDate(r.assessed_at),
      assessedByName: r.assessor_name ? String(r.assessor_name) : null,
      assessedByEmail: r.assessor_email ? String(r.assessor_email) : null,
      criteria: (criteriaRows as Array<Record<string, unknown>>).map((c) => {
        const max = Number(c.criterion_score);
        const obtainedRaw = c.obtained_marks;
        const hasMax = Number.isFinite(max) && max > 0;
        const obtained =
          obtainedRaw != null && obtainedRaw !== "" && Number.isFinite(Number(obtainedRaw))
            ? normalizeObtainedMark(Number(obtainedRaw))
            : null;
        return {
          label: String(c.label ?? ""),
          obtainedMarks: hasMax ? obtained : null,
          totalMarks: hasMax ? normalizeObtainedMark(max) : null,
        };
      }),
      planStrategy: r.plan_strategy ? String(r.plan_strategy) : null,
      additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
      strategyAssessmentMarks: Number.isFinite(Number(r.strategy_assessment_marks))
        ? normalizeObtainedMark(Number(r.strategy_assessment_marks))
        : 0,
      achievementAssessmentMarks: Number.isFinite(Number(r.achievement_assessment_marks))
        ? normalizeObtainedMark(Number(r.achievement_assessment_marks))
        : 0,
      bonusMarks: Number.isFinite(Number(r.bonus_marks))
        ? normalizeObtainedMark(Number(r.bonus_marks))
        : 0,
      assessmentRemarks: r.assessment_remarks ? String(r.assessment_remarks) : null,
    };
  }

  const [hasAssocAssessedByCol, hasAssocAssessedAtCol, hasAssocAssessmentRemarksCol] = await Promise.all([
    sql/* sql */`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblalumniassociation' AND column_name = 'assessed_by'
      LIMIT 1
    `,
    sql/* sql */`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblalumniassociation' AND column_name = 'assessed_at'
      LIMIT 1
    `,
    sql/* sql */`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblalumniassociation' AND column_name = 'assessment_remarks'
      LIMIT 1
    `,
  ]);
  const assocAssessedAtSelect = hasAssocAssessedAtCol?.[0] ? sql`ass.assessed_at` : sql`NULL::timestamp as assessed_at`;
  const assocAssessmentRemarksSelect = hasAssocAssessmentRemarksCol?.[0]
    ? sql`ass.assessment_remarks`
    : sql`NULL::text as assessment_remarks`;
  const assocAssessorJoin = hasAssocAssessedByCol?.[0]
    ? sql`LEFT JOIN public.users assessor ON assessor.id = ass.assessed_by`
    : sql``;
  const assocAssessorSelect = hasAssocAssessedByCol?.[0]
    ? sql`${assessorNameSql}, assessor.email as assessor_email`
    : sql`NULL::text as assessor_name, NULL::text as assessor_email`;

  const rows = await sql/* sql */`
    SELECT
      ass.id as application_id,
      ass.q3 as role,
      ass.status,
      ass.createddatetime,
      ${assocAssessedAtSelect},
      ${assocAssessmentRemarksSelect},
      ass.plan_strategy,
      ass.additional_achievements,
      ass.strategy_assessment_marks,
      ass.achievement_assessment_marks,
      ass.bonus_marks,
      fac.faculty_name as association_name,
      a.alumniid,
      a.sapid,
      a.registrationno,
      a.alumniname,
      a.personalemail,
      a.officialemail,
      a.universityemail,
      f.faculty_name as facultyname,
      d.department_name as departmentname,
      p.program_name as program_name,
      a.degreetitle,
      ${assocAssessorSelect}
    FROM public.tblalumniassociation ass
    LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
    LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
    LEFT JOIN public.tbl_departments d ON d.id = a.department
    LEFT JOIN public.tbl_programs p ON p.id = a.program
    LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
    ${assocAssessorJoin}
    WHERE ass.id = ${applicationId}
      ${isAlumni && sessionAlumniId ? sql` AND ass.alumni_id = ${sessionAlumniId}` : sql``}
      ${accessFilter.hasFilter && accessFilter.sql
        ? sql` AND EXISTS (
            SELECT 1 FROM public.tbl_alumni a_filter
            WHERE a_filter.alumniid = ass.alumni_id
              AND (${accessFilter.sql})
          )`
        : sql``}
    LIMIT 1
  `;

  if (!rows?.length) return null;

  const r = rows[0] as Record<string, unknown>;
  const position = String(r.role ?? "");
  const roleName = inferRoleNameFromPosition(position);
  const categoryName = r.association_name ? String(r.association_name) : null;

  const criteriaRows = await sql/* sql */`
    SELECT
      c.label,
      c.criterion_score,
      ad.obtained_marks
    FROM public.leadership_roles lr
    JOIN public.leadership_role_criteria c ON c.role_id = lr.id
    LEFT JOIN public.leadership_criteria_confirmations ad
      ON ad.leadership_type = 'association'
     AND ad.association_application_id = ${applicationId}
     AND ad.criterion_id = c.id
     AND ad.actor_type = 'admin'
    WHERE lr.leadership_type = 'association'
      AND lr.role_name = ${roleName}
    ORDER BY c.sort_order ASC, c.id ASC
  `;

  const reg = r.registrationno ? String(r.registrationno) : null;
  const sap = String(r.sapid ?? "");

  return {
    applicationId,
    leadershipType: "association",
    status: String(r.status ?? "pending"),
    applicant: {
      name: String(r.alumniname ?? ""),
      membershipNumber: reg || sap || "-",
      sapId: sap,
      registrationNo: reg,
      email:
        (r.personalemail ? String(r.personalemail) : null) ||
        (r.officialemail ? String(r.officialemail) : null) ||
        (r.universityemail ? String(r.universityemail) : null) ||
        "",
      faculty: r.facultyname ? String(r.facultyname) : null,
      department: r.departmentname ? String(r.departmentname) : null,
      program: r.program_name ? String(r.program_name) : r.degreetitle ? String(r.degreetitle) : null,
    },
    position,
    applicationTypeLabel: categoryLabel("association", "association", categoryName),
    categoryName,
    applicationDate: formatDisplayDate(r.createddatetime),
    assessmentDate: formatDisplayDate(r.assessed_at),
    assessedByName: r.assessor_name ? String(r.assessor_name) : null,
    assessedByEmail: r.assessor_email ? String(r.assessor_email) : null,
    criteria: (criteriaRows as Array<Record<string, unknown>>).map((c) => {
      const max = Number(c.criterion_score);
      const obtainedRaw = c.obtained_marks;
      const hasMax = Number.isFinite(max) && max > 0;
      const obtained =
        obtainedRaw != null && obtainedRaw !== "" && Number.isFinite(Number(obtainedRaw))
          ? normalizeObtainedMark(Number(obtainedRaw))
          : null;
      return {
        label: String(c.label ?? ""),
        obtainedMarks: hasMax ? obtained : null,
        totalMarks: hasMax ? normalizeObtainedMark(max) : null,
      };
    }),
    planStrategy: r.plan_strategy ? String(r.plan_strategy) : null,
    additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
    strategyAssessmentMarks: Number.isFinite(Number(r.strategy_assessment_marks))
      ? normalizeObtainedMark(Number(r.strategy_assessment_marks))
      : 0,
    achievementAssessmentMarks: Number.isFinite(Number(r.achievement_assessment_marks))
      ? normalizeObtainedMark(Number(r.achievement_assessment_marks))
      : 0,
    bonusMarks: Number.isFinite(Number(r.bonus_marks)) ? normalizeObtainedMark(Number(r.bonus_marks)) : 0,
    assessmentRemarks: r.assessment_remarks ? String(r.assessment_remarks) : null,
  };
}

export { computeScorecardTotals } from "@/lib/leadershipScorecardTotals";
