import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";

export async function GET() {
  try {
    const session = await auth();
    if (!canModify(session?.user)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const rows = await sql/* sql */`
      SELECT COUNT(*)::bigint as count
      FROM public.tbl_alumni
      WHERE change_approval = 'pending'
    ` as Array<{ count: string | number }>;

    const changeApprovalCount = Number(rows?.[0]?.count ?? 0);

    return NextResponse.json(
      {
        changeApprovalCount: Number.isFinite(changeApprovalCount) ? changeApprovalCount : 0,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
