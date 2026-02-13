"use client";

import React, { useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { useEmailHistory, type EmailLogItem } from "@/app/queries/fetch-email-history";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { emailHistoryKey } from "@/app/queries/fetch-email-history";

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-PK", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export function EmailHistoryModal(props: {
  isOpen: boolean;
  onClose: () => void;
  alumniId: number | null;
}) {
  const { isOpen, onClose, alumniId } = props;
  const { data = [], isLoading, error } = useEmailHistory(alumniId, isOpen);
  const [selected, setSelected] = useState<EmailLogItem | null>(null);
  const qc = useQueryClient();
  const [isSendingCredentials, setIsSendingCredentials] = useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setSelected(null);
    }
  }, [isOpen]);

  const sent = useMemo(() => data.filter((x) => String(x.status).toLowerCase() === "sent"), [data]);
  const failed = useMemo(() => data.filter((x) => String(x.status).toLowerCase() !== "sent"), [data]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[800px] mx-auto" showCloseButton={true}>
      <div className="p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Email History</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sent and unsuccessful emails for this alumni.</p>
          </div>
          <button
            type="button"
            disabled={!alumniId || alumniId <= 0 || isSendingCredentials}
            onClick={async () => {
              if (!alumniId) return;
              try {
                setIsSendingCredentials(true);
                const res = await fetch("/api/send-credentials", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", accept: "application/json" },
                  body: JSON.stringify({ alumniId }),
                });
                const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
                if (!res.ok || !data.ok) {
                  throw new Error(data?.error || data?.message || `Failed (${res.status})`);
                }
                toast.success("Credentials email sent");
                await qc.invalidateQueries({ queryKey: emailHistoryKey(alumniId) });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to send credentials");
              } finally {
                setIsSendingCredentials(false);
              }
            }}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSendingCredentials ? "Sending..." : "Send Credentials"}
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-sm text-rose-600">{error.message || "Failed to load"}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Sent ({sent.length})
                </div>
                <div className="max-h-[45vh] overflow-y-auto custom-scrollbar">
                  {sent.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No sent emails</div>
                  ) : (
                    sent.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelected(item)}
                        className={`w-full text-left p-4 border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selected?.id === item.id ? "bg-blue-50/70 dark:bg-blue-900/20" : ""}`}
                      >
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.subject}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatTs(item.created_at)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Unsuccessful ({failed.length})
                </div>
                <div className="max-h-[45vh] overflow-y-auto custom-scrollbar">
                  {failed.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No failed emails</div>
                  ) : (
                    failed.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelected(item)}
                        className={`w-full text-left p-4 border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selected?.id === item.id ? "bg-blue-50/70 dark:bg-blue-900/20" : ""}`}
                      >
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.subject}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatTs(item.created_at)}</div>
                        {item.error_message ? (
                          <div className="text-xs text-rose-600 mt-1 truncate">{item.error_message}</div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Email Details
              </div>
              <div className="p-4">
                {!selected ? (
                  <div className="text-sm text-gray-500">Select an email to view details</div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Subject</div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">{selected.subject}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Status</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{selected.status}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Timestamp</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{formatTs(selected.created_at)}</div>
                      </div>
                    </div>
                    {selected.error_message ? (
                      <div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Error</div>
                        <div className="text-sm text-rose-700 dark:text-rose-300 whitespace-pre-wrap">{selected.error_message}</div>
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800">Body</div>
                      <div className="p-3 max-h-[45vh] overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: selected.body }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
