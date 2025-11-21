import { NextResponse } from "next/server";
import { storyServerSchema, type ServerStoryPayload } from "@/lib/alumniStories";
import { sql } from "@/lib/dbconnect";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { sendSuccessStoryEmail } from "@/lib/email";

// Configure DOMPurify for server-side sanitization
const window = new JSDOM("").window;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const purify = DOMPurify(window as any);

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
    
    // Sanitize HTML using DOMPurify
    const cleanHtml = purify.sanitize(String(v.storyHtml || ""), {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "a", "div"],
      ALLOWED_ATTR: ["href", "target", "rel"],
    });

    const alumniRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${v.sapId} LIMIT 1` as { alumniid: number }[];
    const alumniId = alumniRows[0]?.alumniid;
    if (!alumniId) {
      return NextResponse.json({ message: "SAP ID not found in tbl_alumni" }, { status: 404 });
    }

    // Update contact number if provided
    if (v.contactNumber) {
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET contactno = ${v.contactNumber}
        WHERE alumniid = ${alumniId}`;
    }

    await sql/* sql */`
      INSERT INTO public.tblalumnistories (alumniid, alumnistories, alumniimage, status, createdat)
      VALUES (${alumniId}, ${cleanHtml}, ${null}, ${null}, ${createdAt.toISOString()})
      ON CONFLICT (alumniid) DO UPDATE SET
        alumnistories = EXCLUDED.alumnistories,
        createdat = EXCLUDED.createdat`;
    
    // Send confirmation email
    try {
      const alumniRows = await sql/* sql */`
        SELECT alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;
      const alumni = alumniRows[0] as {
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      } | undefined;
      
      if (alumni) {
        const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
        const alumniName = alumni.alumniname || "Alumni";
        
        if (alumniEmail) {
          // Send email asynchronously (don't wait for it to complete)
          sendSuccessStoryEmail(alumniEmail, alumniName).catch((err) => {
            console.error("[API] Failed to send success story email:", err);
          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending success story email:", emailError);
    }
    
    return NextResponse.json({ ok: true, alumniid: alumniId }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}