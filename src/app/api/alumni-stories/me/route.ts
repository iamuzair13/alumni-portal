import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/auth";

type Body = {
  text: string;
  imageUrl?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const email = String(session.user.email);
    const alumniRows = await sql/* sql */`
      SELECT alumniid FROM public.tbl_alumni WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
      ORDER BY alumniid DESC LIMIT 1`;
    const alumniid = alumniRows[0]?.alumniid as number | undefined;
    if (!alumniid) return NextResponse.json({ error: "ALUMNI_NOT_FOUND" }, { status: 404 });

    const body = (await req.json()) as Body;
    const text = String(body.text || "");
    const imageUrl = body.imageUrl ?? null;
    const status = body.status ?? "active";
    const createdAtIso = body.createdAt ?? new Date().toISOString();

    await sql.begin(async (tx) => {
      const updated = await tx/* sql */`
        UPDATE public.tblalumnistories
        SET alumnistories = ${text}, alumniimage = ${imageUrl}, status = ${status}, createdat = ${createdAtIso}
        WHERE alumniid = ${alumniid}
        RETURNING alumniid`;
      if (!updated[0]) {
        await tx/* sql */`
          INSERT INTO public.tblalumnistories (alumniid, alumnistories, alumniimage, status, createdat)
          VALUES (${alumniid}, ${text}, ${imageUrl}, ${status}, ${createdAtIso})`;
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save story";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}