import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildIdBasedAccessFilterSQL } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// GET - List all distinguished alumni
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    const faculty = searchParams.getAll("faculty");
    const department = searchParams.getAll("department");
    const program = searchParams.getAll("program");

    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql`1 = 0`;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };

    // RBAC filter (new). Superadmin => no filter (includes NULL). Admin/viewer =>
    // - if all faculties assigned => no filter (includes NULL)
    // - else restricted to assigned faculty/department/program (excludes NULL)
    const access = await buildIdBasedAccessFilterSQL(session, {
      alias: "d",
      facultyColumn: "faculty_id",
      departmentColumn: "department_id",
      programColumn: "program_id",
    });
    const accessFilter = access.sql ? sql`AND (${access.sql})` : sql``;

    // Faculty/Department/Program master filters (ID-based)
    let facultyFilter = sql``;
    if (faculty && faculty.length > 0) {
      const conditions = faculty.map((f) => {
        const normalized = String(f).trim();
        if (normalized === "NULL" || normalized === "null") return sql`(d.faculty_id IS NULL)`;
        const id = Number.parseInt(normalized, 10);
        if (Number.isNaN(id)) return sql`1 = 0`;
        return sql`(d.faculty_id = ${id})`;
      });
      facultyFilter = sql`AND (${combineOrConditions(conditions)})`;
    }

    let departmentFilter = sql``;
    if (department && department.length > 0) {
      const conditions = department.map((dept) => {
        const normalized = String(dept).trim();
        if (normalized === "NULL" || normalized === "null") return sql`(d.department_id IS NULL)`;
        const id = Number.parseInt(normalized, 10);
        if (Number.isNaN(id)) return sql`1 = 0`;
        return sql`(d.department_id = ${id})`;
      });
      departmentFilter = sql`AND (${combineOrConditions(conditions)})`;
    }

    let programFilter = sql``;
    if (program && program.length > 0) {
      const conditions = program.map((prog) => {
        const normalized = String(prog).trim();
        if (normalized === "NULL" || normalized === "null") return sql`(d.program_id IS NULL)`;
        const id = Number.parseInt(normalized, 10);
        if (Number.isNaN(id)) return sql`1 = 0`;
        return sql`(d.program_id = ${id})`;
      });
      programFilter = sql`AND (${combineOrConditions(conditions)})`;
    }

    let query;
    let countQuery;

    if (search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      query = sql/* sql */`
        SELECT 
          d.*,
          f.faculty_name as faculty_name,
          dept.department_name as department_name,
          prog.program_name as program_name
        FROM public.distinguished_alumni d
        LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
        LEFT JOIN public.tbl_departments dept ON d.department_id = dept.id
        LEFT JOIN public.tbl_programs prog ON d.program_id = prog.id
        WHERE (
          LOWER(name) LIKE ${searchTerm}
          OR LOWER(slug) LIKE ${searchTerm}
          OR LOWER(role) LIKE ${searchTerm}
          OR LOWER(summary) LIKE ${searchTerm}
          OR LOWER(headline) LIKE ${searchTerm}
        )
        ${accessFilter}
        ${facultyFilter}
        ${departmentFilter}
        ${programFilter}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countQuery = sql/* sql */`
        SELECT COUNT(*) as total
        FROM public.distinguished_alumni d
        WHERE (
          LOWER(name) LIKE ${searchTerm}
          OR LOWER(slug) LIKE ${searchTerm}
          OR LOWER(role) LIKE ${searchTerm}
          OR LOWER(summary) LIKE ${searchTerm}
          OR LOWER(headline) LIKE ${searchTerm}
        )
        ${accessFilter}
        ${facultyFilter}
        ${departmentFilter}
        ${programFilter}
      `;
    } else {
      query = sql/* sql */`
        SELECT 
          d.*,
          f.faculty_name as faculty_name,
          dept.department_name as department_name,
          prog.program_name as program_name
        FROM public.distinguished_alumni d
        LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
        LEFT JOIN public.tbl_departments dept ON d.department_id = dept.id
        LEFT JOIN public.tbl_programs prog ON d.program_id = prog.id
        WHERE 1=1
        ${accessFilter}
        ${facultyFilter}
        ${departmentFilter}
        ${programFilter}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      countQuery = sql/* sql */`
        SELECT COUNT(*) as total
        FROM public.distinguished_alumni d
        WHERE 1=1
        ${accessFilter}
        ${facultyFilter}
        ${departmentFilter}
        ${programFilter}
      `;
    }

    const [rows, countResult] = await Promise.all([query, countQuery]);
    const total = Number(countResult[0]?.total || 0);

    // Parse JSONB fields if they're strings (PostgreSQL sometimes returns JSONB as strings)
    const parsedRows = rows.map((row: any) => {
      const parsed: any = { ...row };
      
      // Parse JSONB fields if they're strings
      if (typeof parsed.tags === 'string') {
        try {
          parsed.tags = JSON.parse(parsed.tags);
        } catch (e) {
          parsed.tags = [];
        }
      }
      if (typeof parsed.stats === 'string') {
        try {
          parsed.stats = JSON.parse(parsed.stats);
        } catch (e) {
          parsed.stats = null;
        }
      }
      if (typeof parsed.achievements === 'string') {
        try {
          parsed.achievements = JSON.parse(parsed.achievements);
        } catch (e) {
          parsed.achievements = [];
        }
      }
      if (typeof parsed.story === 'string') {
        try {
          parsed.story = JSON.parse(parsed.story);
        } catch (e) {
          parsed.story = [];
        }
      }
      
      return parsed;
    });

    return NextResponse.json({
      items: parsedRows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }, { status: 200 });
  } catch (error) {

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch distinguished alumni" },
      { status: 500 }
    );
  }
}

