import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    // Build search condition
    let searchCondition = sql``;
    if (search.trim()) {
      searchCondition = sql`AND (
        title ILIKE ${`%${search.trim()}%`} OR
        company ILIKE ${`%${search.trim()}%`} OR
        category ILIKE ${`%${search.trim()}%`} OR
        location ILIKE ${`%${search.trim()}%`}
      )`;
    }

    // Get total count
    const countRows = await sql/* sql */`
      SELECT COUNT(*) as total
      FROM public.tbljobs
      WHERE 1=1 ${searchCondition}
    ` as Array<{ total: number }>;
    
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    // Get jobs with pagination
    let rows: Array<{
      id: number;
      title: string | null;
      category: string | null;
      company: string | null;
      company_email?: string | null;
      job_description?: string | null;
      deadline: string | null;
      location: string | null;
      job_link: string | null;
      created_at: string | null;
    }>;

    try {
      rows = await sql/* sql */`
        SELECT 
          id,
          title,
          category,
          company,
          company_email,
          job_description,
          deadline,
          location,
          job_link,
          created_at
        FROM public.tbljobs
        WHERE 1=1 ${searchCondition}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as typeof rows;
    } catch (dbError) {
      if (dbError instanceof Error && (dbError.message.includes('column "company_email"') || dbError.message.includes('column "job_description"'))) {
        rows = await sql/* sql */`
          SELECT 
            id,
            title,
            category,
            company,
            deadline,
            location,
            job_link,
            created_at
          FROM public.tbljobs
          WHERE 1=1 ${searchCondition}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as unknown as typeof rows;
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        title: row.title || "",
        category: row.category || "",
        company: row.company || "",
        companyEmail: row.company_email || "",
        jobDescription: row.job_description || "",
        deadline: row.deadline || null,
        location: row.location || "",
        jobLink: row.job_link || "",
        createdAt: row.created_at || null,
      })),
      total,
      page,
      limit,
      totalPages,
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, category, company, companyEmail, deadline, location, jobLink, jobDescription } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!company || !company.trim()) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }

    const companyEmailValue = String(companyEmail || "").trim();
    if (!companyEmailValue) {
      return NextResponse.json({ error: "Company email is required" }, { status: 400 });
    }
    if (!isValidEmail(companyEmailValue)) {
      return NextResponse.json({ error: "Invalid company email" }, { status: 400 });
    }

    // Insert new job
    // Use deadline string directly (already in YYYY-MM-DD format from HTML date input)
    // Don't convert through Date object to avoid timezone issues
    const deadlineValue = deadline && deadline.trim() ? deadline.trim() : null;
    const jobDescriptionValue = jobDescription && String(jobDescription).trim() ? String(jobDescription).trim() : null;
    
    let rows: Array<{
      id: number;
      title: string | null;
      category: string | null;
      company: string | null;
      company_email?: string | null;
      job_description?: string | null;
      deadline: string | null;
      location: string | null;
      job_link: string | null;
      created_at: string | null;
    }>;

    try {
      rows = await sql/* sql */`
        INSERT INTO public.tbljobs (title, category, company, company_email, job_description, deadline, location, job_link, created_at)
        VALUES (
          ${String(title).trim()},
          ${category ? String(category).trim() : null},
          ${String(company).trim()},
          ${companyEmailValue},
          ${jobDescriptionValue},
          ${deadlineValue},
          ${location ? String(location).trim() : null},
          ${jobLink ? String(jobLink).trim() : null},
          now()
        )
        RETURNING id, title, category, company, company_email, job_description, deadline, location, job_link, created_at
      ` as typeof rows;
    } catch (dbError) {
      if (dbError instanceof Error && (dbError.message.includes('column "company_email"') || dbError.message.includes('column "job_description"'))) {
        rows = await sql/* sql */`
          INSERT INTO public.tbljobs (title, category, company, deadline, location, job_link, created_at)
          VALUES (
            ${String(title).trim()},
            ${category ? String(category).trim() : null},
            ${String(company).trim()},
            ${deadlineValue},
            ${location ? String(location).trim() : null},
            ${jobLink ? String(jobLink).trim() : null},
            now()
          )
          RETURNING id, title, category, company, deadline, location, job_link, created_at
        ` as unknown as typeof rows;
      } else {
        throw dbError;
      }
    }

    if (!rows[0]) {
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    await logAdminAction({ session, req: request, input: { action: "jobs.create", entityType: "tbljobs", entityId: rows[0].id, success: true, metadata: { jobId: rows[0].id, title: rows[0].title || "" } } });

    return NextResponse.json({
      id: rows[0].id,
      title: rows[0].title || "",
      category: rows[0].category || "",
      company: rows[0].company || "",
      companyEmail: rows[0].company_email || companyEmailValue,
      jobDescription: rows[0].job_description || "",
      deadline: rows[0].deadline || null,
      location: rows[0].location || "",
      jobLink: rows[0].job_link || "",
      createdAt: rows[0].created_at || null,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create job";
    await logAdminAction({ session: null, req: request, input: { action: "jobs.create", entityType: "tbljobs", success: false, errorMessage: message } }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
