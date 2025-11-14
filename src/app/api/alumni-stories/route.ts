import { NextResponse } from "next/server";
import { storyServerSchema, type ServerStoryPayload } from "@/lib/alumniStories";
import { sql } from "@/lib/dbconnect";

type StoryItem = {
  id: string;
  date: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

type StoryRow = {
  alumniid: number;
  alumnistories: string | null;
  alumniimage: string | null;
  status: string | null;
  createdat: string | null;
  alumniname: string | null;
  degreetitle: string | null;
  academicsession: string | null;
  image1: string | null;
};

export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        s.alumniid,
        s.alumnistories,
        s.alumniimage,
        s.status,
        s.createdat,
        a.alumniname,
        a.degreetitle,
        a.academicsession,
        a.image1
      FROM public.tblalumnistories s
      JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      ORDER BY s.createdat DESC
      LIMIT 200` as StoryRow[];
    const items = rows.map((r): StoryItem => {
      const id = String(r.alumniid ?? "");
      const date = r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString();
      const name = String(r.alumniname ?? "");
      const program = String(r.degreetitle ?? "");
      const session = String(r.academicsession ?? "");
      const shortDescription = String(r.alumnistories ?? "");
      const imageUrl = String(r.alumniimage ?? r.image1 ?? "");
      return { id, date, name, program, session, shortDescription, imageUrl };
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch stories";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = storyServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", issues: parsed.error.format() }, { status: 422 });
    }
    const v: ServerStoryPayload = parsed.data;
    const createdAt = new Date();
    const cleanHtml = String(v.storyHtml || "")
      .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "");

    const alumniRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${v.sapId} LIMIT 1` as { alumniid: number }[];
    const alumniId = alumniRows[0]?.alumniid;
    if (!alumniId) {
      return NextResponse.json({ message: "SAP ID not found in tbl_alumni" }, { status: 404 });
    }

    await sql/* sql */`
      INSERT INTO public.tblalumnistories (alumniid, alumnistories, alumniimage, status, createdat)
      VALUES (${alumniId}, ${cleanHtml}, ${null}, ${null}, ${createdAt.toISOString()})
      ON CONFLICT (alumniid) DO UPDATE SET
        alumnistories = EXCLUDED.alumnistories,
        createdat = EXCLUDED.createdat`;
    return NextResponse.json({ ok: true, alumniid: alumniId }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}