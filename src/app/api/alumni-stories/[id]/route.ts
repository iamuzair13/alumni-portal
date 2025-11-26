import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const alumniid = Number(id);
    
    if (isNaN(alumniid)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }
    
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
        a.academicsession
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.alumniid = ${alumniid}
        AND s.alumnistories IS NOT NULL
        AND s.alumnistories != ''
        AND TRIM(s.alumnistories) != ''
        AND a.alumniname IS NOT NULL
        AND TRIM(a.alumniname) != ''
      LIMIT 1`);
    
    const r = rows[0] as {
      alumniid: number;
      alumnistories: string | null;
      storytitle: string | null;
      alumniimage: string | null;
      status: string | null;
      createdat: string | null;
      alumniname: string | null;
      degreetitle: string | null;
      academicsession: string | null;
    } | undefined;
    
    if (!r) {
      return NextResponse.json({ 
        message: "Story not found. This story may not exist or may have been removed.",
        error: "NOT_FOUND"
      }, { status: 404 });
    }
    
    const result = {
      id: String(r.alumniid ?? ""),
      date: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString(),
      title: String(r.storytitle ?? r.alumniname ?? ""),
      name: String(r.alumniname ?? ""),
      program: String(r.degreetitle ?? ""),
      session: String(r.academicsession ?? ""),
      shortDescription: String(r.alumnistories ?? ""),
      imageUrl: String(r.alumniimage ?? ""),
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch story";
    console.error("[API] Error fetching alumni story:", msg, err);
    
    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    if (isConnectionError) {
      return NextResponse.json({ 
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const alumniid = Number(id);
    
    if (isNaN(alumniid)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }
    
    const res = await retryDbOperation(async () => await sql/* sql */`
      DELETE FROM public.tblalumnistories WHERE alumniid = ${alumniid} RETURNING alumniid`);
    
    if (!res[0]) {
      return NextResponse.json({ 
        message: "Story not found",
        error: "NOT_FOUND"
      }, { status: 404 });
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    console.error("[API] Error deleting alumni story:", msg, err);
    
    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    if (isConnectionError) {
      return NextResponse.json({ 
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}