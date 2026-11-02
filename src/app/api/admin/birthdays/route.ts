import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { sql } from "@/lib/dbconnect";
import { logAdminAction } from "@/lib/adminActivityLog";
import { eventImageStoredFromBasename } from "@/lib/uploadsImageUrl";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (!isSuperAdminUser(session.user) && !isAdminUser(session.user)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

/**
 * GET /api/admin/birthdays
 * List curated birthday entries with joined alumni details (admin-only).
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await sql/* sql */`
      SELECT
        b.id,
        b.alumniid,
        b.linkedin_post_url,
        b.gift_image_url,
        b.created_at,
        a.alumniname,
        a.sapid,
        a.registrationno,
        a.degree_title,
        a.yearofending,
        a.image1,
        p.program_name
      FROM public.alumni_birthdays b
      INNER JOIN public.tbl_alumni a ON a.alumniid = b.alumniid
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      ORDER BY b.created_at DESC, b.id DESC
    `;

    const items = (rows as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      alumniId: Number(r.alumniid),
      name: String(r.alumniname ?? "").trim(),
      sapId: String(r.sapid ?? "").trim() || null,
      registrationNo: String(r.registrationno ?? "").trim() || null,
      program: String(r.degree_title ?? "").trim() || String(r.program_name ?? "").trim() || null,
      passingOutYear:
        r.yearofending != null && Number.isFinite(Number(r.yearofending))
          ? Number(r.yearofending)
          : null,
      image: String(r.image1 ?? "").trim() || null,
      linkedinPostUrl: String(r.linkedin_post_url ?? "").trim() || null,
      giftImageUrl: String(r.gift_image_url ?? "").trim() || null,
      createdAt: r.created_at != null ? String(r.created_at) : null,
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list birthdays";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/birthdays
 * Create or update a birthday entry (one per alumni).
 * Body: { identifier?, alumniid?, linkedinPostUrl, giftImageUrl? }
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      identifier?: string;
      alumniid?: number;
      linkedinPostUrl?: string;
      giftImageUrl?: string;
    };

    const linkedinPostUrl = String(body.linkedinPostUrl ?? "").trim();
    const giftImageUrl = eventImageStoredFromBasename(body.giftImageUrl ?? "") || null;

    if (!linkedinPostUrl || linkedinPostUrl.length > 500) {
      return NextResponse.json({ error: "LinkedIn post URL is required" }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(linkedinPostUrl)) {
      return NextResponse.json({ error: "LinkedIn post URL must be a valid http(s) URL" }, { status: 400 });
    }

    // Resolve alumni
    let alumniId = Number(body.alumniid) || 0;
    if (!alumniId) {
      const identifier = String(body.identifier ?? "").trim();
      if (!identifier) {
        return NextResponse.json({ error: "Alumni identifier is required" }, { status: 400 });
      }
      const found = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni
        WHERE sapid = ${identifier} OR registrationno = ${identifier}
        LIMIT 1
      `;
      alumniId = Number((found?.[0] as { alumniid?: number } | undefined)?.alumniid ?? 0);
    }
    if (!alumniId || !Number.isFinite(alumniId)) {
      return NextResponse.json({ error: "Alumni record not found" }, { status: 404 });
    }

    const createdBy = Number((session.user as { id?: number | string })?.id) || null;

    const rows = await sql/* sql */`
      INSERT INTO public.alumni_birthdays
        (alumniid, linkedin_post_url, gift_image_url, created_by, updated_at)
      VALUES (${alumniId}, ${linkedinPostUrl}, ${giftImageUrl}, ${createdBy}, NOW())
      ON CONFLICT (alumniid) DO UPDATE
      SET linkedin_post_url = EXCLUDED.linkedin_post_url,
          gift_image_url   = EXCLUDED.gift_image_url,
          updated_at       = NOW()
      RETURNING id, alumniid, linkedin_post_url, gift_image_url, created_at
    `;

    const created = rows?.[0] as Record<string, unknown> | undefined;

    await logAdminAction({
      session,
      req,
      input: {
        action: "birthdays.upsert",
        entityType: "alumni_birthdays",
        success: true,
        entityId: alumniId,
        metadata: { linkedinPostUrl, giftImageUrl },
      },
    });

    return NextResponse.json(
      {
        item: {
          id: Number(created?.id),
          alumniId: Number(created?.alumniid),
          linkedinPostUrl: created?.linkedin_post_url ?? null,
          giftImageUrl: created?.gift_image_url ?? null,
          createdAt: created?.created_at ?? null,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save birthday";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/birthdays?id=<entryId>
 * Remove a birthday entry (admin-only).
 */
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Valid id is required" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      DELETE FROM public.alumni_birthdays WHERE id = ${id} RETURNING id
    `;
    if ((rows as unknown[]).length === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await logAdminAction({
      session,
      req,
      input: {
        action: "birthdays.delete",
        entityType: "alumni_birthdays",
        success: true,
        entityId: id,
      },
    });

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
