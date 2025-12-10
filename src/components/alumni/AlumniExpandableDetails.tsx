"use client";

import React, { useState, useEffect } from "react";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import { useForm } from "react-hook-form";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { PencilIcon, TrashBinIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { canModify } from "@/lib/alumniProfile";

type Chapter = {
  id: number;
  name: string;
  type: "national" | "international";
};

type Association = {
  id: number;
  title: string;
};

async function getChaptersList(): Promise<Chapter[]> {
  const res = await fetch("/api/chapters/list", { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch chapters list");
  }
  const data = (await res.json()) as { chapters: Chapter[] };
  return data.chapters ?? [];
}

async function getAssociationsList(): Promise<Association[]> {
  const res = await fetch("/api/associations/list", { headers: { "accept": "application/json" } });
  if (!res.ok) {
    throw new Error("Failed to fetch associations list");
  }
  const data = (await res.json()) as { associations: Association[] };
  return data.associations ?? [];
}

type AlumniExpandableDetailsProps = {
  sapId: string;
  onClose: () => void;
  readOnly?: boolean;
};

type AlumniFullData = {
  alumniid: number | null;
  alumniemail: string | null;
  registrationno: string | null;
  sapid: string | null;
  alumniname: string | null;
  gender: string | null;
  fathername: string | null;
  dateofbirth: string | null;
  maritalstatus: string | null;
  cnicpassport: string | null;
  contactno: string | null;
  contactno1: string | null;
  contactno1show: string | null;
  personalemail: string | null;
  personalemailshow: string | null;
  universityemail: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  academicsession: string | null;
  degreetitle: string | null;
  cgpa: number | null;
  yearofstarting: number | null;
  yearofending: number | null;
  facultyname: string | null;
  campusname: string | null;
  departmentname: string | null;
  majorsubject: string | null;
  industry: string | null;
  employeed: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  officialemail: string | null;
  officialnumber: string | null;
  work_city: string | null;
  work_country: string | null;
  image1: string | null;
  image2: string | null;
  cv: string | null;
  aboutme: string | null;
  lasttimelogin: string | null;
  logincount: number | null;
  verify: string | null;
  emailsendcount: number | null;
  emailsendstatus: string | null;
  createddatetime: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
  password: string | null;
  father_cnic: string | null;
  chapter: string | null;
  chapter1_id: number | null;
  chapter2_id: number | null;
  chapter3_id: number | null;
  association: string | null;
  association_id: number | null;
};

// Helper to format field value
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

// Compact field component
const CompactField: React.FC<{
  label: string;
  value: string | number | null | undefined;
  isEditing?: boolean;
  readOnly?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register?: any;
  name?: string;
  type?: string;
  options?: { value: string; label: string }[];
}> = ({ label, value, isEditing = false, readOnly = false, register, name, type = "text", options }) => {
  // If readOnly is true, always show as display (not editing)
  const effectiveIsEditing = readOnly ? false : isEditing;
  const displayValue = formatValue(value);
  
  if (!effectiveIsEditing) {
    return (
      <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">{label}:</span>
        <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 break-words">{displayValue}</span>
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">{label}:</label>
        <select
          {...(register && name ? register(name) : {})}
          disabled={readOnly}
          className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0 pt-1">{label}:</label>
        <textarea
          {...(register && name ? register(name) : {})}
          rows={2}
          disabled={readOnly}
          readOnly={readOnly}
          className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 resize-none ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
        />
      </div>
    );
  }

  // Add validation attributes for CGPA field
  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {};
  if (name === "cgpa") {
    inputProps.pattern = "[0-4](\\.\\d{1,2})?";
    inputProps.maxLength = 4;
    inputProps.placeholder = "0.0 - 4.0";
    inputProps.title = "CGPA must be between 0.0 and 4.0 (e.g., 3.2, 2.9, 4.0)";
  }
  
  return (
    <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">{label}:</label>
      <input
        type={type}
        {...(register && name ? register(name) : {})}
        {...inputProps}
        disabled={readOnly}
        readOnly={readOnly}
        className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
      />
    </div>
  );
};

export const AlumniExpandableDetails: React.FC<AlumniExpandableDetailsProps> = ({ sapId, onClose, readOnly = false }) => {
  const [currentSapId, setCurrentSapId] = useState(sapId);
  const { data, isLoading, error} = useAlumniFullDetails(currentSapId);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { register, handleSubmit, reset } = useForm<AlumniFullData>();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const deleteModal = useModal();

  // Fetch chapters and associations for dropdowns
  const { data: chaptersList = [] } = useQuery<Chapter[]>({
    queryKey: ["chapters-list"],
    queryFn: getChaptersList,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: associationsList = [] } = useQuery<Association[]>({
    queryKey: ["associations-list"],
    queryFn: getAssociationsList,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data) {
      // Convert AlumniFullDetails to AlumniFullData format (handle boolean to string conversion)
      const formData: AlumniFullData = {
        ...data,
        contactno1show: data.contactno1show !== null && data.contactno1show !== undefined 
          ? String(data.contactno1show) 
          : null,
        personalemailshow: data.personalemailshow !== null && data.personalemailshow !== undefined 
          ? String(data.personalemailshow) 
          : null,
      };
      reset(formData);
      // Update currentSapId if the data has a different SAP ID (in case it was changed)
      if (data.sapid && data.sapid !== currentSapId) {
        setCurrentSapId(data.sapid);
      }
    }
  }, [data, reset, currentSapId]);

  const onSubmit = async (formData: AlumniFullData) => {
    if (!currentSapId) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(currentSapId)}/update-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sapid: formData.sapid,
          registrationno: formData.registrationno,
          alumniname: formData.alumniname,
          gender: formData.gender,
          fathername: formData.fathername,
          dateofbirth: formData.dateofbirth,
          maritalstatus: formData.maritalstatus,
          cnicpassport: formData.cnicpassport,
          contactno: formData.contactno,
          contactno1: formData.contactno1,
          contactno1show: formData.contactno1show,
          personalemail: formData.personalemail,
          personalemailshow: formData.personalemailshow,
          universityemail: formData.universityemail,
          officialemail: formData.officialemail,
          officialnumber: formData.officialnumber,
          address: formData.address,
          province: formData.province,
          city: formData.city,
          country: formData.country,
          campusname: formData.campusname,
          facultyname: formData.facultyname,
          departmentname: formData.departmentname,
          degreetitle: formData.degreetitle,
          yearofending: formData.yearofending,
          yearofstarting: formData.yearofstarting,
          cgpa: formData.cgpa,
          employeed: formData.employeed,
          industry: formData.industry,
          nameoforganization: formData.nameoforganization,
          designation: formData.designation,
          totalyearsofexpereince: formData.totalyearsofexpereince,
          work_city: formData.work_city,
          work_country: formData.work_country,
          majorsubject: formData.majorsubject,
          aboutme: formData.aboutme,
          association_id: formData.association_id && String(formData.association_id) !== "" ? Number(formData.association_id) : null,
          chapter1_id: formData.chapter1_id && String(formData.chapter1_id) !== "" ? Number(formData.chapter1_id) : null,
          chapter2_id: formData.chapter2_id && String(formData.chapter2_id) !== "" ? Number(formData.chapter2_id) : null,
          chapter3_id: formData.chapter3_id && String(formData.chapter3_id) !== "" ? Number(formData.chapter3_id) : null,
          facebook: formData.facebook,
          instagram: formData.instagram,
          youtube: formData.youtube,
          linkedin: formData.linkedin,
          datasource: formData.datasource,
          alumnistatus: formData.alumnistatus,
          verify: formData.verify,
          lasttimelogin: formData.lasttimelogin,
          logincount: formData.logincount,
          createddatetime: formData.createddatetime,
          academicsession: formData.academicsession,
          father_cnic: formData.father_cnic,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update alumni");
      }

      const responseData = await res.json();
      const updatedSapId = responseData?.updated?.sapid;
      
      // Invalidate queries (non-blocking) - React Query will refetch when components need the data
      queryClient.invalidateQueries({ queryKey: ["alumni"] });
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alumnilist"] });
      
      // If SAP ID was changed, update our current identifier
      if (updatedSapId && updatedSapId !== currentSapId) {
        setCurrentSapId(updatedSapId);
        // Invalidate the specific query - will refetch automatically when component needs it
        queryClient.invalidateQueries({ queryKey: ["alumni", "full-details", updatedSapId] });
      } else {
        // Invalidate current query - will refetch automatically when component needs it
        queryClient.invalidateQueries({ queryKey: ["alumni", "full-details", currentSapId] });
      }

      toast.success("Alumni data updated successfully");
      setIsEditing(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update alumni";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentSapId || !data) return;
    
    // Validate sapid before proceeding
    if (!currentSapId || currentSapId === "null" || currentSapId === "undefined" || currentSapId.trim() === "") {
      toast.error("Invalid SAP ID. Cannot delete alumni without a valid SAP ID.");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(currentSapId)}`, { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to delete: ${res.status}` }));
        throw new Error(errorData.error || `Failed to delete: ${res.status}`);
      }
      
      toast.success("Alumni deleted successfully.");
      
      // Invalidate all alumni-related queries to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alumni"] }),
        queryClient.invalidateQueries({ queryKey: ["alumnilist"] }),
        queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false }),
        queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false })
      ]);
      
      // Close the details panel and modal
      deleteModal.closeModal();
      onClose();
      
      // Optionally navigate away or refresh the page
      // router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to delete alumni.");
      console.error("[AlumniExpandableDetails] Delete error:", msg, e);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 px-3 py-2">
        <p className="text-xs text-red-800 dark:text-red-200">
          {error instanceof Error ? error.message : "Failed to load alumni details"}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 dark:bg-gray-800/30 dark:border-gray-700 px-3 py-2">
        <p className="text-xs text-gray-600 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded border ml-2 border-gray-200 dark:border-gray-700 p-3 overflow-x-hidden max-w-xl w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Alumni Details</h3>
        <div className="flex items-center gap-2">
          {!isEditing && !readOnly && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded transition-colors"
            >
              <PencilIcon className="w-3 h-3" />
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="overflow-x-hidden">
        <div className="space-y-1 text-xs">
          {/* Personal Information */}
          <div className="pt-1 pb-1 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Personal</h4>
          </div>
          <CompactField label="SAP ID" value={data.sapid} isEditing={isEditing} readOnly={readOnly} register={register} name="sapid" />
          <CompactField label="Registration No" value={data.registrationno} isEditing={isEditing} readOnly={readOnly} register={register} name="registrationno" />
          <CompactField label="Full Name" value={data.alumniname} isEditing={isEditing} readOnly={readOnly} register={register} name="alumniname" />
          <CompactField label="Gender" value={data.gender} isEditing={isEditing} readOnly={readOnly} register={register} name="gender" type="select" options={[
            { value: "", label: "Select" },
            { value: "Male", label: "Male" },
            { value: "Female", label: "Female" },
            { value: "Other", label: "Other" }
          ]} />
          <CompactField label="Date of Birth" value={data.dateofbirth} isEditing={isEditing} readOnly={readOnly} register={register} name="dateofbirth" />
          <CompactField label="CNIC/Passport" value={data.cnicpassport} isEditing={isEditing} readOnly={readOnly} register={register} name="cnicpassport" />
          <CompactField label="Father Name" value={data.fathername} isEditing={isEditing} readOnly={readOnly} register={register} name="fathername" />
          <CompactField label="Marital Status" value={data.maritalstatus} isEditing={isEditing} readOnly={readOnly} register={register} name="maritalstatus" type="select" options={[
            { value: "", label: "Select" },
            { value: "Single", label: "Single" },
            { value: "Married", label: "Married" },
            { value: "Divorced", label: "Divorced" },
            { value: "Widowed", label: "Widowed" }
          ]} />

          {/* Contact Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Contact</h4>
          </div>
          <CompactField label="Primary Contact" value={data.contactno} isEditing={isEditing} readOnly={readOnly} register={register} name="contactno" />
          <CompactField label="Secondary Contact" value={data.contactno1} isEditing={isEditing} readOnly={readOnly} register={register} name="contactno1" />
          <CompactField label="Personal Email" value={data.personalemail} isEditing={isEditing} readOnly={readOnly} register={register} name="personalemail" type="email" />
          <CompactField label="Alumni Email" value={data.universityemail} isEditing={isEditing} readOnly={readOnly} register={register} name="universityemail" type="email" />
         
          <CompactField label="Address" value={data.address} isEditing={isEditing} readOnly={readOnly} register={register} name="address" type="textarea" />
          <CompactField label="Country" value={data.country} isEditing={isEditing} readOnly={readOnly} register={register} name="country" />
          <CompactField label="Province" value={data.province} isEditing={isEditing} readOnly={readOnly} register={register} name="province" />
          <CompactField label="City" value={data.city} isEditing={isEditing} readOnly={readOnly} register={register} name="city" />

          {/* Academic Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Academic</h4>
          </div>
          <CompactField label="Faculty" value={data.facultyname} isEditing={isEditing} readOnly={readOnly} register={register} name="facultyname" />
          <CompactField label="Department" value={data.departmentname} isEditing={isEditing} readOnly={readOnly} register={register} name="departmentname" />
          <CompactField label="Program" value={data.degreetitle} isEditing={isEditing} readOnly={readOnly} register={register} name="degreetitle" />
          <CompactField label="Campus" value={data.campusname} isEditing={isEditing} readOnly={readOnly} register={register} name="campusname" />
          <CompactField label="Year of Starting" value={data.yearofstarting} isEditing={isEditing} readOnly={readOnly} register={register} name="yearofstarting" type="number" />
          <CompactField label="Year of Ending" value={data.yearofending} isEditing={isEditing} readOnly={readOnly} register={register} name="yearofending" type="number" />
          <CompactField label="CGPA" value={data.cgpa} isEditing={isEditing} readOnly={readOnly} register={register} name="cgpa" type="text" />
          <CompactField label="Major Subject" value={data.majorsubject} isEditing={isEditing} readOnly={readOnly} register={register} name="majorsubject" />
          <CompactField label="Academic Session" value={data.academicsession} isEditing={isEditing} readOnly={readOnly} register={register} name="academicsession" />

          {/* Professional Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Professional</h4>
          </div>
          <CompactField label="Occupation Status" value={data.employeed} isEditing={isEditing} readOnly={readOnly} register={register} name="employeed" type="select" options={[
            { value: "", label: "Select" },
            { value: "Employed", label: "Employed" },
            { value: "Unemployed", label: "Unemployed" },
            { value: "Self-Employed", label: "Self-Employed" },
            { value: "Pursuing Higher Education", label: "Pursuing Higher Education" }
          ]} />
          <CompactField label="Organization" value={data.nameoforganization} isEditing={isEditing} readOnly={readOnly} register={register} name="nameoforganization" />
          <CompactField label="Designation" value={data.designation} isEditing={isEditing} readOnly={readOnly} register={register} name="designation" />
          <CompactField label="Sector" value={data.industry} isEditing={isEditing} readOnly={readOnly} register={register} name="industry" />
          <CompactField label="Experience (Years)" value={data.totalyearsofexpereince} isEditing={isEditing} readOnly={readOnly} register={register} name="totalyearsofexpereince" />
          <CompactField label="Work Email" value={data.officialemail} isEditing={isEditing} readOnly={readOnly} register={register} name="officialemail" type="email" />
          <CompactField label="Work Phone Number" value={data.officialnumber} isEditing={isEditing} readOnly={readOnly} register={register} name="officialnumber" />
          <CompactField label="Work City" value={data.work_city} isEditing={isEditing} readOnly={readOnly} register={register} name="work_city" />
          <CompactField label="Work Country" value={data.work_country} isEditing={isEditing} readOnly={readOnly} register={register} name="work_country" />

          {/* Chapter and Association Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Chapter & Association</h4>
          </div>
          {!isEditing ? (
            <>
              <CompactField label="Chapter" value={data.chapter} isEditing={false} />
              <CompactField label="Association" value={data.association} isEditing={false} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Chapter 1:</label>
                <select
                  {...register("chapter1_id")}
                  disabled={readOnly}
                  className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
                >
                  <option value="">None</option>
                  {chaptersList.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name} ({chapter.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Chapter 2:</label>
                <select
                  {...register("chapter2_id")}
                  disabled={readOnly}
                  className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
                >
                  <option value="">None</option>
                  {chaptersList.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name} ({chapter.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Chapter 3:</label>
                <select
                  {...register("chapter3_id")}
                  disabled={readOnly}
                  className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
                >
                  <option value="">None</option>
                  {chaptersList.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name} ({chapter.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Association:</label>
                <select
                  {...register("association_id")}
                  disabled={readOnly}
                  className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
                >
                  <option value="">None</option>
                  {associationsList.map((association) => (
                    <option key={association.id} value={association.id}>
                      {association.title}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Additional Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Additional</h4>
          </div>
          <CompactField label="About Me" value={data.aboutme} isEditing={isEditing} readOnly={readOnly} register={register} name="aboutme" type="textarea" />

          {/* Social Links */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Social Links</h4>
          </div>
          <CompactField label="Facebook" value={data.facebook} isEditing={isEditing} readOnly={readOnly} register={register} name="facebook" type="url" />
          <CompactField label="Instagram" value={data.instagram} isEditing={isEditing} readOnly={readOnly} register={register} name="instagram" type="url" />
          <CompactField label="YouTube" value={data.youtube} isEditing={isEditing} readOnly={readOnly} register={register} name="youtube" type="url" />
          <CompactField label="LinkedIn" value={data.linkedin} isEditing={isEditing} readOnly={readOnly} register={register} name="linkedin" type="url" />

          {/* System Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">System</h4>
          </div>
          <CompactField label="Verification Status" value={data.verify || "Not Set"} isEditing={isEditing} readOnly={readOnly} register={register} name="verify" type="select" options={[
            { value: "", label: "Select" },
            { value: "true", label: "Verified" },
            { value: "false", label: "Unverified" },
            { value: "pending", label: "Pending" }
          ]} />
          <CompactField label="Last Login" value={data.lasttimelogin || "Never"} isEditing={isEditing} readOnly={readOnly} register={register} name="lasttimelogin" />
          <CompactField label="Login Count" value={data.logincount || 0} isEditing={isEditing} readOnly={readOnly} register={register} name="logincount" type="number" />
          <CompactField label="Alumni Status" value={data.alumnistatus} isEditing={isEditing} readOnly={readOnly} register={register} name="alumnistatus" />
          <CompactField label="Created Date" value={data.createddatetime} isEditing={isEditing} readOnly={readOnly} register={register} name="createddatetime" />
          <CompactField label="Academic Session" value={data.academicsession} isEditing={isEditing} readOnly={readOnly} register={register} name="academicsession" />
          <CompactField label="Data Source" value={data.datasource} isEditing={isEditing} readOnly={readOnly} register={register} name="datasource" />
        </div>

        {isEditing && !readOnly && (
          <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                if (data) {
                  const formData: AlumniFullData = {
                    ...data,
                    contactno1show: data.contactno1show !== null && data.contactno1show !== undefined 
                      ? String(data.contactno1show) 
                      : null,
                    personalemailshow: data.personalemailshow !== null && data.personalemailshow !== undefined 
                      ? String(data.personalemailshow) 
                      : null,
                  };
                  reset(formData);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {/* Delete Button - Only show for admins and when not editing */}
        {!isEditing && !readOnly && canModify(session?.user) && (
          <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-red-200 dark:border-red-800">
            <button
              type="button"
              onClick={() => deleteModal.openModal()}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashBinIcon className="w-3 h-3" />
              Delete Alumni
            </button>
          </div>
        )}
      </form>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && data && (
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => {
            if (!isDeleting) {
              deleteModal.closeModal();
            }
          }}
          className="max-w-lg mx-auto"
          showCloseButton={true}
        >
          <div className="p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-rose-100 dark:bg-rose-900/30">
                <TrashBinIcon className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  Confirm Deletion
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete <strong className="font-semibold text-gray-900 dark:text-gray-100">{data.alumniname || currentSapId}</strong>? This will permanently remove their record from the system.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isDeleting) {
                    deleteModal.closeModal();
                  }
                }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
