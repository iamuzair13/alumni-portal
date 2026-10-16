"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PassportPhotoCropModal from "@/components/ui/PassportPhotoCropModal";
import Alert from "@/components/ui/alert/Alert";
import {
  Field,
  FileInput,
  Input,
  Select,
  Textarea,
  ReadOnlyField,
  FormSection,
  AcknowledgmentCheckbox,
  FormActions,
} from "@/components/ui/form";
import { ALUMNI_CARD_VALIDITY_ISO } from "@/lib/cardValidity";
import { composeCardDeliveryAddress } from "@/lib/cardDeliveryAddress";

type Props = {
  alumniId: string;
  name: string;
  sapId: string;
  faculty: string;
  department: string;
  cnicPassport?: string;
};

const schema = z.object({
  pictureName: z.string().min(1, "Profile picture is required"),
  comment: z.string().optional(),
  addressPreference: z.enum(["Collect", "Deliver"], {
    message: "Please select an address preference",
  }),
  deliveryCity: z.string().optional(),
  deliverySocietyName: z.string().optional(),
  deliveryStreetNo: z.string().optional(),
  deliveryHouseNo: z.string().optional(),
  collectAcknowledgment: z.boolean(),
  postalAcknowledgment: z.boolean(),
}).refine((data) => {
  if (data.addressPreference !== "Deliver") return true;
  const city = String(data.deliveryCity ?? "").trim();
  const society = String(data.deliverySocietyName ?? "").trim();
  const street = String(data.deliveryStreetNo ?? "").trim();
  const house = String(data.deliveryHouseNo ?? "").trim();
  if (!city || !society || !street || !house) return false;
  const composed = composeCardDeliveryAddress(city, society, street, house);
  return composed.length >= 10;
}, {
  message: "City, society name, street number, and house number are required. The combined address must be at least 10 characters.",
  path: ["deliveryCity"],
}).superRefine((data, ctx) => {
  if (data.addressPreference === "Collect" && data.collectAcknowledgment !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["collectAcknowledgment"],
      message: "You must acknowledge and undertake the collection terms to submit the application",
    });
  }
  if (data.addressPreference === "Deliver" && data.postalAcknowledgment !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["postalAcknowledgment"],
      message: "You must confirm the postal delivery terms to submit the application",
    });
  }
});

type FormVals = z.infer<typeof schema>;



export function validateImage(file: File | undefined): { ok: boolean; error?: string } {
  if (!file) return { ok: false, error: "Select an image file" };
  const types = ["image/jpeg", "image/png", "image/gif"];
  if (!types.includes(file.type)) return { ok: false, error: "Only JPG, PNG or GIF allowed" };
  const min = 50 * 1024;
  if (file.size < min) return { ok: false, error: "Image must be at least 50KB" };
  const max = 5 * 1024 * 1024;
  if (file.size > max) return { ok: false, error: "File must be ≤ 5MB" };
  return { ok: true };
}

async function validatePassportLikeImage(file: File): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = new window.Image();
      img.decoding = "async";
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });
      img.src = url;
      await loaded;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      if (!w || !h) return { ok: false, error: "Invalid image" };

      // Passport photo is typically 35x45mm (w/h ≈ 0.78). Allow a small tolerance.
      const ratio = w / h;
      if (ratio < 0.72 || ratio > 0.82) {
        return { ok: false, error: "Image must be passport size (portrait)" };
      }

      // Basic resolution guard for “high resolution”.
      if (w < 300 || h < 400) {
        return { ok: false, error: "Image resolution is too low. Please upload a clearer photo." };
      }

      return { ok: true };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    // If we cannot read dimensions, don't block the upload.
    return { ok: true };
  }
}

