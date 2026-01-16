import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function PUT(req: Request, ctx: { params: Promise<{ sapid: string }> }) {
  try {
    const { sapid } = await ctx.params;
    
    // Verify alumni exists
    const alumniRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE sapid = ${sapid} LIMIT 1`;
    
    if (!alumniRows[0]) {
      return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { facebook, instagram, youtube, linkedin } = body;

    // Validate URLs if provided
    const urlPattern = /^https?:\/\/.+/;
    if (facebook && facebook !== null && !urlPattern.test(facebook)) {
      return NextResponse.json({ error: "Invalid Facebook URL format" }, { status: 400 });
    }
    if (instagram && instagram !== null && !urlPattern.test(instagram)) {
      return NextResponse.json({ error: "Invalid Instagram URL format" }, { status: 400 });
    }
    if (youtube && youtube !== null && !urlPattern.test(youtube)) {
      return NextResponse.json({ error: "Invalid YouTube URL format" }, { status: 400 });
    }
    if (linkedin && linkedin !== null && !urlPattern.test(linkedin)) {
      return NextResponse.json({ error: "Invalid LinkedIn URL format" }, { status: 400 });
    }

    // Update database - always update all fields (set to null if not provided)
    const facebookVal = facebook !== undefined ? (facebook || null) : null;
    const instagramVal = instagram !== undefined ? (instagram || null) : null;
    const youtubeVal = youtube !== undefined ? (youtube || null) : null;
    const linkedinVal = linkedin !== undefined ? (linkedin || null) : null;

    await sql/* sql */`
      UPDATE public.tbl_alumni 
      SET 
        facebook = ${facebookVal},
        instagram = ${instagramVal},
        youtube = ${youtubeVal},
        linkedin = ${linkedinVal}
      WHERE sapid = ${sapid}
    `;

    return NextResponse.json({ 
      ok: true,
      message: "Social media links updated successfully" 
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update social media links";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

