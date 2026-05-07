"use client";

import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAlumniFullDetails, useUpdateAlumniFields } from "@/app/queries/alumni-profile";
import { useQuery } from "@tanstack/react-query";
import AppHeader from "@/layout/AppHeader";
import Image from "next/image";
import BackButton from "@/components/ui/BackButton";
import PageBanner from "@/components/ui/PageBanner";
import EditableField from "@/components/ui/EditableField";
import EditableCountryProvinceCity from "@/components/ui/EditableCountryProvinceCity";
import EditableEmploymentStatus from "@/components/ui/EditableEmploymentStatus";
import { Toaster, toast } from "react-hot-toast";
import { canModify, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";

/* ─── Icons ─── */
const IconUser = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
);
const IconMail = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
);
const IconPhone = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
);
const IconMapPin = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
);
const IconGraduationCap = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.221 69.494 69.494 0 00-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
);
const IconBriefcase = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 0V5.25A2.25 2.25 0 0011.25 3h-2.25A2.25 2.25 0 006.75 5.25v2.103m4.5 0a48.667 48.667 0 00-3.413.387c-1.069.16-1.837 1.094-1.837 2.175v3.676M20.25 14.25a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
);
const IconShield = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
);
const IconGlobe = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
);
const IconInformationCircle = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
);
const IconPencilSquare = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
);
const IconLockClosed = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
);
const IconEye = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const IconEyeSlash = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
);
const IconKey = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
);
const IconArrowPath = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
);
const IconPaperAirplane = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
);
const IconXMark = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
);
const IconCheck = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
);
const IconExclamationTriangle = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
);

/* ─── Types ─── */
type SectionDef = {
  title: string;
  icon: React.ReactNode;
  fields: MoreDetailsField[];
};

type MoreDetailsField = {
  label: string;
  value: unknown;
  key: string;
  editable: boolean;
  type?: "text" | "email" | "tel" | "number" | "textarea" | "select" | "checkbox" | "password" | "date";
  options?: Array<{ value: string; label: string }>;
  isSpecial?: boolean;
};