export default function AlumniCardForm({ alumniId, name, faculty, department, sapId, cnicPassport = "" }: Props) {
  const router = useRouter();
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [fetchedName, setFetchedName] = useState(name);
  const [fetchedFaculty, setFetchedFaculty] = useState(faculty);
  const [fetchedDepartment, setFetchedDepartment] = useState(department);
  const [fetchedCnicPassport, setFetchedCnicPassport] = useState<string>("");
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      comment: "",
      addressPreference: "Collect",
      deliveryCity: "",
      deliverySocietyName: "",
      deliveryStreetNo: "",
      deliveryHouseNo: "",
      collectAcknowledgment: false,
      postalAcknowledgment: false,
    },
    mode: "onChange",
  });

  // Watch address preference to show/hide address field
  const addressPreference = watch("addressPreference");

  const alumniDetailsQuery = useQuery<any, Error>({
    queryKey: ["alumni", "full-details", sapId],
    enabled: !!sapId && sapId.trim() !== "",
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/full-details`, {
        signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to load alumni details");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  // Auto-fetch alumni details when component mounts or sapId changes
  useEffect(() => {
    if (!alumniDetailsQuery.data) return;
    const alumni = (alumniDetailsQuery.data as any)?.item;
    if (alumni) {
      if (alumni.alumniname) setFetchedName(alumni.alumniname);
      if (alumni.facultyname) setFetchedFaculty(alumni.facultyname);
      if (alumni.departmentname) setFetchedDepartment(alumni.departmentname);
      const cnicValue =
        (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicpassport ??
        (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicPassport ??
        (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicOrPassport ??
        "";
      setFetchedCnicPassport(String(cnicValue ?? "").trim());
    }
  }, [alumniDetailsQuery.data]);

  // Clear address fields when preference changes to "Collect"
  React.useEffect(() => {
    if (addressPreference === "Collect") {
      setValue("deliveryCity", "");
      setValue("deliverySocietyName", "");
      setValue("deliveryStreetNo", "");
      setValue("deliveryHouseNo", "");
      setValue("postalAcknowledgment", false);
    } else {
      setValue("collectAcknowledgment", false);
    }
  }, [addressPreference, setValue]);

  // Standard alumni card validity (policy): end of May 2029
  const validityDateISO = ALUMNI_CARD_VALIDITY_ISO;
  const validityDateStr = new Date(`${validityDateISO}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const cnicFromQuery = (() => {
    const alumni = (alumniDetailsQuery.data as any)?.item;
    if (!alumni) return "";
    const cnicValue =
      (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicpassport ??
      (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicPassport ??
      (alumni as { cnicpassport?: unknown; cnicPassport?: unknown; cnicOrPassport?: unknown }).cnicOrPassport ??
      "";
    return String(cnicValue ?? "").trim();
  })();
  const cnicDisplayValue = cnicFromQuery || fetchedCnicPassport || String(cnicPassport || "").trim();

  // Auto-fetched contact details — required before the application can be submitted.
  const alumniItem = (alumniDetailsQuery.data as any)?.item;
  const emailDisplayValue = String(
    alumniItem?.personalemail || alumniItem?.officialemail || alumniItem?.universityemail || "",
  ).trim();
  const contactDisplayValue = String(alumniItem?.contactno || "").trim();
  const contactDetailsLoaded = alumniDetailsQuery.isSuccess && !!alumniItem;
  const contactDetailsMissing = contactDetailsLoaded && (!emailDisplayValue || !contactDisplayValue);

  

  const onSubmit = async (vals: FormVals) => {
    setFileError(null);
    try {
      if (!selectedFile) {
        setFileError("Profile picture is required");
        return;
      }
      if (contactDetailsMissing) {
        toast.error(
          "Your email and primary contact are required to apply for the alumni card. Please update your profile first.",
          { duration: 5000 },
        );
        return;
      }
      const loadingToast = toast.loading("Submitting your alumni card application...");
      
      const formData = new FormData();
      formData.append("alumniId", String(alumniId));
      formData.append("sapId", String(sapId || ""));
      formData.append("image", selectedFile);
      if (vals.comment) {
        formData.append("comment", vals.comment);
      }
      // cardaddress = full line for mailing; structured columns stored separately
      if (vals.addressPreference === "Deliver") {
        const city = String(vals.deliveryCity ?? "").trim();
        const society = String(vals.deliverySocietyName ?? "").trim();
        const street = String(vals.deliveryStreetNo ?? "").trim();
        const house = String(vals.deliveryHouseNo ?? "").trim();
        formData.append("cardaddress", composeCardDeliveryAddress(city, society, street, house));
        formData.append("delivery_city", city);
        formData.append("delivery_society_name", society);
        formData.append("delivery_street_no", street);
        formData.append("delivery_house_no", house);
      } else {
        formData.append("cardaddress", "Collect from Campus");
      }
      // Standard validity date (policy)
      formData.append("validity_date", validityDateISO);

      const res = await fetch("/api/alumni-cards", {
        method: "POST",
        body: formData,
      });
      
      toast.dismiss(loadingToast);
      
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const errorMsg = j?.error || `Failed to submit application (${res.status})`;
        toast.error(errorMsg, { duration: 5000 });
        throw new Error(errorMsg);
      }

      toast.success("Alumni card application submitted successfully!", {
        duration: 4000,
      });
      
      reset();
      setPreviewUrl(null);
      setSelectedFile(null);
      setValue("pictureName", "");
      setValue("comment", "");
      setValue("addressPreference", "Collect");
      setValue("deliveryCity", "");
      setValue("deliverySocietyName", "");
      setValue("deliveryStreetNo", "");
      setValue("deliveryHouseNo", "");
      setValue("collectAcknowledgment", false);
      setValue("postalAcknowledgment", false);
      
      // Navigate back to profile page
      setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sapIdParam = urlParams.get('sapid') || sapId;
        if (sapIdParam) {
          router.push(`/alumni-profile?sapid=${encodeURIComponent(sapIdParam)}`);
        } else {
          router.push('/alumni-profile');
        }
        router.refresh();
      }, 1500);
    } catch {
      // Error already handled with toast above
    }
  };

  return (
    <>
    <PassportPhotoCropModal
      isOpen={showCropModal}
      file={pendingCropFile}
      onClose={() => {
        setShowCropModal(false);
        setPendingCropFile(null);
      }}
      onCropped={(cropped) => {
        setShowCropModal(false);
        setPendingCropFile(null);
        setFileError(null);
        setPreviewUrl(cropped ? URL.createObjectURL(cropped) : null);
        setValue("pictureName", cropped?.name || "");
        setSelectedFile(cropped ?? null);
      }}
      title="Edit Passport Photo"
    />
    <form className="mx-auto max-w-4xl space-y-6" onSubmit={handleSubmit(onSubmit)} aria-label="Alumni card form">
      {contactDetailsMissing && (
        <Alert
          variant="warning"
          title="Email and primary contact required"
          message="Add your email and primary contact in your alumni profile before applying for the alumni card."
          showLink
          linkHref="/alumni-profile/more-details"
          linkText="Update profile"
        />
      )}

      <FormSection
        title="Your details"
        description="Fetched from your alumni profile. If anything looks wrong, mention it in the comment box below."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <ReadOnlyField label="Name" value={fetchedName || name} />
          <ReadOnlyField label="Faculty" value={fetchedFaculty || faculty} />
          <ReadOnlyField label="Department" value={fetchedDepartment || department} />
          <ReadOnlyField
            label="Validity"
            value={validityDateStr}
            hint={`Card will be valid through ${validityDateStr} (standard validity through May 2029)`}
          />
          <ReadOnlyField
            label="CNIC / Passport"
            value={cnicDisplayValue}
            hint="Please make sure that your CNIC/Passport is correct. It will be used for verification and alumni card issuance."
          />
          <ReadOnlyField label="Email" value={emailDisplayValue} />
          <ReadOnlyField label="Primary Contact" value={contactDisplayValue} />
        </div>
      </FormSection>

      <FormSection title="Application">
        <div className="space-y-5">
          <Field
            label="Profile photo"
            htmlFor="picture"
            required
            hint="Passport-size headshot with a blue or white background. Casual pictures are not accepted. High resolution, minimum 50KB (JPG, PNG or GIF)."
            error={fileError ?? errors.pictureName?.message}
          >
            <FileInput
              id="picture"
              accept="image/jpeg,image/png,image/gif"
              aria-label="Profile picture"
              error={!!(fileError || errors.pictureName)}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                const v = validateImage(file);
                if (!v.ok) {
                  setFileError(v.error || "Invalid file");
                  setPreviewUrl(null);
                  setValue("pictureName", "");
                  setSelectedFile(null);
                  return;
                }

                if (file) {
                  setPendingCropFile(file);
                  setShowCropModal(true);
                }
              }}
              disabled={isSubmitting}
            />
          </Field>
          <input type="hidden" {...register("pictureName")} name="pictureName" />
          {previewUrl && (
            <Image
              src={previewUrl}
              alt="Profile preview"
              width={112}
              height={112}
              className="h-28 w-28 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
            />
          )}

          <Field
            label="Delivery preference"
            htmlFor="addressPreference"
            required
            error={errors.addressPreference?.message}
          >
            <Select
              id="addressPreference"
              {...register("addressPreference")}
              aria-label="Address preference"
            >
              <option value="Collect">Collect from Campus</option>
              <option value="Deliver">Deliver to my below address</option>
            </Select>
          </Field>

          {addressPreference === "Deliver" && (
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Delivery address <span className="text-error-500">*</span>
              </legend>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Where the physical card should be sent (city, society, street, house).
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="House number" htmlFor="deliveryHouseNo" required>
                  <Input
                    id="deliveryHouseNo"
                    {...register("deliveryHouseNo")}
                    placeholder="House number"
                    aria-label="House number"
                  />
                </Field>
                <Field label="Street No." htmlFor="deliveryStreetNo" required>
                  <Input
                    id="deliveryStreetNo"
                    {...register("deliveryStreetNo")}
                    placeholder="Street number"
                    aria-label="Street number"
                  />
                </Field>
                <Field label="Society name" htmlFor="deliverySocietyName" required>
                  <Input
                    id="deliverySocietyName"
                    {...register("deliverySocietyName")}
                    placeholder="Society name"
                    aria-label="Society name"
                  />
                </Field>
                <Field label="City" htmlFor="deliveryCity" required>
                  <Input
                    id="deliveryCity"
                    {...register("deliveryCity")}
                    placeholder="City"
                    aria-label="Delivery city"
                  />
                </Field>
              </div>
              {(errors.deliveryCity || errors.deliverySocietyName || errors.deliveryStreetNo || errors.deliveryHouseNo) && (
                <p className="field-error" role="alert">
                  <span>
                    {errors.deliveryCity?.message ||
                      errors.deliverySocietyName?.message ||
                      errors.deliveryStreetNo?.message ||
                      errors.deliveryHouseNo?.message ||
                      "City, society name, street number, and house number are required."}
                  </span>
                </p>
              )}
            </fieldset>
          )}

          <Field
            label="Please mention if there is any mistake in data"
            htmlFor="comment"
            error={errors.comment?.message}
          >
            <Textarea
              id="comment"
              {...register("comment")}
              rows={4}
              placeholder="If you notice any mistakes in your information, please mention them here..."
              aria-label="Comments about data mistakes"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title={addressPreference === "Collect" ? "Collection terms" : "Delivery terms"}
      >
        {addressPreference === "Collect" ? (
          <AcknowledgmentCheckbox
            {...register("collectAcknowledgment")}
            aria-label="Acknowledge campus collection terms"
            error={errors.collectAcknowledgment?.message}
          >
            I hereby acknowledge that my information is correct and undertake to collect my Alumni Card within 15 days of receiving a call from the authorized Alumni Office; otherwise, my card may be discarded and I will not be eligible to apply for an Alumni Card again.
            <span className="text-error-500 ml-1">*</span>
          </AcknowledgmentCheckbox>
        ) : (
          <AcknowledgmentCheckbox
            {...register("postalAcknowledgment")}
            aria-label="Confirm postal delivery terms"
            error={errors.postalAcknowledgment?.message}
          >
            I hereby confirm that the postal address and mobile number provided are correct and up to date, and I acknowledge that if the Alumni Card is returned by the courier due to an incorrect or incomplete address, unavailability, or any other issue, my card will be discarded and I will not be eligible to apply for an Alumni Card again.
            <span className="text-error-500 ml-1">*</span>
          </AcknowledgmentCheckbox>
        )}
      </FormSection>

      <FormActions
        submitLabel="Submit application"
        submittingLabel="Submitting…"
        loading={isSubmitting}
      />
    </form>
</>
  );
}