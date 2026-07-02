import { NextResponse } from "next/server";
import {
  storyServerSchema,
  type ServerStoryPayload,
  normalizeStoryStatus,
  isStoryOwner,
} from "@/lib/alumniStories";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { sendSuccessStoryEmail } from "@/lib/email";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { canModify } from "@/lib/alumniProfile";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { sanitizeStoryHtml, storyHtmlTextContent } from "@/lib/sanitizeStoryHtml";

type StoryItem = {
  id: string;
  date: string;
  title: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
  status: string;
  rejectionReason: string | null;
};

type StoryRow = {
  id: number;
  alumniid: number;
  alumnistories: string | null;
  story_image: string | null;
  status: string | null;
  rejection_reason: string | null;
  createdat: string | null;
  storytitle: string | null;
  alumniname: string | null;
  degreetitle: string | null;
  academicsession: string | null;
  image1: string | null;
};

function mapStoryRow(r: StoryRow): StoryItem {
  return {
    id: String(r.id ?? ""),
    date: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString(),
    title: String(r.storytitle ?? r.alumniname ?? ""),
    name: String(r.alumniname ?? ""),
    program: String(r.degreetitle ?? ""),
    session: String(r.academicsession ?? ""),
    shortDescription: String(r.alumnistories ?? ""),
    imageUrl: String(r.story_image ?? r.image1 ?? ""),
    status: normalizeStoryStatus(r.status),
    rejectionReason: r.rejection_reason ?? null,
  };
}

const BASE_WHERE = sql`
  s.alumnistories IS NOT NULL
  AND s.alumnistories != ''
  AND TRIM(s.alumnistories) != ''
  AND LENGTH(TRIM(REGEXP_REPLACE(s.alumnistories, '<[^>]+>', '', 'g'))) > 0
  AND COALESCE(a.alumniname, '') != ''
`;

