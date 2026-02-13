"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";

export type EmailEditorValue = {
  subject: string;
  body: string;
};

export function EmailEditor(props: {
  value: EmailEditorValue;
  onChange: (next: EmailEditorValue) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled } = props;
  const [tab, setTab] = React.useState<"visual" | "html">("visual");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
    ],
    content: value.body || "",
    immediatelyRender: false,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== value.body) {
        onChange({ ...value, body: html });
      }
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value.body || "";
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value.body]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
        <input
          type="text"
          value={value.subject}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setTab("visual")}
              disabled={disabled}
              className={`px-3 py-1.5 text-xs font-semibold ${
                tab === "visual"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              } disabled:opacity-60`}
            >
              Visual
            </button>
            <button
              type="button"
              onClick={() => setTab("html")}
              disabled={disabled}
              className={`px-3 py-1.5 text-xs font-semibold border-l border-gray-200 dark:border-gray-700 ${
                tab === "html"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              } disabled:opacity-60`}
            >
              HTML
            </button>
          </div>
        </div>

        {tab === "html" ? (
          <textarea
            rows={12}
            value={value.body}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
        ) : (
          <div className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
              Write your email message like a document. Formatting and links are supported.
            </div>
            <div className="px-3 py-2">
              <EditorContent
                editor={editor}
                className="min-h-[220px] prose prose-sm dark:prose-invert max-w-none focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
