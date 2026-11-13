"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const schema = z.object({
  facebook: z.string().url("Please enter a valid Facebook URL").optional().or(z.literal("")),
  instagram: z.string().url("Please enter a valid Instagram URL").optional().or(z.literal("")),
  youtube: z.string().url("Please enter a valid YouTube URL").optional().or(z.literal("")),
  linkedin: z.string().url("Please enter a valid LinkedIn URL").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

type Props = {
  sapId: string;
  initialData?: {
    facebook?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    linkedin?: string | null;
  };
  onSuccess?: () => void;
};

export default function SocialLinksForm({ sapId, initialData, onSuccess }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      facebook: initialData?.facebook || "",
      instagram: initialData?.instagram || "",
      youtube: initialData?.youtube || "",
      linkedin: initialData?.linkedin || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    const loadingToast = toast.loading("Updating social media links...");

    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/social-links`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facebook: data.facebook?.trim() || null,
          instagram: data.instagram?.trim() || null,
          youtube: data.youtube?.trim() || null,
          linkedin: data.linkedin?.trim() || null,
        }),
      });

      const result = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        const errorMsg = result?.error || "Failed to update social media links. Please try again.";
        toast.error(errorMsg, {
          duration: 5000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            padding: '16px',
            borderRadius: '8px',
          },
        });
        return;
      }

      toast.success("Social media links updated successfully!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });

      if (onSuccess) {
        onSuccess();
      } else {
        // Refresh the page after a short delay
        setTimeout(() => {
          router.refresh();
        }, 1000);
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast.error(errorMsg, {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fields: { name: keyof FormData; label: string; placeholder: string }[] = [
    { name: "facebook", label: "Facebook URL", placeholder: "https://facebook.com/yourprofile" },
    { name: "instagram", label: "Instagram URL", placeholder: "https://instagram.com/yourprofile" },
    { name: "youtube", label: "YouTube URL", placeholder: "https://youtube.com/@yourchannel" },
    { name: "linkedin", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/yourprofile" },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map((f) => {
        const error = errors[f.name];
        const errorId = `${f.name}-error`;
        return (
          <div key={f.name}>
            <label htmlFor={f.name} className="mb-1 block text-sm font-medium text-content-secondary">
              {f.label}
            </label>
            <input
              id={f.name}
              type="url"
              inputMode="url"
              autoComplete="url"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              {...register(f.name)}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-content placeholder:text-content-muted focus-visible:outline-2 focus-visible:outline-brand-500"
            />
            {error && (
              <p id={errorId} role="alert" className="mt-1 text-sm text-error-600 dark:text-error-400">
                {error.message}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 flex-1 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:text-accent-950 dark:hover:bg-brand-400"
        >
          {isSubmitting ? "Updating..." : "Update Links"}
        </button>
        {onSuccess && (
          <button
            type="button"
            onClick={onSuccess}
            disabled={isSubmitting}
            className="min-h-11 rounded-lg border border-border-subtle bg-surface px-4 py-2 font-semibold text-content-secondary transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