export async function GET(req: Request) {
  try {
    const session = await auth();
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");

    const userType = session?.user
      ? String((session.user as { type?: string })?.type || "")
          .toLowerCase()
          .trim()
      : "";
    const isAlumni = userType === "alumni";
    const isStaff = Boolean(session?.user && !isAlumni);

    let alumniIdFilter: ReturnType<typeof sql> | null = null;
    if (isAlumni && session?.user) {
      const userSapid = (session.user as { sapid?: string | null })?.sapid
        ? String((session.user as { sapid?: string | null }).sapid).trim()
        : null;
      const userEmail = session.user.email ? String(session.user.email) : null;

      if (userSapid) {
        const sapRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni
          WHERE sapid = ${userSapid}
          LIMIT 1
        `;
        if (sapRows[0]) {
          const alumniId = Number((sapRows[0] as { alumniid: number }).alumniid);
          alumniIdFilter = sql` AND s.alumniid = ${alumniId}`;
        }
      }

      if (!alumniIdFilter && userEmail) {
        const emailRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni
          WHERE personalemail = ${userEmail} OR officialemail = ${userEmail} OR universityemail = ${userEmail}
          ORDER BY alumniid DESC
          LIMIT 1
        `;
        if (emailRows[0]) {
          const alumniId = Number((emailRows[0] as { alumniid: number }).alumniid);
          alumniIdFilter = sql` AND s.alumniid = ${alumniId}`;
        }
      }

      if (!alumniIdFilter) {
        return NextResponse.json({ items: [] }, { status: 200 });
      }
    }

    const accessFilter = isAlumni
      ? { hasFilter: false, sql: null }
      : await buildAccessFilterSQL(session, "");
    const accessFilterCondition =
      accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    let statusCondition = sql``;
    if (!isAlumni && !isStaff) {
      statusCondition = sql` AND LOWER(COALESCE(s.status, 'pending')) = 'approved'`;
    } else if (isStaff && statusFilter && statusFilter !== "all") {
      const normalized =
        statusFilter === "notApproved" || statusFilter === "not-approved" || statusFilter === "not approved"
          ? "not-approved"
          : statusFilter.toLowerCase();
      statusCondition = sql` AND LOWER(COALESCE(s.status, 'pending')) = ${normalized}`;
    }

    const rows = await retryDbOperation(
      async () =>
        await sql/* sql */`
      SELECT
        s.id,
        s.alumniid,
        s.alumnistories,
        s.story_image,
        s.status,
        s.rejection_reason,
        s.createdat,
        s.storytitle,
        a.alumniname,
        a.degreetitle,
        a.academicsession,
        a.image1
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE ${BASE_WHERE}
        ${alumniIdFilter || sql``}
        ${accessFilterCondition}
        ${statusCondition}
      ORDER BY s.createdat DESC NULLS LAST
      LIMIT 200` as StoryRow[]
    );

    const items = rows.map(mapStoryRow);

    let counts: { pending: number; approved: number; notApproved: number } | undefined;
    if (isStaff) {
      const countRows = await sql/* sql */`
        SELECT LOWER(COALESCE(s.status, 'pending')) AS status, COUNT(*)::int AS count
        FROM public.tblalumnistories s
        INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
        WHERE ${BASE_WHERE}
          ${accessFilterCondition}
        GROUP BY LOWER(COALESCE(s.status, 'pending'))
      ` as Array<{ status: string; count: number }>;

      counts = { pending: 0, approved: 0, notApproved: 0 };
      for (const row of countRows) {
        const s = String(row.status || "").toLowerCase();
        if (s === "approved") counts.approved = Number(row.count || 0);
        else if (s === "not-approved" || s === "not approved") counts.notApproved = Number(row.count || 0);
        else counts.pending += Number(row.count || 0);
      }
    }

    return NextResponse.json({ items, ...(counts ? { counts } : {}) }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch stories";
    const isConnectionError =
      err instanceof Error &&
      (err.message.includes("CONNECT_TIMEOUT") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("timeout") ||
        (err as Error & { code?: string }).code === "CONNECT_TIMEOUT" ||
        (err as Error & { code?: string }).code === "ETIMEDOUT");

    if (isConnectionError) {
      return NextResponse.json(
        {
          items: [],
          error: "Database connection timeout. Please try again in a moment.",
          retryable: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ items: [], error: msg }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let v: ServerStoryPayload;
    let storyImageFilename: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const sapId = String(formData.get("sapId") || "");
      const name = String(formData.get("name") || "");
      const email = String(formData.get("email") || "");
      const faculty = String(formData.get("faculty") || "");
      const department = String(formData.get("department") || "");
      const passingYear = formData.get("passingYear") ? Number(formData.get("passingYear")) : null;
      const contactNumber = formData.get("contactNumber") ? String(formData.get("contactNumber")) : null;
      const storyTitle = String(formData.get("storyTitle") || "");
      const storyHtml = String(formData.get("storyHtml") || "");
      const imageFile = formData.get("storyImage") as File | null;

      if (imageFile && imageFile.size > 0) {
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json(
            { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." },
            { status: 400 }
          );
        }

        const maxSize = 5 * 1024 * 1024;
        if (imageFile.size > maxSize) {
          return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
        }

        const timestamp = Date.now();
        const extension = imageFile.name.split(".").pop() || "jpg";
        const baseFilename = `story-${timestamp}.${extension}`;
        storyImageFilename = baseFilename.length > 50 ? baseFilename.slice(0, 50) : baseFilename;

        const uploadsDir = join(process.cwd(), "public", "images");
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }

        const filePath = join(uploadsDir, storyImageFilename);
        const bytes = await imageFile.arrayBuffer();
        await writeFile(filePath, Buffer.from(bytes));
      }

      const parsed = storyServerSchema.safeParse({
        sapId,
        name,
        email,
        faculty,
        department,
        passingYear,
        contactNumber,
        storyTitle,
        storyHtml,
      });
      if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed", issues: parsed.error.format() }, { status: 422 });
      }
      v = parsed.data;
    } else {
      const body = await req.json();
      const parsed = storyServerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { message: "Validation failed", issues: parsed.error.format(), received: body },
          { status: 422 }
        );
      }
      v = parsed.data;
    }

    const cleanHtml = sanitizeStoryHtml(v.storyHtml);
    const textContent = storyHtmlTextContent(v.storyHtml);
    if (!textContent || textContent.length === 0) {
      return NextResponse.json(
        { message: "Story content is required and cannot be empty after sanitization" },
        { status: 400 }
      );
    }

    const alumniRows = (await sql/* sql */`
      SELECT alumniid, sapid, personalemail, universityemail, officialemail
      FROM public.tbl_alumni WHERE sapid = ${v.sapId} LIMIT 1`) as Array<{
      alumniid: number;
      sapid: string | null;
      personalemail: string | null;
      universityemail: string | null;
      officialemail: string | null;
    }>;
    const alumniId = alumniRows[0]?.alumniid;
    if (!alumniId) {
      return NextResponse.json({ message: "SAP ID not found in tbl_alumni" }, { status: 404 });
    }

    const isAdmin = canModify(session.user);
    const owner = isStoryOwner(session.user, alumniRows[0]);

    if (!isAdmin && !owner) {
      return NextResponse.json({ error: "Forbidden: You can only create stories for your own profile" }, { status: 403 });
    }

    if (isAdmin) {
      const accessFilter = await buildAccessFilterSQL(session, "");
      if (accessFilter.hasFilter && accessFilter.sql) {
        const accessCheck = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni
          WHERE alumniid = ${alumniId}
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
    }

    if (v.contactNumber) {
      await sql/* sql */`
        UPDATE public.tbl_alumni
        SET contactno = ${v.contactNumber}
        WHERE alumniid = ${alumniId}`;
    }

    const storyStatus = isAdmin && !owner ? "approved" : "pending";
    const reviewerId = isAdmin && !owner ? (session.user as { userId?: number })?.userId ?? null : null;

    try {
      await sql/* sql */`
        INSERT INTO public.tblalumnistories (
          alumniid, alumnistories, story_image, status, createdat, storytitle,
          rejection_reason, reviewed_by, reviewed_at
        )
        VALUES (
          ${alumniId}, ${cleanHtml}, ${storyImageFilename}, ${storyStatus}, NOW(), ${v.storyTitle},
          NULL, ${reviewerId}, ${isAdmin && !owner ? sql`NOW()` : null}
        )
        RETURNING id`;
    } catch (dbError) {
      return NextResponse.json(
        {
          message: "Failed to save story to database",
          error: dbError instanceof Error ? dbError.message : "Unknown database error",
          details:
            process.env.NODE_ENV === "development"
              ? dbError instanceof Error
                ? dbError.stack
                : undefined
              : undefined,
        },
        { status: 500 }
      );
    }

    try {
      const emailRows = await sql/* sql */`
        SELECT alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;
      const alumni = emailRows[0] as {
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      } | undefined;

      if (alumni) {
        const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
        const alumniName = alumni.alumniname || "Alumni";
        if (alumniEmail && storyStatus === "pending") {
          sendSuccessStoryEmail(alumniEmail, alumniName).catch(() => {});
        }
      }
    } catch {
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        ok: true,
        alumniid: alumniId,
        message: storyStatus === "approved" ? "Story published successfully" : "Story submitted for review",
        status: storyStatus,
      },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    const statusCode =
      err instanceof Error && msg.includes("Unauthorized")
        ? 401
        : err instanceof Error && msg.includes("Forbidden")
          ? 403
          : err instanceof Error && msg.includes("not found")
            ? 404
            : 400;
    return NextResponse.json(
      { message: msg, error: err instanceof Error ? err.stack : undefined },
      { status: statusCode }
    );
  }
}
