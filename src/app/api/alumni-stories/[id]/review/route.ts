import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { normalizeStoryStatus } from "@/lib/alumniStories";
import { sendEmail } from "@/lib/email";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";

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
      SELECT
        s.id,
        s.status,
        s.storytitle,
        a.alumniname,
        a.personalemail,
        a.officialemail,
        a.universityemail
      FROM public.tblalumnistories s
      INNER JOIN public.tbl_alumni a ON a.alumniid = s.alumniid
      WHERE s.id = ${storyId}
        ${accessCondition}
      LIMIT 1
    `;

    if (!storyRows[0]) {
      return NextResponse.json({ error: "Story not found or access denied" }, { status: 404 });
    }

    const story = storyRows[0] as {
      id: number;
      status: string | null;
      storytitle: string | null;
      alumniname: string | null;
      personalemail: string | null;
      officialemail: string | null;
      universityemail: string | null;
    };

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

    const alumniName = String(story.alumniname || "Alumni");
    const alumniEmail = String(
      story.personalemail || story.officialemail || story.universityemail || ""
    );
    const storyTitle = String(story.storytitle || "Success Story");
    const portalBase = process.env.NEXT_PUBLIC_BASE_URL || "https://portal-alumni.uol.edu.pk";
    const editUrl = `${portalBase}/alumni-success/${storyId}/edit`;
    const viewUrl = `${portalBase}/alumni-success/${storyId}`;

    if (alumniEmail) {
      const emailAction =
        action === "approve"
          ? EMAIL_ACTION_TYPE.SUCCESS_STORY_APPROVED
          : EMAIL_ACTION_TYPE.SUCCESS_STORY_NOT_APPROVED;
      const extraBodyHtml =
        action === "approve"
          ? `<p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your story "<strong>${storyTitle}</strong>" is now live on the Alumni Portal.</p>
             <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;"><a href="${viewUrl}" style="color: #2563eb;">View your published story</a></p>`
          : `<p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">Your story "<strong>${storyTitle}</strong>" could not be approved at this time.</p>
             <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;"><strong>Reason:</strong> ${rejectionReason}</p>
             <p style="margin: 12px 0 0 0; color: #333333; font-size: 16px;">You may revise your story and submit it again for review. <a href="${editUrl}" style="color: #2563eb;">Edit your story</a></p>`;

      const { subject, html } = generateAdminActionEmail({
        actionType: emailAction,
        alumniName,
        extraBodyHtml,
      });
      sendEmail({ to: alumniEmail, subject, html }).catch(() => {});
    }

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
