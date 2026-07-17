"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PencilIcon, TrashBinIcon } from "@/icons";
import { resolveStoredUploadUrl } from "@/lib/uploadsImageUrl";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { canModify, isAdminUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { organizationKeys, useFaculties, useDepartments, usePrograms } from "@/app/queries/fetch-organization";

// ERP Record type for comparison
type ErpRecord = {
  DegrTitle?: string | null;
  DeptName?: string | null;
  Doc?: string | null;
  Mobile?: string | null;
  SapNo?: string | null;
  Mrno?: string | null;
  Name?: string | null;
  Fname?: string | null;
  Cnic?: string | null;
  Address?: string | null;
  Nationality?: string | null;
  Regligion?: string | null;
  [key: string]: unknown;
};

// Comparison result type
type ComparisonResult = "same" | "minor" | "major" | "no_data";

// Helper function to normalize values for comparison
const normalizeValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim().toLowerCase();
};

const formatDateDisplay = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
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

// Compare two values and return comparison result
const compareValues = (alumniValue: unknown, erpValue: unknown): ComparisonResult => {
  const alumniNorm = normalizeValue(alumniValue);
  const erpNorm = normalizeValue(erpValue);
  
  // If both are empty, consider them same
  if (alumniNorm === "" && erpNorm === "") return "no_data";
  
  // If one is empty and other is not, it's a major difference
  if (alumniNorm === "" || erpNorm === "") return "major";
  
  // Exact match
  if (alumniNorm === erpNorm) return "same";
  
  // Check for minor differences (similar but not exact)
  // Remove common punctuation and spaces for comparison
  const alumniClean = alumniNorm.replace(/[^\w]/g, "");
  const erpClean = erpNorm.replace(/[^\w]/g, "");
  
  if (alumniClean === erpClean) return "minor";
  
  // Check if one contains the other (partial match)
  if (alumniClean.includes(erpClean) || erpClean.includes(alumniClean)) {
    // If the difference is small (less than 30% of longer string), consider it minor
    const longer = Math.max(alumniClean.length, erpClean.length);
    const shorter = Math.min(alumniClean.length, erpClean.length);
    const diff = longer - shorter;
    if (diff / longer < 0.3) return "minor";
  }
  
  // Major difference
  return "major";
};

// Map field labels to ERP field names
const getErpFieldValue = (label: string, erpData: ErpRecord | null): unknown => {
  if (!erpData) return null;
  
  const fieldMap: Record<string, keyof ErpRecord> = {
    "Sap No": "SapNo",
    "Registration No": "Mrno",
    "Full Name": "Name",
    "Father Name": "Fname",
    "CNIC/Passport": "Cnic",
    "Mobile": "Mobile",
    "Home Address": "Address",
    "Home Country": "Nationality",
    "Department": "DeptName",
    "Program": "DegrTitle",
    "Date of Completion": "Doc",
  };
  
  const erpField = fieldMap[label];
  return erpField ? erpData[erpField] : null;
};

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


type AlumniExpandableDetailsProps = {
  sapId: string;
  onClose: () => void;
  readOnly?: boolean;
  highlightMissingFields?: string[];
  /** Merged with session override when set from the alumni list (see Alumni-tabs). */
  isPreSapEnabled?: boolean;
  onPreSapEnabledChange?: (value: boolean) => void;
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
  // New ID-based fields
  faculty: number | null;
  department: number | null;
  program: number | null;
  industry: string | null;
  employeed: string | null;
  occupation_transition_timing: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  officialemail: string | null;
  officialnumber: string | null;
  work_city: string | null;
  work_country: string | null;
  organization_address: string | null;
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
  updated_at: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
  password: string | null;
  father_cnic: string | null;
  category: string | null;
  // Higher Education fields
  degree_title: string | null;
  higher_education_institute_name: string | null;
  higher_education_program: string | null;
  higher_education_institute_country: string | null;
  higher_education_institute_city: string | null;
  is_scholarship: string | null;
  chapter: string | null;
  chapter1_id: number | null;
  chapter2_id: number | null;
  chapter3_id: number | null;
  association: string | null;
  association_id: number | null;
  alumni_consent_info: boolean | null;
  alumni_consent_pic: boolean | null;
  pre_sap_registration: boolean | null;
  medal: string | null;
  medal_document: string | null;
};

