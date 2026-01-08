"use client";
import EditableField from "./EditableField";

// Employment status options matching AlumniSqlForm.tsx
const employmentStatusOptions = [
  { value: "Employed/Business", label: "Employed/Business" },
  { value: "Self-employed", label: "Self-employed" },
  { value: "Pursuing Higher Education", label: "Pursuing Higher Education" },
  { value: "Unemployed By choice", label: "Unemployed By choice" },
  { value: "Unemployed, searching for job", label: "Unemployed, searching for job" },
];

// Helper function to map database values to display values
export function mapDbValueToDisplay(dbValue: unknown): string {
  if (!dbValue || typeof dbValue !== "string") return "";
  const normalized = dbValue.trim();
  
  // Map database values to display values
  if (normalized === "Employed") return "Employed/Business";
  if (normalized === "Self-Emplo") return "Self-employed";
  if (normalized === "Pursuing Higher Education" || normalized === "highered") return "Pursuing Higher Education";
  if (normalized === "Unemployed By choice") return "Unemployed By choice";
  if (normalized === "Unemployed, searching for job") return "Unemployed, searching for job";
  
  // If it doesn't match any known mapping, return as-is (for backward compatibility)
  return normalized;
}

// Helper function to map display values to database values
export function mapDisplayValueToDb(displayValue: unknown): string {
  if (!displayValue || typeof displayValue !== "string") return "";
  const normalized = displayValue.trim();
  
  // Map display values to database values (as per AlumniSqlForm.tsx onSubmit logic)
  if (normalized === "Employed/Business") return "Employed";
  if (normalized === "Self-employed") return "Self-Emplo";
  if (normalized === "Pursuing Higher Education") return "Pursuing Higher Education";
  if (normalized === "Unemployed By choice") return "Unemployed By choice";
  if (normalized === "Unemployed, searching for job") return "Unemployed, searching for job";
  
  // Return as-is if no mapping needed
  return normalized;
}

const scholarshipOptions = [
  { value: "full funded scholarship", label: "Full Funded Scholarship" },
  { value: "half funded scholarship", label: "Half Funded Scholarship" },
  { value: "self paid", label: "Self Paid" },
];

type EditableEmploymentStatusProps = {
  employeedValue: unknown;
  industryValue: unknown;
  nameoforganizationValue: unknown;
  designationValue: unknown;
  totalyearsofexpereinceValue: unknown;
  organizationAddressValue?: unknown;
  // Higher Education fields
  degreeTitleValue?: unknown;
  instituteNameValue?: unknown;
  programValue?: unknown;
  instituteCountryValue?: unknown;
  instituteCityValue?: unknown;
  scholarshipValue?: unknown;
  onEmployeedChange: (key: string, value: unknown) => void;
  onIndustryChange: (key: string, value: unknown) => void;
  onOrganizationChange: (key: string, value: unknown) => void;
  onDesignationChange: (key: string, value: unknown) => void;
  onExperienceChange: (key: string, value: unknown) => void;
  onOrganizationAddressChange?: (key: string, value: unknown) => void;
  // Higher Education handlers
  onDegreeTitleChange?: (key: string, value: unknown) => void;
  onInstituteNameChange?: (key: string, value: unknown) => void;
  onProgramChange?: (key: string, value: unknown) => void;
  onInstituteCountryChange?: (key: string, value: unknown) => void;
  onInstituteCityChange?: (key: string, value: unknown) => void;
  onScholarshipChange?: (key: string, value: unknown) => void;
  disabled?: boolean;
};

