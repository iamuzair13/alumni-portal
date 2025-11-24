import { NextResponse } from "next/server";
import { verifySMTPConfig } from "@/lib/email";
import { auth } from "@/lib/auth";

// Test endpoint to verify SMTP configuration
// Only accessible to authenticated users
export async function GET() {
  try {
    const session = await auth();
    
    // Only allow authenticated users (you can restrict this further if needed)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await verifySMTPConfig();
    
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    }, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ok: false,
      message: `Error checking SMTP configuration: ${errorMessage}`,
    }, { status: 500 });
  }
}

