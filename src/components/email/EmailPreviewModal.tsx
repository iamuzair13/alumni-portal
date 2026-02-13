"use client";

import React, { useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { EmailEditor, type EmailEditorValue } from "@/components/email/EmailEditor";

export function EmailPreviewModal(props: {
  isOpen: boolean;
  onClose: () => void;
  initial: EmailEditorValue;
  onSend: (payload: EmailEditorValue) => Promise<void>;
  sending?: boolean;
}) {
  const { isOpen, onClose, initial, onSend, sending } = props;
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState<EmailEditorValue>(initial);
  const [saved, setSaved] = useState<EmailEditorValue>(initial);

  React.useEffect(() => {
    if (!isOpen) return;
    setMode("preview");
    setDraft(initial);
    setSaved(initial);
  }, [isOpen, initial]);

  const contentHtml = useMemo(() => saved.body || "", [saved.body]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!sending) onClose();
      }}
      className="max-w-6xl mx-auto"
      showCloseButton={true}
    >
      <div className="p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Email Preview</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Review the email before sending.</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subject</div>
          <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
            {saved.subject || "-"}
          </div>
        </div>

        {mode === "edit" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Edit
              </div>
              <div className="p-4">
                <EmailEditor value={draft} onChange={setDraft} disabled={sending} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Live Preview
              </div>
              <div className="p-4 max-h-[55vh] overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: draft.body || "" }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Email Content
            </div>
            <div className="p-4 max-h-[55vh] overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          {mode === "preview" ? (
            <button
              type="button"
              onClick={() => setMode("edit")}
              disabled={sending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Edit Email
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("preview");
              }}
              disabled={sending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Back to Preview
            </button>
          )}

          {mode === "edit" && (
            <button
              type="button"
              onClick={() => {
                setSaved(draft);
                setMode("preview");
              }}
              disabled={sending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              Save Email
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              await onSend(saved);
            }}
            disabled={sending}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
