import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

function normalizeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  return String(v);
}

function parseJsonbRecord(v: unknown): Record<string, unknown> {
  if (!v) return {};
  if (typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return {};
    try {
      const parsed = JSON.parse(s) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      return {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!canModify(session?.user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      SELECT
        r.id,
        r.alumni_id,
        r.old_data,
        r.new_data,
        r.status,
        r.created_at,
        r.approved_by,
        r.approved_at,
        a.alumniname,
        a.sapid,
        a.registrationno,
        COALESCE(a.personalemail, a.officialemail, a.universityemail) as email
      FROM public.tbl_alumni_change_requests r
      JOIN public.tbl_alumni a ON a.alumniid = r.alumni_id
      WHERE r.id = ${requestId}
      LIMIT 1
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const row = rows[0] as any;

    const oldData = parseJsonbRecord(row.old_data);
    const newData = parseJsonbRecord(row.new_data);

    const allFields = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)])).sort();
    const changes = allFields
      .map((field) => ({
        field,
        oldValue: normalizeValue(oldData[field]),
        newValue: normalizeValue(newData[field]),
      }))
      .filter((c) => c.oldValue !== c.newValue);

    // If medal is among the changed fields, fetch the current medal_document from tbl_alumni
    // so the admin can view the uploaded document before approving the medal change.
    if (changes.some((c) => c.field === "medal")) {
      const docRows = await sql/* sql */`
        SELECT medal_document
        FROM public.tbl_alumni
        WHERE alumniid = ${Number(row.alumni_id)}
        LIMIT 1
      `;
      const medalDoc = normalizeValue((docRows[0] as Record<string, unknown> | undefined)?.medal_document);
      if (medalDoc) {
        changes.push({ field: "medal_document", oldValue: "", newValue: medalDoc });
      }
    }

    return NextResponse.json(
      {
        request: {
          id: row.id,
          alumni_id: row.alumni_id,
          status: row.status,
          created_at: row.created_at,
          approved_by: row.approved_by,
          approved_at: row.approved_at,
          alumni: {
            alumniname: row.alumniname,
            sapid: row.sapid,
            registrationno: row.registrationno,
            email: row.email,
          },
          old_data: oldData,
          new_data: newData,
        },
        changes,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!canModify(session?.user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { action?: unknown };
    const action = String(body.action ?? "").toLowerCase().trim();
    if (action !== "accept" && action !== "reject") {
      return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }

    const approverUserId = (session?.user as { userId?: number })?.userId;
    if (!approverUserId) {
      return NextResponse.json({ error: "MISSING_APPROVER" }, { status: 400 });
    }

    const result = await sql.begin(async (tx) => {
      const rows = await tx/* sql */`
        SELECT id, alumni_id, old_data, new_data, status
        FROM public.tbl_alumni_change_requests
        WHERE id = ${requestId}
        LIMIT 1
        FOR UPDATE
      `;

      if (!rows[0]) {
        return { error: "NOT_FOUND", status: 404 as const };
      }

      const r = rows[0] as any;
      if (String(r.status).toLowerCase().trim() !== "pending") {
        return { error: "NOT_PENDING", status: 409 as const };
      }

      const alumniId = Number(r.alumni_id);
      const newData = parseJsonbRecord(r.new_data);

      if (action === "accept") {
        // Apply chapter changes into alumni_chapter table (these columns don't exist on tbl_alumni)
        const chapter1Id = ("chapter1_id" in newData) ? (newData.chapter1_id !== null && newData.chapter1_id !== undefined && newData.chapter1_id !== "" ? Number(newData.chapter1_id) : null) : undefined;
        const chapter2Id = ("chapter2_id" in newData) ? (newData.chapter2_id !== null && newData.chapter2_id !== undefined && newData.chapter2_id !== "" ? Number(newData.chapter2_id) : null) : undefined;
        const chapter3Id = ("chapter3_id" in newData) ? (newData.chapter3_id !== null && newData.chapter3_id !== undefined && newData.chapter3_id !== "" ? Number(newData.chapter3_id) : null) : undefined;

        if (chapter1Id !== undefined || chapter2Id !== undefined || chapter3Id !== undefined) {
          const existing = await tx/* sql */`
            SELECT id, chapter1, chapter2, chapter3
            FROM public.alumni_chapter
            WHERE id = ${alumniId}
            LIMIT 1
            FOR UPDATE
          `;
          if (existing[0]) {
            const cur = existing[0] as any;
            const final1 = chapter1Id !== undefined ? chapter1Id : (cur.chapter1 ?? null);
            const final2 = chapter2Id !== undefined ? chapter2Id : (cur.chapter2 ?? null);
            const final3 = chapter3Id !== undefined ? chapter3Id : (cur.chapter3 ?? null);
            await tx/* sql */`
              UPDATE public.alumni_chapter
              SET chapter1 = ${final1}, chapter2 = ${final2}, chapter3 = ${final3}
              WHERE id = ${alumniId}
            `;
          } else {
            await tx/* sql */`
              INSERT INTO public.alumni_chapter (id, chapter1, chapter2, chapter3)
              VALUES (
                ${alumniId},
                ${chapter1Id !== undefined ? chapter1Id : null},
                ${chapter2Id !== undefined ? chapter2Id : null},
                ${chapter3Id !== undefined ? chapter3Id : null}
              )
            `;
          }
        }

        const entries = Object.entries(newData)
          .filter(([k, v]) => v !== undefined && k !== "chapter1_id" && k !== "chapter2_id" && k !== "chapter3_id");

        if (entries.length > 0) {
          const setClause = entries.map(([field], idx) => `"${field}" = $${idx + 1}`).join(", ");
          const values = entries.map(([, v]) => v) as (string | number | boolean | null)[];
          const q = `UPDATE public.tbl_alumni SET ${setClause}, change_approval = 'accepted' WHERE alumniid = $${entries.length + 1}`;
          await tx.unsafe(q, [...values, alumniId] as any);
        } else {
          await tx/* sql */`
            UPDATE public.tbl_alumni
            SET change_approval = 'accepted'
            WHERE alumniid = ${alumniId}
          `;
        }

        await tx/* sql */`
          UPDATE public.tbl_alumni_change_requests
          SET status = 'accepted', approved_by = ${approverUserId}, approved_at = now()
          WHERE id = ${requestId}
        `;

        return { ok: true, status: 200 as const };
      }

      // reject
      await tx/* sql */`
        UPDATE public.tbl_alumni
        SET change_approval = 'rejected'
        WHERE alumniid = ${alumniId}
      `;

      await tx/* sql */`
        UPDATE public.tbl_alumni_change_requests
        SET status = 'rejected', approved_by = ${approverUserId}, approved_at = now()
        WHERE id = ${requestId}
      `;

      return { ok: true, status: 200 as const };
    });

    if ((result as any)?.error) {
      return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
