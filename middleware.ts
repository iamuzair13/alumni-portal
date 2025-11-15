export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!_next|api|signin|favicon.ico).*)",
  ],
};