"use client";
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Props = {
  sapId: string;
  name: string;
  email: string;
  faculty: string;
  department: string;
};

const schema = z.object({
  storyHtml: z.string().min(1, "Story is required"),
});

type FormVals = z.infer<typeof schema>;

const inputBase = " border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
const buttonPrimary = "inline-flex items-center rounded-xl border border-blue-500 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-60 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200";
const labelBase = "text-sm text-gray-600 dark:text-gray-300";

export default function AlumniSuccessForm({ sapId, name, email, faculty, department }: Props) {
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { handleSubmit, control, formState: { errors, isSubmitting }, reset } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { storyHtml: "" },
    mode: "onChange",
  });

  const onSubmit = async (vals: FormVals) => {
    setServerMsg(null);
    setServerError(null);
    try {
      const payload = {
        sapId,
        name,
        email,
        faculty,
        department,
        storyHtml: sanitize(vals.storyHtml),
      };
      const res = await fetch("/api/alumni-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed (${res.status})`);
      }
      setServerMsg("Success story submitted.");
      reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setServerError(msg);
    }
  };

  return (
    <form className="grid grid-cols-1 gap-4 p-10" onSubmit={handleSubmit(onSubmit)} aria-label="Alumni success form">
      <div className="flex flex-col gap-2">
        <label className={labelBase}>Name</label>
        <input className={inputBase} value={name} aria-label="Name" readOnly />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelBase}>Email</label>
        <input className={inputBase} value={email} aria-label="Email" readOnly />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelBase}>SAP ID</label>
        <input className={inputBase} value={sapId} aria-label="SAP ID" readOnly />
      </div>
      <div className="flex flex-col gap-2">
        <label className={labelBase}>Story</label>
        <Controller
          name="storyHtml"
          control={control}
          render={({ field }) => (
            <div>
              <div
                role="textbox"
                aria-label="Story rich text"
                className={`${inputBase} min-h-24 text-left`}
                dir="ltr"
                lang="en"
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const html = (e.target as HTMLElement).innerHTML;
                  field.onChange(html);
                }}
                dangerouslySetInnerHTML={{ __html: field.value || "" }}
              />
              <p className="text-xs text-gray-500 mt-1">Supports basic formatting.</p>
            </div>
          )}
        />
        {errors.storyHtml && <span className="text-xs text-red-600">{errors.storyHtml.message}</span>}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button type="reset" className={buttonPrimary} onClick={() => reset()}>
          Reset
        </button>
        <button type="submit" className={buttonPrimary} disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>

      <div className="mt-2">
        {serverMsg && <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700">{serverMsg}</div>}
        {serverError && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700">{serverError}</div>}
      </div>
    </form>
  );
}

function sanitize(input: string): string {
  const allowed = /<(\/?)(b|i|u|br|a)([^>]*)>/gi;
  return input
    .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, (tag) => (allowed.test(tag) ? tag : ""));
}