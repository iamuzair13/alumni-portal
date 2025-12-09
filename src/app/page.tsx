import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();

  // If not authenticated, redirect to signin
  if (!session?.user) {
    redirect("/signin");
  }

  // Check user type
  function hasType(u: unknown): u is { type?: string } {
    return typeof u === "object" && u !== null && "type" in u;
  }
  
  const role = String(hasType(session.user) ? session.user.type ?? "" : "").toLowerCase().trim();

  // Alumni users go to alumni profile
  if (role === "alumni") {
    redirect("/alumni-profile");
  }

  // Admin/viewer users go to dashboard
  if (role === "admin" || role === "superadmin" || role === "viewer" || role === "user") {
    redirect("/dashboard");
  }

  // Default: redirect to signin
  redirect("/signin");
}

