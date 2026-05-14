import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSuperAdminUser } from "@/lib/alumniProfile";

export async function middleware(request: NextRequest) {
  try {
  const pathname = request.nextUrl.pathname;
  const isPublicAuthPage =
    pathname === "/alumni-registration" ||
    pathname === "/alumni-verification";

  const session = await auth();

  // If no session, redirect to signin (except public alumni auth pages)
  if (!session?.user) {
    if (isPublicAuthPage) {
      return NextResponse.next();
    }
    const signInUrl = new URL("/signin", request.url);
    // Preserve the original URL as a redirect parameter
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Restrict Setup to Super Admin only
  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    if (!isSuperAdminUser(session.user)) {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("error", "FORBIDDEN");
      return NextResponse.redirect(redirectUrl);
    }
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
    /*
     * Match all request paths except:
     * - api routes
     * - _next (Next.js internals)
     * - static files (images, favicon, etc.)
     * - signin page
     * - public alumni registration / verification (middleware not invoked; safe if matcher changes)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|images/|signin|alumni-registration|alumni-verification).*)",
  ],
};