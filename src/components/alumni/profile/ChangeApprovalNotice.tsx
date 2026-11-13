"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import { Notice } from "@/components/alumni/profile/hub-ui";

export default function ChangeApprovalNotice({ sapId }: { sapId: string }) {
  const { data: fullDetails } = useAlumniFullDetails(sapId || undefined);
  const changeApproval = String(fullDetails?.change_approval ?? "").toLowerCase().trim();
  const [dismissedChangeApproval, setDismissedChangeApproval] = useState(false);

  useEffect(() => {
    const storageKey = `change-approval-dismissed:${sapId}`;
    try {
      setDismissedChangeApproval(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissedChangeApproval(false);
    }
  }, [sapId]);

  useEffect(() => {
    if (changeApproval === "pending") {
      setDismissedChangeApproval(false);
      const storageKey = `change-approval-dismissed:${sapId}`;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [changeApproval, sapId]);

  const dismiss = () => {
    setDismissedChangeApproval(true);
    const storageKey = `change-approval-dismissed:${sapId}`;
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  };

  const dismissBtn = (
    <button
      type="button"
      onClick={dismiss}
      className="shrink-0 rounded-full border border-current/30 px-2 py-0.5 text-[11px] font-bold opacity-80 transition-opacity hover:opacity-100"
    >
      Dismiss
    </button>
  );

  if (changeApproval === "pending") {
    return (
      <Notice variant="warning" icon={<Clock />}>
        Change Approval Pending
      </Notice>
    );
  }

  if (changeApproval === "accepted" && !dismissedChangeApproval) {
    return (
      <Notice variant="success" icon={<CheckCircle2 />} action={dismissBtn}>
        Change Approved
      </Notice>
    );
  }

  if (changeApproval === "rejected" && !dismissedChangeApproval) {
    return (
      <Notice variant="error" icon={<XCircle />} action={dismissBtn}>
        Change Rejected
      </Notice>
    );
  }

  return null;
}
