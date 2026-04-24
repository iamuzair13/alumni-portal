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
      {isSuperAdmin && (
        <header className="rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm sticky top-0 z-30 backdrop-blur-sm dark:border-gray-800 dark:bg-white/[0.04] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Alumni portal
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white/95 sm:text-3xl">
                Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Overview of alumni services, applications, and engagement. Open analytics for trends and growth across modules.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/admin/analytics"
                className="group inline-flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-white/90 dark:hover:border-brand-500/50 dark:hover:bg-brand-950/40 dark:hover:text-brand-200"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 transition-colors group-hover:bg-brand-500/15 dark:text-brand-400"
                  aria-hidden
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </span>
                <span className="text-left leading-tight">
                  <span className="block">View Analytics</span>
                  <span className="mt-0.5 block text-xs font-normal text-gray-500 group-hover:text-brand-600/90 dark:text-gray-500 dark:group-hover:text-brand-300/90">
                    Trends and insights
                  </span>
                </span>
                <svg
                  className="ml-1 h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className="grid grid-cols-12">
        <div className="col-span-12 xl:col-span-12">
          <AlumniTabbedMenu />
        </div>
      </div>
    </div>
  );
}

