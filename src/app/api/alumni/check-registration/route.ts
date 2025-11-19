import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const registrationno = searchParams.get("registrationno");
    const sapid = searchParams.get("sapid");

    if (!registrationno && !sapid) {
      return NextResponse.json({ error: "Either registrationno or sapid is required" }, { status: 400 });
    }

    let rows;
    if (registrationno && sapid) {
      // Check both
      rows = await sql/* sql */`
        SELECT alumniid, registrationno, sapid, alumniname 
        FROM public.tbl_alumni 
        WHERE registrationno = ${registrationno} OR sapid = ${sapid} 
        LIMIT 1`;
    } else if (registrationno) {
      // Check only registration number
      rows = await sql/* sql */`
        SELECT alumniid, registrationno, sapid, alumniname 
        FROM public.tbl_alumni 
        WHERE registrationno = ${registrationno} 
        LIMIT 1`;
    } else {
      // Check only SAP ID
      rows = await sql/* sql */`
        SELECT alumniid, registrationno, sapid, alumniname 
        FROM public.tbl_alumni 
        WHERE sapid = ${sapid} 
        LIMIT 1`;
    }

    if (rows[0]) {
      return NextResponse.json({ 
        exists: true, 
        alumni: {
          alumniid: rows[0].alumniid,
          registrationno: rows[0].registrationno,
          sapid: rows[0].sapid,
          alumniname: rows[0].alumniname
        }
      }, { status: 200 });
    }

    return NextResponse.json({ exists: false }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check registration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

