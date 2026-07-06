import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { handleCorsPreflight, addCorsHeaders } from "@/lib/cors";
import {
  EXTERNAL_SUCCESS_STORY_BASE_WHERE,
  EXTERNAL_SUCCESS_STORY_ORDER_COLUMNS,
  EXTERNAL_SUCCESS_STORY_SELECT,
  mapExternalSuccessStoryListItem,
  type ExternalSuccessStoryRow,
} from "@/lib/alumniStoriesPublic";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

/**
 * GET /api/external/success-stories
 * Approved alumni success stories for external consumers (e.g. shareholder portals).
 *
 * Query: page (default 1), limit (default 20, max 100), orderBy (createdat|storytitle|id), order (asc|desc), search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const orderByParam = searchParams.get("orderBy") || "createdat";
    const orderParam = searchParams.get("order") || "desc";
    const search = searchParams.get("search")?.trim() || "";

    if (page < 1 || limit < 1 || limit > 100) {
      const response = NextResponse.json(
        { data: null, error: "Invalid pagination parameters. Page must be >= 1 and limit must be 1–100." },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const orderColumn =
      EXTERNAL_SUCCESS_STORY_ORDER_COLUMNS[orderByParam] ??
      EXTERNAL_SUCCESS_STORY_ORDER_COLUMNS.createdat;
    const order = orderParam.toLowerCase() === "asc" ? "ASC" : "DESC";
    const offset = (page - 1) * limit;

    const searchCondition = search
      ? sql`
          AND (
            COALESCE(s.storytitle, '') ILIKE ${`%${search}%`}
            OR COALESCE(a.alumniname, '') ILIKE ${`%${search}%`}
            OR COALESCE(a.degreetitle, '') ILIKE ${`%${search}%`}
            OR COALESCE(a.academicsession, '') ILIKE ${`%${search}%`}
            OR COALESCE(f.faculty_name, a.facultyname, '') ILIKE ${`%${search}%`}
            OR COALESCE(d.department_name, a.departmentname, '') ILIKE ${`%${search}%`}
          )`
      : sql``;

    const countRows = await sql/* sql */`
      SELECT COUNT(*)::int AS total
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      WHERE ${EXTERNAL_SUCCESS_STORY_BASE_WHERE}
        ${searchCondition}
    `;
    const total = Number((countRows[0] as { total?: number } | undefined)?.total ?? 0);

    const rows = await sql/* sql */`
      ${EXTERNAL_SUCCESS_STORY_SELECT}
      WHERE ${EXTERNAL_SUCCESS_STORY_BASE_WHERE}
        ${searchCondition}
      ORDER BY ${sql.unsafe(orderColumn)} ${sql.unsafe(order)} NULLS LAST
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const data = (rows as unknown as ExternalSuccessStoryRow[]).map((row) =>
      mapExternalSuccessStoryListItem(request, row)
    );

    const response = NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      error: null,
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    const response = NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
