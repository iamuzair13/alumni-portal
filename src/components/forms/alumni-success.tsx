"use client";
import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import DOMPurify from "dompurify";

type Props = {
  sapId: string;
  name: string;
  email: string;
  faculty: string;
  department: string;
  passingYear: number | null;
  contactNumber: string;
  existingStory?: string;
  storyId?: string;
};

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  faculty: z.string().min(1, "Faculty is required"),
  department: z.string().min(1, "Department is required"),
  passingYear: z.number().int().min(1900).max(2100).optional().nullable(),
  contactNumber: z.string().max(50).optional(),
  storyHtml: z.string().min(1, "Story is required"),
});

type FormVals = z.infer<typeof schema>;

const inputBase = "w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelBase = "block text-sm font-medium text-gray-700 mb-2";
const buttonPrimary = "inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export default function AlumniSuccessForm({ 
  sapId, 
  name, 
  email, 
  faculty, 
  department, 
  passingYear,
  contactNumber: initialContactNumber,
  existingStory = "",
  storyId
}: Props) {
  const router = useRouter();
  const { 
    handleSubmit, 
    control, 
    formState: { errors, isSubmitting }, 
    reset,
    setValue
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { 
      name: name || "",
      faculty: faculty || "",
      department: department || "",
      passingYear: passingYear || null,
      contactNumber: initialContactNumber || "",
      storyHtml: existingStory || "",
    },
    mode: "onChange",
  });

  // Tiptap editor configuration
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
    content: existingStory || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setValue("storyHtml", html, { shouldValidate: true });
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
  });

  // Update editor content when existingStory changes (for edit mode)
  React.useEffect(() => {
    if (editor && existingStory && existingStory !== editor.getHTML()) {
      editor.commands.setContent(existingStory);
      setValue("storyHtml", existingStory, { shouldValidate: true });
    }
  }, [editor, existingStory, setValue]);

  const onSubmit = async (vals: FormVals) => {
    const loadingToast = toast.loading(storyId ? "Updating your story..." : "Submitting your success story...");
    try {
      // Sanitize HTML using DOMPurify (client-side)
      const sanitizedHtml = DOMPurify.sanitize(vals.storyHtml, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "a", "div"],
        ALLOWED_ATTR: ["href", "target", "rel"],
      });

      const payload = {
        sapId,
        name: vals.name,
        email,
        faculty: vals.faculty,
        department: vals.department,
        passingYear: vals.passingYear || null,
        contactNumber: vals.contactNumber || null,
        storyHtml: sanitizedHtml,
      };

      const res = await fetch("/api/alumni-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      toast.dismiss(loadingToast);
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed (${res.status})`);
      }
      
      toast.success(storyId ? "Story updated successfully!" : "Success story submitted successfully!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });
      
      reset();
      editor?.commands.clearContent();
      
      // Navigate back to story detail page if editing, otherwise to stories list
      setTimeout(() => {
        if (storyId) {
          router.push(`/alumni-success/${encodeURIComponent(storyId)}`);
        } else {
          router.push('/alumni-success');
        }
        router.refresh();
      }, 1500);
    } catch (e) {
      toast.dismiss(loadingToast);
      const msg = e instanceof Error ? e.message : "Unexpected error";
      toast.error(msg, {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    }
  };

  return (
    <form className="grid grid-cols-1 gap-6" onSubmit={handleSubmit(onSubmit)} aria-label="Alumni success form">
      {/* Name */}
      <div>
        <label htmlFor="name" className={labelBase}>Name</label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <input
              id="name"
              {...field}
              className={inputBase}
              readOnly
              aria-label="Name"
            />
          )}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      {/* Faculty */}
      <div>
        <label htmlFor="faculty" className={labelBase}>Faculty</label>
        <Controller
          name="faculty"
          control={control}
          render={({ field }) => (
            <input
              id="faculty"
              {...field}
              className={inputBase}
              readOnly
              aria-label="Faculty"
            />
          )}
        />
        {errors.faculty && <p className="mt-1 text-xs text-red-600">{errors.faculty.message}</p>}
      </div>

      {/* Department */}
      <div>
        <label htmlFor="department" className={labelBase}>Department</label>
        <Controller
          name="department"
          control={control}
          render={({ field }) => (
            <input
              id="department"
              {...field}
              className={inputBase}
              readOnly
              aria-label="Department"
            />
          )}
        />
        {errors.department && <p className="mt-1 text-xs text-red-600">{errors.department.message}</p>}
      </div>

      {/* Passing Year */}
      <div>
        <label htmlFor="passingYear" className={labelBase}>Passing Year</label>
        <Controller
          name="passingYear"
          control={control}
          render={({ field }) => (
            <input
              id="passingYear"
              type="number"
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
              className={inputBase}
              readOnly
              aria-label="Passing Year"
            />
          )}
        />
        {errors.passingYear && <p className="mt-1 text-xs text-red-600">{errors.passingYear.message}</p>}
      </div>

      {/* Contact Number */}
      <div>
        <label htmlFor="contactNumber" className={labelBase}>
          Contact Number
          <span className="text-gray-500 text-xs ml-1">(Optional)</span>
        </label>
        <Controller
          name="contactNumber"
          control={control}
          render={({ field }) => (
            <input
              id="contactNumber"
              type="tel"
              {...field}
              className={inputBase}
              placeholder="Enter your contact number"
              aria-label="Contact Number"
            />
          )}
        />
        {errors.contactNumber && <p className="mt-1 text-xs text-red-600">{errors.contactNumber.message}</p>}
      </div>

      {/* Story - Tiptap Editor */}
      <div>
        <label htmlFor="storyHtml" className={labelBase}>
          Your Success Story
          <span className="text-red-600 ml-1">*</span>
        </label>
        <Controller
          name="storyHtml"
          control={control}
          render={({ field }) => (
            <div className="bg-white border border-gray-300 rounded-md overflow-hidden">
              {/* Toolbar */}
              <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 ${
                    editor?.isActive("heading", { level: 1 }) ? "bg-gray-300" : ""
                  }`}
                  title="Heading 1"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 ${
                    editor?.isActive("heading", { level: 2 }) ? "bg-gray-300" : ""
                  }`}
                  title="Heading 2"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 ${
                    editor?.isActive("heading", { level: 3 }) ? "bg-gray-300" : ""
                  }`}
                  title="Heading 3"
                >
                  H3
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 font-bold ${
                    editor?.isActive("bold") ? "bg-gray-300" : ""
                  }`}
                  title="Bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 italic ${
                    editor?.isActive("italic") ? "bg-gray-300" : ""
                  }`}
                  title="Italic"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 underline ${
                    editor?.isActive("underline") ? "bg-gray-300" : ""
                  }`}
                  title="Underline"
                >
                  <u>U</u>
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 ${
                    editor?.isActive("bulletList") ? "bg-gray-300" : ""
                  }`}
                  title="Bullet List"
                >
                  •
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 ${
                    editor?.isActive("orderedList") ? "bg-gray-300" : ""
                  }`}
                  title="Numbered List"
                >
                  1.
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt("Enter URL:");
                    if (url) {
                      editor?.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 ${
                    editor?.isActive("link") ? "bg-gray-300" : ""
                  }`}
                  title="Insert Link"
                >
                  🔗
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().unsetLink().run()}
                  className="px-3 py-1.5 text-sm rounded hover:bg-gray-200"
                  title="Remove Link"
                  disabled={!editor?.isActive("link")}
                >
                  Unlink
                </button>
              </div>
              {/* Editor Content */}
              <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
                <EditorContent editor={editor} />
              </div>
              <input type="hidden" {...field} value={field.value || ""} />
            </div>
          )}
        />
        {errors.storyHtml && <p className="mt-1 text-xs text-red-600">{errors.storyHtml.message}</p>}
        <p className="mt-2 text-xs text-gray-500">You can format your story with headings, bold, italic, lists, and links.</p>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button type="submit" className={buttonPrimary} disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? (storyId ? "Updating..." : "Submitting...") : (storyId ? "Update Story" : "Submit Story")}
        </button>
      </div>
    </form>
  );
}
