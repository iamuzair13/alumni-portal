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
      LIMIT 200`;
    const typed = rows as unknown as Array<{
      alumniid?: number;
      alumnistories?: string | null;
      alumniimage?: string | null;
      status?: string | null;
      createdat?: string | Date | null;
      alumniname?: string | null;
      degreetitle?: string | null;
      academicsession?: string | null;
      image1?: string | null;
    }>;
    const items = typed.map((r): StoryItem => {
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
    const createdAt = new Date(v.date).toISOString();
    const text = v.description || v.shortStoriesHtml;
    const image = v.imageUrl ?? null;
    // Insert into tblstories (rich story storage) for full fidelity
    const rows = await sql/* sql */`
      INSERT INTO public.tblstories (
        alumniname, alumnisession, alumnifaculty, alumnicompany, alumnidesignation,
        alumnicitycountry, alumnistories, alumnishortstories, alumnistoriesdate, alumniimage1, alumnishowhome
      ) VALUES (
        ${v.name}, ${v.degreeSession}, ${v.faculty}, ${v.company}, ${v.designation},
        ${v.cityCountry}, ${text}, ${v.shortStoriesHtml.slice(0, 500)}, ${createdAt}, ${image}, ${v.showHome ? "true" : "false"}
      ) RETURNING id`;
    const created = rows[0]?.id as number | undefined;
    return NextResponse.json({ ok: true, id: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}