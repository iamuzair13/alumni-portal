import Link from "next/link";
import { PencilLine, CreditCard, GraduationCap, LayoutGrid, Building2, ClipboardList } from "lucide-react";

type QuickActionsRowProps = {
  sapId: string;
  cardIssued: boolean;
  isViewer: boolean;
};

export default function QuickActionsRow({ sapId, cardIssued, isViewer }: QuickActionsRowProps) {
  const enc = encodeURIComponent(sapId);
  const withSap = (href: string) => (sapId ? `${href}${href.includes("?") ? "&" : "?"}sapid=${enc}` : href);

  const actions: { href: string; label: string; icon: React.ReactNode; primary?: boolean }[] = [
    ...(isViewer
      ? []
      : [{ href: withSap("/alumni-profile?tab=profile"), label: "Edit Profile", icon: <PencilLine className="h-4 w-4" /> }]),
    ...(cardIssued
      ? [
          {
            href: `/alumni-profile/card-print?sapid=${enc}`,
            label: "Digital Card",
            icon: <CreditCard className="h-4 w-4" />,
            primary: true,
          },
        ]
      : []),
    ...(isViewer
      ? []
      : [
          {
            href: withSap("/alumni-profile/scholarship-application"),
            label: "Apply Scholarship",
            icon: <GraduationCap className="h-4 w-4" />,
          },
        ]),
    {
      href: withSap("/alumni-profile/benefits/campus-facilities"),
      label: "Campus Membership",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      href: withSap("/alumni-profile?tab=all-benefits"),
      label: "All Benefits",
      icon: <LayoutGrid className="h-4 w-4" />,
    },
    {
      href: withSap("/alumni-profile/view-applications"),
      label: "My Applications",
      icon: <ClipboardList className="h-4 w-4" />,
    },
  ];

  return (
    <nav aria-label="Quick actions" className="mt-4 flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none ${
            a.primary
              ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700 dark:border-brand-500 dark:bg-brand-500 dark:text-accent-950 dark:hover:bg-brand-400"
              : "border-border-subtle bg-surface text-content-secondary hover:border-brand-300 hover:text-brand-700 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
          }`}
        >
          {a.icon}
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
