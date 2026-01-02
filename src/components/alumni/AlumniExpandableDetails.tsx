"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import { useForm, Controller } from "react-hook-form";
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
  // New ID-based fields
  faculty: number | null;
  department: number | null;
  program: number | null;
  industry: string | null;
  employeed: string | null;
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
}> = ({ label, value, isEditing = false, readOnly = false, register, name, type = "text", options, onEdit }) => {
  // If readOnly is true, always show as display (not editing)
  const effectiveIsEditing = readOnly ? false : isEditing;
  const displayValue = formatValue(value);
  
  if (!effectiveIsEditing) {
    return (
      <div className="flex items-start gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">{label}:</span>
        <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 break-words">{displayValue}</span>
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

  // Handle password field separately
  if (type === "password") {
    // For password fields, show actual value (visible)
    const displayValue = formatValue(value);
    return (
      <div className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[140px] flex-shrink-0">{label}:</label>
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

export const AlumniExpandableDetails: React.FC<AlumniExpandableDetailsProps> = ({ sapId, onClose, readOnly = false }) => {
  const [currentSapId, setCurrentSapId] = useState(sapId);
  const { data, isLoading, error} = useAlumniFullDetails(currentSapId);
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, control } = useForm<AlumniFullData>();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const deleteModal = useModal();
  
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
          : null,
        personalemailshow: data.personalemailshow !== null && data.personalemailshow !== undefined 
          ? String(data.personalemailshow) 
          : null,
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
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // Faculty, Department, and Program state
  const [allFaculties, setAllFaculties] = useState<{ id: number; faculty_name: string }[]>([]);
  const [allDepartments, setAllDepartments] = useState<{ id: number; department_name: string; faculty_id: number }[]>([]);
  const [allPrograms, setAllPrograms] = useState<{ id: number; program_name: string; department_id: number }[]>([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [programsLoading, setProgramsLoading] = useState(false);
  const selectedFacultyId = watch("faculty");
  const selectedDepartmentId = watch("department");

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

  // Fetch faculties on mount
  useEffect(() => {
    const fetchFaculties = async () => {
      setFacultiesLoading(true);
      try {
        const res = await fetch("/api/organization/faculties");
        if (res.ok) {
          const data = await res.json();
          setAllFaculties(data.faculties || []);
        }
      } catch (error) {
        console.error("Error fetching faculties:", error);
      } finally {
        setFacultiesLoading(false);
      }
    };
    fetchFaculties();
  }, []);

  // Fetch departments on mount if faculty ID exists (for display mode)
  useEffect(() => {
    const fetchInitialDepartments = async () => {
      if (data?.faculty) {
        setDepartmentsLoading(true);
        try {
          const res = await fetch(`/api/organization/departments?faculty_id=${data.faculty}`);
          if (res.ok) {
            const result = await res.json();
            setAllDepartments(result.departments || []);
          }
        } catch (error) {
          console.error("Error fetching initial departments:", error);
        } finally {
          setDepartmentsLoading(false);
        }
      } else {
        setDepartmentsLoading(false);
      }
    };
    fetchInitialDepartments();
  }, [data?.faculty]);

  // Fetch departments when faculty changes or on initial load
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!selectedFacultyId) {
        setAllDepartments([]);
        return;
      }
      try {
        const res = await fetch(`/api/organization/departments?faculty_id=${selectedFacultyId}`);
        if (res.ok) {
          const data = await res.json();
          setAllDepartments(data.departments || []);
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    };
    fetchDepartments();
  }, [selectedFacultyId]);

  // Fetch programs when department changes
  useEffect(() => {
    const fetchPrograms = async () => {
      if (!selectedDepartmentId) {
        setAllPrograms([]);
        return;
      }
      setProgramsLoading(true);
      try {
        const res = await fetch(`/api/organization/programs?department_id=${selectedDepartmentId}`);
        if (res.ok) {
          const data = await res.json();
          setAllPrograms(data.programs || []);
        }
      } catch (error) {
        console.error("Error fetching programs:", error);
      } finally {
        setProgramsLoading(false);
      }
    };
    fetchPrograms();
  }, [selectedDepartmentId]);

  // Fetch initial programs on mount if department ID exists (for display mode)
  useEffect(() => {
    const fetchInitialPrograms = async () => {
      if (data?.department) {
        setProgramsLoading(true);
        try {
          const res = await fetch(`/api/organization/programs?department_id=${data.department}`);
          if (res.ok) {
            const result = await res.json();
            setAllPrograms(result.programs || []);
          }
        } catch (error) {
          console.error("Error fetching initial programs:", error);
        } finally {
          setProgramsLoading(false);
        }
      }
    };
    fetchInitialPrograms();
  }, [data?.department]);

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
    
    console.log('[AlumniExpandableDetails] Faculty lookup:', {
      facultyId: data.faculty,
      facultyIdType: typeof data.faculty,
      allFacultiesCount: allFaculties.length,
      facultyname: data.facultyname
    });
    
    // If we have a faculty ID, try to look it up
    if (data.faculty && allFaculties.length > 0) {
      // Convert to number for comparison (API might return string)
      const facultyIdNum = typeof data.faculty === 'string' ? parseInt(data.faculty, 10) : data.faculty;
      const found = allFaculties.find(f => f.id === facultyIdNum);
      console.log('[AlumniExpandableDetails] Faculty found:', found);
      if (found) {
        return found.faculty_name;
      }
    }
    
    // Fallback to text name
    console.log('[AlumniExpandableDetails] Using fallback facultyname:', data.facultyname);
    return data.facultyname;
  }, [data, allFaculties]);

  const displayDepartmentName = useMemo(() => {
    if (!data) return null;
    
    console.log('[AlumniExpandableDetails] Department lookup:', {
      departmentId: data.department,
      departmentIdType: typeof data.department,
      allDepartmentsCount: allDepartments.length,
      departmentname: data.departmentname
    });
    
    // If we have a department ID, try to look it up
    if (data.department && allDepartments.length > 0) {
      // Convert to number for comparison (API might return string)
      const departmentIdNum = typeof data.department === 'string' ? parseInt(data.department, 10) : data.department;
      const found = allDepartments.find(d => d.id === departmentIdNum);
      console.log('[AlumniExpandableDetails] Department found:', found);
      if (found) {
        return found.department_name;
      }
    }
    
    // Fallback to text name
    console.log('[AlumniExpandableDetails] Using fallback departmentname:', data.departmentname);
    return data.departmentname;
  }, [data, allDepartments]);

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
      };
      reset(formData);
      // Set initial city search value
      if (data.city) {
        setCitySearch(data.city);
      }
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
          password: formData.password,
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
          faculty: formData.faculty,
          department: formData.department,
          program: formData.program,
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
          organization_address: formData.organization_address,
          majorsubject: formData.majorsubject,
          aboutme: formData.aboutme,
          // Higher Education fields
          higher_education_institute_name: formData.higher_education_institute_name,
          higher_education_program: formData.higher_education_program,
          is_scholarship: formData.is_scholarship,
          higher_education_institute_country: formData.higher_education_institute_country,
          higher_education_institute_city: formData.higher_education_institute_city,
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
          category: formData.category,
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
      // Invalidate marital statuses query when marital status is updated
      queryClient.invalidateQueries({ queryKey: ["marital-statuses"] });
      // Invalidate genders query when gender is updated
      queryClient.invalidateQueries({ queryKey: ["genders"] });
      // Invalidate campuses query when campus is updated
      queryClient.invalidateQueries({ queryKey: ["campuses"] });
      // Invalidate occupation statuses query when occupation status is updated
      queryClient.invalidateQueries({ queryKey: ["occupation-statuses"] });
      
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
      setEditingFields(new Set());
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
          {/* Personal Information */}
          <div className="pt-1 pb-1 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Personal</h4>
          </div>
          <CompactField label="Sap No" value={data.sapid} isEditing={isFieldEditing("sapid")} readOnly={readOnly} register={register} name="sapid" onEdit={() => startEditingField("sapid")} />
          <CompactField label="Registration No" value={data.registrationno} isEditing={isFieldEditing("registrationno")} readOnly={readOnly} register={register} name="registrationno" onEdit={() => startEditingField("registrationno")} />
          <CompactField label="Full Name" value={data.alumniname} isEditing={isFieldEditing("alumniname")} readOnly={readOnly} register={register} name="alumniname" onEdit={() => startEditingField("alumniname")} />
          <CompactField label="Father Name" value={data.fathername} isEditing={isFieldEditing("fathername")} readOnly={readOnly} register={register} name="fathername" onEdit={() => startEditingField("fathername")} />
          <CompactField label="CNIC/Passport" value={data.cnicpassport} isEditing={isFieldEditing("cnicpassport")} readOnly={readOnly} register={register} name="cnicpassport" onEdit={() => startEditingField("cnicpassport")} />
          <CompactField label="Gender" value={data.gender} isEditing={isFieldEditing("gender")} readOnly={readOnly} register={register} name="gender" type="select" options={[
            { value: "", label: "Select" },
            { value: "Male", label: "Male" },
            { value: "Female", label: "Female" }
          ]} onEdit={() => startEditingField("gender")} />
          <CompactField label="Date of Birth" value={data.dateofbirth} isEditing={isFieldEditing("dateofbirth")} readOnly={readOnly} register={register} name="dateofbirth" onEdit={() => startEditingField("dateofbirth")} />
          <CompactField label="Marital Status" value={data.maritalstatus} isEditing={isFieldEditing("maritalstatus")} readOnly={readOnly} register={register} name="maritalstatus" type="select" options={[
            { value: "", label: "Select" },
            { value: "Married", label: "Married" },
            { value: "Un-Married", label: "Un-Married" }
          ]} onEdit={() => startEditingField("maritalstatus")} />

          {/* Contact Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Contact</h4>
          </div>
          <CompactField label="Mobile" value={data.contactno} isEditing={isFieldEditing("contactno")} readOnly={readOnly} register={register} name="contactno" onEdit={() => startEditingField("contactno")} />
          <CompactField label="Secondary Contact" value={data.contactno1} isEditing={isFieldEditing("contactno1")} readOnly={readOnly} register={register} name="contactno1" onEdit={() => startEditingField("contactno1")} />
          <CompactField label="Personal Email" value={data.personalemail} isEditing={isFieldEditing("personalemail")} readOnly={readOnly} register={register} name="personalemail" type="email" onEdit={() => startEditingField("personalemail")} />
          <CompactField label="Password" value={data.password || ""} isEditing={isFieldEditing("password")} readOnly={readOnly} register={register} name="password" type="password" onEdit={() => startEditingField("password")} />
         
          <CompactField label="Home Address" value={data.address} isEditing={isFieldEditing("address")} readOnly={readOnly} register={register} name="address" type="textarea" onEdit={() => startEditingField("address")} />
          
          {/* Country Field */}
          {!isFieldEditing("country") || readOnly ? (
            <CompactField label="Home Country" value={data.country} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("country")} />
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
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Academic</h4>
          </div>
          
          {/* Faculty Field */}
          {!isFieldEditing("faculty") || readOnly ? (
            <CompactField 
              label="Faculty" 
              value={facultiesLoading ? "Loading..." : displayFacultyName} 
              isEditing={false} 
              readOnly={readOnly}
              onEdit={() => startEditingField("faculty")}
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

          {/* Department Field */}
          {!isFieldEditing("department") || readOnly ? (
            <CompactField 
              label="Department" 
              value={departmentsLoading ? "Loading..." : displayDepartmentName} 
              isEditing={false} 
              readOnly={readOnly}
              onEdit={() => startEditingField("department")}
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
          
          {/* Program Field */}
          {!isFieldEditing("program") || readOnly ? (
            <CompactField 
              label="Program" 
              value={programsLoading ? "Loading..." : (allPrograms.find(p => p.id === data?.program)?.program_name || data?.degreetitle || "-")} 
              isEditing={false} 
              readOnly={readOnly}
              onEdit={() => startEditingField("program")}
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
          ]} onEdit={() => startEditingField("campusname")} />
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
          {!isFieldEditing("yearofending") || readOnly ? (
            <CompactField label="Passing Out Year" value={data.yearofending} isEditing={false} readOnly={readOnly} onEdit={() => startEditingField("yearofending")} />
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
          <CompactField label="CGPA" value={data.cgpa} isEditing={isFieldEditing("cgpa")} readOnly={readOnly} register={register} name="cgpa" type="text" onEdit={() => startEditingField("cgpa")} />
          <CompactField label="Major Subject" value={data.majorsubject} isEditing={isFieldEditing("majorsubject")} readOnly={readOnly} register={register} name="majorsubject" onEdit={() => startEditingField("majorsubject")} />

          {/* Professional Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Occupation</h4>
          </div>
          <CompactField label="Occupation Status" value={data.employeed} isEditing={isFieldEditing("employeed")} readOnly={readOnly} register={register} name="employeed" type="select" options={[
            { value: "", label: "Select" },
            { value: "Employed", label: "Employed" },
            { value: "Self-Employed", label: "Self-Employed" },
            { value: "Unemployed (By Choice)", label: "Unemployed (By Choice)" },
            { value: "Unemployed (Searching Job)", label: "Unemployed (Searching Job)" },
            { value: "Pursuing Higher Education", label: "Pursuing Higher Education" }
          ]} onEdit={() => startEditingField("employeed")} />
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
              <CompactField label="Chapter" value={data.chapter} isEditing={false} onEdit={() => startEditingField("chapters")} />
              <CompactField label="Association" value={data.association} isEditing={false} onEdit={() => startEditingField("association_id")} />
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

          {/* Additional Information */}
          <div className="pt-2 pb-1 border-b border-gray-200 dark:border-gray-700 mt-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Additional</h4>
          </div>
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
          <CompactField label="Verification Status" value={data.verify || "Not Set"} isEditing={isFieldEditing("verify")} readOnly={readOnly} register={register} name="verify" type="select" options={[
            { value: "", label: "Select" },
            { value: "Verified", label: "Verified" },
            { value: "Unverified", label: "Unverified" },
            { value: "On-Hold", label: "On-Hold" }
          ]} onEdit={() => startEditingField("verify")} />
          <CompactField label="Last Login" value={data.lasttimelogin || "Never"} isEditing={isFieldEditing("lasttimelogin")} readOnly={readOnly} register={register} name="lasttimelogin" onEdit={() => startEditingField("lasttimelogin")} />
          <CompactField label="Login Count" value={data.logincount || 0} isEditing={isFieldEditing("logincount")} readOnly={readOnly} register={register} name="logincount" type="number" onEdit={() => startEditingField("logincount")} />
          <CompactField label="Alumni Status" value={data.alumnistatus} isEditing={isFieldEditing("alumnistatus")} readOnly={readOnly} register={register} name="alumnistatus" type="select" options={[
            { value: "", label: "Select" },
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" }
          ]} onEdit={() => startEditingField("alumnistatus")} />
          <CompactField label="Alumni Category" value={data.category} isEditing={isFieldEditing("category")} readOnly={readOnly} register={register} name="category" type="select" options={[
            { value: "", label: "Select" },
            { value: "A+", label: "A+" },
            { value: "A", label: "A" },
            { value: "B", label: "B" },
            { value: "C", label: "C" },
          ]} onEdit={() => startEditingField("category")} />
          <CompactField label="Created Date" value={data.createddatetime} isEditing={isFieldEditing("createddatetime")} readOnly={readOnly} register={register} name="createddatetime" onEdit={() => startEditingField("createddatetime")} />
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
        {editingFields.size === 0 && !readOnly && canModify(session?.user) && (
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
