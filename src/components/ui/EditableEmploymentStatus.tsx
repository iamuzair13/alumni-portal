"use client";
import EditableField from "./EditableField";

const employmentStatusOptions = [
  { value: "Employed", label: "Employed" },
  { value: "Unemployed", label: "Unemployed" },
  { value: "HigherEd", label: "Pursuing Higher Education" },
];

type EditableEmploymentStatusProps = {
  employeedValue: unknown;
  industryValue: unknown;
  nameoforganizationValue: unknown;
  designationValue: unknown;
  totalyearsofexpereinceValue: unknown;
  onEmployeedChange: (key: string, value: unknown) => void;
  onIndustryChange: (key: string, value: unknown) => void;
  onOrganizationChange: (key: string, value: unknown) => void;
  onDesignationChange: (key: string, value: unknown) => void;
  onExperienceChange: (key: string, value: unknown) => void;
};

export default function EditableEmploymentStatus({
  employeedValue,
  industryValue,
  nameoforganizationValue,
  designationValue,
  totalyearsofexpereinceValue,
  onEmployeedChange,
  onIndustryChange,
  onOrganizationChange,
  onDesignationChange,
  onExperienceChange,
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
            label="Industry"
            value={industryValue}
            fieldKey="industry"
            onValueChange={onIndustryChange}
            type="text"
            batchMode={true}
          />
          <EditableField
            label="Company Name"
            value={nameoforganizationValue}
            fieldKey="nameoforganization"
            onValueChange={onOrganizationChange}
            type="text"
            batchMode={true}
          />
          <EditableField
            label="Designation"
            value={designationValue}
            fieldKey="designation"
            onValueChange={onDesignationChange}
            type="text"
            batchMode={true}
          />
          <EditableField
            label="Total Years of Experience"
            value={totalyearsofexpereinceValue}
            fieldKey="totalyearsofexpereince"
            onValueChange={onExperienceChange}
            type="text"
            batchMode={true}
          />
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

