import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { validatePayload } from "./validation";

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.alumniname,
        a.departmentname,
        a.facultyname,
        a.degreetitle,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        t.topic,
        t.day,
        t.timings,
        t.activity
      FROM public.tbl_alumni a
      JOIN public.tblalumnitalks t ON t.alumniid = a.alumniid
      ORDER BY t.alumniid DESC`;
    const typedRows = rows as unknown as {
      sapid: string;
      alumniname: string;
      departmentname: string | null;
      facultyname: string | null;
      degreetitle: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
      topic: string | null;
      day: string;
      timings: string;
      activity: string | null;
    }[];
    const items = typedRows.map((r) => ({
      sapid: r.sapid,
      name: r.alumniname,
      department: r.departmentname,
      faculty: r.facultyname,
      program: r.degreetitle || null,
      email: r.personalemail || r.officialemail || r.universityemail,
      topics: String(r.topic || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      areas: String(r.activity || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean),
      day: r.day,
      time: r.timings,
    }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch talks";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    const email = String(session.user.email);
    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const alumRows = await sql/* sql */`
      SELECT alumniid, facultyname, degreetitle, departmentname, linkedin FROM public.tbl_alumni 
      WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    const alum = alumRows[0] as { alumniid: number; facultyname: string | null; degreetitle: string | null; departmentname: string | null; linkedin?: string | null } | undefined;
    if (!alum?.alumniid) {
      return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });
    }

    const topicStr = v.data.topics.join(", ").slice(0, 500);
    const activityStr = v.data.areas.join(", ").slice(0, 50);
    const dayStr = v.data.day.slice(0, 20);
    const timeStr = v.data.time.slice(0, 20);
    const majorStr = v.data.major.slice(0, 100);

    await sql.begin(async (tx) => {
      await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${alum.alumniid}`;
      await tx/* sql */`INSERT INTO public.tblalumnitalks (alumniid, alumnitalks, mentorshipprogram, topic, day, timings, activity, linkedin) VALUES (
        ${alum.alumniid}, ${"yes"}, ${"yes"}, ${topicStr}, ${dayStr}, ${timeStr}, ${activityStr}, ${alum.linkedin ?? null}
      )`;
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to submit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const email = String(session.user.email);
    const body = await req.json();
    const v = validatePayload(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const alumRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    const alumniid = alumRows[0]?.alumniid as number | undefined;
    if (!alumniid) return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });
    const topicStr = v.data.topics.join(", ").slice(0, 500);
    const activityStr = v.data.areas.join(", ").slice(0, 50);
    const dayStr = v.data.day.slice(0, 20);
    const timeStr = v.data.time.slice(0, 20);
    const majorStr = v.data.major.slice(0, 100);
    await sql.begin(async (tx) => {
      await tx/* sql */`UPDATE public.tbl_alumni SET majorsubject = ${majorStr} WHERE alumniid = ${alumniid}`;
      await tx/* sql */`UPDATE public.tblalumnitalks SET topic = ${topicStr}, day = ${dayStr}, timings = ${timeStr}, activity = ${activityStr} WHERE alumniid = ${alumniid}`;
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const url = new URL(req.url);
    const maybeSapId = url.searchParams.get("sapid");
    const type = String((session.user as unknown as { type?: string | null })?.type || "").toLowerCase();
    if (maybeSapId) {
      if (type !== "staff") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      const arows = await sql/* sql */`
        SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${maybeSapId} LIMIT 1`;
      const aid = arows[0]?.alumniid as number | undefined;
      if (!aid) return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });
      await sql/* sql */`DELETE FROM public.tblalumnitalks WHERE alumniid = ${aid}`;
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    const email = String(session.user.email);
    const alumRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    const alumniid = alumRows[0]?.alumniid as number | undefined;
    if (!alumniid) return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });
    await sql/* sql */`DELETE FROM public.tblalumnitalks WHERE alumniid = ${alumniid}`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}