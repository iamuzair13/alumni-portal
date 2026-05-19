"use client";

import { Suspense } from "react";
import CampusMembershipForm from "@/components/forms/campus-membership-form";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
};

function CricketMembershipFormInner({ alumniId, sapId }: Props) {
  return <CampusMembershipForm facilityType="cricket" alumniId={alumniId} sapId={sapId} />;
}

export default function CricketMembershipForm(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CricketMembershipFormInner {...props} />
    </Suspense>
  );
}