// POST - Create new distinguished alumni
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if request is FormData (for image upload) or JSON
    const contentType = request.headers.get("content-type") || "";
    let slug: string;
    let name: string;
    let image: string | null = null;
    let role: string;
    let summary: string;
    let headline: string | null = null;
    let quote: string | null = null;
    let quote_by: string | null = null;
    let tags: any[] = [];
    let stats: any = null;
    let achievements: any[] = [];
    let story: any[] = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle FormData with image upload
      const formData = await request.formData();
      
      slug = String(formData.get("slug") || "").trim();
      name = String(formData.get("name") || "").trim();
      role = String(formData.get("role") || "").trim();
      summary = String(formData.get("summary") || "").trim();
      headline = formData.get("headline") ? String(formData.get("headline")).trim() : null;
      quote = formData.get("quote") ? String(formData.get("quote")).trim() : null;
      quote_by = formData.get("quote_by") ? String(formData.get("quote_by")).trim() : null;
      
      // Parse JSON fields
      const tagsStr = formData.get("tags");
      if (tagsStr) {
        try {
          tags = JSON.parse(String(tagsStr));
        } catch (e) {
          tags = [];
        }
      }
      
      const statsStr = formData.get("stats");
      if (statsStr) {
        try {
          stats = JSON.parse(String(statsStr));
        } catch (e) {
          stats = null;
        }
      }
      
      const achievementsStr = formData.get("achievements");
      if (achievementsStr) {
        try {
          achievements = JSON.parse(String(achievementsStr));
        } catch (e) {
          achievements = [];
        }
      }
      
      const storyStr = formData.get("story");
      if (storyStr) {
        try {
          story = JSON.parse(String(storyStr));
        } catch (e) {
          story = [];
        }
      }

      // Handle image upload
      const imageFile = formData.get("image") as File | null;
      if (imageFile && imageFile.size > 0) {
        // Validate file type
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json({ 
            error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." 
          }, { status: 400 });
        }
        
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (imageFile.size > maxSize) {
          return NextResponse.json({ 
            error: "File size exceeds 5MB limit" 
          }, { status: 400 });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const extension = imageFile.name.split(".").pop() || "jpg";
        const filename = `distinguished-${timestamp}-${randomSuffix}.${extension}`;
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), "public", "images");
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }
        
        // Save file
        const filePath = join(uploadsDir, filename);
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);
        
        // Save just the filename to database
        image = filename;

      } else {
        return NextResponse.json(
          { error: "Image is required" },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON (backward compatibility)
      const body = await request.json();
      slug = body.slug;
      name = body.name;
      image = body.image;
      role = body.role;
      summary = body.summary;
      headline = body.headline || null;
      quote = body.quote || null;
      quote_by = body.quote_by || null;
      tags = body.tags || [];
      stats = body.stats || null;
      achievements = body.achievements || [];
      story = body.story || [];
    }

    // Validation
    if (!slug || !name || !image || !role || !summary) {
      return NextResponse.json(
        { error: "Missing required fields: slug, name, image, role, summary" },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await sql/* sql */`
      SELECT id FROM public.distinguished_alumni
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Slug already exists. Please use a unique slug." },
        { status: 400 }
      );
    }

    // Insert new record
    const result = await sql/* sql */`
      INSERT INTO public.distinguished_alumni (
        slug, name, image, role, summary, headline, quote, quote_by,
        tags, stats, achievements, story, created_at, updated_at
      ) VALUES (
        ${slug},
        ${name},
        ${image},
        ${role},
        ${summary},
        ${headline || null},
        ${quote || null},
        ${quote_by || null},
        ${tags ? JSON.stringify(tags) : JSON.stringify([])},
        ${stats ? JSON.stringify(stats) : JSON.stringify([])},
        ${achievements ? JSON.stringify(achievements) : JSON.stringify([])},
        ${story ? JSON.stringify(story) : JSON.stringify([])},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    // Parse JSONB fields if they're strings
    const row = result[0] as any;
    const parsed: any = { ...row };
    
    if (typeof parsed.tags === 'string') {
      try {
        parsed.tags = JSON.parse(parsed.tags);
      } catch (e) {
        parsed.tags = [];
      }
    }
    if (typeof parsed.stats === 'string') {
      try {
        parsed.stats = JSON.parse(parsed.stats);
      } catch (e) {
        parsed.stats = null;
      }
    }
    if (typeof parsed.achievements === 'string') {
      try {
        parsed.achievements = JSON.parse(parsed.achievements);
      } catch (e) {
        parsed.achievements = [];
      }
    }
    if (typeof parsed.story === 'string') {
      try {
        parsed.story = JSON.parse(parsed.story);
      } catch (e) {
        parsed.story = [];
      }
    }

    return NextResponse.json({ item: parsed }, { status: 201 });
  } catch (error) {

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create distinguished alumni" },
      { status: 500 }
    );
  }
}