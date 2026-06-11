"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { canModify } from "@/lib/alumniProfile";
import { Modal } from "@/components/ui/modal";
import { SendEmailButton } from "@/components/email/SendEmailButton";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import {
  type CardStatus,
  type DbCardStatus,
  CARD_STATUS_CONFIG,
  mapDbStatusToUI,
  mapUIStatusToDb,
  getStatusLabel,
  normalizeDbStatus,
} from "@/lib/card-status-config";
import { useCardStatus, cardStatusKey, type CardData } from "@/app/queries/fetch-card-status";
import {
  cardApplicantsKey,
  type CardApplicantsResponse,
  type CardStatusFilter,
} from "@/app/queries/fetch-card-applicants";

/** Stored in tblcard.reason_onhold; sent in notification email. */
export const ON_HOLD_REASON_OPTIONS = [
  { value: "Picture issue", label: "📷 Picture Issue — Blurry, incorrect format, or missing photo" },
  { value: "Data Mismatch", label: "📋 Data Mismatch — Information doesn't match university records" },
  { value: "Islamabad Campus", label: "🏛️ Islamabad Campus" },
] as const;

export type OnHoldReason = (typeof ON_HOLD_REASON_OPTIONS)[number]["value"];

export type PendingCardStatusChange = {
  sapId: string;
  alumniId: number | null;
  recipientEmail: string | null;
  alumniName: string;
  fromStatus: DbCardStatus;
  toStatus: DbCardStatus;
  reason?: string;
};

function getStatusSelectStyles(status: string | null): string {
  const base = "border-transparent";
  switch (status) {
    case "Pending":
    case "UnderReview":
      return `${base} bg-amber-50 text-amber-800 hover:bg-amber-100 focus:border-amber-500 dark:bg-amber-900/20 dark:text-amber-300`;
    case "Process":
    case "UnderPrinting":
      return `${base} bg-purple-50 text-purple-800 hover:bg-purple-100 focus:border-purple-500 dark:bg-purple-900/20 dark:text-purple-300`;
    case "Active":
      return `${base} bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300`;
    case "Delivered":
      return `${base} bg-blue-50 text-blue-800 hover:bg-blue-100 focus:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300`;
    case "Onhold":
      return `${base} bg-rose-50 text-rose-800 hover:bg-rose-100 focus:border-rose-500 dark:bg-rose-900/20 dark:text-rose-300`;
    default:
      return `${base} bg-gray-50 text-gray-700 hover:bg-gray-100 focus:border-gray-500 dark:bg-gray-800 dark:text-gray-300`;
  }
}

function getStatusDotColor(status: string | null): string {
  switch (status) {
    case "Pending":
    case "UnderReview":
      return "bg-amber-400";
    case "Process":
    case "UnderPrinting":
      return "bg-purple-400";
    case "Active":
      return "bg-emerald-400";
    case "Delivered":
      return "bg-blue-400";
    case "Onhold":
      return "bg-rose-400";
    default:
      return "bg-gray-400";
  }
}

