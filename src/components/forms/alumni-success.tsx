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
import { useQueryClient } from "@tanstack/react-query";
import { alumniStoriesKey } from "@/app/queries/fetch-alumni-stories";

type Props = {
  sapId: string;
  name: string;
  email: string;
  faculty: string;
  department: string;
  passingYear: number | null;
  contactNumber: string;
  existingStory?: string;
  existingTitle?: string;
  storyId?: string;
};

// Helper function to check if HTML has actual content (not just empty tags)
function hasContent(html: string): boolean {
  if (!html || html.trim() === "") return false;
  // Remove all HTML tags and check if there's actual text content
  const textContent = html.replace(/<[^>]*>/g, "").trim();
  return textContent.length > 0;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  faculty: z.string().min(1, "Faculty is required"),
  department: z.string().min(1, "Department is required"),
  passingYear: z.number().int().min(1900).max(2100).optional().nullable(),
  contactNumber: z.string().max(50).optional(),
  storyTitle: z.string().min(1, "Story title is required").max(200, "Title must be under 200 characters"),
  storyHtml: z.string().refine(
    (val) => hasContent(val),
    { message: "Story is required. Please enter your success story." }
  ),
});

type FormVals = z.infer<typeof schema>;

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const errorText = "mt-1 text-xs text-rose-600";
const buttonPrimary = "px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60";

