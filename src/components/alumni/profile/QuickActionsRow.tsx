import Link from "next/link";
import {
  Dumbbell,
  FileText,
  GraduationCap,
  IdCard,
  PencilLine,
} from "lucide-react";

type QuickActionsRowProps = {
  sapId: string;
  isViewer: boolean;
  cardIssued: boolean;
};

type Action = {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
};

export default function QuickActionsRow({ sapId, isViewer, cardIssued }: QuickActionsRowProps) {
  const sap = sapId ? `?sapid=${encodeURIComponent(sapId)}` : "";

  const actions: Action[] = [
    { href: "#profile", label: "Edit Profile", icon: <PencilLine className="h-4 w-4" aria-hidden /> },
    ...(cardIssued
      ? [{ href: `/alumni-profile/card-print${sap}`, label: "Digital Card", icon: <IdCard className="h-4 w-4" aria-hidden />, external: true }]
      : []),
    ...(!isViewer
      ? [
          { href: `/alumni-profile/scholarship-application${sap}`, label: "Apply Scholarship", icon: <GraduationCap className="h-4 w-4" aria-hidden /> },
          { href: `/alumni-profile/benefits/campus-facilities${sap}`, label: "Campus Membership", icon: <Dumbbell className="h-4 w-4" aria-hidden /> },
        ]
      : []),
    { href: `/alumni-profile/view-applications${sap}`, label: "My Applications", icon: <FileText className="h-4 w-4" aria-hidden /> },
  ];

  return (
    <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2 sm:gap-3">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-brand-950/40 dark:hover:text-brand-200"
        >
          {a.icon}
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
