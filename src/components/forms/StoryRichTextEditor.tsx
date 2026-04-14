"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";

export function StoryRichTextEditor(props: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeightClassName?: string;
}) {
  const { value, onChange, disabled, minHeightClassName = "min-h-[220px]" } = props;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
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
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-3 ${minHeightClassName}`,
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className="rounded-xl border border-gray-300 bg-white overflow-hidden dark:border-gray-700 dark:bg-gray-800/80">
      {editor && (
        <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1 dark:border-gray-600 dark:bg-gray-900/40">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("heading", { level: 1 }) ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Heading 1"
            aria-label="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("heading", { level: 2 }) ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Heading 2"
            aria-label="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("heading", { level: 3 }) ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Heading 3"
            aria-label="Heading 3"
          >
            H3
          </button>
          <div className="w-px h-6 bg-gray-300 mx-0.5 self-center dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 font-bold dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("bold") ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Bold"
            aria-label="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 italic dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("italic") ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Italic"
            aria-label="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 underline dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("underline") ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Underline"
            aria-label="Underline"
          >
            U
          </button>
          <div className="w-px h-6 bg-gray-300 mx-0.5 self-center dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("bulletList") ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Bullet list"
            aria-label="Bullet list"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("orderedList") ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Numbered list"
            aria-label="Numbered list"
          >
            1. List
          </button>
          <div className="w-px h-6 bg-gray-300 mx-0.5 self-center dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => {
              const url = window.prompt("Link URL:");
              if (url?.trim()) {
                editor.chain().focus().setLink({ href: url.trim() }).run();
              }
            }}
            className={`px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
              editor.isActive("link") ? "bg-gray-200 dark:bg-gray-700" : ""
            }`}
            title="Insert link"
            aria-label="Insert link"
          >
            Link
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="px-2.5 py-1.5 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Remove link"
            aria-label="Remove link"
            disabled={!editor.isActive("link")}
          >
            Unlink
          </button>
        </div>
      )}
      <div className={`max-h-[420px] overflow-y-auto ${!editor ? "min-h-[220px] flex items-center justify-center text-sm text-gray-400" : ""}`}>
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <span>Loading editor…</span>
        )}
      </div>
    </div>
  );
}
