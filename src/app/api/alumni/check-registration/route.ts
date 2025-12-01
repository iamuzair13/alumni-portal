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
        SELECT alumniid, registrationno, sapid, alumniname, verify
        FROM public.tbl_alumni 
        WHERE registrationno = ${registrationno} OR sapid = ${sapid} 
        LIMIT 1`;
    } else if (registrationno) {
      // Check only registration number
      rows = await sql/* sql */`
        SELECT alumniid, registrationno, sapid, alumniname, verify
        FROM public.tbl_alumni 
        WHERE registrationno = ${registrationno} 
        LIMIT 1`;
    } else {
      // Check only SAP ID
      rows = await sql/* sql */`
        SELECT alumniid, registrationno, sapid, alumniname, verify
        FROM public.tbl_alumni 
        WHERE sapid = ${sapid} 
        LIMIT 1`;
    }

    if (rows[0]) {
      const row = rows[0];
      // Normalize verify status
      const rawVerify = row.verify;
      let verifyStatus: string | null = null;
      let isVerified = false;
      
      if (rawVerify !== null && rawVerify !== undefined) {
        const verifyStr = String(rawVerify).trim();
        if (verifyStr.length > 0) {
          verifyStatus = verifyStr.toLowerCase();
          isVerified = verifyStatus === "true";
        }
      }
      
      return NextResponse.json({ 
        exists: true,
        canRegister: !isVerified, // Can register if not verified
        alumni: {
          alumniid: row.alumniid,
          registrationno: row.registrationno,
          sapid: row.sapid,
          alumniname: row.alumniname,
          verify: row.verify,
          isVerified: isVerified
        }
      }, { status: 200 });
    }

    return NextResponse.json({ exists: false }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check registration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