export default function AlumniSuccessForm({ 
  sapId, 
  name, 
  email, 
  faculty, 
  department, 
  passingYear,
  contactNumber: initialContactNumber,
  existingStory = "",
  existingTitle = "",
  storyId
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
      storyTitle: existingTitle || "",
      storyHtml: existingStory || "",
    },
    mode: "onChange",
  });

  // Tiptap editor configuration
  // Note: immediatelyRender: false is required for SSR compatibility in Next.js
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
    // Ensure editor is editable
    editable: true,
  });

  // Update editor content when existingStory changes (for edit mode)
  React.useEffect(() => {
    if (editor && existingStory && existingStory !== editor.getHTML()) {
      editor.commands.setContent(existingStory);
      setValue("storyHtml", existingStory, { shouldValidate: true });
    }
  }, [editor, existingStory, setValue]);

  const onSubmit = async (vals: FormVals) => {
    // Get the latest HTML from editor if available
    const htmlContent = editor?.getHTML() || vals.storyHtml;
    
    // Check if content is actually empty
    if (!hasContent(htmlContent)) {
      toast.error("Please enter your success story before submitting.", {
        duration: 3000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
      return;
    }

    const loadingToast = toast.loading(storyId ? "Updating your story..." : "Submitting your success story...");
    try {
      // Sanitize HTML using DOMPurify (client-side)
      const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
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
        storyTitle: vals.storyTitle,
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
      
      // Invalidate and refetch stories to show the new/updated story
      await queryClient.invalidateQueries({ queryKey: alumniStoriesKey });
      await queryClient.refetchQueries({ queryKey: alumniStoriesKey });
      
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
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Success Story</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">Share your success story with the alumni community.</p>

      <form className="max-w-4xl mx-auto mt-4" onSubmit={handleSubmit(onSubmit)} aria-label="Alumni success form">
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className={labelBase}>Name</label>
            <div className="relative flex items-center">
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
            </div>
            {errors.name && <span className={errorText}>{errors.name.message}</span>}
          </div>

          {/* Faculty */}
          <div>
            <label htmlFor="faculty" className={labelBase}>Faculty</label>
            <div className="relative flex items-center">
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
            </div>
            {errors.faculty && <span className={errorText}>{errors.faculty.message}</span>}
          </div>

          {/* Department */}
          <div>
            <label htmlFor="department" className={labelBase}>Department</label>
            <div className="relative flex items-center">
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
            </div>
            {errors.department && <span className={errorText}>{errors.department.message}</span>}
          </div>

          {/* Passing Year */}
          <div>
            <label htmlFor="passingYear" className={labelBase}>Passing Year</label>
            <div className="relative flex items-center">
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
            </div>
            {errors.passingYear && <span className={errorText}>{String(errors.passingYear.message || "Required")}</span>}
          </div>

          {/* Contact Number */}
          <div className="md:col-span-2">
            <label htmlFor="contactNumber" className={labelBase}>
              Contact Number
              <span className="text-gray-500 text-xs ml-1 font-normal">(Optional)</span>
            </label>
            <div className="relative flex items-center">
              <Controller
                name="contactNumber"
                control={control}
                render={({ field }) => (
                  <input
                    id="contactNumber"
                    type="tel"
                    {...field}
                    className={`${inputBase} ${errors.contactNumber ? "border-rose-500 bg-rose-50" : ""}`}
                    placeholder="Enter your contact number"
                    aria-label="Contact Number"
                  />
                )}
              />
            </div>
            {errors.contactNumber && <span className={errorText}>{errors.contactNumber.message}</span>}
          </div>

          {/* Story Title */}
          <div className="md:col-span-2">
            <label htmlFor="storyTitle" className={labelBase}>
              Story Title
              <span className="text-rose-600 ml-1">*</span>
            </label>
            <div className="relative flex items-center">
              <Controller
                name="storyTitle"
                control={control}
                render={({ field }) => (
                  <input
                    id="storyTitle"
                    type="text"
                    {...field}
                    className={`${inputBase} ${errors.storyTitle ? "border-rose-500 bg-rose-50" : ""}`}
                    placeholder="Enter a title for your success story"
                    aria-label="Story Title"
                    maxLength={200}
                  />
                )}
              />
            </div>
            {errors.storyTitle && <span className={errorText}>{errors.storyTitle.message}</span>}
            <p className="mt-1 text-xs text-gray-500">Give your story a compelling title that captures the essence of your success.</p>
          </div>

          {/* Story - Tiptap Editor */}
          <div className="md:col-span-2">
            <label htmlFor="storyHtml" className={labelBase}>
              Your Success Story
              <span className="text-rose-600 ml-1">*</span>
            </label>
            <Controller
              name="storyHtml"
              control={control}
              render={({ field }) => (
                <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                  {/* Toolbar - Only show if editor is ready */}
                  {editor && (
                    <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                    editor.isActive("heading", { level: 1 }) ? "bg-gray-300" : ""
                  }`}
                  title="Heading 1"
                  aria-label="Heading 1"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                    editor.isActive("heading", { level: 2 }) ? "bg-gray-300" : ""
                  }`}
                  title="Heading 2"
                  aria-label="Heading 2"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                    editor.isActive("heading", { level: 3 }) ? "bg-gray-300" : ""
                  }`}
                  title="Heading 3"
                  aria-label="Heading 3"
                >
                  H3
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 font-bold transition-colors ${
                    editor.isActive("bold") ? "bg-gray-300" : ""
                  }`}
                  title="Bold"
                  aria-label="Bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 italic transition-colors ${
                    editor.isActive("italic") ? "bg-gray-300" : ""
                  }`}
                  title="Italic"
                  aria-label="Italic"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 underline transition-colors ${
                    editor.isActive("underline") ? "bg-gray-300" : ""
                  }`}
                  title="Underline"
                  aria-label="Underline"
                >
                  <u>U</u>
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                    editor.isActive("bulletList") ? "bg-gray-300" : ""
                  }`}
                  title="Bullet List"
                  aria-label="Bullet List"
                >
                  •
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                    editor.isActive("orderedList") ? "bg-gray-300" : ""
                  }`}
                  title="Numbered List"
                  aria-label="Numbered List"
                >
                  1.
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt("Enter URL:");
                    if (url && url.trim()) {
                      editor.chain().focus().setLink({ href: url.trim() }).run();
                    }
                  }}
                  className={`px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors ${
                    editor.isActive("link") ? "bg-gray-300" : ""
                  }`}
                  title="Insert Link"
                  aria-label="Insert Link"
                >
                  🔗
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().unsetLink().run()}
                  className="px-3 py-1.5 text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove Link"
                  aria-label="Remove Link"
                  disabled={!editor.isActive("link")}
                >
                  Unlink
                </button>
              </div>
              )}
              {/* Editor Content */}
              <div className="min-h-[300px] max-h-[500px] overflow-y-auto">
                {editor ? (
                  <EditorContent editor={editor} />
                ) : (
                  <div className="min-h-[300px] p-4 flex items-center justify-center text-gray-400">
                    <p>Loading editor...</p>
                  </div>
                )}
              </div>
              <input type="hidden" {...field} value={field.value || ""} />
            </div>
          )}
        />
            {errors.storyHtml && <span className={errorText}>{errors.storyHtml.message}</span>}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">You can format your story with headings, bold, italic, lists, and links.</p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2 flex items-center gap-3 mt-6">
          <button 
            type="submit" 
            className={buttonPrimary} 
            disabled={isSubmitting || !editor} 
            aria-busy={isSubmitting}
            aria-label={storyId ? "Update Story" : "Submit Story"}
          >
            {isSubmitting ? (storyId ? "Updating..." : "Submitting...") : (storyId ? "Update Story" : "Submit Story")}
          </button>
          {!editor && (
            <p className="text-xs text-gray-500">Please wait for the editor to load...</p>
          )}
        </div>
      </form>
    </div>
  );
}
