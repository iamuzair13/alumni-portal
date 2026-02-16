import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { validatePayload } from "./validation";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import type { Session } from "next-auth";
import { sendEmailDetailed } from "@/lib/email";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import { EMAIL_LOG_STATUS, EMAIL_TRIGGERED_BY, insertEmailLog } from "@/lib/emailLogs";

async function resolveAlumniIdFromSession(session: Session | null): Promise<
  | { ok: true; alumniid: number; email: string | null; userSapid: string | null; userRegNo: string | null }
  | { ok: false; status: number; error: string; message?: string }
> {
  if (!session?.user) return { ok: false, status: 401, error: "UNAUTHENTICATED" };

  const user = session.user as unknown as { email?: unknown; sapid?: unknown; registrationno?: unknown };
  const email = user.email ? String(user.email) : null;
  const userSapid = user.sapid ? String(user.sapid).trim() : null;
  const userRegNo = user.registrationno ? String(user.registrationno).trim() : null;

  if (!email && !userSapid && !userRegNo) return { ok: false, status: 401, error: "UNAUTHENTICATED" };

  let alumRows: Array<{ alumniid: number }> = [];

  if (userSapid) {
    alumRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${userSapid} LIMIT 1`;
  }

  if (alumRows.length === 0 && userRegNo) {
    alumRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE registrationno = ${userRegNo} LIMIT 1`;
  }

  if (alumRows.length === 0 && email) {
    alumRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni
      WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email} OR alumniemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
  }

  const alumniid = alumRows[0]?.alumniid;
  if (!alumniid) {
    return {
      ok: false,
      status: 404,
      error: "ALUMNI_NOT_FOUND",
      message: "Your alumni record was not found. Please ensure you are logged in with the correct account.",
    };
  }

  return { ok: true, alumniid, email, userSapid, userRegNo };
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { canModify } = await import("@/lib/alumniProfile");
    const isAdmin = canModify(session.user);

    const { searchParams } = new URL(req.url);
    const sapidParam = String(searchParams.get("sapid") || "").trim();

    if (!isAdmin) {
      const me = await resolveAlumniIdFromSession(session);
      if (!me.ok) return NextResponse.json({ error: me.error, message: me.message }, { status: me.status });

      const rows = await sql/* sql */`
        SELECT
          s.id,
          s.created_at,
          s.updated_at,
          s.alumniid,
          s.topic,
          s.activity,
          s.mode,
          s.brief_outline,
          s.date_1,
          s.timings_1,
          s.date_2,
          s.timings_2,
          s.date_3,
          s.timings_3,
          s.status,
          s.confirmed_date,
          s.confirmed_timings,
          s.admin_proposed_date,
          s.admin_proposed_timings,
          s.admin_note,
          s.alumni_note
        FROM public.alumni_talk_sessions s
        WHERE s.alumniid = ${me.alumniid}
        ORDER BY s.created_at DESC
      `;

      const countsRows = await sql/* sql */`
        SELECT
          COUNT(*) AS all_count,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) = 'pending') AS pending_count,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) = 'admin_proposed') AS pending_confirmation_count,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) IN ('admin_confirmed', 'alumni_confirmed')) AS confirmed_count
        FROM public.alumni_talk_sessions s
        WHERE s.alumniid = ${me.alumniid}
      `;

      const countRow = (countsRows as any)[0] as {
        all_count?: number | bigint;
        pending_count?: number | bigint;
        pending_confirmation_count?: number | bigint;
        confirmed_count?: number | bigint;
      } | undefined;
      const all = countRow?.all_count ? Number(countRow.all_count) : 0;
      const pending = countRow?.pending_count ? Number(countRow.pending_count) : 0;
      const pendingConfirmation = countRow?.pending_confirmation_count ? Number(countRow.pending_confirmation_count) : 0;
      const confirmed = countRow?.confirmed_count ? Number(countRow.confirmed_count) : 0;

      return NextResponse.json({ items: rows, counts: { all, pending, pendingConfirmation, confirmed } }, { status: 200 });
    }

    // Admin: apply access filter and optional sapid filter
    let accessFilter;
    try {
      accessFilter = await buildAccessFilterSQL(session, "");
    } catch (filterError) {
      return NextResponse.json(
        {
          error: "Failed to build access filter",
          details: filterError instanceof Error ? filterError.message : String(filterError),
        },
        { status: 500 }
      );
    }

    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    const sapidCondition = sapidParam ? sql` AND (a.sapid = ${sapidParam} OR a.registrationno = ${sapidParam})` : sql``;

    let rows;
    try {
      rows = await sql/* sql */`
        SELECT
          a.sapid,
          a.registrationno,
          a.alumniname,
          a.departmentname,
          a.facultyname,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          s.id,
          s.created_at,
          s.updated_at,
          s.alumniid,
          s.topic,
          s.activity,
          s.mode,
          s.brief_outline,
          s.date_1,
          s.timings_1,
          s.date_2,
          s.timings_2,
          s.date_3,
          s.timings_3,
          s.status,
          s.confirmed_date,
          s.confirmed_timings,
          s.admin_proposed_date,
          s.admin_proposed_timings,
          s.admin_note,
          s.alumni_note
        FROM public.tbl_alumni a
          INNER JOIN public.alumni_talk_sessions s ON s.alumniid = a.alumniid
        WHERE (
          (a.sapid IS NOT NULL AND a.sapid != '')
          OR (a.registrationno IS NOT NULL AND a.registrationno != '')
        )
        ${sapidCondition}
        ${accessFilterCondition}
        ORDER BY s.created_at DESC
      `;
    } catch (queryError) {
      return NextResponse.json(
        {
          error: "Failed to fetch talks",
          details: queryError instanceof Error ? queryError.message : String(queryError),
        },
        { status: 500 }
      );
    }
    const typedRows = rows as unknown as Array<Record<string, unknown> & {
      sapid: string;
      registrationno: string | null;
      alumniname: string;
      departmentname: string | null;
      facultyname: string | null;
      degreetitle: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
      id: number;
      alumniid: number;
      topic?: string | null;
      activity?: string | null;
      mode?: string | null;
      brief_outline?: string | null;
      date_1?: string | null;
      timings_1?: string | null;
      date_2?: string | null;
      timings_2?: string | null;
      date_3?: string | null;
      timings_3?: string | null;
      status?: string | null;
      confirmed_date?: string | null;
      confirmed_timings?: string | null;
      admin_proposed_date?: string | null;
      admin_proposed_timings?: string | null;
      admin_note?: string | null;
      alumni_note?: string | null;
    }>;

    const items = typedRows.map((r) => ({
      id: r.id,
      alumniid: r.alumniid,
      sapid: r.sapid,
      registrationNo: r.registrationno,
      name: r.alumniname,
      department: r.departmentname,
      faculty: r.facultyname,
      program: r.degreetitle || null,
      email: r.personalemail || r.officialemail || r.universityemail,
      status: (r.status ?? "pending") as string,
      topics: String(r.topic ?? "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      areas: String(r.activity ?? "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      mode: (r.mode ?? null) as string | null,
      briefOutline: (r.brief_outline ?? null) as string | null,
      date1: (r.date_1 ?? null) as string | null,
      timings1: (r.timings_1 ?? null) as string | null,
      date2: (r.date_2 ?? null) as string | null,
      timings2: (r.timings_2 ?? null) as string | null,
      date3: (r.date_3 ?? null) as string | null,
      timings3: (r.timings_3 ?? null) as string | null,
      confirmedDate: (r.confirmed_date ?? null) as string | null,
      confirmedTimings: (r.confirmed_timings ?? null) as string | null,
      adminProposedDate: (r.admin_proposed_date ?? null) as string | null,
      adminProposedTimings: (r.admin_proposed_timings ?? null) as string | null,
      adminNote: (r.admin_note ?? null) as string | null,
      alumniNote: (r.alumni_note ?? null) as string | null,
    }));

    const countsRows = await sql/* sql */`
      SELECT
        COUNT(*) AS all_count,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) = 'admin_proposed') AS pending_confirmation_count,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, 'pending')) IN ('admin_confirmed', 'alumni_confirmed')) AS confirmed_count
      FROM public.tbl_alumni a
        INNER JOIN public.alumni_talk_sessions s ON s.alumniid = a.alumniid
      WHERE (
        (a.sapid IS NOT NULL AND a.sapid != '')
        OR (a.registrationno IS NOT NULL AND a.registrationno != '')
      )
      ${sapidCondition}
      ${accessFilterCondition}
    `;

    const countRow = (countsRows as any)[0] as {
      all_count?: number | bigint;
      pending_count?: number | bigint;
      pending_confirmation_count?: number | bigint;
      confirmed_count?: number | bigint;
    } | undefined;
    const all = countRow?.all_count ? Number(countRow.all_count) : 0;
    const pending = countRow?.pending_count ? Number(countRow.pending_count) : 0;
    const pendingConfirmation = countRow?.pending_confirmation_count ? Number(countRow.pending_confirmation_count) : 0;
    const confirmed = countRow?.confirmed_count ? Number(countRow.confirmed_count) : 0;

    return NextResponse.json({ items, counts: { all, pending, pendingConfirmation, confirmed } }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    return NextResponse.json({ 
      error: "Failed to fetch talks",
      message: errorMessage 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const me = await resolveAlumniIdFromSession(session);
    if (!me.ok) return NextResponse.json({ error: me.error, message: me.message }, { status: me.status });

    const topicStr = v.data.topics.join(", ").slice(0, 500);
    const activityStr = v.data.areas.join(", ").slice(0, 50);
    const majorStr = v.data.major.slice(0, 100);
    const modeStr = v.data.mode;
    const briefOutlineStr = v.data.briefOutline.slice(0, 5000);
    
    // Extract availability dates (up to 3)
    const availability = v.data.availability.slice(0, 3);
    const date1 = availability[0]?.date || null;
    const timings1 = availability[0]?.timings || null;
    const date2 = availability[1]?.date || null;
    const timings2 = availability[1]?.timings || null;
    const date3 = availability[2]?.date || null;
    const timings3 = availability[2]?.timings || null;

    const inserted = await sql.begin(async (tx) => {
      await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${me.alumniid}`;

      const rows = await tx/* sql */`
        INSERT INTO public.alumni_talk_sessions (
          alumniid,
          topic,
          activity,
          mode,
          brief_outline,
          date_1,
          timings_1,
          date_2,
          timings_2,
          date_3,
          timings_3,
          status
        ) VALUES (
          ${me.alumniid},
          ${topicStr},
          ${activityStr},
          ${modeStr},
          ${briefOutlineStr},
          ${date1},
          ${timings1},
          ${date2},
          ${timings2},
          ${date3},
          ${timings3},
          ${"pending"}
        )
        RETURNING id
      `;
      return rows[0] as { id: number } | undefined;
    });

    const recipientRows = await sql/* sql */`
      SELECT
        a.alumniname,
        COALESCE(a.personalemail, a.officialemail, a.universityemail, a.alumniemail) AS email
      FROM public.tbl_alumni a
      WHERE a.alumniid = ${me.alumniid}
      LIMIT 1
    `;

    const recipientRow = recipientRows[0] as { alumniname?: string | null; email?: string | null } | undefined;
    const recipientEmail = String(recipientRow?.email || "").trim();
    const alumniName = String(recipientRow?.alumniname || "Alumni").trim() || "Alumni";

    if (recipientEmail && recipientEmail.includes("@")) {
      const availabilityLines = availability
        .map((a) => {
          const d = String(a?.date || "").trim();
          const t = String(a?.timings || "").trim();
          if (!d && !t) return null;
          return [d, t].filter(Boolean).join(" ");
        })
        .filter(Boolean)
        .join("\n");

      const tpl = generateAdminActionEmail({
        actionType: EMAIL_ACTION_TYPE.ALUMNI_TALK_APPLICATION_ACK,
        alumniName,
      });

      const html = tpl.html
        .replaceAll("{Major}", majorStr)
        .replaceAll("{Area}", activityStr)
        .replaceAll("{Topic}", topicStr)
        .replaceAll("{Mode}", modeStr)
        .replaceAll("{Availability}", availabilityLines);

      const emailRes = await sendEmailDetailed({
        to: recipientEmail,
        subject: tpl.subject,
        html,
      });

      await insertEmailLog({
        recipientEmail,
        alumniId: me.alumniid,
        subject: tpl.subject,
        body: html,
        status: emailRes.ok ? EMAIL_LOG_STATUS.SENT : EMAIL_LOG_STATUS.FAILED,
        errorMessage: emailRes.ok ? null : emailRes.errorMessage ?? "Unknown error",
        triggeredBy: EMAIL_TRIGGERED_BY.AUTO,
        actionType: EMAIL_ACTION_TYPE.ALUMNI_TALK_APPLICATION_ACK,
      });
    }

    return NextResponse.json({ ok: true, id: inserted?.id ?? null }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to submit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const { canModify } = await import("@/lib/alumniProfile");
    const isAdmin = canModify(session.user);

    const url = new URL(req.url);
    const idParam = String(url.searchParams.get("id") || "").trim();
    const id = Number(idParam);
    if (!idParam || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body?.action || "").trim();
    if (!action) return NextResponse.json({ error: "ACTION_REQUIRED" }, { status: 400 });

    if (!isAdmin) {
      const me = await resolveAlumniIdFromSession(session);
      if (!me.ok) return NextResponse.json({ error: me.error, message: me.message }, { status: me.status });

      const ownership = await sql/* sql */`
        SELECT alumniid, admin_proposed_date, admin_proposed_timings
        FROM public.alumni_talk_sessions
        WHERE id = ${id}
        LIMIT 1
      `;

      const row = ownership[0] as { alumniid?: number; admin_proposed_date?: string | null; admin_proposed_timings?: string | null } | undefined;
      if (!row?.alumniid || row.alumniid !== me.alumniid) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      if (action === "confirm_proposed") {
        if (!row.admin_proposed_date || !row.admin_proposed_timings) {
          return NextResponse.json({ error: "NO_ADMIN_PROPOSAL" }, { status: 400 });
        }
        await sql/* sql */`
          UPDATE public.alumni_talk_sessions
          SET
            status = ${"alumni_confirmed"},
            confirmed_date = ${row.admin_proposed_date},
            confirmed_timings = ${row.admin_proposed_timings},
            updated_at = now()
          WHERE id = ${id}
        `;
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      if (action === "cancel") {
        await sql/* sql */`
          UPDATE public.alumni_talk_sessions
          SET status = ${"cancelled"}, updated_at = now()
          WHERE id = ${id}
        `;
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      return NextResponse.json({ error: "ACTION_NOT_ALLOWED" }, { status: 400 });
    }

    // Admin actions
    if (action === "confirm_option") {
      const option = Number(body?.option);
      if (![1, 2, 3].includes(option)) return NextResponse.json({ error: "OPTION_INVALID" }, { status: 400 });

      const rows = await sql/* sql */`
        SELECT date_1, timings_1, date_2, timings_2, date_3, timings_3
        FROM public.alumni_talk_sessions
        WHERE id = ${id}
        LIMIT 1
      `;
      const r = rows[0] as {
        date_1?: string | null;
        timings_1?: string | null;
        date_2?: string | null;
        timings_2?: string | null;
        date_3?: string | null;
        timings_3?: string | null;
      } | undefined;

      const chosenDate = option === 1 ? r?.date_1 : option === 2 ? r?.date_2 : r?.date_3;
      const chosenTimings = option === 1 ? r?.timings_1 : option === 2 ? r?.timings_2 : r?.timings_3;

      if (!chosenDate || !chosenTimings) return NextResponse.json({ error: "OPTION_NOT_AVAILABLE" }, { status: 400 });

      await sql/* sql */`
        UPDATE public.alumni_talk_sessions
        SET
          status = ${"admin_confirmed"},
          confirmed_date = ${chosenDate},
          confirmed_timings = ${chosenTimings},
          updated_at = now()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === "propose") {
      const proposedDate = String(body?.date || "").trim();
      const proposedTimings = String(body?.timings || "").trim();
      if (!proposedDate || !proposedTimings) return NextResponse.json({ error: "PROPOSED_DATE_TIMINGS_REQUIRED" }, { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) return NextResponse.json({ error: "DATE_INVALID" }, { status: 400 });
      if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(proposedTimings)) return NextResponse.json({ error: "TIMINGS_INVALID" }, { status: 400 });

      await sql/* sql */`
        UPDATE public.alumni_talk_sessions
        SET
          status = ${"admin_proposed"},
          admin_proposed_date = ${proposedDate},
          admin_proposed_timings = ${proposedTimings},
          admin_note = ${body?.note ? String(body.note).slice(0, 2000) : null},
          updated_at = now()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === "mark_conducted") {
      await sql/* sql */`
        UPDATE public.alumni_talk_sessions
        SET status = ${"conducted"}, updated_at = now()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === "cancel") {
      await sql/* sql */`
        UPDATE public.alumni_talk_sessions
        SET status = ${"cancelled"}, updated_at = now()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "ACTION_NOT_SUPPORTED" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const url = new URL(req.url);
    const idParam = String(url.searchParams.get("id") || "").trim();
    const id = Number(idParam);
    if (!idParam || !Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
    }

    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { canModify } = await import("@/lib/alumniProfile");
    const isAdmin = canModify(session.user);

    if (!isAdmin) {
      const me = await resolveAlumniIdFromSession(session);
      if (!me.ok) return NextResponse.json({ error: me.error, message: me.message }, { status: me.status });

      const own = await sql/* sql */`
        SELECT alumniid FROM public.alumni_talk_sessions WHERE id = ${id} LIMIT 1`;
      const row = own[0] as { alumniid?: number } | undefined;
      if (!row?.alumniid || row.alumniid !== me.alumniid) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }
    const topicStr = v.data.topics.join(", ").slice(0, 500);
    const activityStr = v.data.areas.join(", ").slice(0, 50);
    const majorStr = v.data.major.slice(0, 100);
    const modeStr = v.data.mode;
    const briefOutlineStr = v.data.briefOutline.slice(0, 5000);
    
    // Extract availability dates (up to 3)
    const availability = v.data.availability.slice(0, 3);
    const date1 = availability[0]?.date || null;
    const timings1 = availability[0]?.timings || null;
    const date2 = availability[1]?.date || null;
    const timings2 = availability[1]?.timings || null;
    const date3 = availability[2]?.date || null;
    const timings3 = availability[2]?.timings || null;
    
    await sql.begin(async (tx) => {
      // Keep majorsubject update for compatibility with previous flow.
      if (!isAdmin) {
        const me = await resolveAlumniIdFromSession(session);
        if (me.ok) {
          await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${me.alumniid}`;
        }
      }

      if (isAdmin) {
        await tx/* sql */`
          UPDATE public.alumni_talk_sessions SET
            topic = ${topicStr},
            activity = ${activityStr},
            mode = ${modeStr},
            brief_outline = ${briefOutlineStr},
            date_1 = ${date1},
            timings_1 = ${timings1},
            date_2 = ${date2},
            timings_2 = ${timings2},
            date_3 = ${date3},
            timings_3 = ${timings3},
            updated_at = now()
          WHERE id = ${id}
        `;
      } else {
        await tx/* sql */`
          UPDATE public.alumni_talk_sessions SET
            topic = ${topicStr},
            activity = ${activityStr},
            mode = ${modeStr},
            brief_outline = ${briefOutlineStr},
            date_1 = ${date1},
            timings_1 = ${timings1},
            date_2 = ${date2},
            timings_2 = ${timings2},
            date_3 = ${date3},
            timings_3 = ${timings3},
            status = ${"reschedule_requested"},
            updated_at = now()
          WHERE id = ${id}
        `;
      }
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}