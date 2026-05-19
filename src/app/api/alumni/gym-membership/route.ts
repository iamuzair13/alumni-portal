import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleCampusMembershipPost } from "@/lib/campusMembershipSubmit";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return await handleCampusMembershipPost(req, "gym", session);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
