import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  try {
  const session = await auth();
  
  // If no session, redirect to signin
  if (!session?.user) {
    const signInUrl = new URL("/signin", request.url);
    // Preserve the original URL as a redirect parameter
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }
  
  // If session exists, allow the request to proceed
  return NextResponse.next();
  } catch (error) {
    // Log the error for debugging
    console.error("[Middleware] Auth error:", error);
    
    // On auth failure, redirect to signin instead of crashing
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    signInUrl.searchParams.set("error", "AUTH_ERROR");
    return NextResponse.redirect(signInUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next|api|signin|favicon.ico|images/).*)",
  ],
};