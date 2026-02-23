import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId) || jobId <= 0) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

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
        WHERE id = ${jobId}
        LIMIT 1
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
          WHERE id = ${jobId}
          LIMIT 1
        ` as unknown as typeof rows;
      } else {
        throw dbError;
      }
    }

    if (!rows[0]) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: rows[0].id,
      title: rows[0].title || "",
      category: rows[0].category || "",
      company: rows[0].company || "",
      companyEmail: rows[0].company_email || "",
      jobDescription: rows[0].job_description || "",
      deadline: rows[0].deadline || null,
      location: rows[0].location || "",
      jobLink: rows[0].job_link || "",
      createdAt: rows[0].created_at || null,
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId) || jobId <= 0) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
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

    // Update job
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
        UPDATE public.tbljobs
        SET
          title = ${String(title).trim()},
          category = ${category ? String(category).trim() : null},
          company = ${String(company).trim()},
          company_email = ${companyEmailValue},
          job_description = ${jobDescriptionValue},
          deadline = ${deadlineValue},
          location = ${location ? String(location).trim() : null},
          job_link = ${jobLink ? String(jobLink).trim() : null}
        WHERE id = ${jobId}
        RETURNING id, title, category, company, company_email, job_description, deadline, location, job_link, created_at
      ` as typeof rows;
    } catch (dbError) {
      if (dbError instanceof Error && (dbError.message.includes('column "company_email"') || dbError.message.includes('column "job_description"'))) {
        rows = await sql/* sql */`
          UPDATE public.tbljobs
          SET
            title = ${String(title).trim()},
            category = ${category ? String(category).trim() : null},
            company = ${String(company).trim()},
            deadline = ${deadlineValue},
            location = ${location ? String(location).trim() : null},
            job_link = ${jobLink ? String(jobLink).trim() : null}
          WHERE id = ${jobId}
          RETURNING id, title, category, company, deadline, location, job_link, created_at
        ` as unknown as typeof rows;
      } else {
        throw dbError;
      }
    }

    if (!rows[0]) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

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
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId) || jobId <= 0) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Delete job
    const rows = await sql/* sql */`
      DELETE FROM public.tbljobs
      WHERE id = ${jobId}
      RETURNING id
    ` as Array<{ id: number }>;

    if (!rows[0]) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
