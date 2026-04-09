"use client";
import EditableField from "./EditableField";

// Employment status options matching AlumniSqlForm.tsx
const employmentStatusOptions = [
  { value: "Employed", label: "Employed" },
  { value: "Self-Employed/Enterpreneur", label: "Self-Employed/Enterpreneur" },
  { value: "Pursuing Higher Education", label: "Pursuing Higher Education" },
  { value: "Unemployed(By Choice)", label: "Unemployed(By Choice)" },
  { value: "Unemployed(Searching for job)", label: "Unemployed(Searching for job)" },
];

// Helper function to map database values to display values
export function mapDbValueToDisplay(dbValue: unknown): string {
  if (!dbValue || typeof dbValue !== "string") return "";
  const normalized = dbValue.trim();
  
  // Map database values to display values
  if (normalized === "Employed" || normalized === "Employed/Business") return "Employed";
  if (normalized === "Self-Emplo") return "Self-Employed/Enterpreneur";
  if (normalized === "Self-Employed") return "Self-Employed/Enterpreneur";
  if (normalized === "Self-employed") return "Self-Employed/Enterpreneur";
  if (normalized === "Self employed") return "Self-Employed/Enterpreneur";
  if (normalized === "Pursuing Higher Education" || normalized === "highered") return "Pursuing Higher Education";
  if (normalized === "Unemployed(By Choice)" || normalized === "Unemployed(By Choice)" || normalized === "Unemployed By choice" || normalized === "Unemployed(By Choice)") {
    return "Unemployed(By Choice)";
  }
  if (
    normalized === "Unemployed(Searching for job)" ||
    normalized === "Unemployed(Searching for Job)" ||
    normalized === "Unemployed (Searching for Job)" ||
    normalized === "Unemployed (Searching Job)" ||
    normalized === "Unemployed, searching for job" ||
    normalized === "Unemployed(Searching for job))"
  ) {
    return "Unemployed(Searching for job)";
  }
  
  // If it doesn't match any known mapping, return as-is (for backward compatibility)
  return normalized;
}

// Helper function to map display values to database values
export function mapDisplayValueToDb(displayValue: unknown): string {
  if (!displayValue || typeof displayValue !== "string") return "";
  const normalized = displayValue.trim();
  
  if (normalized === "Employed" || normalized === "Employed/Business") return "Employed";
  if (normalized === "Self-Emplo") return "Self-Employed/Enterpreneur";
  if (normalized.toLowerCase() === "highered") return "Pursuing Higher Education";
  if (normalized === "Self-Employed" || normalized === "Self-employed" || normalized === "Self employed") return "Self-Employed/Enterpreneur";
  if (normalized === "Self-Employed/Enterpreneur") return "Self-Employed/Enterpreneur";
  // Normalize legacy unemployed variants to canonical stored values
  if (normalized === "Unemployed(By Choice)" || normalized === "Unemployed By choice") return "Unemployed(By Choice)";
  if (normalized === "Unemployed (Searching for Job)" || normalized === "Unemployed (Searching Job)" || normalized === "Unemployed, searching for job") {
    return "Unemployed(Searching for job)";
  }
  if (normalized === "Unemployed(Searching for job))") return "Unemployed(Searching for job)";
  return normalized;
}

const scholarshipOptions = [
  { value: "full funded scholarship", label: "Full Funded Scholarship" },
  { value: "half funded scholarship", label: "Half Funded Scholarship" },
  { value: "self paid", label: "Self Paid" },
];

const occupationTransitionTimingOptions = [
  { value: "Before graduation", label: "Before graduation" },
  { value: "Immediately after graduation", label: "Immediately after graduation" },
  { value: "Within 3 months", label: "Within 3 months" },
  { value: "Within 6 months", label: "Within 6 months" },
  { value: "After 6 months", label: "After 6 months" },
];

