"use client";
import EditableField from "./EditableField";

const employmentStatusOptions = [
  { value: "Employed", label: "Employed" },
  { value: "Unemployed", label: "Unemployed" },
  { value: "HigherEd", label: "Pursuing Higher Education" },
];

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
  officialEmailValue?: unknown;
  officialNumberValue?: unknown;
  // Higher Education fields
  degreeTitleValue?: unknown;
  instituteNameValue?: unknown;
  programValue?: unknown;
  instituteCountryValue?: unknown;
  instituteCityValue?: unknown;
  scholarshipValue?: unknown;
  instituteOfficialEmailValue?: unknown;
  instituteOfficialNumberValue?: unknown;
  onEmployeedChange: (key: string, value: unknown) => void;
  onIndustryChange: (key: string, value: unknown) => void;
  onOrganizationChange: (key: string, value: unknown) => void;
  onDesignationChange: (key: string, value: unknown) => void;
  onExperienceChange: (key: string, value: unknown) => void;
  onOrganizationAddressChange?: (key: string, value: unknown) => void;
  onOfficialEmailChange?: (key: string, value: unknown) => void;
  onOfficialNumberChange?: (key: string, value: unknown) => void;
  // Higher Education handlers
  onDegreeTitleChange?: (key: string, value: unknown) => void;
  onInstituteNameChange?: (key: string, value: unknown) => void;
  onProgramChange?: (key: string, value: unknown) => void;
  onInstituteCountryChange?: (key: string, value: unknown) => void;
  onInstituteCityChange?: (key: string, value: unknown) => void;
  onScholarshipChange?: (key: string, value: unknown) => void;
  onInstituteOfficialEmailChange?: (key: string, value: unknown) => void;
  onInstituteOfficialNumberChange?: (key: string, value: unknown) => void;
};

export default function EditableEmploymentStatus({
  employeedValue,
  industryValue,
  nameoforganizationValue,
  designationValue,
  totalyearsofexpereinceValue,
  organizationAddressValue,
  officialEmailValue,
  officialNumberValue,
  degreeTitleValue,
  instituteNameValue,
  programValue,
  instituteCountryValue,
  instituteCityValue,
  scholarshipValue,
  instituteOfficialEmailValue,
  instituteOfficialNumberValue,
  onEmployeedChange,
  onIndustryChange,
  onOrganizationChange,
  onDesignationChange,
  onExperienceChange,
  onOrganizationAddressChange,
  onOfficialEmailChange,
  onOfficialNumberChange,
  onDegreeTitleChange,
  onInstituteNameChange,
  onProgramChange,
  onInstituteCountryChange,
  onInstituteCityChange,
  onScholarshipChange,
  onInstituteOfficialEmailChange,
  onInstituteOfficialNumberChange,
}: EditableEmploymentStatusProps) {
  const employeedStatus = String(employeedValue || "").toLowerCase();
  const isEmployed = employeedStatus === "employed";
  const isPursuingHigherEd = employeedStatus === "pursuing higher education" || employeedStatus === "highered";
  const isUnemployed = employeedStatus === "unemployed" || (!isEmployed && !isPursuingHigherEd);

  return (
    <>
      <EditableField
        label="Employment Status"
        value={employeedValue}
        fieldKey="employeed"
        onValueChange={onEmployeedChange}
        type="select"
        options={employmentStatusOptions}
        batchMode={true}
      />
      {isEmployed && (
        <>
          <EditableField
            label="Industry *"
            value={industryValue}
            fieldKey="industry"
            onValueChange={onIndustryChange}
            type="text"
            batchMode={true}
          />
          <EditableField
            label="Company Name *"
            value={nameoforganizationValue}
            fieldKey="nameoforganization"
            onValueChange={onOrganizationChange}
            type="text"
            batchMode={true}
          />
          <EditableField
            label="Designation *"
            value={designationValue}
            fieldKey="designation"
            onValueChange={onDesignationChange}
            type="text"
            batchMode={true}
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
            />
          )}
          {onOfficialEmailChange && (
            <EditableField
              label="Company Official Email *"
              value={officialEmailValue}
              fieldKey="officialemail"
              onValueChange={onOfficialEmailChange}
              type="email"
              batchMode={true}
            />
          )}
          {onOfficialNumberChange && (
            <EditableField
              label="Company Official Phone Number *"
              value={officialNumberValue}
              fieldKey="officialnumber"
              onValueChange={onOfficialNumberChange}
              type="tel"
              batchMode={true}
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
            />
          )}
          {onInstituteOfficialEmailChange && (
            <EditableField
              label="Institute Official Email *"
              value={instituteOfficialEmailValue}
              fieldKey="higher_education_institute_email"
              onValueChange={onInstituteOfficialEmailChange}
              type="email"
              batchMode={true}
            />
          )}
          {onInstituteOfficialNumberChange && (
            <EditableField
              label="Institute Official Phone Number *"
              value={instituteOfficialNumberValue}
              fieldKey="higher_education_intiture_number"
              onValueChange={onInstituteOfficialNumberChange}
              type="tel"
              batchMode={true}
            />
          )}
        </>
      )}
      {isUnemployed && (
        <div className="col-span-full text-sm text-gray-500 italic">
          No employment fields to display when status is &quot;Unemployed&quot;
        </div>
      )}
    </>
  );
}

