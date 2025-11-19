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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="facebook" className="block text-sm font-medium text-gray-700 mb-1">
          Facebook URL
        </label>
        <input
          id="facebook"
          type="url"
          {...register("facebook")}
          placeholder="https://facebook.com/yourprofile"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.facebook && (
          <p className="mt-1 text-sm text-red-600">{errors.facebook.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 mb-1">
          Instagram URL
        </label>
        <input
          id="instagram"
          type="url"
          {...register("instagram")}
          placeholder="https://instagram.com/yourprofile"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.instagram && (
          <p className="mt-1 text-sm text-red-600">{errors.instagram.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="youtube" className="block text-sm font-medium text-gray-700 mb-1">
          YouTube URL
        </label>
        <input
          id="youtube"
          type="url"
          {...register("youtube")}
          placeholder="https://youtube.com/@yourchannel"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.youtube && (
          <p className="mt-1 text-sm text-red-600">{errors.youtube.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="linkedin" className="block text-sm font-medium text-gray-700 mb-1">
          LinkedIn URL
        </label>
        <input
          id="linkedin"
          type="url"
          {...register("linkedin")}
          placeholder="https://linkedin.com/in/yourprofile"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.linkedin && (
          <p className="mt-1 text-sm text-red-600">{errors.linkedin.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Updating..." : "Update Links"}
        </button>
        {onSuccess && (
          <button
            type="button"
            onClick={onSuccess}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