type EditableEmploymentStatusProps = {
  employeedValue: unknown;
  industryValue: unknown;
  nameoforganizationValue: unknown;
  designationValue: unknown;
  totalyearsofexpereinceValue: unknown;
  occupationTransitionTimingValue?: unknown;
  organizationAddressValue?: unknown;
  // Work location fields
  workCountryValue?: unknown;
  workCityValue?: unknown;
  workPhoneValue?: unknown;
  workEmailValue?: unknown;
  // About Me field
  aboutMeValue?: unknown;
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
  onOccupationTransitionTimingChange?: (key: string, value: unknown) => void;
  onStartOfCareerChange?: (key: string, value: unknown) => void;
  onOrganizationAddressChange?: (key: string, value: unknown) => void;
  // Work location handlers
  onWorkCountryChange?: (key: string, value: unknown) => void;
  onWorkCityChange?: (key: string, value: unknown) => void;
  onWorkPhoneChange?: (key: string, value: unknown) => void;
  onWorkEmailChange?: (key: string, value: unknown) => void;
  // About Me handler
  onAboutMeChange?: (key: string, value: unknown) => void;
  // Higher Education handlers
  onDegreeTitleChange?: (key: string, value: unknown) => void;
  onInstituteNameChange?: (key: string, value: unknown) => void;
  onProgramChange?: (key: string, value: unknown) => void;
  onInstituteCountryChange?: (key: string, value: unknown) => void;
  onInstituteCityChange?: (key: string, value: unknown) => void;
  onScholarshipChange?: (key: string, value: unknown) => void;
  disabled?: boolean;
  pendingValues?: Record<string, unknown>;
};

