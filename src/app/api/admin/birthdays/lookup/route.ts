import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";

/**
 * GET /api/admin/birthdays/lookup?identifier=<sapid|registrationNo>
 * Admin-only lookup used by the Birthdays admin form — returns the
 * auto-fetched profile details for an alumni record.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSuperAdminUser(session.user) && !isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const identifier = request.nextUrl.searchParams.get("identifier")?.trim() || "";
    if (!identifier || identifier.length > 50) {
      return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT
        a.alumniid,
        a.alumniname,
        a.sapid,
        a.registrationno,
        a.degree_title,
        a.yearofending,
        a.image1,
        p.program_name,
        COALESCE(assoc.faculty_name, f.faculty_name) AS association_title,
        ac.chapter1,
        ac.chapter2,
        ac.chapter3
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      WHERE a.sapid = ${identifier}
         OR a.registrationno = ${identifier}
      LIMIT 1
    `;

    const r = rows?.[0] as Record<string, unknown> | undefined;
    if (!r) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const chapterIds = [r.chapter1, r.chapter2, r.chapter3]
      .map((v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null))
      .filter((v): v is number => v != null);

    let chapters: Array<{ id: number; title: string }> = [];
    if (chapterIds.length > 0) {
      const chRows = await sql/* sql */`
        SELECT id, COALESCE(national_chapter, international_chapter) AS title
        FROM public.tblchapters
        WHERE id = ANY(${chapterIds}::int[])
      `;
      chapters = (chRows as Record<string, unknown>[]).map((c) => ({
        id: Number(c.id),
        title: String(c.title ?? "").trim(),
      }));
    }

    return NextResponse.json(
      {
        found: true,
        alumni: {
          alumniId: Number(r.alumniid),
          name: String(r.alumniname ?? "").trim(),
          sapId: String(r.sapid ?? "").trim() || null,
          registrationNo: String(r.registrationno ?? "").trim() || null,
          program: String(r.degree_title ?? "").trim() || String(r.program_name ?? "").trim() || null,
          passingOutYear:
            r.yearofending != null && Number.isFinite(Number(r.yearofending))
              ? Number(r.yearofending)
              : null,
          association: String(r.association_title ?? "").trim() || null,
          chapters,
          image: String(r.image1 ?? "").trim() || null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
