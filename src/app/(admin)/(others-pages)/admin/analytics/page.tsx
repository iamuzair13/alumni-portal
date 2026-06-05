import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import AnalyticsDashboardClient from "@/components/analytics/AnalyticsDashboardClient";

export const metadata: Metadata = {
  title: "Analytics - Admin",
  description: "Analytics & insights across modules",
};

function hasType(u: unknown): u is { type?: string } {
  return typeof u === "object" && u !== null && "type" in u;
}

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session) {
    redirect("/signin");
  }

  const role = String(hasType(session.user) ? session.user.type ?? "" : "").toLowerCase().trim();
  if (role !== "admin" && role !== "superadmin" && role !== "viewer" && role !== "user") {
    redirect("/alumni-profile");
  }

  return (
    <div>
    
        <AnalyticsDashboardClient />

    </div>
  );
}

