import {
  BookOpenCheck,
  HeartPulse,
  Dumbbell,
  Store,
  Briefcase,
  Users2,
  Award,
} from "lucide-react";
import { HubTile, SectionHeader } from "@/components/alumni/profile/hub-ui";

type BenefitsTabProps = { sapId: string };

const PERKS: {
  slug: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  tone: "brand" | "amber" | "sky" | "violet" | "rose" | "emerald" | "orange";
}[] = [
  {
    slug: "academic-benefits",
    title: "Academic Benefits",
    desc: "Avail special tuition and admission discounts offered to UOL alumni.",
    icon: <BookOpenCheck />,
    tone: "brand",
  },
  {
    slug: "healthcare-benefits",
    title: "Healthcare Benefits",
    desc: "Avail comprehensive health insurance and wellness programs as UOL alumni members.",
    icon: <HeartPulse />,
    tone: "emerald",
  },
  {
    slug: "campus-facilities",
    title: "Campus Facilities and Memberships",
    desc: "Enjoy access to gym, sports facilities, and exclusive campus amenities.",
    icon: <Dumbbell />,
    tone: "sky",
  },
  {
    slug: "merchant-promotions",
    title: "Merchant and Business Promotions",
    desc: "Exclusive partner discounts and offers available for alumni (with the Alumni Card).",
    icon: <Store />,
    tone: "orange",
  },
  {
    slug: "career-mentorship",
    title: "Career and Mentorship",
    desc: "Avail exclusive career and professional development opportunities.",
    icon: <Briefcase />,
    tone: "violet",
  },
  {
    slug: "chapters-events",
    title: "Chapters & Engagement Events",
    desc: "You can join chapters based on their city or country to connect locally and globally.",
    icon: <Users2 />,
    tone: "rose",
  },
  {
    slug: "recognition",
    title: "Identity, Inclusion & Recognition",
    desc: "Avail opportunities to be honored for achievements via awards and spotlights.",
    icon: <Award />,
    tone: "amber",
  },
];

export default function BenefitsTab({ sapId }: BenefitsTabProps) {
  const enc = encodeURIComponent(sapId);
  const withSap = (href: string) => (sapId ? `${href}?sapid=${enc}` : href);

  return (
    <div>
      <SectionHeader
        title="Perks & Benefits"
        description="Explore exclusive benefits and opportunities available to UOL alumni members."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {PERKS.map((p) => (
          <HubTile
            key={p.slug}
            href={withSap(`/alumni-profile/benefits/${p.slug}`)}
            icon={p.icon}
            tone={p.tone}
            label={p.title}
            headline=""
            subline={p.desc}
            cta="Learn more"
          />
        ))}
      </div>
    </div>
  );
}