function StatusBadge({ status }: { status: string | null }) {
  const styles = getStatusSelectStyles(status);
  const label = status ? getStatusLabel(mapDbStatusToUI(status as DbCardStatus)) : "Unknown";

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotColor(status)}`} />
      {label}
    </span>
  );
}

function resolveContact(
  alumniId: number | null | undefined,
  recipientEmail: string | null | undefined,
  cardData: CardData | null | undefined
): { alumniId: number | null; recipientEmail: string | null } {
  const resolvedAlumniId =
    alumniId != null && Number(alumniId) > 0
      ? Number(alumniId)
      : cardData?.alumniid != null && Number(cardData.alumniid) > 0
        ? Number(cardData.alumniid)
        : null;

  const fromProps = String(recipientEmail ?? "").trim();
  const fromCard = String(cardData?.email ?? "").trim();
  const resolvedEmail = fromProps || fromCard || null;

  return { alumniId: resolvedAlumniId, recipientEmail: resolvedEmail };
}

type CardStatusSelectProps = {
  sapId: string;
  alumniId?: number | null;
  recipientEmail?: string | null;
  alumniName?: string;
  initialStatus?: CardStatus;
  readOnly?: boolean;
  onStatusChangeRequest: (change: PendingCardStatusChange) => void;
};

export const CardStatusSelect: React.FC<CardStatusSelectProps> = ({
  sapId,
  alumniId,
  recipientEmail,
  alumniName,
  initialStatus,
  readOnly = false,
  onStatusChangeRequest,
}) => {
  const { data: session, status: sessionStatus } = useSession();
  const [localStatus, setLocalStatus] = React.useState<DbCardStatus | null>(null);
  const [showReasonInput, setShowReasonInput] = React.useState<boolean>(false);
  const hasUpdatedRef = React.useRef(false);
  const canEdit = !readOnly && sessionStatus !== "loading" && canModify(session?.user);

  const getDbStatusFromUI = (uiStatus?: CardStatus): DbCardStatus => {
    const dbStatus = mapUIStatusToDb(uiStatus || "under-review");
    return dbStatus || "UnderReview";
  };

  const initialDbStatus = initialStatus ? getDbStatusFromUI(initialStatus) : null;
  const { data, isLoading } = useCardStatus(sapId);
  const contact = resolveContact(alumniId, recipientEmail, data);

  React.useEffect(() => {
    if (!hasUpdatedRef.current && data !== undefined) {
      if (data?.status) {
        const normalizedStatus = normalizeDbStatus(data.status);
        setLocalStatus(normalizedStatus);
        if (normalizedStatus === "Onhold" && data.reason_onhold) {
          setShowReasonInput(true);
        }
      } else if (initialDbStatus && !data) {
        setLocalStatus(initialDbStatus);
      } else {
        setLocalStatus("UnderReview");
      }
    } else if (initialDbStatus && !hasUpdatedRef.current && !data) {
      setLocalStatus(initialDbStatus);
    }
  }, [data, initialDbStatus]);

  const current = localStatus ?? initialDbStatus ?? (data?.status ? normalizeDbStatus(data.status) : "UnderReview");

  React.useEffect(() => {
    setShowReasonInput(current === "Onhold");
  }, [current]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = normalizeDbStatus(e.target.value) as DbCardStatus;
    if (next === current) return;

    if (!canEdit) return;

    onStatusChangeRequest({
      sapId,
      alumniId: contact.alumniId,
      recipientEmail: contact.recipientEmail,
      alumniName: alumniName || "Alumni",
      fromStatus: current,
      toStatus: next,
      reason: next === "Onhold" ? "" : undefined,
    });
  };

  const uiStatus = current ? mapDbStatusToUI(current) : "under-review";
  const statusLabel = getStatusLabel(uiStatus);

  if (readOnly) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{statusLabel}</span>
        {current === "Onhold" && data?.reason_onhold && (
          <span className="text-[10px] text-gray-500" title={data.reason_onhold}>
            (Reason: {data.reason_onhold})
          </span>
        )}
      </div>
    );
  }

  const onHoldEmailTpl =
    current === "Onhold" && data?.reason_onhold
      ? generateAdminActionEmail({
          actionType: EMAIL_ACTION_TYPE.ALUMNI_CARD_ONHOLD,
          alumniName: alumniName || "Alumni",
          extraBodyHtml: `<p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;"><strong>Reason:</strong> ${String(data.reason_onhold)}</p>`,
        })
      : null;

  return (
    <div
      className="flex flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <div className="relative group">
          <select
            aria-label="Card status"
            value={current}
            disabled={isLoading || !canEdit}
            onChange={handleStatusChange}
            className={`
              appearance-none rounded-xl border px-3.5 py-2 pr-10 text-xs font-semibold shadow-sm
              transition-all duration-200 cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/30
              disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
              hover:shadow-md
              ${getStatusSelectStyles(current)}
            `}
          >
            {Object.entries(CARD_STATUS_CONFIG)
              .filter(([key]) => key !== "all")
              .map(([key, config]) => (
                <option key={key} value={config.dbValue || ""}>
                  {config.label}
                </option>
              ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <svg
              className={`h-3.5 w-3.5 transition-colors ${isLoading || !canEdit ? "text-gray-300" : "text-gray-400 group-hover:text-gray-600"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

      </div>

      {showReasonInput && current === "Onhold" && data?.reason_onhold && (
        <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-3 shadow-sm space-y-3">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                On Hold Reason
              </span>
              <p className="text-xs text-amber-900 dark:text-amber-300 mt-1 font-medium leading-relaxed">
                {data.reason_onhold}
              </p>
            </div>
          </div>
          {contact.alumniId && contact.recipientEmail && onHoldEmailTpl && (
            <div className="flex justify-end">
              <SendEmailButton
                alumniId={contact.alumniId}
                recipientEmail={contact.recipientEmail}
                actionType={EMAIL_ACTION_TYPE.ALUMNI_CARD_ONHOLD}
                initialSubject={onHoldEmailTpl.subject}
                initialBody={onHoldEmailTpl.html}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type CardStatusConfirmModalProps = {
  pending: PendingCardStatusChange | null;
  isOpen: boolean;
  isUpdating: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onReasonChange: (reason: string) => void;
  onClearError: () => void;
};

export const CardStatusConfirmModal: React.FC<CardStatusConfirmModalProps> = ({
  pending,
  isOpen,
  isUpdating,
  error,
  onClose,
  onConfirm,
  onReasonChange,
  onClearError,
}) => {
  const { data: cardData } = useCardStatus(isOpen && pending?.sapId ? pending.sapId : undefined);

  if (!pending) return null;

  const contact = resolveContact(pending.alumniId, pending.recipientEmail, cardData);
  const effectiveAlumniId = contact.alumniId;
  const effectiveRecipientEmail = contact.recipientEmail;
  const next = pending.toStatus;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg mx-auto" showCloseButton={true}>
      <div className="p-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Confirm Status Change</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Review details before confirming</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Current</div>
              <StatusBadge status={pending.fromStatus} />
            </div>
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">New Status</div>
              <StatusBadge status={pending.toStatus} />
            </div>
          </div>

          {pending.toStatus === "Onhold" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Reason for On Hold
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This reason will be saved to the database and included in the notification email.
                </p>
              </div>
              <div className="relative">
                <select
                  aria-label="On hold reason"
                  value={pending.reason || ""}
                  disabled={isUpdating}
                  onChange={(e) => {
                    onReasonChange(e.target.value);
                    onClearError();
                  }}
                  className={`
                    w-full rounded-xl border px-4 py-3 text-sm shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    appearance-none pr-10
                    ${!pending.reason ? "border-gray-300 bg-white text-gray-500" : "border-amber-300 bg-amber-50/30 text-gray-900"}
                  `}
                >
                  <option value="" disabled>
                    Select a reason...
                  </option>
                  {ON_HOLD_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
            </div>
          )}

          {(() => {
            if (!next) return null;
            if (next !== "Onhold" && next !== "Active") return null;

            if (!effectiveAlumniId || !effectiveRecipientEmail) {
              return (
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 flex items-start gap-3">
                  <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Email preview unavailable</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                      Alumni email or ID is missing for this record.
                    </p>
                  </div>
                </div>
              );
            }

            if (next === "Onhold" && !String(pending.reason || "").trim()) {
              return (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
                  <svg className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email notification ready</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                      Select an On Hold reason above to preview and customize the email.
                    </p>
                  </div>
                </div>
              );
            }

            const actionType =
              next === "Onhold"
                ? EMAIL_ACTION_TYPE.ALUMNI_CARD_ONHOLD
                : EMAIL_ACTION_TYPE.ALUMNI_CARD_READY_FOR_DELIVERY;

            const tpl = generateAdminActionEmail({
              actionType,
              alumniName: pending.alumniName || "Alumni",
              extraBodyHtml:
                next === "Onhold" && pending.reason
                  ? `<p style="margin: 12px 0 0 0; color: #333333; font-size: 14px;"><strong>Reason:</strong> ${String(pending.reason)}</p>`
                  : "",
            });

            return (
              <div className="rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">Email Notification</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Preview and send email to {effectiveRecipientEmail}
                      </p>
                    </div>
                  </div>
                  <SendEmailButton
                    alumniId={effectiveAlumniId}
                    recipientEmail={effectiveRecipientEmail}
                    actionType={actionType}
                    initialSubject={tpl.subject}
                    initialBody={tpl.html}
                    disabled={isUpdating}
                  />
                </div>

                <div className="mt-3 rounded-lg border border-blue-100 bg-white dark:bg-gray-900 dark:border-gray-700 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Subject</div>
                  <p className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate">{tpl.subject}</p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isUpdating}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 hover:shadow-md hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 inline-flex items-center gap-2"
          >
            {isUpdating ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Confirm Change</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export async function submitCardStatusChange(
  sapId: string,
  next: DbCardStatus,
  reason: string,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<void> {
  const body: { status: string; reason_onhold?: string } = { status: next };
  if (next === "Onhold" && reason) {
    body.reason_onhold = reason;
  }

  const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || `Failed (${res.status})`);
  }

  queryClient.setQueryData(cardStatusKey(sapId), (old: CardData | null) => {
    if (!old) {
      return {
        cardid: 0,
        alumniid: 0,
        email: null,
        cnicno: null,
        cardaddress: null,
        status: next,
        cardpicture: null,
        card_image: null,
        createdat: null,
        reason_onhold: next === "Onhold" ? reason : null,
      };
    }
    return {
      ...old,
      status: next,
      reason_onhold: next === "Onhold" ? reason : null,
    };
  });

  const statuses: CardStatusFilter[] = ["all", "under-review", "underprinting", "active", "onhold", "delivered"];
  for (const s of statuses) {
    const key = cardApplicantsKey(s);
    const current = queryClient.getQueryData<CardApplicantsResponse>(key);

    if (current) {
      const itemIndex = current.items.findIndex(
        (r) => String(r.sapid) === String(sapId) || String(r.registrationno) === String(sapId)
      );
      if (itemIndex !== -1 && itemIndex !== 0) {
        const updatedItem = { ...current.items[itemIndex], status: next };
        const reorderedItems = [updatedItem, ...current.items.slice(0, itemIndex), ...current.items.slice(itemIndex + 1)];
        queryClient.setQueryData(key, { ...current, items: reorderedItems });
      } else if (itemIndex !== -1) {
        const updatedItem = { ...current.items[itemIndex], status: next };
        queryClient.setQueryData(key, { ...current, items: [updatedItem, ...current.items.slice(1)] });
      }
    }
  }

  setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ["alumni", "card", "applicants"], exact: false });
  }, 500);
}
