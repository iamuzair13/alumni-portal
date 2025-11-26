import { NextResponse } from "next/server";
import { storyServerSchema, type ServerStoryPayload } from "@/lib/alumniStories";
import { sql, retryDbOperation } from "@/lib/dbconnect";
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
  title: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

type StoryRow = {
  alumniid: number;
  alumnistories: string | null;
  storytitle: string | null;
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
    const rows = await retryDbOperation(async () => await sql/* sql */`
      SELECT 
        s.alumniid,
        s.alumnistories,
        COALESCE(s.storytitle, a.alumniname) as storytitle,
        s.alumniimage,
        s.status,
        s.createdat,
        a.alumniname,
        a.degreetitle,
        a.academicsession,
        a.image1
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.alumnistories IS NOT NULL 
        AND s.alumnistories != ''
        AND TRIM(s.alumnistories) != ''
        AND a.alumniname IS NOT NULL
        AND TRIM(a.alumniname) != ''
      ORDER BY s.createdat DESC NULLS LAST
      LIMIT 200` as StoryRow[]);
    
    const items = rows.map((r): StoryItem => {
      const id = String(r.alumniid ?? "");
      const date = r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString();
      const title = String(r.storytitle ?? r.alumniname ?? "");
      const name = String(r.alumniname ?? "");
      const program = String(r.degreetitle ?? "");
      const session = String(r.academicsession ?? "");
      const shortDescription = String(r.alumnistories ?? "");
      const imageUrl = String(r.alumniimage ?? r.image1 ?? "");
      return { id, date, title, name, program, session, shortDescription, imageUrl };
    });
    
    // Always return items array, even if empty (no stories is a valid state)
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch stories";
    console.error("[API] Error fetching alumni stories:", msg, err);
    
    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    // For any error, return empty array so UI can handle it gracefully
    // This prevents the "Failed to fetch" error from breaking the page
    if (isConnectionError) {
      console.warn("[API] Database connection timeout, returning empty stories list");
      return NextResponse.json({ 
        items: [], // Return empty array so UI shows "no stories" instead of error
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 200 }); // Return 200 with empty array so client doesn't treat it as error
    }
    
    // For other errors, also return empty array with 200 status
    // The client can check if items.length === 0 to show appropriate message
    console.warn("[API] Error fetching stories, returning empty list:", msg);
    return NextResponse.json({ 
      items: [], // Return empty array so UI shows "no stories" instead of error
      error: msg 
    }, { status: 200 }); // Return 200 so client doesn't treat it as error
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = storyServerSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[API] Story validation failed:", JSON.stringify(parsed.error.format(), null, 2));
      console.error("[API] Received body:", JSON.stringify(body, null, 2));
      return NextResponse.json({ 
        message: "Validation failed", 
        issues: parsed.error.format(),
        received: body 
      }, { status: 422 });
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
      INSERT INTO public.tblalumnistories (alumniid, alumnistories, storytitle, alumniimage, status, createdat)
      VALUES (${alumniId}, ${cleanHtml}, ${v.storyTitle}, ${null}, ${null}, ${createdAt.toISOString()})
      ON CONFLICT (alumniid) DO UPDATE SET
        alumnistories = EXCLUDED.alumnistories,
        storytitle = EXCLUDED.storytitle,
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