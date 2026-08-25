import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminActivityLog";
import type { Session } from "next-auth";
import { handleCampusMembershipPost } from "@/lib/campusMembershipSubmit";

export async function POST(req: Request) {
  let session: Session | null = null;
  try {
    session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    const result = await handleCampusMembershipPost(req, "pool", session);
    await logAdminAction({
      session,
      req,
      input: {
        action: "memberships.swimming_pool_submit",
        entityType: "alumni_memberships",
        success: true,
      },
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    await logAdminAction({
      session,
      req,
      input: {
        action: "memberships.swimming_pool_submit",
        entityType: "alumni_memberships",
        success: false,
        errorMessage,
      },
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
