"use client";
import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Modal } from "@/components/ui/modal";

type LeadershipType = "chapter" | "association";
type LeadershipRoleName = "president" | "vice_president" | "coordinator";
type PdfSectionKey = "role_description" | "code_of_ethics" | "compliance_declaration" | "office_term_governance";

export default function RoleDescriptionSection(props: {
  title: string;
  content: string;
  onSave: (nextHtml: string) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  pdfSection?: PdfSectionKey;

  roleDescriptionDraft?: string;
  setRoleDescriptionDraft?: React.Dispatch<React.SetStateAction<string>>;
  savingRoleDescription?: boolean;

  criteriaType?: LeadershipType;
  criteriaRole?: LeadershipRoleName;
  typeLabel?: (t: LeadershipType) => string;
  roleLabel?: (role: LeadershipRoleName) => string;
}) {
  const {
    title,
    content,
    onSave,
    disabled,
    loading,
    pdfSection,
    roleDescriptionDraft,
    setRoleDescriptionDraft,
    savingRoleDescription,
    criteriaType,
    criteriaRole,
    typeLabel,
    roleLabel,
  } = props;

  const [editOpen, setEditOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [internalDraft, setInternalDraft] = React.useState<string>(content || "");
  const [internalSaving, setInternalSaving] = React.useState(false);

  const effectivePdfSection: PdfSectionKey = pdfSection || "role_description";

  const effectiveSavedHtml = String(content || "");
  const effectiveDraftHtml = (() => {
    if (roleDescriptionDraft !== undefined) {
      const s = String(roleDescriptionDraft || "");
      return s.trim() ? s : effectiveSavedHtml;
    }
    return String(internalDraft || "") || effectiveSavedHtml;
  })();

  const currentDraft = roleDescriptionDraft ?? internalDraft;
  const setCurrentDraft = setRoleDescriptionDraft ?? setInternalDraft;
  const isSaving = Boolean(savingRoleDescription ?? internalSaving);
  const isDisabled = Boolean(disabled || loading || isSaving);

  React.useEffect(() => {
    if (roleDescriptionDraft !== undefined) return;
    setInternalDraft(content || "");
  }, [content, roleDescriptionDraft]);

  React.useEffect(() => {
    if (!editOpen) return;
    setCurrentDraft(effectiveSavedHtml);
  }, [effectiveSavedHtml, editOpen, setCurrentDraft]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: effectiveDraftHtml || "",
    editable: editOpen && !isDisabled,
    onUpdate: ({ editor }) => {
      setCurrentDraft(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[260px] p-3",
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(editOpen && !isDisabled);
  }, [editor, editOpen, isDisabled]);

  React.useEffect(() => {
    if (!editor) return;
    if (!editOpen) return;
    const current = editor.getHTML();
    const next = effectiveDraftHtml || "";
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, editOpen, effectiveDraftHtml]);

  const print = () => {
    try {
      if (!criteriaType || !criteriaRole) {
        window.alert("Missing role context for PDF download.");
        return;
      }

      const url = new URL(
        "/api/leadership/role-description-pdf",
        typeof window !== "undefined" ? window.location.origin : ""
      );
      url.searchParams.set("type", criteriaType);
      url.searchParams.set("role", criteriaRole);
      url.searchParams.set("section", effectivePdfSection);

      fetch(url.toString(), { headers: { accept: "application/pdf" } })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const err =
              data && typeof data === "object" && "error" in data
                ? String((data as { error?: unknown }).error || "")
                : "";
            throw new Error(err || "Failed to download PDF");
          }
          return res.blob();
        })
        .then((blob) => {
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `${effectivePdfSection}-${criteriaType}-${criteriaRole}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        })
        .catch((e) => {
          window.alert(e instanceof Error ? e.message : "Failed");
        });
    } catch {
      window.alert("Failed to download PDF");
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 w-[400px] min-h-[400px] max-h-[600px] dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden overflow-y-auto">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {title}
            {criteriaType && criteriaRole && typeLabel && roleLabel ? (
              <span className="text-gray-500 dark:text-gray-400 font-medium"> ({typeLabel(criteriaType)} / {roleLabel(criteriaRole)})</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = effectiveSavedHtml;
              setCurrentDraft(next);
              if (editor) {
                const current = editor.getHTML();
                if (current !== next) {
                  editor.commands.setContent(next, { emitUpdate: false });
                }
              }
              setEditOpen(true);
            }}
            disabled={Boolean(disabled || loading)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={Boolean(disabled || loading)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            Preview
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="prose prose-sm dark:prose-invert max-w-[800px] leading-[1.7]">
          <div dangerouslySetInnerHTML={{ __html: String(content || "").trim() || "-" }} />
        </div>
      </div>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} className="max-w-[900px] w-[92vw] p-0">
        <div className="p-6">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit {title}</div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
              Use headings, lists, and links to format the content.
            </div>
            <EditorContent editor={editor} className="min-h-[320px]" />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={isSaving}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const nextHtml = String(currentDraft || "");
                const setSaving = savingRoleDescription !== undefined ? undefined : setInternalSaving;
                try {
                  if (setSaving) setSaving(true);
                  await onSave(nextHtml);
                  setEditOpen(false);
                } finally {
                  if (setSaving) setSaving(false);
                }
              }}
              disabled={isDisabled}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} className="max-w-[900px] w-[92vw] p-0">
        <div className="p-6">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title} Preview</div>
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 max-h-[70vh] overflow-y-auto">
            <div className="p-5 prose prose-sm dark:prose-invert max-w-[800px] leading-[1.7]">
              <div dangerouslySetInnerHTML={{ __html: String(content || "").trim() || "-" }} />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={print}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Print / Download PDF
            </button>

            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