const toBoolPreSap = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    return n === "true" || n === "1" || n === "yes" || n === "on";
  }
  return false;
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
  onEdit?: () => void;
  comparisonStatus?: ComparisonResult;
  highlightMissing?: boolean;
}> = ({ label, value, isEditing = false, readOnly = false, register, name, type = "text", options, onEdit, comparisonStatus, highlightMissing = false }) => {
  // If readOnly is true, always show as display (not editing)
  const effectiveIsEditing = readOnly ? false : isEditing;
  const displayValue = formatValue(value);
  
  // Get indicator dot based on comparison status
  const getIndicator = () => {
    if (!comparisonStatus || comparisonStatus === "same" || comparisonStatus === "no_data") return null;
    
    if (comparisonStatus === "major") {
      return (
        <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Major difference with ERP data" />
      );
    }
    
    if (comparisonStatus === "minor") {
      return (
        <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" title="Minor difference with ERP data" />
      );
    }
    
    return null;
  };
  
  if (!effectiveIsEditing) {
    return (
      <div
        data-field-name={name || undefined}
        className={`flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50 ${
          highlightMissing ? "bg-rose-50/70 dark:bg-rose-900/10" : ""
        }`}
      >
        <span className={`text-xs font-medium min-w-[140px] flex-shrink-0 flex items-center gap-1.5 ${
          highlightMissing ? "text-rose-700 dark:text-rose-300" : "text-gray-500 dark:text-gray-400"
        }`}>
          {label}:
          {getIndicator()}
        </span>
        <span className={`text-xs flex-1 break-words ${
          highlightMissing ? "text-rose-700 dark:text-rose-200 font-semibold" : "text-gray-900 dark:text-gray-100"
        }`}>
          {displayValue}
        </span>
        {!readOnly && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded transition-colors"
            title="Edit field"
          >
            <PencilIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <div
        data-field-name={name || undefined}
        className={`flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50 ${
          highlightMissing ? "bg-rose-50/70 dark:bg-rose-900/10" : ""
        }`}
      >
        <label className={`text-xs font-medium min-w-[140px] flex-shrink-0 ${
          highlightMissing ? "text-rose-700 dark:text-rose-300" : "text-gray-500 dark:text-gray-400"
        }`}>{label}:</label>
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
      <div
        data-field-name={name || undefined}
        className={`flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50 ${
          highlightMissing ? "bg-rose-50/70 dark:bg-rose-900/10" : ""
        }`}
      >
        <label className={`text-xs font-medium min-w-[140px] flex-shrink-0 pt-1 ${
          highlightMissing ? "text-rose-700 dark:text-rose-300" : "text-gray-500 dark:text-gray-400"
        }`}>{label}:</label>
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

  // Handle password field separately
  if (type === "password") {
    // For password fields, show actual value (visible)
    const displayValue = formatValue(value);
    return (
      <div
        data-field-name={name || undefined}
        className={`flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50 ${
          highlightMissing ? "bg-rose-50/70 dark:bg-rose-900/10" : ""
        }`}
      >
        <label className={`text-xs font-medium min-w-[140px] flex-shrink-0 ${
          highlightMissing ? "text-rose-700 dark:text-rose-300" : "text-gray-500 dark:text-gray-400"
        }`}>{label}:</label>
        {effectiveIsEditing ? (
          <input
            type="text"
            {...(register && name ? register(name) : {})}
            placeholder="Enter new password (leave blank to keep current)"
            disabled={readOnly}
            className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
          />
        ) : (
          <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 break-words">{displayValue}</span>
        )}
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
    <div
      data-field-name={name || undefined}
      className={`flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50 ${
        highlightMissing ? "bg-rose-50/70 dark:bg-rose-900/10" : ""
      }`}
    >
      <label className={`text-xs font-medium min-w-[140px] flex-shrink-0 ${
        highlightMissing ? "text-rose-700 dark:text-rose-300" : "text-gray-500 dark:text-gray-400"
      }`}>{label}:</label>
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

// Countries list
const allCountries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia",
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Côte d'Ivoire", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Democratic Republic of the Congo",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
  "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. Swaziland)", "Ethiopia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia",
  "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
  "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia",
  "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay",
  "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan",
  "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania",
  "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe", "Other"
];

// Pakistan provinces
const pakistanProvinces = [
  { value: "Punjab", label: "Punjab" },
  { value: "Sindh", label: "Sindh" },
  { value: "KPK", label: "KPK" },
  { value: "Balochistan", label: "Balochistan" },
  { value: "Islamabad", label: "Islamabad Capital Territory" },
  { value: "GB", label: "Gilgit-Baltistan" },
  { value: "AJK", label: "Azad Kashmir" },
];

// Pakistan cities by province
const citiesByProvince: Record<string, string[]> = {
  "Punjab": [
    "Ahmadpur East", "Ahmadpur Sial", "Arifwala", "Attock", "Bahawalnagar", "Bahawalpur", "Bhakkar",
    "Burewala", "Chak Jhumra", "Chakwal", "Chiniot", "Chishtian", "Chunian", "Daska", "Dera Ghazi Khan",
    "Dina", "Dipalpur", "Dunyapur", "Faisalabad", "Fateh Jang", "Gojra", "Gujar Khan", "Gujranwala",
    "Gujrat", "Hafizabad", "Haroonabad", "Hassan Abdal", "Hasilpur", "Hujra Shah Muqeem", "Jalalpur Jattan",
    "Jampur", "Jaranwala", "Jauharabad", "Jhang", "Jhelum", "Kabirwala", "Kahror Pakka", "Kamalia",
    "Kamoke", "Kasur", "Khanewal", "Khushab", "Kot Abdul Malik", "Kot Addu", "Kot Mithan", "Kot Momin",
    "Kot Radha Kishan", "Kotli Loharan", "Kundian", "Lahore", "Layyah", "Lodhran", "Malisi", "Mamu Kanjan",
    "Mandi Bahauddin", "Mananwala", "Mian Channun", "Mianwali", "Multan", "Muridke", "Muzaffargarh",
    "Nankana Sahib", "Narowal", "Okara", "Pakpattan", "Pasrur", "Pattoki", "Pindi Bhattian", "Rahim Yar Khan",
    "Rajanpur", "Renala Khurd", "Sadiqabad", "Sahiwal", "Sargodha", "Sarai Alamgir", "Shakargarh", "Shahkot",
    "Sheikhupura", "Sialkot", "Sohawa", "Toba Tek Singh", "Taunsa", "Uch Sharif", "Vehari", "Wazirabad"
  ],
  "Sindh": [
    "Badin", "Bhiria", "Chachro", "Dadu", "Daharki", "Digri", "Ghotki", "Hala", "Hyderabad", "Islamkot",
    "Jacobabad", "Jamshoro", "Kandhkot", "Kandiaro", "Karachi", "Kashmore", "Khairpur", "Khairpur Nathan Shah",
    "Khipro", "Kot Ghulam Muhammad", "Kotri", "Kunri", "Larkana", "Matiari", "Mehrabpur", "Mirpur Khas",
    "Mithi", "Moro", "Nagarparkar", "Naushahro Feroze", "Nawabshah", "Qazi Ahmad", "Rohri", "Sakrand",
    "Samaro", "Sanghar", "Sehwan", "Shahdadpur", "Shikarpur", "Sukkur", "Tando Adam", "Tando Allahyar",
    "Tando Muhammad Khan", "Thatta", "Umerkot", "Vik"
  ],
  "KPK": [
    "Abbottabad", "Bajaur", "Bannu", "Barikot", "Battagram", "Batkhela", "Buner", "Charsadda", "Chitral",
    "Daggar", "Dera Ismail Khan", "Dir", "Gomal", "Hangu", "Haripur", "Jandola", "Kaniguram", "Karak",
    "Khyber", "Kohat", "Kulachi", "Lakki Marwat", "Lower Dir", "Malakand", "Mardan", "Mansehra", "Makeen",
    "Mohmand", "Mingora", "North Waziristan", "Nowshera", "Orakzai", "Pabbi", "Paharpur", "Paroa", "Peshawar",
    "Razmak", "Sararogha", "Sarwakai", "Shakai", "Shangla", "South Waziristan", "Spinkai Raghzai", "Swabi",
    "Swat", "Takht-i-Bahi", "Tangi", "Tank", "Timergara", "Tiarza", "Upper Dir", "Wana"
  ],
  "Balochistan": [
    "Awaran", "Bela", "Barkhan", "Chagai", "Chaman", "Dalbandin", "Dera Bugti", "Dera Murad Jamali",
    "Duki", "Ghizer", "Gulistan", "Gwadar", "Harnai", "Hub", "Jaffarabad", "Jhal Magsi", "Jiwani",
    "Kachhi", "Kalat", "Kharan", "Khuzdar", "Killa Abdullah", "Killa Saifullah", "Kohlu", "Lasbela",
    "Loralai", "Mastung", "Musakhel", "Nasirabad", "Nok Kundi", "Nushki", "Ormara", "Panjgur", "Pasni",
    "Pishin", "Qila Saifullah", "Quetta", "Sherani", "Sibi", "Surab", "Taftan", "Turbat", "Usta Muhammad",
    "Uthal", "Washuk", "Winder", "Ziarat", "Zhob"
  ],
  "Islamabad": ["Islamabad"],
  "GB": [
    "Astore", "Chitral", "Darel", "Diamer", "Ghanche", "Ghizer", "Gilgit", "Gultari", "Gojal", "Hunza",
    "Ishkoman", "Kharmang", "Nagar", "Punial", "Roundu", "Shigar", "Skardu", "Tangir", "Yasin"
  ],
  "AJK": [
    "Athmuqam", "Bagh", "Barnala", "Bhimber", "Chakswari", "Dadyal", "Forward Kahuta", "Hattian Bala",
    "Haveli", "Kel", "Kotli", "Mendhar", "Mirpur", "Muzaffarabad", "Nakyal", "Neelum", "Poonch",
    "Rawalakot", "Samahni", "Sehnsa", "Sharda", "Sudhnuti"
  ]
};

const getCitiesByProvince = (province: string): string[] => {
  return citiesByProvince[province] || [];
};

// Fetch ERP data function
async function fetchErpData(sapId?: string, registrationNo?: string | null): Promise<ErpRecord | null> {
  const validSapId = sapId && sapId.trim() ? sapId.trim() : undefined;
  const validRegistrationNo = registrationNo && String(registrationNo).trim() ? String(registrationNo).trim() : undefined;
  
  if (!validSapId && !validRegistrationNo) {
    return null;
  }

  const params = new URLSearchParams();
  if (validSapId) params.append("sapid", validSapId);
  if (validRegistrationNo) params.append("registrationno", validRegistrationNo);

  try {
    const res = await fetch(`/api/erp/fetch?${params.toString()}`);

    // Handle 403 (Forbidden) gracefully - viewers don't have access to ERP data, which is fine
    if (res.status === 403) {

      return null;
    }

    // Handle 401 (Unauthorized) - should not happen if session is valid, but handle gracefully
    if (res.status === 401) {

      return null;
    }

    const responseData = await res.json();

    if (responseData.success === false && responseData.error === "NOT_FOUND") {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    if (!responseData.success || !responseData.data) {
      return null;
    }

    const erpData = Array.isArray(responseData.data) ? responseData.data[0] : responseData.data;
    
    if (typeof erpData === "string" || (erpData && typeof erpData === "object" && Object.keys(erpData).every(k => /^\d+$/.test(k)))) {
      return null;
    }
    
    return erpData as ErpRecord;
  } catch {
    return null;
  }
}

function AlumniExpandableDetails({
  sapId,
  onClose,
  readOnly = false,
  highlightMissingFields = [],
  isPreSapEnabled,
  onPreSapEnabledChange,
}: AlumniExpandableDetailsProps) {
  const queryClient = useQueryClient();
  const session = useSession();
  const router = useRouter();
  const isSuperAdmin = isSuperAdminUser(session.data?.user);
  const canViewPassword = isAdminUser(session.data?.user) || isSuperAdmin;
  const canSendCredentials = canModify(session.data?.user);
  const canTogglePreSap = canModify(session.data?.user) && !readOnly;
  const [isSendingCredentials, setIsSendingCredentials] = useState(false);

  const deleteModal = useModal();

  const [currentSapId, setCurrentSapId] = useState(sapId);
  const openedWithNumericIdentifier = useMemo(() => {
    const v = String(sapId || "").trim();
    return v !== "" && !Number.isNaN(Number(v));
  }, [sapId]);
  const { data, isLoading, error } = useAlumniFullDetails(currentSapId);

  const isPreSap = useMemo(() => {
    if (typeof isPreSapEnabled === "boolean") {
      return isPreSapEnabled;
    }
    return toBoolPreSap(data?.pre_sap_registration);
  }, [isPreSapEnabled, data?.pre_sap_registration]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    control,
  } = useForm<AlumniFullData>({
    defaultValues: {} as AlumniFullData,
    mode: "onSubmit",
  });

  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAutoAssigningCategory, setIsAutoAssigningCategory] = useState(false);

  const safePasswordValue = useMemo(() => {
    const raw = data?.password;
    if (!raw) return "";
    return String(raw);
  }, [data?.password]);

  const normalizeMaritalStatus = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return null;
    if (s === "Married" || s === "Un-Married") return s;
    return null;
  };
  
  // Fetch ERP data for comparison
  // Note: Viewers will get 403, which is handled gracefully in fetchErpData
  const { data: erpData } = useQuery({
    queryKey: ["erp-data-comparison", currentSapId, data?.registrationno],
    queryFn: () => fetchErpData(currentSapId, data?.registrationno || null),
    enabled: !!currentSapId && !!data,
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 403 (Forbidden) errors - viewers don't have access
      if (error instanceof Error && error.message.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
  
  // Helper function to get comparison status for a field
  const getComparisonStatus = (label: string, alumniValue: unknown): ComparisonResult => {
    if (!erpData || !data) return "no_data";
    const erpValue = getErpFieldValue(label, erpData);
    return compareValues(alumniValue, erpValue);
  };
  
  // Helper functions for field editing
  const startEditingField = (fieldName: string) => {
    if (readOnly) return;
    setEditingFields(prev => new Set(prev).add(fieldName));
  };
  
  const isFieldEditing = (fieldName: string) => editingFields.has(fieldName);
  
  const cancelAllEdits = () => {
    setEditingFields(new Set());
    if (data) {
      const formData: AlumniFullData = {
        ...data,
        contactno1show: data.contactno1show !== null && data.contactno1show !== undefined 
          ? String(data.contactno1show) 
          : "",
        maritalstatus: normalizeMaritalStatus(data.maritalstatus),
        personalemailshow: data.personalemailshow !== null && data.personalemailshow !== undefined 
          ? String(data.personalemailshow) 
          : "",
        alumni_consent_info: data.alumni_consent_info ?? null,
        alumni_consent_pic: data.alumni_consent_pic ?? null,
      };
      reset(formData);
      // Reset city search
      if (data.city) {
        setCitySearch(data.city);
      } else {
        setCitySearch("");
      }
    }
  };
  
  // Watch country, province, and employeed for dependent fields
  const selectedCountry = watch("country") || "";
  const selectedProvince = watch("province") || "";
  const selectedEmployeed = watch("employeed") || data?.employeed || "";
  const selectedHigherEducationProgram = watch("higher_education_program") || data?.higher_education_program || "";
  const selectedPassingOutYear = watch("yearofending") || data?.yearofending || null;
  const selectedCategory = watch("category") || data?.category || "";
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Faculty, Department, and Program state
  const [allFaculties, setAllFaculties] = useState<{ id: number; faculty_name: string }[]>([]);
  const [allDepartments, setAllDepartments] = useState<{ id: number; department_name: string; faculty_id: number | null }[]>([]);
  const [allPrograms, setAllPrograms] = useState<{ id: number; program_name: string; department_id: number | null }[]>([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [programsLoading, setProgramsLoading] = useState(false);
  const selectedFacultyId = watch("faculty");
  const selectedDepartmentId = watch("department");

  const { data: facultiesData, isLoading: facultiesQueryLoading } = useFaculties();
  const facultyIdForDepartments = selectedFacultyId ? Number(selectedFacultyId) : data?.faculty ? Number(data.faculty) : undefined;
  const { data: departmentsData, isLoading: departmentsQueryLoading } = useDepartments(facultyIdForDepartments);
  const departmentIdForPrograms = selectedDepartmentId ? Number(selectedDepartmentId) : data?.department ? Number(data.department) : undefined;
  const { data: programsData, isLoading: programsQueryLoading } = usePrograms(departmentIdForPrograms);

  // Fetch chapters and associations for dropdowns
  const { data: chaptersList = [] } = useQuery<Chapter[]>({
    queryKey: ["chapters-list"],
    queryFn: getChaptersList,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const associationsList = useMemo<Association[]>(() => {
    return (facultiesData ?? []).map((f) => ({
      id: Number(f.id),
      title: String(f.faculty_name ?? "").trim() || `Faculty #${f.id}`,
    }));
  }, [facultiesData]);

  // Keep local state in sync with cached TanStack Query data
  useEffect(() => {
    setFacultiesLoading(facultiesQueryLoading);
    if (facultiesData) {
      setAllFaculties(facultiesData);
    }
  }, [facultiesData, facultiesQueryLoading]);

  useEffect(() => {
    setDepartmentsLoading(departmentsQueryLoading);
    if (!facultyIdForDepartments) {
      setAllDepartments([]);
      return;
    }
    if (departmentsData) {
      setAllDepartments(departmentsData);
    }
  }, [departmentsData, departmentsQueryLoading, facultyIdForDepartments]);

  useEffect(() => {
    setProgramsLoading(programsQueryLoading);
    if (!departmentIdForPrograms) {
      setAllPrograms([]);
      return;
    }
    if (programsData) {
      setAllPrograms(programsData);
    }
  }, [programsData, programsQueryLoading, departmentIdForPrograms]);

  // When alumni changes to a new record, ensure dependent org queries are up-to-date.
  useEffect(() => {
    if (!data) return;
    if (data.faculty) {
      queryClient.invalidateQueries({ queryKey: organizationKeys.departments(Number(data.faculty)) });
    }
    if (data.department) {
      queryClient.invalidateQueries({ queryKey: organizationKeys.programs(Number(data.department)) });
    }
  }, [data, queryClient]);

  // Reset department and program when faculty changes (only during editing)
  useEffect(() => {
    if (editingFields.has("faculty") && selectedFacultyId !== undefined) {
      const currentDept = watch("department");
      if (currentDept && allDepartments.length > 0) {
        const deptExists = allDepartments.some(d => d.id === Number(currentDept));
        if (!deptExists) {
          setValue("department", null);
          setValue("program", null);
        }
      }
    }
  }, [selectedFacultyId, allDepartments, editingFields, watch, setValue]);

  // Reset program when department changes (only during editing)
  useEffect(() => {
    if (editingFields.has("department") && selectedDepartmentId !== undefined) {
      const currentProgram = watch("program");
      if (currentProgram && allPrograms.length > 0) {
        const programExists = allPrograms.some(p => p.id === Number(currentProgram));
        if (!programExists) {
          setValue("program", null);
        }
      }
    }
  }, [selectedDepartmentId, allPrograms, editingFields, watch, setValue]);

  // Computed faculty and department names from IDs
  const displayFacultyName = useMemo(() => {
    if (!data) return null;

    // If we have a faculty ID, try to look it up
    if (data.faculty && allFaculties.length > 0) {
      // Convert to number for comparison (API might return string)
      const facultyIdNum = typeof data.faculty === 'string' ? parseInt(data.faculty, 10) : data.faculty;
      const found = allFaculties.find(f => f.id === facultyIdNum);

      if (found) {
        return found.faculty_name;
      }
    }
    
    // Fallback to text name

    return data.facultyname;
  }, [data, allFaculties]);

  const displayDepartmentName = useMemo(() => {
    if (!data) return null;

    // If we have a department ID, try to look it up
    if (data.department && allDepartments.length > 0) {
      // Convert to number for comparison (API might return string)
      const departmentIdNum = typeof data.department === 'string' ? parseInt(data.department, 10) : data.department;
      const found = allDepartments.find(d => d.id === departmentIdNum);

      if (found) {
        return found.department_name;
      }
    }
    
    // Fallback to text name

    return data.departmentname;
  }, [data, allDepartments]);

  const isMissingRequiredValue = useMemo(() => {
    return (value: unknown) => {
      if (value === null || value === undefined) return true;
      if (typeof value === "string") return value.trim() === "";
      if (typeof value === "number") return !Number.isFinite(value);
      return String(value).trim() === "";
    };
  }, []);

  const requiredMissingMap = useMemo(() => {
    if (!data) return new Set<string>();

    const missing = new Set<string>();
    if (!isPreSap && isMissingRequiredValue(data.sapid)) missing.add("sapid");
    if (isPreSap && isMissingRequiredValue(data.registrationno)) missing.add("registrationno");
    if (isMissingRequiredValue(data.alumniname)) missing.add("alumniname");
    if (isMissingRequiredValue(data.fathername)) missing.add("fathername");
    if (isMissingRequiredValue(data.cnicpassport)) missing.add("cnicpassport");
    if (isMissingRequiredValue(data.contactno)) missing.add("contactno");
    if (isMissingRequiredValue(data.personalemail)) missing.add("personalemail");
    if (isMissingRequiredValue(displayFacultyName) && isMissingRequiredValue(data.faculty)) missing.add("faculty");
    if (isMissingRequiredValue(displayDepartmentName) && isMissingRequiredValue(data.department)) missing.add("department");
    if (isMissingRequiredValue(data.program) && isMissingRequiredValue(data.degreetitle)) missing.add("program");
    if (isMissingRequiredValue(data.campusname)) missing.add("campusname");
    if (isMissingRequiredValue(data.yearofending)) missing.add("yearofending");

    return missing;
  }, [data, displayDepartmentName, displayFacultyName, isMissingRequiredValue, isPreSap]);

  useEffect(() => {
    if (!highlightMissingFields || highlightMissingFields.length === 0) return;
    const first = highlightMissingFields.find((k) => requiredMissingMap.has(k));
    if (!first) return;

    const el = document.querySelector(`[data-field-name="${first}"]`);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightMissingFields, requiredMissingMap]);

  // Province options based on selected country
  const provinceOptions = useMemo(() => {
    if (selectedCountry === "Pakistan") {
      return pakistanProvinces;
    }
    return [];
  }, [selectedCountry]);
  
  // Get cities for selected province
  const provinceCities = useMemo(() => {
    if (selectedCountry === "Pakistan" && selectedProvince) {
      return getCitiesByProvince(selectedProvince);
    }
    return [];
  }, [selectedCountry, selectedProvince]);
  
  // Filter cities based on search
  const filteredCities = useMemo(() => {
    if (selectedCountry === "Pakistan" && selectedProvince && provinceCities.length > 0) {
      if (!citySearch.trim()) {
        return provinceCities;
      }
      const searchLower = citySearch.toLowerCase();
      return provinceCities.filter(city => 
        city.toLowerCase().includes(searchLower)
      );
    }
    return [];
  }, [citySearch, selectedCountry, selectedProvince, provinceCities]);
  
  // Reset city when province changes
  useEffect(() => {
    if (selectedCountry === "Pakistan" && selectedProvince) {
      const currentCity = watch("city") || "";
      const validCities = getCitiesByProvince(selectedProvince);
      if (currentCity && !validCities.includes(currentCity)) {
        setValue("city", "");
        setCitySearch("");
      }
    } else if (selectedCountry !== "Pakistan") {
      setCitySearch("");
    }
  }, [selectedProvince, selectedCountry, watch, setValue]);
  
  // Close city dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cityDropdownRef.current &&
        cityInputRef.current &&
        !cityDropdownRef.current.contains(event.target as Node) &&
        !cityInputRef.current.contains(event.target as Node)
      ) {
        setShowCityDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
        // Ensure ID fields are properly set (faculty, department, and program)
        faculty: data.faculty || null,
        department: data.department || null,
        program: data.program || null,
        // Ensure boolean consent field is properly set
        alumni_consent_info: data.alumni_consent_info ?? null,
      };
      // Reset form with all data - this registers all fields with react-hook-form
      reset(formData, { keepDefaultValues: false });
      // Set initial city search value
      if (data.city) {
        setCitySearch(data.city);
      }


      // Only switch identifier to sapid if the panel was opened by a non-numeric identifier.
      // If the panel was opened using alumniid (numeric), sapid may be non-unique and switching
      // can cause updates/deletes to affect the wrong duplicate row.
      if (!openedWithNumericIdentifier) {
        if (data.sapid && data.sapid !== currentSapId) {
          setCurrentSapId(data.sapid);
        }
      }
    }
  }, [data, reset, openedWithNumericIdentifier]);

  const onSubmit = async (formValues: AlumniFullData) => {
    if (!currentSapId || !data) return;
    
    setIsSaving(true);
    try {
      // Get all current form values to ensure we capture edited fields
      const allFormValues = getValues();
      // Ensure registrationno is always uppercase if present
      if (allFormValues.registrationno) {
        allFormValues.registrationno = String(allFormValues.registrationno).toUpperCase();
      }
      // Capitalize alumniname (first letter and first after space)
      if (allFormValues.alumniname) {
        allFormValues.alumniname = String(allFormValues.alumniname)
          .toLowerCase()
          .replace(/\b\w/g, c => c.toUpperCase());
      }
      // Capitalize fathername (first letter and first after space)
      if (allFormValues.fathername) {
        allFormValues.fathername = String(allFormValues.fathername)
          .toLowerCase()
          .replace(/\b\w/g, c => c.toUpperCase());
      }
      // Restrict sapid to digits only
      if (allFormValues.sapid) {
        allFormValues.sapid = String(allFormValues.sapid).replace(/\D/g, '');
      }
      // Build update payload - include all fields that are currently being edited
      const updatePayload: Record<string, unknown> = {};
      
      // Handle "chapters" field specially - it maps to chapter1_id, chapter2_id, chapter3_id
      if (editingFields.has("chapters")) {
        // Extract chapter IDs from form values
        // HTML select inputs return strings, but the type expects number | null
        // We need to handle the conversion safely
        const chapter1IdValue = allFormValues.chapter1_id;
        const chapter2IdValue = allFormValues.chapter2_id;
        const chapter3IdValue = allFormValues.chapter3_id;
        
        // Convert to number if value exists (handle both string and number types from form)
        // Check for undefined, null, or empty string (for form values that might be strings)
        const chapter1Id = chapter1IdValue !== undefined && chapter1IdValue !== null && String(chapter1IdValue).trim() !== ""
          ? Number(chapter1IdValue)
          : null;
        const chapter2Id = chapter2IdValue !== undefined && chapter2IdValue !== null && String(chapter2IdValue).trim() !== ""
          ? Number(chapter2IdValue)
          : null;
        const chapter3Id = chapter3IdValue !== undefined && chapter3IdValue !== null && String(chapter3IdValue).trim() !== ""
          ? Number(chapter3IdValue)
          : null;
        
        // Add chapter IDs to payload (even if null, to allow clearing)
        updatePayload.chapter1_id = chapter1Id;
        updatePayload.chapter2_id = chapter2Id;
        updatePayload.chapter3_id = chapter3Id;
      }
      
      // Add all other fields that are currently in editing mode
      editingFields.forEach((fieldName) => {
        // Skip "chapters" as it's already handled above
        if (fieldName === "chapters") return;
        
        const value = allFormValues[fieldName as keyof AlumniFullData];
        // Include the value even if it's null or empty string (to allow clearing fields)
        if (value !== undefined) {
          updatePayload[fieldName] = value;
        }
      });
      
      // If no fields are being edited, don't send the request
      if (Object.keys(updatePayload).length === 0) {
        toast.error("No fields are being edited");
        setIsSaving(false);
        return;
      }
      
      // Always include related text fields for ID-based fields
      if (editingFields.has("faculty") && allFormValues.faculty !== undefined) {
        updatePayload.faculty = allFormValues.faculty;
        if (allFormValues.facultyname !== undefined) {
          updatePayload.facultyname = allFormValues.facultyname;
        }
      }
      if (editingFields.has("department") && allFormValues.department !== undefined) {
        updatePayload.department = allFormValues.department;
        if (allFormValues.departmentname !== undefined) {
          updatePayload.departmentname = allFormValues.departmentname;
        }
      }
      if (editingFields.has("program") && allFormValues.program !== undefined) {
        updatePayload.program = allFormValues.program;
        if (allFormValues.degreetitle !== undefined) {
          updatePayload.degreetitle = allFormValues.degreetitle;
        }
      }

      const stableIdentifier = data?.alumniid ? String(data.alumniid) : currentSapId;

      const res = await fetch(`/api/alumni/${encodeURIComponent(stableIdentifier)}/update-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update alumni");
      }

      const responseData = await res.json();
      const updatedSapId = responseData?.updated?.sapid;
      const updatedAlumniId = responseData?.updated?.alumniid;
      
      // Invalidate queries (non-blocking) - React Query will refetch when components need the data
      queryClient.invalidateQueries({ queryKey: ["alumni"] });
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alumnilist"] });
      queryClient.invalidateQueries({ queryKey: ["alumni", "faculties"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alumni", "departments"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alumni", "programs"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["degree-titles"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["institution-names"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["categories"], exact: false });
      // Invalidate marital statuses query when marital status is updated
      queryClient.invalidateQueries({ queryKey: ["marital-statuses"] });
      // Invalidate genders query when gender is updated
      queryClient.invalidateQueries({ queryKey: ["genders"] });
      // Invalidate campuses query when campus is updated
      queryClient.invalidateQueries({ queryKey: ["campuses"] });
      // Invalidate occupation statuses query when occupation status is updated
      queryClient.invalidateQueries({ queryKey: ["occupation-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["occupation-transition-timings"] });
      
      // Always invalidate the current identifier
      queryClient.invalidateQueries({ queryKey: ["alumni", "full-details", currentSapId] });

      // Also invalidate any new identifiers returned by the API (e.g. if sapid was changed)
      if (updatedSapId) {
        queryClient.invalidateQueries({ queryKey: ["alumni", "full-details", String(updatedSapId)] });
      }
      if (updatedAlumniId) {
        queryClient.invalidateQueries({ queryKey: ["alumni", "full-details", String(updatedAlumniId)] });
      }

      // IMPORTANT: Do NOT switch the panel's identifier to sapid, because sapid can be non-unique.
      // Keep the original identifier stable; future update/delete must continue targeting alumniid.
      
      toast.success("Alumni data updated successfully");
      setEditingFields(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update alumni";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoAssignCategory = async () => {
    if (!data) return;
    const occupation = String(selectedEmployeed || "").trim().toLowerCase();
    const higherEducationProgram = String(selectedHigherEducationProgram || "").trim().toLowerCase();
    const isPursuingHigherEducation = occupation === "pursuing higher education";

    let assignedCategory: "A" | "B" | "C" | "D" | null = null;

    // Overrides: while pursuing higher education, category derives from enrolled program.
    if (isPursuingHigherEducation && higherEducationProgram.includes("phd")) {
      assignedCategory = "B";
    } else if (
      isPursuingHigherEducation &&
      (higherEducationProgram.includes("master") ||
        higherEducationProgram.includes("ms") ||
        higherEducationProgram.includes("m.s") ||
        higherEducationProgram.includes("mba"))
    ) {
      assignedCategory = "C";
    } else {
      const passoutYear = Number(selectedPassingOutYear);
      if (!Number.isFinite(passoutYear) || passoutYear <= 0) {
        toast.error("Passing Out Year is required for auto assigning category.");
        return;
      }

      const currentYear = new Date().getFullYear();
      const yearsSincePassout = currentYear - passoutYear;

      if (yearsSincePassout < 2) {
        assignedCategory = "D";
      } else if (yearsSincePassout < 4) {
        assignedCategory = "C";
      } else if (yearsSincePassout < 7) {
        assignedCategory = "B";
      } else {
        assignedCategory = "A";
      }
    }

    if (!assignedCategory) {
      toast.error("Unable to auto assign category.");
      return;
    }

    const stableIdentifier = data?.alumniid ? String(data.alumniid) : currentSapId;
    if (!stableIdentifier) {
      toast.error("Invalid identifier for category update.");
      return;
    }

    setIsAutoAssigningCategory(true);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(stableIdentifier)}/update-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: assignedCategory }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to auto assign category");
      }

      setValue("category", assignedCategory);
      setEditingFields((prev) => {
        const next = new Set(prev);
        next.delete("category");
        return next;
      });

      queryClient.invalidateQueries({ queryKey: ["alumni"] });
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alumnilist"] });
      queryClient.invalidateQueries({ queryKey: ["categories"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alumni", "full-details", currentSapId] });

      toast.success(`Category auto-assigned as ${assignedCategory}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to auto assign category";
      toast.error(msg);
    } finally {
      setIsAutoAssigningCategory(false);
    }
  };

  const handleDelete = async () => {
    if (!currentSapId || !data) return;
    
    // Validate identifier before proceeding
    if (String(currentSapId || "").trim() === "") {
      toast.error("Invalid identifier. Cannot delete alumni.");
      return;
    }

    setIsDeleting(true);
    try {
      const stableIdentifier = data?.alumniid ? String(data.alumniid) : currentSapId;

      const res = await fetch(`/api/alumni/${encodeURIComponent(stableIdentifier)}`, { 
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

    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 w-full">
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
          <div className="pt-1 pb-1 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Mandatory</h4>
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-full px-2 py-0.5">Required for verification</span>
            </div>
          </div>

          <div
            data-field-name="sapid"
            className={`flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50 ${
              !isPreSap && requiredMissingMap.has("sapid") ? "bg-rose-50/70 dark:bg-rose-900/10" : ""
            }`}
          >
            <span className={`text-xs font-medium min-w-[140px] flex-shrink-0 ${
              !isPreSap && requiredMissingMap.has("sapid") ? "text-rose-700 dark:text-rose-300" : "text-gray-500 dark:text-gray-400"
            }`}>Sap No:</span>
            <div className="flex-1 min-w-0 flex items-center gap-3">
              {isFieldEditing("sapid") && !readOnly && !isPreSap ? (
                <input
                  type="text"
                  {...register("sapid")}
                  className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                />
              ) : (
                <span className={`text-xs break-words ${
                  !isPreSap && requiredMissingMap.has("sapid") ? "text-rose-700 dark:text-rose-200 font-semibold" : "text-gray-900 dark:text-gray-100"
                }`}>
                  {formatValue(data.sapid)}
                </span>
              )}
              {canTogglePreSap && onPreSapEnabledChange && (
                <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 whitespace-nowrap cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPreSap}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditingFields((prev) => {
                          const next = new Set(prev);
                          next.delete("sapid");
                          return next;
                        });
                      }
                      onPreSapEnabledChange(e.target.checked);
                    }}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                  />
                  Pre Sap Registration
                </label>
              )}
            </div>
            {!readOnly && !isPreSap && !isFieldEditing("sapid") && (
              <button
                type="button"
                onClick={() => startEditingField("sapid")}
                className="ml-auto flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded transition-colors"
                title="Edit field"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
            )}
          </div>
          <CompactField label="Full Name" value={data.alumniname} isEditing={isFieldEditing("alumniname")} readOnly={readOnly} register={register} name="alumniname" onEdit={() => startEditingField("alumniname")} comparisonStatus={getComparisonStatus("Full Name", data.alumniname)} highlightMissing={requiredMissingMap.has("alumniname")} />
          <CompactField label="Father Name" value={data.fathername} isEditing={isFieldEditing("fathername")} readOnly={readOnly} register={register} name="fathername" onEdit={() => startEditingField("fathername")} comparisonStatus={getComparisonStatus("Father Name", data.fathername)} highlightMissing={requiredMissingMap.has("fathername")} />
          <CompactField label="CNIC/Passport" value={data.cnicpassport} isEditing={isFieldEditing("cnicpassport")} readOnly={readOnly} register={register} name="cnicpassport" onEdit={() => startEditingField("cnicpassport")} comparisonStatus={getComparisonStatus("CNIC/Passport", data.cnicpassport)} highlightMissing={requiredMissingMap.has("cnicpassport")} />
          <CompactField label="Primary Contact" value={data.contactno} isEditing={isFieldEditing("contactno")} readOnly={readOnly} register={register} name="contactno" onEdit={() => startEditingField("contactno")} comparisonStatus={getComparisonStatus("Mobile", data.contactno)} highlightMissing={requiredMissingMap.has("contactno")} />
          <CompactField label="Personal Email" value={data.personalemail} isEditing={isFieldEditing("personalemail")} readOnly={readOnly} register={register} name="personalemail" type="email" onEdit={() => startEditingField("personalemail")} highlightMissing={requiredMissingMap.has("personalemail")} />

          {!isFieldEditing("faculty") || readOnly ? (
            <CompactField 
              label="Faculty" 
              value={facultiesLoading ? "Loading..." : displayFacultyName} 
              isEditing={false} 
              readOnly={readOnly}
              onEdit={() => startEditingField("faculty")}
              highlightMissing={requiredMissingMap.has("faculty")}
            />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Faculty:</label>
              <select
                {...register("faculty", { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = e.target.value;
                    const facultyId = value ? Number(value) : null;
                    setValue("faculty", facultyId);
                    setValue("department", null);
                    setValue("program", null);
                    setValue("departmentname", null);
                    setValue("degreetitle", null);
                    // Update facultyname from selected faculty
                    if (facultyId) {
                      const selectedFaculty = allFaculties.find(f => f.id === facultyId);
                      if (selectedFaculty) {
                        setValue("facultyname", selectedFaculty.faculty_name);
                      }
                    } else {
                      setValue("facultyname", null);
                    }
                  }
                })}
                disabled={readOnly}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              >
                <option value="">Select Faculty</option>
                {allFaculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>{faculty.faculty_name}</option>
                ))}
              </select>
            </div>
          )}

          {!isFieldEditing("department") || readOnly ? (
            <CompactField 
              label="Department" 
              value={departmentsLoading ? "Loading..." : displayDepartmentName} 
              isEditing={false} 
              readOnly={readOnly}
              onEdit={() => startEditingField("department")}
              comparisonStatus={getComparisonStatus("Department", displayDepartmentName)}
              highlightMissing={requiredMissingMap.has("department")}
            />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Department:</label>
              <select
                {...register("department", { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = e.target.value;
                    const departmentId = value ? Number(value) : null;
                    setValue("department", departmentId);
                    setValue("program", null);
                    setValue("degreetitle", null);
                    // Update departmentname from selected department
                    if (departmentId) {
                      const selectedDepartment = allDepartments.find(d => d.id === departmentId);
                      if (selectedDepartment) {
                        setValue("departmentname", selectedDepartment.department_name);
                      }
                    } else {
                      setValue("departmentname", null);
                    }
                  }
                })}
                disabled={readOnly || !selectedFacultyId || allDepartments.length === 0}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly || !selectedFacultyId ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              >
                <option value="">{!selectedFacultyId ? "Select Faculty First" : "Select Department"}</option>
                {allDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                ))}
              </select>
            </div>
          )}

          {!isFieldEditing("program") || readOnly ? (
            <CompactField 
              label="Program" 
              value={programsLoading ? "Loading..." : (allPrograms.find(p => p.id === data?.program)?.program_name || data?.degreetitle || "-")} 
              isEditing={false} 
              readOnly={readOnly}
              onEdit={() => startEditingField("program")}
              comparisonStatus={getComparisonStatus("Program", allPrograms.find(p => p.id === data?.program)?.program_name || data?.degreetitle)}
              highlightMissing={requiredMissingMap.has("program")}
            />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Program:</label>
              <select
                {...register("program", { 
                  valueAsNumber: true,
                  onChange: (e) => {
                    const value = e.target.value;
                    const programId = value ? Number(value) : null;
                    setValue("program", programId);
                    // Update degreetitle from selected program
                    if (programId) {
                      const selectedProgram = allPrograms.find(p => p.id === programId);
                      if (selectedProgram) {
                        setValue("degreetitle", selectedProgram.program_name);
                      }
                    } else {
                      setValue("degreetitle", null);
                    }
                  }
                })}
                disabled={readOnly || !selectedDepartmentId || allPrograms.length === 0}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly || !selectedDepartmentId ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              >
                <option value="">{!selectedDepartmentId ? "Select Department First" : "Select Program"}</option>
                {allPrograms.map((program) => (
                  <option key={program.id} value={program.id}>{program.program_name}</option>
                ))}
              </select>
            </div>
          )}

          <CompactField label="Campus" value={data.campusname} isEditing={isFieldEditing("campusname")} readOnly={readOnly} register={register} name="campusname" type="select" options={[
            { value: "", label: "Select" },
            { value: "Lahore", label: "Lahore" },
            { value: "Sargodha", label: "Sargodha" },
            { value: "Islamabad", label: "Islamabad" },
            { value: "Pakpattan", label: "Pakpattan" }
          ]} onEdit={() => startEditingField("campusname")} highlightMissing={requiredMissingMap.has("campusname")} />

          {!isFieldEditing("yearofending") || readOnly ? (
            <CompactField label="Passing Out Year" value={data.yearofending} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("yearofending")} highlightMissing={requiredMissingMap.has("yearofending")} />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Passing Out Year:</label>
              <select
                {...register("yearofending", { valueAsNumber: true })}
                disabled={readOnly}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              >
                <option value="">Select</option>
                {Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => {
                  const year = 2000 + i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
          )}

         
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Additional</h4>
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">All other fields</span>
            </div>
          </div>

          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Personal</h4>
          </div>

          <CompactField
            label="Registration No"
            value={data.registrationno}
            isEditing={isFieldEditing("registrationno")}
            readOnly={readOnly}
            register={register}
            name="registrationno"
            onEdit={() => startEditingField("registrationno")}
            comparisonStatus={getComparisonStatus("Registration No", data.registrationno)}
            highlightMissing={requiredMissingMap.has("registrationno")}
          />
          <CompactField label="Gender" value={data.gender} isEditing={isFieldEditing("gender")} readOnly={readOnly} register={register} name="gender" type="select" options={[
            { value: "", label: "Select" },
            { value: "Male", label: "Male" },
            { value: "Female", label: "Female" }
          ]} onEdit={() => startEditingField("gender")} />
          <CompactField label="Date of Birth" value={data.dateofbirth} isEditing={isFieldEditing("dateofbirth")} readOnly={readOnly} register={register} name="dateofbirth" type="date" onEdit={() => startEditingField("dateofbirth")} />
          <CompactField label="Marital Status" value={data.maritalstatus} isEditing={isFieldEditing("maritalstatus")} readOnly={readOnly} register={register} name="maritalstatus" type="select" options={[
            { value: "", label: "Select" },
            { value: "Married", label: "Married" },
            { value: "Un-Married", label: "Un-Married" }
          ]} onEdit={() => startEditingField("maritalstatus")} />

          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Contact</h4>
          </div>

          <CompactField label="Secondary Contact" value={data.contactno1} isEditing={isFieldEditing("contactno1")} readOnly={readOnly} register={register} name="contactno1" onEdit={() => startEditingField("contactno1")} />
          <CompactField label="Home Address" value={data.address} isEditing={isFieldEditing("address")} readOnly={readOnly} register={register} name="address" type="textarea" onEdit={() => startEditingField("address")} comparisonStatus={getComparisonStatus("Home Address", data.address)} />
          
          {/* Country Field */}
          {!isFieldEditing("country") || readOnly ? (
            <CompactField label="Home Country" value={data.country} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("country")} comparisonStatus={getComparisonStatus("Home Country", data.country)} />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Home Country:</label>
              <select
                {...register("country")}
                disabled={readOnly}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              >
                <option value="">Select</option>
                {allCountries.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Province Field - Always show, empty if country is not Pakistan */}
          {!isFieldEditing("province") || readOnly ? (
            <CompactField 
              label="Home Province" 
              value={selectedCountry === "Pakistan" ? data.province : null} 
              isEditing={false} 
              readOnly={readOnly} 
              onEdit={() => startEditingField("province")} 
            />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Home Province:</label>
              <select
                {...register("province")}
                disabled={readOnly || selectedCountry !== "Pakistan"}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly || selectedCountry !== "Pakistan" ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              >
                <option value="">{selectedCountry === "Pakistan" ? "Select" : "N/A (Not Pakistan)"}</option>
                {selectedCountry === "Pakistan" && provinceOptions.map((province) => (
                  <option key={province.value} value={province.value}>{province.label}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* City Field */}
          {!isFieldEditing("city") || readOnly ? (
            <CompactField label="Home City" value={data.city} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("city")} />
          ) : selectedCountry === "Pakistan" ? (
            <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0 pt-1">Home City:</label>
              <div className="flex-1 relative">
                {!selectedProvince ? (
                  <div className="p-2 rounded border border-gray-300 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    Please select a province first
                  </div>
                ) : (
                  <Controller
                    name="city"
                    control={control}
                    render={({ field }) => (
                      <>
                        <input
                          ref={(e) => {
                            field.ref(e);
                            cityInputRef.current = e;
                          }}
                          type="text"
                          value={citySearch}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCitySearch(val);
                            setShowCityDropdown(true);
                            // If exact match found, set the value
                            const exactMatch = provinceCities.find(c => c.toLowerCase() === val.toLowerCase());
                            if (exactMatch) {
                              field.onChange(exactMatch);
                            } else {
                              field.onChange(val);
                            }
                          }}
                          onFocus={() => setShowCityDropdown(true)}
                          placeholder="Type to search city..."
                          disabled={readOnly}
                          className={`w-full text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
                        />
                        {showCityDropdown && filteredCities.length > 0 && (
                          <div
                            ref={cityDropdownRef}
                            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto"
                          >
                            {filteredCities.map((city) => (
                              <div
                                key={city}
                                onClick={() => {
                                  setCitySearch(city);
                                  field.onChange(city);
                                  setShowCityDropdown(false);
                                }}
                                className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300"
                              >
                                {city}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  />
                )}
              </div>
            </div>
          ) : (
          <CompactField label="City" value={data.city} isEditing={isFieldEditing("city")} readOnly={readOnly} register={register} name="city" onEdit={() => startEditingField("city")} />
          )}

          {/* Academic Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Academic (Additional)</h4>
          </div>
          {!isFieldEditing("yearofstarting") || readOnly ? (
            <CompactField label="Admission Year" value={data.yearofstarting} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("yearofstarting")} />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Admission Year:</label>
              <select
                {...register("yearofstarting", { valueAsNumber: true })}
                disabled={readOnly}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              >
                <option value="">Select</option>
                {Array.from({ length: new Date().getFullYear() - 1997 }, (_, i) => {
                  const year = 1998 + i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
          )}
          <CompactField label="CGPA" value={data.cgpa} isEditing={isFieldEditing("cgpa")} readOnly={readOnly} register={register} name="cgpa" type="text" onEdit={() => startEditingField("cgpa")} />
          <CompactField label="Major Subject" value={data.majorsubject} isEditing={isFieldEditing("majorsubject")} readOnly={readOnly} register={register} name="majorsubject" onEdit={() => startEditingField("majorsubject")} />
          <CompactField label="Medal" value={data.medal} isEditing={isFieldEditing("medal")} readOnly={readOnly} register={register} name="medal" type="select" options={[
            { value: "", label: "None" },
            { value: "Gold Medalist", label: "Gold Medalist" },
            { value: "Silver Medalist", label: "Silver Medalist" },
            { value: "Bronze Medalist", label: "Bronze Medalist" },
          ]} onEdit={() => startEditingField("medal")} />
          {data.medal && data.medal !== "None" && (
            <div className="col-span-full -mt-1 mb-1 flex items-center gap-2">
              {data.medal_document ? (
                <a
                  href={resolveStoredUploadUrl(data.medal_document) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  View Document
                </a>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400 italic">No document uploaded</span>
              )}
            </div>
          )}

          {/* Professional Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Occupation</h4>
          </div>
          <CompactField label="Occupation Status" value={data.employeed} isEditing={isFieldEditing("employeed")} readOnly={readOnly} register={register} name="employeed" type="select" options={[
            { value: "", label: "Select" },
            { value: "Employed", label: "Employed" },
            { value: "Self-Employed/Enterpreneur", label: "Self-Employed/Enterpreneur" },
            { value: "Unemployed(By Choice)", label: "Unemployed(By Choice)" },
            { value: "Unemployed(Searching for job)", label: "Unemployed (Searching for Job)" },
            { value: "Pursuing Higher Education", label: "Pursuing Higher Education" }
          ]} onEdit={() => startEditingField("employeed")} />
          <CompactField
            label="Post-Graduation Transition"
            value={data.occupation_transition_timing}
            isEditing={isFieldEditing("occupation_transition_timing")}
            readOnly={readOnly}
            register={register}
            name="occupation_transition_timing"
            type="select"
            options={[
              { value: "", label: "Select" },
              { value: "Before graduation", label: "Before graduation" },
              { value: "Immediately after graduation", label: "Immediately after graduation" },
              { value: "Within 3 months", label: "Within 3 months" },
              { value: "Within 6 months", label: "Within 6 months" },
              { value: "After 6 months", label: "After 6 months" },
            ]}
            onEdit={() => startEditingField("occupation_transition_timing")}
          />
          <CompactField label="Current Organization" value={data.nameoforganization} isEditing={isFieldEditing("nameoforganization")} readOnly={readOnly} register={register} name="nameoforganization" onEdit={() => startEditingField("nameoforganization")} />
          <CompactField label="Current Designation" value={data.designation} isEditing={isFieldEditing("designation")} readOnly={readOnly} register={register} name="designation" onEdit={() => startEditingField("designation")} />
          {!isFieldEditing("industry") || readOnly ? (
            <CompactField label="Sector" value={data.industry} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("industry")} />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Sector:</label>
              <input
                type="text"
                list="sector-options"
                placeholder="Select from list or type your sector"
                {...register("industry")}
                disabled={readOnly}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
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
            </div>
          )}
          {/* Note: Start of Career is not in the database schema, so we'll skip it for now */}
          <CompactField label="Work Address" value={data.organization_address} isEditing={isFieldEditing("organization_address")} readOnly={readOnly} register={register} name="organization_address" type="textarea" onEdit={() => startEditingField("organization_address")} />
          <CompactField label="Work City" value={data.work_city} isEditing={isFieldEditing("work_city")} readOnly={readOnly} register={register} name="work_city" onEdit={() => startEditingField("work_city")} />
          {!isFieldEditing("work_country") || readOnly ? (
            <CompactField label="Work Country" value={data.work_country} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("work_country")} />
          ) : (
            <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Work Country:</label>
              <input
                type="text"
                list="work-country-options"
                placeholder="Select from list or type country"
                {...register("work_country")}
                disabled={readOnly}
                className={`flex-1 text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
              />
              <datalist id="work-country-options">
                {allCountries.map((country) => (
                  <option key={country} value={country} />
                ))}
              </datalist>
            </div>
          )}
          <CompactField label="Work Phone" value={data.officialnumber} isEditing={isFieldEditing("officialnumber")} readOnly={readOnly} register={register} name="officialnumber" onEdit={() => startEditingField("officialnumber")} />
          <CompactField label="Work Email" value={data.officialemail} isEditing={isFieldEditing("officialemail")} readOnly={readOnly} register={register} name="officialemail" type="email" onEdit={() => startEditingField("officialemail")} />

          {/* Higher Education Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Higher Education</h4>
          </div>
          <CompactField label="Institution Name" value={data.higher_education_institute_name} isEditing={isFieldEditing("higher_education_institute_name")} readOnly={readOnly} register={register} name="higher_education_institute_name" onEdit={() => startEditingField("higher_education_institute_name")} />
          <CompactField label="Program Enrolled" value={data.higher_education_program} isEditing={isFieldEditing("higher_education_program")} readOnly={readOnly} register={register} name="higher_education_program" onEdit={() => startEditingField("higher_education_program")} />
          <CompactField label="Funding Source" value={data.is_scholarship} isEditing={isFieldEditing("is_scholarship")} readOnly={readOnly} register={register} name="is_scholarship" type="select" options={[
            { value: "", label: "Select" },
            { value: "Full Scholarship", label: "Full Scholarship" },
            { value: "Partial Scholarship", label: "Partial Scholarship" },
            { value: "Self Paid", label: "Self Paid" }
          ]} onEdit={() => startEditingField("is_scholarship")} />
          <CompactField label="Institution Country" value={data.higher_education_institute_country} isEditing={isFieldEditing("higher_education_institute_country")} readOnly={readOnly} register={register} name="higher_education_institute_country" onEdit={() => startEditingField("higher_education_institute_country")} />
          <CompactField label="Institution City" value={data.higher_education_institute_city} isEditing={isFieldEditing("higher_education_institute_city")} readOnly={readOnly} register={register} name="higher_education_institute_city" onEdit={() => startEditingField("higher_education_institute_city")} />

          {/* Chapter and Association Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Chapter & Association</h4>
          </div>
          {!isFieldEditing("chapters") ? (
            <>
              <CompactField 
                label="Chapter 1" 
                value={data.chapter1_id ? chaptersList.find(c => c.id === data.chapter1_id)?.name || "-" : "-"} 
                isEditing={false} 
                readOnly={readOnly}
                onEdit={() => startEditingField("chapters")} 
              />
              <CompactField 
                label="Chapter 2" 
                value={data.chapter2_id ? chaptersList.find(c => c.id === data.chapter2_id)?.name || "-" : "-"} 
                isEditing={false} 
                readOnly={readOnly}
                onEdit={() => startEditingField("chapters")} 
              />
              <CompactField 
                label="Chapter 3" 
                value={data.chapter3_id ? chaptersList.find(c => c.id === data.chapter3_id)?.name || "-" : "-"} 
                isEditing={false} 
                readOnly={readOnly}
                onEdit={() => startEditingField("chapters")} 
              />
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
            </>
          )}
          {!isFieldEditing("association_id") || readOnly ? (
            <CompactField label="Association" value={data.association} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("association_id")} />
          ) : (
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
          )}

          <CompactField label="About Me" value={data.aboutme} isEditing={isFieldEditing("aboutme")} readOnly={readOnly} register={register} name="aboutme" type="textarea" onEdit={() => startEditingField("aboutme")} />

          {/* Social Links */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Social Links</h4>
          </div>
          <CompactField label="Facebook" value={data.facebook} isEditing={isFieldEditing("facebook")} readOnly={readOnly} register={register} name="facebook" type="url" onEdit={() => startEditingField("facebook")} />
          <CompactField label="Instagram" value={data.instagram} isEditing={isFieldEditing("instagram")} readOnly={readOnly} register={register} name="instagram" type="url" onEdit={() => startEditingField("instagram")} />
          <CompactField label="YouTube" value={data.youtube} isEditing={isFieldEditing("youtube")} readOnly={readOnly} register={register} name="youtube" type="url" onEdit={() => startEditingField("youtube")} />
          <CompactField label="LinkedIn" value={data.linkedin} isEditing={isFieldEditing("linkedin")} readOnly={readOnly} register={register} name="linkedin" type="url" onEdit={() => startEditingField("linkedin")} />

          {/* System Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">System</h4>
          </div>
                    {canSendCredentials && data.alumniid && data.alumniid > 0 && (
            <div className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-700/50">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">Credentials:</span>
              <button
                type="button"
                disabled={isSendingCredentials}
                onClick={async () => {
                  if (isSendingCredentials) return;
                  setIsSendingCredentials(true);
                  try {
                    const res = await fetch("/api/send-credentials", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ alumniId: data.alumniid }),
                    });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok || (j && j.ok === false)) {
                      throw new Error((j as any)?.error || `Failed (${res.status})`);
                    }
                    toast.success("Credentials email sent");
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "Failed to send credentials";
                    toast.error(msg);
                  } finally {
                    setIsSendingCredentials(false);
                  }
                }}
                className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium bg-[#183D32] text-white hover:bg-[#183D32]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingCredentials ? "Sending..." : "Send Credentials"}
              </button>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Sends a temporary password to the alumni email</span>
            </div>
          )}
                    {canViewPassword && (
            <CompactField
              label="Alumni Password"
              value={safePasswordValue}
              isEditing={isFieldEditing("password")}
              readOnly={readOnly || !isSuperAdmin}
              register={register}
              name="password"
              type="password"
              onEdit={isSuperAdmin && !readOnly ? () => startEditingField("password") : undefined}
            />
          )}

          <CompactField label="Last Login" value={formatDateTimeDisplay(data.lasttimelogin) || "Never"} isEditing={false} readOnly={true} />
          <CompactField label="Login Count" value={data.logincount || 0} isEditing={isFieldEditing("logincount")} readOnly={readOnly} register={register} name="logincount" type="number" onEdit={() => startEditingField("logincount")} />
          <CompactField label="Alumni Status" value={data.alumnistatus} isEditing={isFieldEditing("alumnistatus")} readOnly={readOnly} register={register} name="alumnistatus" type="select" options={[
            { value: "", label: "Select" },
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" }
          ]} onEdit={() => startEditingField("alumnistatus")} />
          <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-1.5 min-w-[140px] flex-shrink-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Alumni Category:</span>
            </div>
            <div className="flex-1 min-w-0">
              {(!isFieldEditing("category") || readOnly) ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs flex-1 break-words text-gray-900 dark:text-gray-100">{formatValue(selectedCategory)}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => startEditingField("category")}
                      className="ml-auto flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded transition-colors"
                      title="Edit field"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <select
                  {...register("category")}
                  disabled={readOnly}
                  className={`w-full text-xs px-2 py-1 border border-gray-300 rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 ${readOnly ? "bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" : ""}`}
                >
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              )}
            </div>
            {!readOnly && canModify(session.data?.user) && String(selectedCategory).toUpperCase() !== "A+" && (
              <button
                type="button"
                onClick={handleAutoAssignCategory}
                disabled={isAutoAssigningCategory}
                className="flex-shrink-0 inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAutoAssigningCategory ? "Assigning..." : "Auto Assign"}
              </button>
            )}
          </div>
          <CompactField 
            label="Allowed to use information Officially" 
            value={data.alumni_consent_info === true ? "Allowed" : data.alumni_consent_info === false ? "Not Allowed" : "Not Set"} 
            isEditing={false} 
            readOnly={true}
          />
          <CompactField label="Last Updated" value={formatDateDisplay(data.updated_at)} isEditing={isFieldEditing("updated_at")} readOnly={true} register={register} name="updated_at" />
          <CompactField label="Created Date" value={data.createddatetime} isEditing={isFieldEditing("createddatetime")} readOnly={readOnly} register={register} name="createddatetime" onEdit={() => startEditingField("createddatetime")} />
          <CompactField 
            label="Photo Usage Consent" 
            value={data.alumni_consent_pic === true ? "Allowed" : data.alumni_consent_pic === false ? "Not Allowed" : "Not Set"} 
            isEditing={false} 
            readOnly={true}
          />
        </div>

        {editingFields.size > 0 && !readOnly && (
          <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={cancelAllEdits}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {/* Delete Button - Only show for admins and when not editing */}
        {editingFields.size === 0 && !readOnly && canModify(session.data?.user) && (
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
}

export { AlumniExpandableDetails };
export default AlumniExpandableDetails;
