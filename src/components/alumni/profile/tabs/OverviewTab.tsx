import BenefitsBento, {
  type EngagementSummary,
  type MembershipSummary,
  type MerchantSummary,
  type ScholarshipSummary,
} from "@/components/alumni/profile/BenefitsBento";
import QuickActionsRow from "@/components/alumni/profile/QuickActionsRow";
import type { CardStatus } from "@/app/alumni-profile/status";

type OverviewTabProps = {
  sapId: string;
  cardStatus: CardStatus;
  cardValidity?: string;
  cardIssued: boolean;
  isViewer: boolean;
  scholarships: ScholarshipSummary;
  memberships: MembershipSummary;
  merchants: MerchantSummary;
  chapters: string[];
  engagement: EngagementSummary;
};

export default function OverviewTab({
  sapId,
  cardStatus,
  cardValidity,
  cardIssued,
  isViewer,
  scholarships,
  memberships,
  merchants,
  chapters,
  engagement,
}: OverviewTabProps) {
  return (
    <div>
      <BenefitsBento
        sapId={sapId}
        cardStatus={cardStatus}
        cardValidity={cardValidity}
        isViewer={isViewer}
        scholarships={scholarships}
        memberships={memberships}
        merchants={merchants}
        chapters={chapters}
        engagement={engagement}
      />
      <QuickActionsRow sapId={sapId} cardIssued={cardIssued} isViewer={isViewer} />
    </div>
  );
}