export default function EditableEmploymentStatus({
  employeedValue,
  industryValue,
  nameoforganizationValue,
  designationValue,
  totalyearsofexpereinceValue,
  occupationTransitionTimingValue,
  organizationAddressValue,
  workCountryValue,
  workCityValue,
  workPhoneValue,
  workEmailValue,
  aboutMeValue,
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
  onOccupationTransitionTimingChange,
  onStartOfCareerChange,
  onOrganizationAddressChange,
  onWorkCountryChange,
  onWorkCityChange,
  onWorkPhoneChange,
  onWorkEmailChange,
  onAboutMeChange,
  onDegreeTitleChange,
  onInstituteNameChange,
  onProgramChange,
  onInstituteCountryChange,
  onInstituteCityChange,
  onScholarshipChange,
  disabled = false,
  pendingValues,
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
  // Check for self-employed legacy values and new canonical value
  const isSelfEmployed =
    employeedStatus === "self-emplo" ||
    employeedStatus === "self-employed" ||
    employeedStatus === "self employed" ||
    employeedStatus === "self-employed/enterpreneur";
  // Check for both database and display values
  const isPursuingHigherEd = employeedStatus === "pursuing higher education" || employeedStatus === "highered";
  // Show employment fields for both "Employed" and "Self-Employed/Enterpreneur"
  const showEmploymentFields = isEmployed || isSelfEmployed;
  // Show work location fields only for "Employed/Business" (not Self-Employed/Enterpreneur)
  const showWorkLocationFields = isEmployed;
  // Show Self-Employed/Enterpreneur specific fields only for self-employed
  const showSelfEmployedFields = isSelfEmployed;

  return (
    <>
      <EditableField
        label="Employment Status"
        value={displayValue}
        pendingValue={pendingValues?.employeed}
        fieldKey="employeed"
        onValueChange={handleEmployeedChange}
        type="select"
        options={employmentStatusOptions}
        batchMode={true}
        disabled={disabled}
      />
      {showEmploymentFields && (
        <>
          {onOccupationTransitionTimingChange && (
            <EditableField
              label={
                showSelfEmployedFields
                  ? "How soon after graduation did you start your business or become self-employed? *"
                  : "How soon after graduation did you secure your first job? *"
              }
              value={occupationTransitionTimingValue}
              pendingValue={pendingValues?.occupation_transition_timing}
              fieldKey="occupation_transition_timing"
              onValueChange={onOccupationTransitionTimingChange}
              type="select"
              options={occupationTransitionTimingOptions}
              batchMode={true}
              disabled={disabled}
            />
          )}
          {/* Sector field - shown for both, but required for Self-Employed */}
          {showSelfEmployedFields ? (
            <>
              <EditableField
                label="Sector *"
                value={industryValue}
                pendingValue={pendingValues?.industry}
                fieldKey="industry"
                onValueChange={onIndustryChange}
                type="text"
                batchMode={true}
                disabled={disabled}
                placeholder="Select from list or type your sector"
                datalistId="sector-options"
              />
              <datalist id="sector-options">
                <option value="NA">NA</option>
                <option value="IT & Software Development">IT & Software Development</option>
                <option value="Engineering & Manufacturing">Engineering & Manufacturing</option>
                <option value="Finance & Banking">Finance & Banking</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Education & Research">Education & Research</option>
                <option value="Media & Communication">Media & Communication</option>
                <option value="Retail & E-commerce">Retail & E-commerce</option>
                <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                <option value="Textile & Fashion">Textile & Fashion</option>
                <option value="Architecture & Planning">Architecture & Planning</option>
                <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                <option value="NGO & Social Services">NGO & Social Services</option>
                <option value="Government Sector">Government Sector</option>
                <option value="Construction & Real Estate">Construction & Real Estate</option>
              </datalist>
            </>
          ) : (
            <EditableField
              label="Industry *"
              value={industryValue}
              pendingValue={pendingValues?.industry}
              fieldKey="industry"
              onValueChange={onIndustryChange}
              type="text"
              batchMode={true}
              disabled={disabled}
            />
          )}
          <EditableField
            label={showSelfEmployedFields ? "Business Name *" : "Company Name *"}
            value={nameoforganizationValue}
            pendingValue={pendingValues?.nameoforganization}
            fieldKey="nameoforganization"
            onValueChange={onOrganizationChange}
            type="text"
            batchMode={true}
            disabled={disabled}
            placeholder={showSelfEmployedFields ? "Enter your business name" : "Enter organization name"}
          />
          <EditableField
            label="Current Designation *"
            value={designationValue}
            pendingValue={pendingValues?.designation}
            fieldKey="designation"
            onValueChange={onDesignationChange}
            type="text"
            batchMode={true}
            disabled={disabled}
            placeholder="Enter your designation"
          />
          <EditableField
            label="Total Years of Experience *"
            value={totalyearsofexpereinceValue}
            pendingValue={pendingValues?.totalyearsofexpereince}
            fieldKey="totalyearsofexpereince"
            onValueChange={onExperienceChange}
            type="number"
            batchMode={true}
            disabled={disabled}
          />
          {/* Start of Career - date picker for Self-Employed, number for employed */}
          {showSelfEmployedFields ? (
            <EditableField
              label="Start of Career *"
              value={totalyearsofexpereinceValue ? (() => {
                // Convert years of experience to a date (approximate - use January 1st of the start year)
                const years = Number(totalyearsofexpereinceValue);
                if (!isNaN(years) && years > 0) {
                  const startYear = new Date().getFullYear() - years;
                  // Return as YYYY-MM-DD format for date input
                  return `${startYear}-01-01`;
                }
                return null;
              })() : null}
              fieldKey="startOfCareer"
              onValueChange={(key, value) => {
                // Convert date string to years of experience
                if (value && typeof value === "string" && value.trim() !== "") {
                  try {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                      const currentYear = new Date().getFullYear();
                      const startYear = date.getFullYear();
                      const totalYears = currentYear - startYear;
                      // Store startOfCareer if handler is provided
                      if (onStartOfCareerChange) {
                        onStartOfCareerChange("startOfCareer", startYear);
                      }
                      // Also store as totalyearsofexpereince for database
                      onExperienceChange("totalyearsofexpereince", totalYears > 0 ? String(totalYears) : null);
                    } else {
                      if (onStartOfCareerChange) {
                        onStartOfCareerChange("startOfCareer", null);
                      }
                      onExperienceChange("totalyearsofexpereince", null);
                    }
                  } catch {
                    if (onStartOfCareerChange) {
                      onStartOfCareerChange("startOfCareer", null);
                    }
                    onExperienceChange("totalyearsofexpereince", null);
                  }
                } else {
                  if (onStartOfCareerChange) {
                    onStartOfCareerChange("startOfCareer", null);
                  }
                  onExperienceChange("totalyearsofexpereince", null);
                }
              }}
              type="date"
              batchMode={true}
              disabled={disabled}
            />
          ) : (
            <EditableField
              label="Start of Career *"
              value={totalyearsofexpereinceValue ? (() => {
                // Calculate start year from total years of experience
                const years = Number(totalyearsofexpereinceValue);
                if (!isNaN(years) && years > 0) {
                  return new Date().getFullYear() - years;
                }
                return null;
              })() : null}
              fieldKey="startOfCareer"
              onValueChange={(key, value) => {
                // Store startOfCareer directly for validation
                // Also convert to total years of experience for backward compatibility with database
                if (value && typeof value === "number") {
                  const currentYear = new Date().getFullYear();
                  const totalYears = currentYear - value;
                  // Store startOfCareer if handler is provided
                  if (onStartOfCareerChange) {
                    onStartOfCareerChange("startOfCareer", value);
                  }
                  // Also store as totalyearsofexpereince for database
                  onExperienceChange("totalyearsofexpereince", totalYears > 0 ? String(totalYears) : null);
                } else {
                  if (onStartOfCareerChange) {
                    onStartOfCareerChange("startOfCareer", null);
                  }
                  onExperienceChange("totalyearsofexpereince", null);
                }
              }}
              type="number"
              batchMode={true}
              disabled={disabled}
            />
          )}
          {onOrganizationAddressChange && (
            <EditableField
              label="Work Address *"
              value={organizationAddressValue}
              fieldKey="organization_address"
              onValueChange={onOrganizationAddressChange}
              type="textarea"
              batchMode={true}
              disabled={disabled}
              placeholder={showSelfEmployedFields ? "Enter your work/business address" : "Enter work address"}
            />
          )}
          {/* Self-Employed specific fields */}
          {showSelfEmployedFields && (
            <>
              {onWorkEmailChange && (
                <EditableField
                  label="Work Email *"
                  value={workEmailValue}
                  fieldKey="officialemail"
                  onValueChange={onWorkEmailChange}
                  type="email"
                  batchMode={true}
                  disabled={disabled}
                  placeholder="Enter work email"
                />
              )}
              {onWorkPhoneChange && (
                <EditableField
                  label="Work Phone *"
                  value={workPhoneValue}
                  fieldKey="officialnumber"
                  onValueChange={onWorkPhoneChange}
                  type="tel"
                  batchMode={true}
                  disabled={disabled}
                  placeholder="Enter work phone"
                />
              )}
              {onWorkCityChange && (
                <EditableField
                  label="Work City *"
                  value={workCityValue}
                  fieldKey="work_city"
                  onValueChange={onWorkCityChange}
                  type="text"
                  batchMode={true}
                  disabled={disabled}
                  placeholder="Enter work city"
                />
              )}
              {onWorkCountryChange && (
                <EditableField
                  label="Work Country *"
                  value={workCountryValue}
                  fieldKey="work_country"
                  onValueChange={onWorkCountryChange}
                  type="text"
                  batchMode={true}
                  disabled={disabled}
                  placeholder="Select from list or type work country"
                />
              )}
              {onAboutMeChange && (
                <EditableField
                  label="About Me (Optional)"
                  value={aboutMeValue}
                  fieldKey="about"
                  onValueChange={onAboutMeChange}
                  type="textarea"
                  batchMode={true}
                  disabled={disabled}
                  placeholder="Tell us about yourself"
                />
              )}
            </>
          )}
          {/* Work location fields - only shown for Employed/Business */}
          {showWorkLocationFields && (
            <>
              {onWorkCountryChange && (
                <EditableField
                  label="Work Country"
                  value={workCountryValue}
                  fieldKey="work_country"
                  onValueChange={onWorkCountryChange}
                  type="text"
                  batchMode={true}
                  disabled={disabled}
                />
              )}
              {onWorkCityChange && (
                <EditableField
                  label="Work City"
                  value={workCityValue}
                  fieldKey="work_city"
                  onValueChange={onWorkCityChange}
                  type="text"
                  batchMode={true}
                  disabled={disabled}
                />
              )}
              {onWorkPhoneChange && (
                <EditableField
                  label="Work Phone"
                  value={workPhoneValue}
                  fieldKey="officialnumber"
                  onValueChange={onWorkPhoneChange}
                  type="tel"
                  batchMode={true}
                  disabled={disabled}
                />
              )}
              {onWorkEmailChange && (
                <EditableField
                  label="Work Email"
                  value={workEmailValue}
                  fieldKey="officialemail"
                  onValueChange={onWorkEmailChange}
                  type="email"
                  batchMode={true}
                  disabled={disabled}
                />
              )}
            </>
          )}
        </>
      )}
      {isPursuingHigherEd && (
        <>
          {onOccupationTransitionTimingChange && (
            <EditableField
              label="How soon after graduation did you enrol in a higher education program? *"
              value={occupationTransitionTimingValue}
              pendingValue={pendingValues?.occupation_transition_timing}
              fieldKey="occupation_transition_timing"
              onValueChange={onOccupationTransitionTimingChange}
              type="select"
              options={occupationTransitionTimingOptions}
              batchMode={true}
              disabled={disabled}
            />
          )}
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