/* ─── Component ─── */
function MoreDetailsContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isViewer = isViewerUser(session?.user);
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAlumniUser = String((session?.user as { type?: string | null })?.type || "").toLowerCase().trim() === "alumni";
  const [isSendingCredentials, setIsSendingCredentials] = useState(false);
  const safeSearchParams = searchParams ?? new URLSearchParams();

  const urlSapId = safeSearchParams.get("sapid") || "";

  let sessionSapid: string | undefined;
  let sessionRegNo: string | undefined;
  if (session?.user) {
    const user = session.user as Record<string, unknown>;
    sessionSapid = user["sapid"] ? String(user["sapid"]).trim() : undefined;
    sessionRegNo = user["registrationno"] ? String(user["registrationno"]).trim() : undefined;
  }

  const sapId = urlSapId || sessionSapid || sessionRegNo || "";

  const { data, isLoading, isError, error, refetch } = useAlumniFullDetails(sapId || undefined);
  const updateMutation = useUpdateAlumniFields(sapId || undefined);
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);

  const pendingRequestQuery = useQuery<
    { pending: boolean; request: null | { id: number; new_data: Record<string, unknown> } },
    Error
  >({
    queryKey: ["alumni", "pending-change", sapId],
    enabled: !!sapId && String((data as any)?.change_approval ?? "").toLowerCase().trim() === "pending",
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/pending-change`, {
        signal,
        headers: { accept: "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to load pending change request");
      return payload as { pending: boolean; request: null | { id: number; new_data: Record<string, unknown> } };
    },
    staleTime: 10 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const pendingServerNewData = (pendingRequestQuery.data?.request?.new_data ?? {}) as Record<string, unknown>;
  const pendingDisplayMap = useMemo(() => {
    return { ...pendingServerNewData, ...pendingChanges };
  }, [pendingServerNewData, pendingChanges]);

  const [isInitialized, setIsInitialized] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async () => {
    if (isChangingPassword) return;
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Please fill all password fields");
      return;
    }
    if (newPassword.trim().length < 4) {
      toast.error("New password must be at least 4 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/alumni/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(payload?.error || "Failed to change password");
        return;
      }
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    if (data && !isLoading && !isInitialized) {
      setPendingChanges({});
      const timer = setTimeout(() => {
        setIsInitialized(true);
        setPendingChanges((prev) => {
          if (Object.keys(prev).length > 0) return {};
          return prev;
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data, isLoading, isInitialized]);

  const normalizeValue = useCallback((val: unknown): unknown => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "not provided" || trimmed.toLowerCase() === "n/a" || trimmed.toLowerCase() === "na") {
        return null;
      }
      return trimmed;
    }
    return val;
  }, []);

  const formatDateDisplay = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    const str = String(value).trim();
    const d = new Date(str.length === 10 ? `${str}T00:00:00` : str);
    if (Number.isNaN(d.getTime())) return str;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  };

  const formatDateTimeDisplay = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value).trim();
    if (!str) return "";
    const d = new Date(str.length === 10 ? `${str}T00:00:00` : str);
    if (Number.isNaN(d.getTime())) return str;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const handleFieldValueChange = useCallback((key: string, value: unknown) => {
    if (!data || !isInitialized) return;
    if (value === undefined) {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      const originalValue = (data as Record<string, unknown>)?.[key];
      const normalizedNewValue = normalizeValue(value);
      const normalizedOriginalValue = normalizeValue(originalValue);
      const isDifferent = normalizedNewValue !== normalizedOriginalValue;
      if (isDifferent) {
        setPendingChanges((prev) => ({ ...prev, [key]: value }));
      } else {
        setPendingChanges((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
  }, [data, isInitialized, normalizeValue]);

  const handleSaveAll = async () => {
    if (!sapId || Object.keys(pendingChanges).length === 0 || isSavingAll) return;

    const countryChanged = pendingChanges.country !== undefined;
    const newCountry = countryChanged ? pendingChanges.country : (data?.country ?? null);
    const provinceValue = pendingChanges.province !== undefined ? pendingChanges.province : (data?.province ?? null);
    const cityValue = pendingChanges.city !== undefined ? pendingChanges.city : (data?.city ?? null);

    if (newCountry && String(newCountry).trim() === "Pakistan") {
      const missingFields: string[] = [];
      if (!provinceValue || String(provinceValue).trim() === "" || String(provinceValue).trim() === "Not applicable") {
        missingFields.push("Province");
      }
      if (!cityValue || String(cityValue).trim() === "") {
        missingFields.push("City");
      }
      if (missingFields.length > 0) {
        const fieldsList = missingFields.join(" and ");
        toast.error(
          `When country is "Pakistan", ${fieldsList} ${missingFields.length > 1 ? 'are' : 'is'} required. Please fill in all required fields before saving.`,
          { duration: 5000 }
        );
        return;
      }
    }

    if (newCountry && newCountry !== "Pakistan") {
      if (!cityValue || String(cityValue).trim() === "") {
        toast.error("City is required when country is not Pakistan. Please enter a city.", { duration: 4000 });
        return;
      }
    }

    const changesCount = Object.keys(pendingChanges).length;
    setIsSavingAll(true);
    try {
      const res = await updateMutation.mutateAsync(pendingChanges as Partial<NonNullable<typeof data>>);
      setPendingChanges({});
      try {
        window.dispatchEvent(
          new CustomEvent("alumni-card-revision-changed", { detail: { sapId } })
        );
      } catch { /* ignore */ }
      await refetch();

      const approval = String((res as { change_approval?: string | null })?.change_approval ?? "").toLowerCase().trim();
      if (approval === "pending") {
        toast.success("Changes submitted for approval. Check your profile for status.", { duration: 4000 });
      } else {
        toast.success(`Saved ${changesCount} field${changesCount !== 1 ? "s" : ""} successfully`, { duration: 3000 });
      }
    } catch (error) {
      let errorMessage = "Failed to save changes. Please try again.";
      let errorDetails = "";
      if (error instanceof Error) {
        errorMessage = error.message;
        try {
          const errorData = JSON.parse(errorMessage);
          if (errorData.error) errorMessage = errorData.error;
          if (errorData.message) errorDetails = errorData.message;
          if (errorData.field) errorDetails = `${errorDetails ? errorDetails + " " : ""}(Field: ${errorData.field})`;
        } catch { /* ignore */ }
      }
      toast.error(errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage, { duration: 5000 });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleCancelAll = () => {
    setPendingChanges({});
    toast.success("All pending changes cancelled", { duration: 2000 });
  };

  const normalizeImagePath = (imagePath: unknown): string => {
    if (!imagePath || typeof imagePath !== "string" || imagePath.trim() === "" || imagePath === "null" || imagePath === "undefined") {
      return "/images/person.jpg";
    }
    let trimmedPath = String(imagePath).trim();
    trimmedPath = trimmedPath.replace(/\/tumbnail\//g, "/");
    trimmedPath = trimmedPath.replace(/\/alumni-images\/thumbnail\//g, "/");
    trimmedPath = trimmedPath.replace(/\/alumni-images\/card\//g, "/");
    if (!trimmedPath.startsWith("/") && !trimmedPath.startsWith("http://") && !trimmedPath.startsWith("https://")) {
      if (!trimmedPath.includes("/")) return `/images/${trimmedPath}`;
      return `/${trimmedPath}`;
    }
    return trimmedPath;
  };

  const maritalStatusOptions = [
    { value: "Married", label: "Married" },
    { value: "Un-Married", label: "Un-Married" },
  ];

  const employmentStatusOptions = [
    { value: "Employed", label: "Employed" },
    { value: "Self-Employed/Enterpreneur", label: "Self-Employed/Enterpreneur" },
    { value: "Pursuing Higher Education", label: "Pursuing Higher Education" },
    { value: "Unemployed(By Choice)", label: "Unemployed(By Choice)" },
    { value: "Unemployed(Searching for job)", label: "Unemployed(Searching for job)" },
  ];

  const occupationTransitionTimingOptions = [
    { value: "Before graduation", label: "Before graduation" },
    { value: "Immediately after graduation", label: "Immediately after graduation" },
    { value: "Within 3 months", label: "Within 3 months" },
    { value: "Within 6 months", label: "Within 6 months" },
    { value: "After 6 months", label: "After 6 months" },
  ];

  const sections: SectionDef[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: "Personal Information",
        icon: <IconUser className="w-4 h-4" />,
        fields: [
          { label: "Full Name", value: data.alumniname, key: "alumniname", editable: false },
          { label: "SAP ID", value: data.sapid, key: "sapid", editable: false },
          { label: "Registration Number", value: data.registrationno, key: "registrationno", editable: false },
          { label: "Gender", value: data.gender, key: "gender", editable: false },
          { label: "Father's Name", value: data.fathername, key: "fathername", editable: false },
          { label: "Date of Birth", value: data.dateofbirth, key: "dateofbirth", editable: true, type: "date" },
          { label: "Marital Status", value: data.maritalstatus, key: "maritalstatus", editable: true, type: "select", options: maritalStatusOptions },
          { label: "CNIC / Passport", value: data.cnicpassport, key: "cnicpassport", editable: true },
        ],
      },
      {
        title: "Contact Information",
        icon: <IconPhone className="w-4 h-4" />,
        fields: [
          { label: "Primary Contact", value: data.contactno, key: "contactno", editable: true, type: "tel" },
          { label: "Secondary Contact", value: data.contactno1, key: "contactno1", editable: true, type: "tel" },
          { label: "Personal Email", value: data.personalemail, key: "personalemail", editable: true, type: "email" },
          { label: "Alumni Email", value: data.universityemail, key: "universityemail", editable: false, type: "email" },
        ],
      },
      {
        title: "Address Information",
        icon: <IconMapPin className="w-4 h-4" />,
        fields: [
          { label: "Home Country", value: data.country, key: "country", editable: true, isSpecial: true },
          { label: "Home Province", value: data.province, key: "province", editable: true, isSpecial: true },
          { label: "Home City", value: data.city, key: "city", editable: true, isSpecial: true },
          { label: "Home Address", value: data.address, key: "address", editable: true, type: "textarea" },
        ],
      },
      {
        title: "Academic Information",
        icon: <IconGraduationCap className="w-4 h-4" />,
        fields: [
          { label: "Campus", value: data.campusname, key: "campusname", editable: false },
          { label: "Faculty", value: data.facultyname, key: "facultyname", editable: false },
          { label: "Department", value: data.departmentname, key: "departmentname", editable: false },
          { label: "Program", value: data.degreetitle, key: "degreetitle", editable: false },
          { label: "CGPA", value: data.cgpa, key: "cgpa", editable: true, type: "number" },
          { label: "Year of Starting", value: data.yearofstarting, key: "yearofstarting", editable: false },
          { label: "Year of Ending", value: data.yearofending, key: "yearofending", editable: false },
        ],
      },
      {
        title: "Employment Information",
        icon: <IconBriefcase className="w-4 h-4" />,
        fields: [
          { label: "Employment Status", value: data.employeed, key: "employeed", editable: true, type: "select", options: employmentStatusOptions, isSpecial: true },
        ],
      },
      {
        title: "Social Media Links",
        icon: <IconGlobe className="w-4 h-4" />,
        fields: [
          { label: "Facebook", value: data.facebook, key: "facebook", editable: true },
          { label: "Instagram", value: data.instagram, key: "instagram", editable: true },
          { label: "YouTube", value: data.youtube, key: "youtube", editable: true },
          { label: "LinkedIn", value: data.linkedin, key: "linkedin", editable: true },
        ],
      },
      {
        title: "Additional Information",
        icon: <IconInformationCircle className="w-4 h-4" />,
        fields: [
          { label: "About Me", value: data.aboutme, key: "aboutme", editable: true, type: "textarea" },
          { label: "Last Login", value: formatDateTimeDisplay(data.lasttimelogin) || "Never", key: "lasttimelogin", editable: false },
          { label: "Login Count", value: data.logincount, key: "logincount", editable: false },
          { label: "Last Updated", value: formatDateDisplay((data as Record<string, unknown>).updated_at as unknown), key: "updated_at", editable: false },
          { label: "Created Date", value: formatDateDisplay(data.createddatetime), key: "createddatetime", editable: false },
        ],
      },
    ];
  }, [data]);

  const isAdminOrSuperAdmin = canModify(session?.user);

  const handleSendCredentials = async () => {
    const alumniId = data?.alumniid;
    if (!alumniId || alumniId <= 0) {
      toast.error("Missing alumniId");
      return;
    }
    if (isSendingCredentials) return;
    setIsSendingCredentials(true);
    try {
      const res = await fetch("/api/send-credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alumniId }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `Failed (${res.status})`);
      toast.success("Credentials email sent successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send credentials");
    } finally {
      setIsSendingCredentials(false);
    }
  };

  const pendingCount = Object.keys(pendingChanges).length;
  const hasPendingChanges = pendingCount > 0;

  /* ─── Loading State ─── */
  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="animate-pulse space-y-8">
              <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                  <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                </div>
                <div className="lg:col-span-3 space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ─── Error State ─── */
  if (isError || !data) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <IconExclamationTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Failed to load profile</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error instanceof Error ? error.message : "Unknown error occurred"}</p>
            <div className="mt-6">
              <BackButton />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <Toaster
        position="top-right"
        toastOptions={{
          className: "dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700",
        }}
        containerStyle={{ top: 80, zIndex: 100000 }}
      />

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <PageBanner title="Profile Details" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ─── Sidebar ─── */}
            <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-emerald-800 to-teal-700 dark:from-emerald-900 dark:to-teal-900" />
                <div className="px-6 pb-6">
                  <div className="relative -mt-12 mb-4 flex justify-center">
                    <div className="relative w-24 h-24 rounded-full ring-4 ring-white dark:ring-slate-900 overflow-hidden bg-white dark:bg-slate-800">
                      <Image
                        src={normalizeImagePath(data.image1)}
                        alt={data.alumniname || "Profile"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{data.alumniname || "—"}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{data.sapid || data.registrationno || ""}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                      <IconShield className="w-3 h-3" />
                      Alumni
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {data.personalemail && (
                      <div className="flex items-center gap-3 text-sm">
                        <IconMail className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300 truncate">{String(data.personalemail)}</span>
                      </div>
                    )}
                    {data.contactno && (
                      <div className="flex items-center gap-3 text-sm">
                        <IconPhone className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300">{String(data.contactno)}</span>
                      </div>
                    )}
                    {(data.city || data.country) && (
                      <div className="flex items-center gap-3 text-sm">
                        <IconMapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-300">
                          {[data.city, data.country].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {isAdminOrSuperAdmin && data.alumniid && data.alumniid > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={isSendingCredentials}
                        onClick={handleSendCredentials}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-emerald-900 text-white hover:bg-emerald-800 dark:bg-emerald-800 dark:hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <IconPaperAirplane className="w-4 h-4" />
                        {isSendingCredentials ? "Sending..." : "Send Credentials"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Changes Summary */}
              {hasPendingChanges && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <IconPencilSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Pending Changes</h3>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                    You have <span className="font-bold">{pendingCount}</span> unsaved field{pendingCount !== 1 ? "s" : ""}.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(pendingChanges).map((key) => (
                      <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Activity</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last Login</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDateTimeDisplay(data.lasttimelogin) || "Never"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Logins</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{data.logincount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Member Since</div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDateDisplay(data.createddatetime)}</div>
                  </div>
                </div>
              </div>
            </aside>

            {/* ─── Main Content ─── */}
            <main className="lg:col-span-8 xl:col-span-9 space-y-6">
              {sections.map((section) => (
                <section
                  key={section.title}
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-shadow hover:shadow-md"
                >
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                    <span className="text-emerald-700 dark:text-emerald-400">{section.icon}</span>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{section.title}</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                      {section.fields.map((field) => {
                        const editable = field.editable && !isViewer;

                        if (field.isSpecial && field.key === "country") {
                          return (
                            <div key={field.key} className="sm:col-span-2">
                              <EditableCountryProvinceCity
                                countryValue={data.country}
                                provinceValue={data.province}
                                cityValue={data.city}
                                pendingCountryValue={pendingDisplayMap.country}
                                pendingProvinceValue={pendingDisplayMap.province}
                                pendingCityValue={pendingDisplayMap.city}
                                disabled={!editable}
                                onCountryChange={(_, value) => handleFieldValueChange("country", value)}
                                onProvinceChange={(_, value) => handleFieldValueChange("province", value)}
                                onCityChange={(_, value) => handleFieldValueChange("city", value)}
                              />
                            </div>
                          );
                        }

                        if (field.isSpecial && field.key === "employeed") {
                          return (
                            <div key={field.key} className="sm:col-span-2">
                              <EditableEmploymentStatus
                                employeedValue={data.employeed}
                                industryValue={data.industry}
                                nameoforganizationValue={data.nameoforganization}
                                designationValue={data.designation}
                                totalyearsofexpereinceValue={data.totalyearsofexpereince}
                                occupationTransitionTimingValue={data.occupation_transition_timing}
                                organizationAddressValue={data.organization_address}
                                workCountryValue={data.work_country}
                                workCityValue={data.work_city}
                                workEmailValue={data.officialemail}
                                workPhoneValue={data.officialnumber}
                                instituteNameValue={data.higher_education_institute_name}
                                programValue={data.higher_education_program}
                                instituteCountryValue={data.higher_education_institute_country}
                                instituteCityValue={data.higher_education_institute_city}
                                scholarshipValue={data.is_scholarship}
                                pendingValues={pendingDisplayMap}
                                disabled={!editable}
                                onEmployeedChange={(_, value) => handleFieldValueChange("employeed", value)}
                                onIndustryChange={(_, value) => handleFieldValueChange("industry", value)}
                                onOrganizationChange={(_, value) => handleFieldValueChange("nameoforganization", value)}
                                onDesignationChange={(_, value) => handleFieldValueChange("designation", value)}
                                onExperienceChange={(_, value) => handleFieldValueChange("totalyearsofexpereince", value)}
                                onOccupationTransitionTimingChange={(_, value) => handleFieldValueChange("occupation_transition_timing", value)}
                                onOrganizationAddressChange={(_, value) => handleFieldValueChange("organization_address", value)}
                                onWorkCountryChange={(_, value) => handleFieldValueChange("work_country", value)}
                                onWorkCityChange={(_, value) => handleFieldValueChange("work_city", value)}
                                onWorkEmailChange={(_, value) => handleFieldValueChange("officialemail", value)}
                                onWorkPhoneChange={(_, value) => handleFieldValueChange("officialnumber", value)}
                                onInstituteNameChange={(_, value) => handleFieldValueChange("higher_education_institute_name", value)}
                                onProgramChange={(_, value) => handleFieldValueChange("higher_education_program", value)}
                                onInstituteCountryChange={(_, value) => handleFieldValueChange("higher_education_institute_country", value)}
                                onInstituteCityChange={(_, value) => handleFieldValueChange("higher_education_institute_city", value)}
                                onScholarshipChange={(_, value) => handleFieldValueChange("is_scholarship", value)}
                              />
                            </div>
                          );
                        }

                        return (
                          <EditableField
                            key={field.key}
                            label={field.label}
                            value={field.value}
                            pendingValue={pendingDisplayMap[field.key]}
                            fieldKey={field.key}
                            type={field.type}
                            options={field.options}
                            disabled={!editable}
                            batchMode={true}
                            onValueChange={handleFieldValueChange}
                          />
                        );
                      })}
                    </div>
                  </div>
                </section>
              ))}

              {/* Password Change Section */}
              {isAlumniUser && (
                <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                    <IconLockClosed className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Security</h3>
                  </div>
                  <div className="p-6">
                    <div className="max-w-2xl">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        Update your password to keep your account secure. You must enter your current password to confirm your identity.
                      </p>
                      <div className="grid grid-cols-1 gap-5">
                        {[
                          { label: "Current Password", value: currentPassword, setter: setCurrentPassword, show: showCurrentPassword, toggle: setShowCurrentPassword },
                          { label: "New Password", value: newPassword, setter: setNewPassword, show: showNewPassword, toggle: setShowNewPassword },
                          { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword, show: showConfirmPassword, toggle: setShowConfirmPassword },
                        ].map((field) => (
                          <div key={field.label}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{field.label}</label>
                            <div className="relative">
                              <input
                                type={field.show ? "text" : "password"}
                                value={field.value}
                                onChange={(e) => field.setter(e.target.value)}
                                disabled={isChangingPassword}
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 dark:focus:ring-emerald-500/20 dark:focus:border-emerald-500 transition-all pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => field.toggle((v) => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              >
                                {field.show ? <IconEyeSlash className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={handleChangePassword}
                            disabled={isChangingPassword}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-800 dark:hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                          >
                            <IconKey className="w-4 h-4" />
                            {isChangingPassword ? "Updating..." : "Change Password"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* ─── Sticky Save Bar ─── */}
      {hasPendingChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <IconPencilSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Review and save your updates</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCancelAll}
                  disabled={isSavingAll}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  <IconXMark className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSavingAll}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 dark:bg-emerald-800 dark:hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {isSavingAll ? (
                    <IconArrowPath className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconCheck className="w-4 h-4" />
                  )}
                  {isSavingAll ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function MoreDetailsPage() {
  return (
    <Suspense fallback={null}>
      <MoreDetailsContent />
    </Suspense>
  );
}