export default function EditableEmploymentStatus({
  employeedValue,
  industryValue,
  nameoforganizationValue,
  designationValue,
  totalyearsofexpereinceValue,
  organizationAddressValue,
  degreeTitleValue,
  instituteNameValue,
  programValue,
  instituteCountryValue,
  instituteCityValue,
  scholarshipValue,
  onEmployeedChange,
  onIndustryChange,
  onOrganizationChange,
  onDesignationChange,
  onExperienceChange,
  onOrganizationAddressChange,
  onDegreeTitleChange,
  onInstituteNameChange,
  onProgramChange,
  onInstituteCountryChange,
  onInstituteCityChange,
  onScholarshipChange,
  disabled = false,
}: EditableEmploymentStatusProps) {
  // Map database value to display value for the select dropdown
  const displayValue = mapDbValueToDisplay(employeedValue);
  
  // Handle value change: map display value back to database value before saving
  const handleEmployeedChange = (key: string, value: unknown) => {
    const dbValue = mapDisplayValueToDb(value);
    onEmployeedChange(key, dbValue);
  };
  
  const employeedStatus = String(employeedValue || "").toLowerCase();
  // Check for both "Employed" (DB value) and "Employed/Business" (display value)
  const isEmployed = employeedStatus === "employed" || employeedStatus === "employed/business";
  // Check for "Self-Emplo" (DB value) and "Self-employed" (display value)
  const isSelfEmployed = employeedStatus === "self-emplo" || employeedStatus === "self-employed";
  // Check for both database and display values
  const isPursuingHigherEd = employeedStatus === "pursuing higher education" || employeedStatus === "highered";
  // Show employment fields for both "Employed" and "Self-employed"
  const showEmploymentFields = isEmployed || isSelfEmployed;

  return (
    <>
      <EditableField
        label="Employment Status"
        value={displayValue}
        fieldKey="employeed"
        onValueChange={handleEmployeedChange}
        type="select"
        options={employmentStatusOptions}
        batchMode={true}
        disabled={disabled}
      />
      {showEmploymentFields && (
        <>
          <EditableField
            label="Industry *"
            value={industryValue}
            fieldKey="industry"
            onValueChange={onIndustryChange}
            type="text"
            batchMode={true}
            disabled={disabled}
          />
          <EditableField
            label="Company Name *"
            value={nameoforganizationValue}
            fieldKey="nameoforganization"
            onValueChange={onOrganizationChange}
            type="text"
            batchMode={true}
            disabled={disabled}
          />
          <EditableField
            label="Designation *"
            value={designationValue}
            fieldKey="designation"
            onValueChange={onDesignationChange}
            type="text"
            batchMode={true}
            disabled={disabled}
          />
          <EditableField
            label="Total Years of Experience *"
            value={totalyearsofexpereinceValue}
            fieldKey="totalyearsofexpereince"
            onValueChange={onExperienceChange}
            type="text"
            batchMode={true}
          />
          {onOrganizationAddressChange && (
            <EditableField
              label="Company Address *"
              value={organizationAddressValue}
              fieldKey="organization_address"
              onValueChange={onOrganizationAddressChange}
              type="textarea"
              batchMode={true}
              disabled={disabled}
            />
          )}
        </>
      )}
      {isPursuingHigherEd && (
        <>
          {onDegreeTitleChange && (
            <EditableField
              label="Degree Title *"
              value={degreeTitleValue}
              fieldKey="degree_title"
              onValueChange={onDegreeTitleChange}
              type="text"
              batchMode={true}
              disabled={disabled}
            />
          )}
          {onInstituteNameChange && (
            <EditableField
              label="Institute Name *"
              value={instituteNameValue}
              fieldKey="higher_education_institute_name"
              onValueChange={onInstituteNameChange}
              type="text"
              batchMode={true}
              disabled={disabled}
            />
          )}
          {onProgramChange && (
            <EditableField
              label="Program *"
              value={programValue}
              fieldKey="higher_education_program"
              onValueChange={onProgramChange}
              type="select"
              options={[
                { value: "MS", label: "MS (Master of Science)" },
                { value: "PhD", label: "PhD (Doctor of Philosophy)" },
              ]}
              batchMode={true}
              disabled={disabled}
            />
          )}
          {onInstituteCountryChange && (
            <EditableField
              label="Country *"
              value={instituteCountryValue}
              fieldKey="higher_education_institute_country"
              onValueChange={onInstituteCountryChange}
              type="text"
              batchMode={true}
              disabled={disabled}
            />
          )}
          {onInstituteCityChange && (
            <EditableField
              label="City *"
              value={instituteCityValue}
              fieldKey="higher_education_institute_city"
              onValueChange={onInstituteCityChange}
              type="text"
              batchMode={true}
            />
          )}
          {onScholarshipChange && (
            <EditableField
              label="Scholarship *"
              value={scholarshipValue}
              fieldKey="is_scholarship"
              onValueChange={onScholarshipChange}
              type="select"
              options={scholarshipOptions}
              batchMode={true}
              disabled={disabled}
            />
          )}
        </>
      )}
      {!showEmploymentFields && !isPursuingHigherEd && (
        <div className="col-span-full text-sm text-gray-500 italic">
          No employment fields to display for this status
        </div>
      )}
    </>
  );
}

