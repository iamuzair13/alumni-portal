"use client";

import React, { useState, useEffect } from "react";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PencilIcon } from "@/icons";

type AlumniExpandableDetailsProps = {
  sapId: string;
  onClose: () => void;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register?: any;
  name?: string;
  type?: string;
  options?: { value: string; label: string }[];
}> = ({ label, value, isEditing = false, register, name, type = "text", options }) => {
  const displayValue = formatValue(value);
  
  if (!isEditing) {
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
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
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
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 resize-none"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">{label}:</label>
      <input
        type={type}
        {...(register && name ? register(name) : {})}
        className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
      />
    </div>
  );
};

export const AlumniExpandableDetails: React.FC<AlumniExpandableDetailsProps> = ({ sapId, onClose }) => {
  const [currentSapId, setCurrentSapId] = useState(sapId);
  const { data, isLoading, error, refetch } = useAlumniFullDetails(currentSapId);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<AlumniFullData>();
  const queryClient = useQueryClient();

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
          majorsubject: formData.majorsubject,
          aboutme: formData.aboutme,
          facebook: formData.facebook,
          instagram: formData.instagram,
          youtube: formData.youtube,
          linkedin: formData.linkedin,
          datasource: formData.datasource,
          alumnistatus: formData.alumnistatus,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update alumni");
      }

      const responseData = await res.json();
      const updatedSapId = responseData?.updated?.sapid;
      
      // Invalidate all alumni-related queries to ensure fresh data (including the list and counts)
      await queryClient.invalidateQueries({ queryKey: ["alumni"] });
      await queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Refresh counts
      await queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Force immediate refetch
      await queryClient.invalidateQueries({ queryKey: ["alumnilist"] }); // Refresh list
      
      // If SAP ID was changed, update our current identifier
      if (updatedSapId && updatedSapId !== currentSapId) {
        // Update to new SAP ID - this will trigger a new query automatically via useAlumniFullDetails
        setCurrentSapId(updatedSapId);
        // Wait for React Query to refetch with the new identifier
        await queryClient.refetchQueries({ queryKey: ["alumni", "full-details", updatedSapId] });
      } else {
        // Just refetch with current identifier
        await refetch();
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
    <div className="bg-white dark:bg-gray-800/50 rounded mx-auto border border-gray-200 dark:border-gray-700 p-3 overflow-x-hidden max-w-4xl w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Alumni Details</h3>
        <div className="flex items-center gap-2">
          {!isEditing && (
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
          <CompactField label="SAP ID" value={data.sapid} isEditing={isEditing} register={register} name="sapid" />
          <CompactField label="Registration No" value={data.registrationno} isEditing={isEditing} register={register} name="registrationno" />
          <CompactField label="Full Name" value={data.alumniname} isEditing={isEditing} register={register} name="alumniname" />
          <CompactField label="Gender" value={data.gender} isEditing={isEditing} register={register} name="gender" type="select" options={[
            { value: "", label: "Select" },
            { value: "Male", label: "Male" },
            { value: "Female", label: "Female" },
            { value: "Other", label: "Other" }
          ]} />
          <CompactField label="Date of Birth" value={data.dateofbirth} isEditing={isEditing} register={register} name="dateofbirth" />
          <CompactField label="CNIC/Passport" value={data.cnicpassport} isEditing={isEditing} register={register} name="cnicpassport" />
          <CompactField label="Father Name" value={data.fathername} isEditing={isEditing} register={register} name="fathername" />
          <CompactField label="Father CNIC" value={data.father_cnic} isEditing={isEditing} register={register} name="father_cnic" />
          <CompactField label="Marital Status" value={data.maritalstatus} isEditing={isEditing} register={register} name="maritalstatus" type="select" options={[
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
          <CompactField label="Contact No" value={data.contactno} isEditing={isEditing} register={register} name="contactno" />
          <CompactField label="Contact No 1" value={data.contactno1} isEditing={isEditing} register={register} name="contactno1" />
          <CompactField label="Personal Email" value={data.personalemail} isEditing={isEditing} register={register} name="personalemail" type="email" />
          <CompactField label="University Email" value={data.universityemail} isEditing={isEditing} register={register} name="universityemail" type="email" />
          <CompactField label="Official Email" value={data.officialemail} isEditing={isEditing} register={register} name="officialemail" type="email" />
          <CompactField label="Official Number" value={data.officialnumber} isEditing={isEditing} register={register} name="officialnumber" />
          <CompactField label="Address" value={data.address} isEditing={isEditing} register={register} name="address" type="textarea" />
          <CompactField label="Country" value={data.country} isEditing={isEditing} register={register} name="country" />
          <CompactField label="Province" value={data.province} isEditing={isEditing} register={register} name="province" />
          <CompactField label="City" value={data.city} isEditing={isEditing} register={register} name="city" />

          {/* Academic Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Academic</h4>
          </div>
          <CompactField label="Faculty" value={data.facultyname} isEditing={isEditing} register={register} name="facultyname" />
          <CompactField label="Department" value={data.departmentname} isEditing={isEditing} register={register} name="departmentname" />
          <CompactField label="Program" value={data.degreetitle} isEditing={isEditing} register={register} name="degreetitle" />
          <CompactField label="Campus" value={data.campusname} isEditing={isEditing} register={register} name="campusname" />
          <CompactField label="Year of Starting" value={data.yearofstarting} isEditing={isEditing} register={register} name="yearofstarting" type="number" />
          <CompactField label="Year of Ending" value={data.yearofending} isEditing={isEditing} register={register} name="yearofending" type="number" />
          <CompactField label="CGPA" value={data.cgpa} isEditing={isEditing} register={register} name="cgpa" type="number" />
          <CompactField label="Major Subject" value={data.majorsubject} isEditing={isEditing} register={register} name="majorsubject" />
          <CompactField label="Academic Session" value={data.academicsession} isEditing={isEditing} register={register} name="academicsession" />

          {/* Professional Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Professional</h4>
          </div>
          <CompactField label="Employment Status" value={data.employeed} isEditing={isEditing} register={register} name="employeed" type="select" options={[
            { value: "", label: "Select" },
            { value: "Employed", label: "Employed" },
            { value: "Unemployed", label: "Unemployed" },
            { value: "Self-Employed", label: "Self-Employed" },
            { value: "Pursuing Higher Education", label: "Pursuing Higher Education" }
          ]} />
          <CompactField label="Organization" value={data.nameoforganization} isEditing={isEditing} register={register} name="nameoforganization" />
          <CompactField label="Designation" value={data.designation} isEditing={isEditing} register={register} name="designation" />
          <CompactField label="Industry" value={data.industry} isEditing={isEditing} register={register} name="industry" />
          <CompactField label="Experience (Years)" value={data.totalyearsofexpereince} isEditing={isEditing} register={register} name="totalyearsofexpereince" />

          {/* Additional Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Additional</h4>
          </div>
          <CompactField label="About Me" value={data.aboutme} isEditing={isEditing} register={register} name="aboutme" type="textarea" />

          {/* Social Links */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Social Links</h4>
          </div>
          <CompactField label="Facebook" value={data.facebook} isEditing={isEditing} register={register} name="facebook" type="url" />
          <CompactField label="Instagram" value={data.instagram} isEditing={isEditing} register={register} name="instagram" type="url" />
          <CompactField label="YouTube" value={data.youtube} isEditing={isEditing} register={register} name="youtube" type="url" />
          <CompactField label="LinkedIn" value={data.linkedin} isEditing={isEditing} register={register} name="linkedin" type="url" />

          {/* System Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">System</h4>
          </div>
          <CompactField label="Verification Status" value={data.verify || "Not Set"} isEditing={false} />
          <CompactField label="Last Login" value={data.lasttimelogin || "Never"} isEditing={false} />
          <CompactField label="Login Count" value={data.logincount || 0} isEditing={false} />
          <CompactField label="Data Source" value={data.datasource} isEditing={isEditing} register={register} name="datasource" />
          <CompactField label="Alumni Status" value={data.alumnistatus} isEditing={isEditing} register={register} name="alumnistatus" />
          <CompactField label="Created Date" value={data.createddatetime} isEditing={false} />
        </div>

        {isEditing && (
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
      </form>
    </div>
  );
};
