import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AlumniTabbedMenu } from "@/components/alumni/AlumniTabbedMenu";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Dashboard - Alumni",
  description: "This is Next.js Home for TailAdmin Dashboard Template",
};

export default async function Dashboard() {
  const session = await auth();

  if (!session) {
    redirect("/signin");
  }

  function hasType(u: unknown): u is { type?: string } { return typeof u === "object" && u !== null && "type" in u; }
  const role = String(hasType(session.user) ? session.user.type ?? "" : "").toLowerCase().trim();
  const isSuperAdmin = role === "superadmin";

  // Allow admin, superadmin, and viewer (including legacy "user") to access admin dashboard
  if (role !== "admin" && role !== "superadmin" && role !== "viewer" && role !== "user") {
    redirect("/alumni-profile");
  }

  return (
    <div className="space-y-2">
      

      <div className="grid grid-cols-12">
        <div className="col-span-12 xl:col-span-12">
          <AlumniTabbedMenu />
        </div>
      </div>
    </div>
  );
}

