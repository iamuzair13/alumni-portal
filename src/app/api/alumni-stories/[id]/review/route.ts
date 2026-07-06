import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { normalizeStoryStatus } from "@/lib/alumniStories";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!canModify(session?.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const storyId = Number(id);
    if (isNaN(storyId)) {
      return NextResponse.json({ message: "Invalid story ID" }, { status: 400 });
    }

    const body = (await req.json()) as { action?: string; rejectionReason?: string };
    const action = String(body.action || "").toLowerCase();
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action. Use approve or reject." }, { status: 400 });
    }

    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
    if (action === "reject" && !rejectionReason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessCondition =
      accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    const storyRows = await sql/* sql */`
      SELECT s.id, s.status
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.id = ${storyId}
        ${accessCondition}
      LIMIT 1
    `;

    if (!storyRows[0]) {
      return NextResponse.json({ error: "Story not found or access denied" }, { status: 404 });
    }

    const newStatus = action === "approve" ? "approved" : "not-approved";
    const reviewerId = (session?.user as { userId?: number })?.userId ?? null;

    await retryDbOperation(async () => {
      if (action === "reject") {
        await sql/* sql */`
          UPDATE public.tblalumnistories
          SET status = ${newStatus},
              rejection_reason = ${rejectionReason},
              reviewed_by = ${reviewerId},
              reviewed_at = NOW()
          WHERE id = ${storyId}
        `;
      } else {
        await sql/* sql */`
          UPDATE public.tblalumnistories
          SET status = ${newStatus},
              rejection_reason = NULL,
              reviewed_by = ${reviewerId},
              reviewed_at = NOW()
          WHERE id = ${storyId}
        `;
      }
    });

    return NextResponse.json(
      {
        success: true,
        status: normalizeStoryStatus(newStatus),
        rejectionReason: action === "reject" ? rejectionReason : null,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to review story";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
