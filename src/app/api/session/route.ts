import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true, user: session.user }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Session retrieval failed";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[auth] session endpoint error", { message, stack });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}