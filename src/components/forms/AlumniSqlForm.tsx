"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  getDepartmentsByFaculty,
  getFaculties,
} from "@/data/programs-departments";

// TypeScript type reflecting public.tbl_alumni schema (excluding serial primary key)
export type TblAlumniForm = {
  alumniemail: string | null;
  password: string | null;
  todaydate: string | null; // ISO datetime-local string
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
  contactno1show: boolean | null;
  personalemail: string | null;
  personalemailshow: boolean | null;
  universityemail: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  homeCity: string | null;
  homeCountry: string | null;
  workCity: string | null;
  workCountry: string | null;
  address: string | null;
  academicsession: string | null;
  degreetitle: string | null;
  cgpa: number | null;
  yearofstarting: number | null;
  yearofending: number | null;
  faculty: number | null; // Faculty ID
  facultyname: string | null; // Faculty name (for backward compatibility)
  campusname: string | null;
  department: number | null; // Department ID
  departmentname: string | null; // Department name (for backward compatibility)
  program: number | null; // Program ID
  majorsubject: string | null;
  industry: string | null;
  employeed: string | null;
  reason_of_unemployment: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  startOfCareer: string | null; // Date format for start of career
  officialemail: string | null;
  officialnumber: string | null;
  organization_address: string | null;
  image1: string | null;
  cv: string | null;
  aboutme: string | null;
  // Higher Education fields
  highereducationdegreetitle: string | null;
  highereducationinstitute: string | null;
  highereducationprogram: string | null;
  scholarship: string | null;
  lasttimelogin: string | null;
  logincount: number | null;
  verify: string | null;
  emailsendcount: number | null; // smallint
  emailsendstatus: string | null;
  createddatetime: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
  category: string | null;
  chapters: number[] | null; // Array of selected chapter IDs (up to 3)
};

const inputBase = "mt-1 w-full rounded border border-neutral-300 p-2";
const labelBase = "block text-sm text-neutral-800";

// List of all countries
const allCountries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Côte d'Ivoire",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (Congo-Brazzaville)",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia (Czech Republic)",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini (fmr. Swaziland)",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Holy See",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar (formerly Burma)",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine State",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
  "Other"
];

// Constant list of Pakistan provinces for validation

// Pakistan cities organized by province (sorted alphabetically)
const citiesByProvinceRaw: Record<string, string[]> = {
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
  "Islamabad": [
    "Islamabad"
  ],
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

// Cache for deduplicated cities
const citiesCache: Record<string, string[]> = {};

// Get all cities for a specific province (with deduplication and alphabetical sorting)
const getCitiesByProvince = (province: string): string[] => {
  if (citiesCache[province]) {
    return citiesCache[province];
  }
  
  const cities = citiesByProvinceRaw[province] || [];
  const seen = new Set<string>();
  const deduplicated = cities.filter(city => {
    const normalized = city.trim().toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
  
  // Sort cities alphabetically
  const sorted = deduplicated.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  
  citiesCache[province] = sorted;
  return sorted;
};

export default function AlumniSqlForm({ excludeAdminStep = false, onSuccess }: { excludeAdminStep?: boolean; onSuccess?: () => void }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    trigger,
    watch,
    setError,
    clearErrors,
    setValue,
    control,
    formState: { errors },
  } = useForm<TblAlumniForm>({
    defaultValues: {
      alumniemail: null,
      password: null,
      todaydate: null,
      registrationno: null,
      sapid: null,
      alumniname: null,
      gender: null,
      fathername: null,
      dateofbirth: null,
      maritalstatus: null,
      cnicpassport: null,
      contactno: null,
      contactno1: null,
      contactno1show: null,
      personalemail: null,
      personalemailshow: null,
      universityemail: null,
      country: "Pakistan",
      province: null,
      city: null,
      homeCity: null,
      homeCountry: "Pakistan",
      workCity: null,
      workCountry: null,
      address: null,
      academicsession: null,
      degreetitle: null,
      cgpa: null,
      yearofstarting: null,
      yearofending: null,
      faculty: null,
      facultyname: null,
      campusname: null,
      department: null,
      departmentname: null,
      program: null,
      majorsubject: null,
      industry: null,
      employeed: "Unemployed, searching for job",
      reason_of_unemployment: null,
      nameoforganization: null,
      designation: null,
      totalyearsofexpereince: null,
      startOfCareer: null,
      officialemail: null,
      officialnumber: null,
      image1: null,
      cv: null,
      aboutme: null,
      lasttimelogin: null,
      logincount: null,
      verify: "No",
      emailsendcount: null,
      emailsendstatus: null,
      createddatetime: null,
      facebook: null,
      instagram: null,
      youtube: null,
      linkedin: null,
      datasource: null,
      alumnistatus: null,
      category: null,
      highereducationdegreetitle: null,
      highereducationinstitute: null,
      highereducationprogram: null,
      scholarship: null,
      chapters: null,
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const homeCityInputRef = useRef<HTMLInputElement | null>(null);
  const isTypingHomeCityRef = useRef(false);
  const [facultyOtherSelected, setFacultyOtherSelected] = useState(false);
  const [departmentOtherSelected, setDepartmentOtherSelected] = useState(false);
  // Use refs to track if user is actively typing in "Other" inputs
  const isTypingFacultyOther = useRef(false);
  const isTypingDepartmentOther = useRef(false);
  const [userAccess, setUserAccess] = useState<{
    isSuperAdmin: boolean;
    faculties: string[];
    departments: string[];
    programs: string[];
  } | null>(null);
  const [chapters, setChapters] = useState<Array<{ id: number; name: string; type: "national" | "international" }>>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);

  // Database-backed faculties, departments, and programs
  const [dbFaculties, setDbFaculties] = useState<Array<{ id: number; name: string }>>([]);
  const [dbDepartments, setDbDepartments] = useState<Array<{ id: number; name: string; facultyId: number }>>([]);
  const [loadingDbData, setLoadingDbData] = useState(true);

  // Fetch faculties from database
  useEffect(() => {
    const fetchFaculties = async () => {
      try {
        const res = await fetch("/api/organization/faculties");
        if (res.ok) {
          const data = await res.json();
          // Map faculty_name to name for frontend compatibility
          const mappedFaculties = (data.faculties || []).map((f: { id: number; faculty_name: string }) => ({
            id: f.id,
            name: f.faculty_name
          }));
          setDbFaculties(mappedFaculties);
        }
      } catch (err) {
        console.error("Failed to fetch faculties:", err);
      } finally {
        setLoadingDbData(false);
      }
    };
    fetchFaculties();
  }, []);

  // Fetch departments when faculty changes
  useEffect(() => {
    const facultyId = watch("faculty");
    if (!facultyId) {
      setDbDepartments([]);
      return;
    }

    const fetchDepartments = async () => {
      try {
        const res = await fetch(`/api/organization/departments?faculty_id=${facultyId}`);
        if (res.ok) {
          const data = await res.json();
          // Map department_name to name for frontend compatibility
          const mappedDepartments = (data.departments || []).map((d: { id: number; department_name: string; faculty_id: number }) => ({
            id: d.id,
            name: d.department_name,
            facultyId: d.faculty_id
          }));
          setDbDepartments(mappedDepartments);
        }
      } catch (err) {
        console.error("Failed to fetch departments:", err);
      }
    };
    fetchDepartments();
  }, [watch("faculty")]);


  // Fetch user access assignments
  useEffect(() => {
    const fetchAccess = async () => {
      try {
        const res = await fetch("/api/users/current/access-assignments", {
          headers: { "accept": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          setUserAccess(data);
        } else {
          // If not authenticated or error, assume no restrictions (for public forms)
          setUserAccess({ isSuperAdmin: true, faculties: [], departments: [], programs: [] });
        }
      } catch (err) {
        console.error("Failed to fetch user access:", err);
        // On error, assume no restrictions
        setUserAccess({ isSuperAdmin: true, faculties: [], departments: [], programs: [] });
      }
    };
    fetchAccess();
  }, []);

  // Fetch chapters from API
  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const response = await fetch("/api/chapters/list");
        const result = await response.json();
        if (response.ok && result.chapters) {
          setChapters(result.chapters);
        } else {
          console.error("[AlumniSqlForm] Failed to fetch chapters:", result);
        }
      } catch (error) {
        console.error("[AlumniSqlForm] Error fetching chapters:", error);
      } finally {
        setIsLoadingChapters(false);
      }
    };
    fetchChapters();
  }, []);

  // Sync selectedChapters with form value
  useEffect(() => {
    setValue("chapters", selectedChapters.length > 0 ? selectedChapters : null);
  }, [selectedChapters, setValue]);

  const personalEmailVal = watch("personalemail") || "";
  const employeedVal = (watch("employeed") || "Unemployed, searching for job") as string;
  const selectedFaculty = watch("facultyname") || "";
  const selectedDepartment = watch("departmentname") || "";
  const selectedHomeCountry = watch("country") || "";
  const selectedHomeProvince = watch("province") || "";
  const selectedHomeCity = watch("homeCity") || "";
  
  // Filter faculties based on user access
  const availableFaculties = useMemo(() => {
    const allFaculties = getFaculties();
    if (!userAccess || userAccess.isSuperAdmin) {
      return allFaculties;
    }
    if (userAccess.faculties.length === 0) {
      return []; // No access
    }
    return allFaculties.filter(f => 
      userAccess.faculties.some(af => af.toLowerCase().trim() === f.toLowerCase().trim())
    );
  }, [userAccess]);

  // Filter departments based on user access and selected faculty
  const deptOptions = useMemo(() => {
    const allDepts = getDepartmentsByFaculty(selectedFaculty);
    if (!userAccess || userAccess.isSuperAdmin) {
      return allDepts;
    }
    if (userAccess.departments.length === 0) {
      // If no department-level access, check if we have faculty-level access
      if (selectedFaculty && userAccess.faculties.some(f => 
        f.toLowerCase().trim() === selectedFaculty.toLowerCase().trim()
      )) {
        return allDepts; // Show all departments in the faculty
      }
      return [];
    }
    // Filter departments that are in the selected faculty AND in user's access
    return allDepts.filter(d => 
      userAccess.departments.some(ad => ad.toLowerCase().trim() === d.toLowerCase().trim())
    );
  }, [selectedFaculty, userAccess]);

  // // Filter programs based on user access, selected faculty and department
  // const programOptions = useMemo(() => {
  //   if (!selectedFaculty || !selectedDepartment || selectedDepartment === "other") {
  //     return [];
  //   }
  //   const allPrograms = getProgramsByFacultyAndDepartment(selectedFaculty, selectedDepartment);
  //   if (!userAccess || userAccess.isSuperAdmin) {
  //     return allPrograms;
  //   }
  //   if (userAccess.programs.length === 0) {
  //     // If no program-level access, check if we have department-level access
  //     if (userAccess.departments.some(d => 
  //       d.toLowerCase().trim() === selectedDepartment.toLowerCase().trim()
  //     )) {
  //       return allPrograms; // Show all programs in the department
  //     }
  //     return [];
  //   }
  //   // Filter programs that are in the selected department AND in user's access
  //   return allPrograms.filter(p => 
  //     userAccess.programs.some(ap => ap.toLowerCase().trim() === p.toLowerCase().trim())
  //   );
  // }, [selectedFaculty, selectedDepartment, userAccess]);
  
  // Get cities for selected province (for home city)
  const homeProvinceCities = useMemo(() => {
    if (selectedHomeCountry === "Pakistan" && selectedHomeProvince) {
      return getCitiesByProvince(selectedHomeProvince);
    }
    return [];
  }, [selectedHomeCountry, selectedHomeProvince]);

  
  // Province options based on selected home country
  const homeProvinceOptions = useMemo(() => {
    if (selectedHomeCountry === "Pakistan") {
      return [
        { value: "Punjab", label: "Punjab" },
        { value: "Sindh", label: "Sindh" },
        { value: "KPK", label: "KPK" },
        { value: "Balochistan", label: "Balochistan" },
        { value: "Islamabad", label: "Islamabad Capital Territory" },
        { value: "GB", label: "Gilgit-Baltistan" },
        { value: "AJK", label: "Azad Kashmir" },
      ];
    } else if (selectedHomeCountry && selectedHomeCountry !== "" && selectedHomeCountry !== "Select") {
      return [{ value: "Not applicable", label: "Not applicable" }];
    }
    return [];
  }, [selectedHomeCountry]);

  
  // Reset department and program when faculty changes
  useEffect(() => {
    // Don't reset if user is currently typing in "Other" input
    if (isTypingFacultyOther.current || (facultyOtherSelected && selectedFaculty && selectedFaculty !== "other")) {
      // User is typing a custom faculty name, don't interfere
      return;
    }
    
    setValue("departmentname", "");
    setValue("degreetitle", "");
    setDepartmentOtherSelected(false);
    // Only set facultyOtherSelected if faculty is explicitly "other", otherwise reset it
    if (selectedFaculty === "other") {
      setFacultyOtherSelected(true);
    } else if (selectedFaculty && selectedFaculty !== "" && availableFaculties.includes(selectedFaculty)) {
      // Only reset if it's a valid faculty from the list
      setFacultyOtherSelected(false);
    }
  }, [selectedFaculty, setValue, facultyOtherSelected, availableFaculties]);

  // Reset program when department changes
  useEffect(() => {
    // Don't reset if user is currently typing in "Other" input
    if (isTypingDepartmentOther.current || (departmentOtherSelected && selectedDepartment && selectedDepartment !== "other")) {
      // User is typing a custom department name, don't interfere
      return;
    }
    
    setValue("degreetitle", "");
    // Only set departmentOtherSelected if department is explicitly "other", otherwise reset it
    if (selectedDepartment === "other") {
      setDepartmentOtherSelected(true);
    } else if (selectedDepartment && selectedDepartment !== "" && deptOptions.includes(selectedDepartment)) {
      // Only reset if it's a valid department from the list
      setDepartmentOtherSelected(false);
    }
  }, [selectedDepartment, setValue, departmentOtherSelected, deptOptions]);
  

  // Sync country to homeCountry for form submission
  useEffect(() => {
    const currentCountry = watch("country");
    if (currentCountry) {
      setValue("homeCountry", currentCountry, { shouldValidate: false });
    }
  }, [selectedHomeCountry, setValue, watch]);

  // Reset home province and city when home country changes
  useEffect(() => {
    if (selectedHomeCountry && selectedHomeCountry !== "Pakistan") {
      // Force reset province when country changes to non-Pakistan
      setValue("province", "", { shouldValidate: false });
      setValue("homeCity", "", { shouldValidate: false });
    } else if (selectedHomeCountry === "Pakistan") {
      // If switching back to Pakistan, also reset province if it's "Not applicable"
      const currentProvince = watch("province");
      if (currentProvince === "Not applicable" || (currentProvince && !homeProvinceOptions.find(opt => opt.value === currentProvince))) {
        setValue("province", "", { shouldValidate: false });
      }
    }
  }, [selectedHomeCountry, setValue, watch, homeProvinceOptions]);
  
  // Reset home city when province changes (only when not typing)
  useEffect(() => {
    // Don't interfere if user is actively typing
    if (isTypingHomeCityRef.current) {
      return;
    }
    
    if (selectedHomeCountry === "Pakistan" && selectedHomeProvince) {
      // Only reset if current city is not in the new province's cities
      const currentCity = selectedHomeCity || "";
      const validCities = getCitiesByProvince(selectedHomeProvince);
      if (currentCity && !validCities.includes(currentCity)) {
        setValue("homeCity", "");
      }
    } else if (selectedHomeCountry === "Pakistan" && !selectedHomeProvince) {
      // Clear city if province is cleared
      setValue("homeCity", "");
    }
  }, [selectedHomeProvince, selectedHomeCountry, setValue]);


  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Helper function to strip non-numeric characters from phone numbers
  const sanitizePhoneNumber = (value: string): string => {
    return value.replace(/\D/g, '');
  };

  // Helper function to generate year options for dropdowns
  const generateYearOptions = (startYear: number, endYear: number) => {
    const years = [];
    for (let year = endYear; year >= startYear; year--) {
      years.push(year);
    }
    return years;
  };

  const currentYear = new Date().getFullYear();
  const admissionYearOptions = generateYearOptions(1998, currentYear);
  const passingYearOptions = generateYearOptions(2000, currentYear);

  async function validateAll() {
    clearErrors();
    
    // Check if at least one of registrationno or sapid is provided
    const regNo = watch("registrationno") ? String(watch("registrationno")).trim() : "";
    const sapId = watch("sapid") ? String(watch("sapid")).trim() : "";
    if (!regNo && !sapId) {
      setError("registrationno", { type: "validate", message: "Either Registration # or SAP ID is required" });
      setError("sapid", { type: "validate", message: "Either Registration # or SAP ID is required" });
      return false;
    }
    
    // Validate Personal Information section (only trigger fields that are actually required)
    const fieldsToValidate: Array<keyof TblAlumniForm> = ["alumniname", "fathername", "gender", "cnicpassport", "contactno", "personalemail", "homeCity", "homeCountry"];
    
    // Only validate the provided field (registrationno OR sapid), not both
    if (regNo) {
      fieldsToValidate.push("registrationno");
    } else if (sapId) {
      fieldsToValidate.push("sapid");
    }
    
    const personalOk = await trigger(fieldsToValidate);
    if (!personalOk) return false;
    if (!emailPattern.test(personalEmailVal)) {
      setError("personalemail", { type: "pattern", message: "Invalid email format" });
      return false;
    }

    // Validate Academic Information section
    const academicOk = await trigger([
      "campusname",
      "faculty",
      "department",
      "degreetitle",
      "yearofstarting",
      "yearofending",
    ]);
    if (!academicOk) return false;

    // Validate Work Status section
    const workFieldsToValidate: Array<keyof TblAlumniForm> = ["employeed"];
    
    // Only validate work fields if employed or self-employed
    if ((employeedVal || "").toLowerCase() === "employed/business" || (employeedVal || "").toLowerCase() === "self-employed") {
      workFieldsToValidate.push("industry", "startOfCareer", "nameoforganization", "designation", "officialemail", "officialnumber", "organization_address", "workCity", "workCountry");
    }
    
    // Validate higher education fields if pursuing higher education
    if ((employeedVal || "").toLowerCase() === "pursuing higher education") {
      workFieldsToValidate.push("highereducationinstitute", "highereducationprogram", "scholarship", "workCity", "workCountry");
    }
    
    // No validation needed for unemployed options as reason is in the radio button value
    
    const workOk = await trigger(workFieldsToValidate);
    if (!workOk) return false;
    
    // Conditional: when employed or self-employed, validate required fields
    if ((employeedVal || "").toLowerCase() === "employed/business" || (employeedVal || "").toLowerCase() === "self-employed") {
      const fields: Array<keyof TblAlumniForm> = [
        "industry",
        "startOfCareer",
        "nameoforganization",
        "designation",
        "officialemail",
        "officialnumber",
        "organization_address",
        "workCity",
        "workCountry",
      ];
      for (const f of fields) {
        const val = watch(f);
        if (!val || String(val).trim() === "") {
          setError(f, { type: "required", message: "Required" });
          return false;
        }
      }
    }
    
    // Conditional: when pursuing higher education, validate required fields
    if ((employeedVal || "").toLowerCase() === "pursuing higher education") {
      const fields: Array<keyof TblAlumniForm> = [
        "highereducationinstitute",
        "highereducationprogram",
        "scholarship",
        "workCity",
        "workCountry",
      ];
      for (const f of fields) {
        const val = watch(f);
        if (!val || String(val).trim() === "") {
          setError(f, { type: "required", message: "Required" });
          return false;
        }
      }
    }
    
    // No validation needed for unemployed options as reason is in the radio button value

    // Validate Admin Section (if not excluded)
    if (!excludeAdminStep) {
      const adminOk = await trigger(["datasource", "verify", "alumnistatus"]);
      if (!adminOk) return false;
    }

    return true;
  }

  async function onSubmit(data: TblAlumniForm) {
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitError(null);
    
    try {
      const payload: TblAlumniForm = { ...data };
      if (!payload.alumniemail || String(payload.alumniemail).trim() === "") {
        payload.alumniemail = payload.personalemail ?? null;
      }
      if (!payload.datasource || String(payload.datasource).trim() === "") {
        payload.datasource = "Alumni";
      }
      
      // Map employment status to database format
      if (payload.employeed) {
        const employeedValue = String(payload.employeed).trim();
        if (employeedValue === "Employed/Business") {
          payload.employeed = "Employed";
        } else if (employeedValue === "Self-employed") {
          payload.employeed = "Self-Emplo";
        } else if (employeedValue === "Pursuing Higher Education") {
          payload.employeed = "Pursuing Higher Education";
        } else if (employeedValue === "Unemployed By choice") {
          payload.employeed = "Unemployed By choice";
        } else if (employeedValue === "Unemployed, searching for job") {
          payload.employeed = "Unemployed, searching for job";
        }
      }
      
      // Map work city/country to database city/country if provided, otherwise use home city/country
      // The database only has one city and country field, so we prioritize work location when provided
      if (payload.workCity && String(payload.workCity).trim() !== "") {
        payload.city = payload.workCity;
      } else if (payload.homeCity && String(payload.homeCity).trim() !== "") {
        payload.city = payload.homeCity;
      }
      
      if (payload.workCountry && String(payload.workCountry).trim() !== "") {
        payload.country = payload.workCountry;
      } else if (payload.homeCountry && String(payload.homeCountry).trim() !== "") {
        payload.country = payload.homeCountry;
      }
      
      // Check if SAP ID or Registration # exists
      const sapId = String(payload.sapid || "").trim();
      const regNo = String(payload.registrationno || "").trim();
      
      // Show loading toast
      const loadingToast = toast.loading("Checking if user already exists...");
      
      // Check both registration number and SAP ID
      const checkParams = new URLSearchParams();
      if (regNo) checkParams.append("registrationno", regNo);
      if (sapId) checkParams.append("sapid", sapId);
      
      const checkRes = await fetch(`/api/alumni/check-registration?${checkParams.toString()}`);
      const checkData = await checkRes.json();
      
      toast.dismiss(loadingToast);
      
      // Only block if alumni exists AND is verified (cannot re-register)
      // If alumni exists but is NOT verified (pending/false/null), allow registration (will update existing record)
      if (checkRes.ok && checkData.exists && !checkData.canRegister) {
        const alumni = checkData.alumni;
        let errorMsg = "";
        
        if (regNo && alumni?.registrationno === regNo && sapId && alumni?.sapid === sapId) {
          errorMsg = "This alumni is already verified and cannot register again. Please contact support if you need assistance.";
        } else if (regNo && alumni?.registrationno === regNo) {
          errorMsg = "This alumni is already verified and cannot register again. Please contact support if you need assistance.";
        } else if (sapId && alumni?.sapid === sapId) {
          errorMsg = "This alumni is already verified and cannot register again. Please contact support if you need assistance.";
        } else {
          errorMsg = "This alumni is already verified and cannot register again. Please contact support if you need assistance.";
        }
        
        toast.error(errorMsg, {
          duration: 6000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            padding: '16px',
            borderRadius: '8px',
          },
        });
        
        setSubmitError(errorMsg);
        setSubmitting(false);
        return;
      }
      
      // If alumni exists but can register (not verified), show info message but allow registration
      if (checkRes.ok && checkData.exists && checkData.canRegister) {
        toast("Updating existing registration. Your status will be set to 'Under Approval'.", {
          duration: 4000,
          icon: 'ℹ️',
          style: {
            background: '#dbeafe',
            color: '#1e40af',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
      
      if (!checkRes.ok) {
        const errorMsg = checkData?.error || "Failed to verify existing user. Please try again.";
        toast.error(errorMsg, {
          duration: 5000,
        });
        setSubmitError(errorMsg);
        setSubmitting(false);
        return;
      }
      
      // Show submitting toast
      const submittingToast = toast.loading("Submitting your registration...");
      
      // Add selected chapters to payload
      if (selectedChapters.length > 0) {
        payload.chapters = selectedChapters;
      }

      // Send to API (server will sanitize and validate again)
      const res = await fetch("/api/alumni/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const json = await res.json();
      
      toast.dismiss(submittingToast);
      
      if (!res.ok) {
        const errorMsg = json?.error || json?.message || "Failed to save record. Please check all fields and try again.";
        toast.error(errorMsg, {
          duration: 6000,
        });
        setSubmitError(errorMsg);
        setSubmitting(false);
        return;
      }
      
      // Success - show toast and close form
      let successMessage = `Registration successful! Your Alumni ID is ${json.alumniid}.`;
      if (json.generatedPassword) {
        successMessage += ` A password has been generated and sent to your email. Please check your inbox for login credentials.`;
        toast.success(successMessage, {
          duration: 6000,
          style: {
            background: '#d1fae5',
            color: '#065f46',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      } else {
        toast.success(successMessage, {
          duration: 4000,
          style: {
            background: '#d1fae5',
            color: '#065f46',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
      
      setSubmitMsg(json.generatedPassword 
        ? `Registration successful! Your Alumni ID is ${json.alumniid}. You will be notified via email when your registration is approved.`
        : `Registration successful! Your Alumni ID is ${json.alumniid}. Redirecting to sign in...`);
      
      // Reset form
      reset();
      
      // Close modal/form if callback provided, otherwise redirect
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          // Redirect after closing modal
          setTimeout(() => {
            router.push("/signin");
            router.refresh();
          }, 300);
        }, 800);
      } else {
        // Redirect to signin page immediately (form will close)
        setTimeout(() => {
          router.push("/signin");
          router.refresh();
        }, 800);
      }
      
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorMsg = msg || "An unexpected error occurred. Please try again later.";
      
      toast.error(errorMsg, {
        duration: 6000,
      });
      
      setSubmitError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFormSubmit(data: TblAlumniForm) {
    // Clear previous errors
    setSubmitError(null);
    setSubmitMsg(null);
    
    // Validate all fields
    const isValid = await validateAll();
    if (!isValid) {
      // Show general error message
      setSubmitError("Please fix all errors in the form before submitting.");
      
      // Scroll to first error after a brief delay to allow errors to render
      setTimeout(() => {
        const firstErrorField = document.querySelector('.text-red-600')?.closest('div')?.querySelector('input, select, textarea');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: "smooth", block: "center" });
          (firstErrorField as HTMLElement).focus();
        }
      }, 100);
      return;
    }
    
    // If validation passes, submit the form
    await onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-6 bg-white px-4" aria-label="Alumni registration form">
      <input type="hidden" value="Alumni" {...register("datasource")} />
      <input type="hidden" name="alumni" value="alumni" />
      {/* Notifications */}
      {(submitMsg || submitError || submitting) && (
        <div className="mb-4 rounded-lg border p-4" aria-live="polite" aria-atomic="true">
          {submitting && (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600"></div>
              <span>Submitting your registration...</span>
            </div>
          )}
          {submitMsg && (
            <div role="status" className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{submitMsg}</span>
            </div>
          )}
          {submitError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <svg className="h-5 w-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{submitError}</span>
            </div>
          )}
        </div>
      )}

      {/* Section 1: Personal Information */}
      <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Personal Information</h2>
          <p className="mt-1 text-xs text-neutral-600">Fields marked with * are required.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelBase}>
                Registration No{' '}
                <span className="ml-1 text-xs text-neutral-500 font-normal italic">
                  (Provide atleast one, Registration No or SAP ID)
                </span>
              </label>
              <input
                type="text"
                className={inputBase}
                {...register("registrationno", {
                  maxLength: 20,
                  validate: (value, formValues) => {
                    const regNo = value ? String(value).trim() : "";
                    const sapId = formValues?.sapid ? String(formValues.sapid).trim() : "";
                    // If this field has a value, it's valid
                    if (regNo) return true;
                    // If the other field has a value, this one is optional
                    if (sapId) return true;
                    // Both are empty
                    return "Either Registration # or SAP ID is required";
                  }
                })}
              />
              {errors.registrationno && <p className="mt-1 text-xs text-red-600">{errors.registrationno.message}</p>}
            </div>
            <div>
              <label className={labelBase}>SAP ID </label>
              <input
                type="text"
                className={inputBase}
                {...register("sapid", {
                  maxLength: 20,
                  validate: (value, formValues) => {
                    const regNo = formValues?.registrationno ? String(formValues.registrationno).trim() : "";
                    const sapId = value ? String(value).trim() : "";
                    // If this field has a value, it's valid
                    if (sapId) return true;
                    // If the other field has a value, this one is optional
                    if (regNo) return true;
                    // Both are empty
                    return "Either Registration # or SAP ID is required";
                  }
                })}
              />
              {errors.sapid && <p className="mt-1 text-xs text-red-600">{errors.sapid.message}</p>}
            </div>
            <div>
              <label className={labelBase}>Full Name (as in CNIC) *</label>
              <input type="text" className={inputBase} {...register("alumniname", { required: true, maxLength: 200 })} />
              {errors.alumniname && <p className="mt-1 text-xs text-red-600">Name is required</p>}
            </div>
            <div>
              <label className={labelBase}>Father Name *</label>
              <input type="text" className={inputBase} {...register("fathername", { required: true, maxLength: 200 })} />
              {errors.fathername && <p className="mt-1 text-xs text-red-600">Father name is required</p>}
            </div>
            <div>
              <label className={labelBase}>Gender *</label>
              <select className={inputBase} {...register("gender", { required: true })}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              {errors.gender && <p className="mt-1 text-xs text-red-600">Gender is required</p>}
            </div>
            <div>
              <label className={labelBase}>Date of Birth</label>
              <input
                type="date"
                className={inputBase}
                min="1900-01-01"
                max="9999-12-31"
                onInput={(e) => {
                  const el = e.currentTarget as HTMLInputElement;
                  const v = el.value;
                  const dash = v.indexOf("-");
                  if (dash > 4) {
                    el.value = v.slice(0, 4) + v.slice(dash);
                  } else if (dash === -1 && v.length > 4) {
                    el.value = v.slice(0, 4);
                  }
                }}
                {...register("dateofbirth", { maxLength: 50 })}
              />
            </div>
            
            <div>
              <label className={labelBase}>CNIC/Passport *</label>
              <input type="text" className={inputBase} {...register("cnicpassport", { required: true, maxLength: 50 })} />
              {errors.cnicpassport && <p className="mt-1 text-xs text-red-600">CNIC/Passport is required</p>}
            </div>
            <div>
              <label className={labelBase}>Primary Contact No.*</label>
              <Controller
                name="contactno"
                control={control}
                rules={{ required: true, maxLength: 50 }}
                render={({ field }) => {
                  const { value, onChange, onBlur, name, ref } = field;
                  return (
                    <input
                      type="tel"
                      className={inputBase}
                      placeholder="Enter mobile number"
                      name={name}
                      ref={ref}
                      onBlur={onBlur}
                      value={value ?? ""}
                      onChange={(e) => {
                        const sanitized = sanitizePhoneNumber(e.target.value);
                        onChange(sanitized);
                      }}
                    />
                  );
                }}
              />
              {errors.contactno && <p className="mt-1 text-xs text-red-600">Mobile number is required</p>}
            </div>
            <div>
              <label className={labelBase}>Secondary Contact No.</label>
              <Controller
                name="contactno1"
                control={control}
                rules={{ maxLength: 50 }}
                render={({ field }) => {
                  const { value, onChange, onBlur, name, ref } = field;
                  return (
                    <input
                      type="tel"
                      className={inputBase}
                      placeholder="Enter secondary contact number"
                      name={name}
                      ref={ref}
                      onBlur={onBlur}
                      value={value ?? ""}
                      onChange={(e) => {
                        const sanitized = sanitizePhoneNumber(e.target.value);
                        onChange(sanitized);
                      }}
                    />
                  );
                }}
              />
              {errors.contactno1 && <p className="mt-1 text-xs text-red-600">Secondary contact number is not valid</p>}
            </div>
            <div>
              <label className={labelBase}>Personal Email *</label>
              <input type="email" className={inputBase} placeholder="eg. example@gmail.com" {...register("personalemail", { required: true, maxLength: 100 })} />
              {errors.personalemail && <p className="mt-1 text-xs text-red-600">Valid email is required</p>}
            </div>
            <div>
              <label className={labelBase}>Marital Status</label>
              <select className={inputBase} {...register("maritalstatus")}>
                <option value="">Select</option>
                <option value="Married">Married</option>
                <option value="Un-Married">Un-Married</option>
              </select>
              {errors.maritalstatus && <p className="mt-1 text-xs text-red-600">Marital status is required</p>}
            </div>
            <div className="lg:col-span-3">
              <label className={labelBase}>Home Address</label>
              <textarea rows={1} className={inputBase} {...register("address", { maxLength: 250 })} />
            </div>
            <div>
              <label className={labelBase}>Home Country *</label>
              <Controller
                name="country"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <select 
                    className={inputBase} 
                    {...field}
                    value={field.value || ""}
                  >
                    <option value="">Select</option>
                    {[
                      "Afghanistan",
                      "Albania",
                      "Algeria",
                      "Andorra",
                      "Angola",
                      "Antigua and Barbuda",
                      "Argentina",
                      "Armenia",
                      "Australia",
                      "Austria",
                      "Azerbaijan",
                      "Bahamas",
                      "Bahrain",
                      "Bangladesh",
                      "Barbados",
                      "Belarus",
                      "Belgium",
                      "Belize",
                      "Benin",
                      "Bhutan",
                      "Bolivia",
                      "Bosnia and Herzegovina",
                      "Botswana",
                      "Brazil",
                      "Brunei",
                      "Bulgaria",
                      "Burkina Faso",
                      "Burundi",
                      "Côte d'Ivoire",
                      "Cabo Verde",
                      "Cambodia",
                      "Cameroon",
                      "Canada",
                      "Central African Republic",
                      "Chad",
                      "Chile",
                      "China",
                      "Colombia",
                      "Comoros",
                      "Congo (Congo-Brazzaville)",
                      "Costa Rica",
                      "Croatia",
                      "Cuba",
                      "Cyprus",
                      "Czechia (Czech Republic)",
                      "Democratic Republic of the Congo",
                      "Denmark",
                      "Djibouti",
                      "Dominica",
                      "Dominican Republic",
                      "Ecuador",
                      "Egypt",
                      "El Salvador",
                      "Equatorial Guinea",
                      "Eritrea",
                      "Estonia",
                      "Eswatini (fmr. " + "Swaziland)",
                      "Ethiopia",
                      "Fiji",
                      "Finland",
                      "France",
                      "Gabon",
                      "Gambia",
                      "Georgia",
                      "Germany",
                      "Ghana",
                      "Greece",
                      "Grenada",
                      "Guatemala",
                      "Guinea",
                      "Guinea-Bissau",
                      "Guyana",
                      "Haiti",
                      "Holy See",
                      "Honduras",
                      "Hungary",
                      "Iceland",
                      "India",
                      "Indonesia",
                      "Iran",
                      "Iraq",
                      "Ireland",
                      "Israel",
                      "Italy",
                      "Jamaica",
                      "Japan",
                      "Jordan",
                      "Kazakhstan",
                      "Kenya",
                      "Kiribati",
                      "Kuwait",
                      "Kyrgyzstan",
                      "Laos",
                      "Latvia",
                      "Lebanon",
                      "Lesotho",
                      "Liberia",
                      "Libya",
                      "Liechtenstein",
                      "Lithuania",
                      "Luxembourg",
                      "Madagascar",
                      "Malawi",
                      "Malaysia",
                      "Maldives",
                      "Mali",
                      "Malta",
                      "Marshall Islands",
                      "Mauritania",
                      "Mauritius",
                      "Mexico",
                      "Micronesia",
                      "Moldova",
                      "Monaco",
                      "Mongolia",
                      "Montenegro",
                      "Morocco",
                      "Mozambique",
                      "Myanmar (formerly Burma)",
                      "Namibia",
                      "Nauru",
                      "Nepal",
                      "Netherlands",
                      "New Zealand",
                      "Nicaragua",
                      "Niger",
                      "Nigeria",
                      "North Korea",
                      "North Macedonia",
                      "Norway",
                      "Oman",
                      "Pakistan",
                      "Palau",
                      "Palestine State",
                      "Panama",
                      "Papua New Guinea",
                      "Paraguay",
                      "Peru",
                      "Philippines",
                      "Poland",
                      "Portugal",
                      "Qatar",
                      "Romania",
                      "Russia",
                      "Rwanda",
                      "Saint Kitts and Nevis",
                      "Saint Lucia",
                      "Saint Vincent and the Grenadines",
                      "Samoa",
                      "San Marino",
                      "Sao Tome and Principe",
                      "Saudi Arabia",
                      "Senegal",
                      "Serbia",
                      "Seychelles",
                      "Sierra Leone",
                      "Singapore",
                      "Slovakia",
                      "Slovenia",
                      "Solomon Islands",
                      "Somalia",
                      "South Africa",
                      "South Korea",
                      "South Sudan",
                      "Spain",
                      "Sri Lanka",
                      "Sudan",
                      "Suriname",
                      "Sweden",
                      "Switzerland",
                      "Syria",
                      "Tajikistan",
                      "Tanzania",
                      "Thailand",
                      "Timor-Leste",
                      "Togo",
                      "Tonga",
                      "Trinidad and Tobago",
                      "Tunisia",
                      "Turkey",
                      "Turkmenistan",
                      "Tuvalu",
                      "Uganda",
                      "Ukraine",
                      "United Arab Emirates",
                      "United Kingdom",
                      "United States",
                      "Uruguay",
                      "Uzbekistan",
                      "Vanuatu",
                      "Venezuela",
                      "Vietnam",
                      "Yemen",
                      "Zambia",
                      "Zimbabwe",
                      "Other"
                    ].map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.country && <p className="mt-1 text-xs text-red-600">Country is required</p>}
            </div>
            {selectedHomeCountry === "Pakistan" && (
              <div>
                <label className={labelBase}> Home Province *</label>
                <select 
                  className={inputBase} 
                  {...register("province", { required: true })}
                  key={`province-${selectedHomeCountry || "none"}`}
                > 
                  <option value="">Select</option>
                  {homeProvinceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.province && (
                  <p className="mt-1 text-xs text-red-600">Province is required</p>
                )}
              </div>
            )}
            <div>
              <label className={labelBase}>Home City *</label>
              {selectedHomeCountry === "Pakistan" && !selectedHomeProvince ? (
                <div className="mt-1 p-2 rounded border border-gray-300 bg-gray-50 text-sm text-gray-500">
                  Please select a province first
                </div>
              ) : (
                <>
                  <Controller
                    name="homeCity"
                    control={control}
                    rules={{
                      required: "City is required",
                      maxLength: {
                        value: 50,
                        message: "City must be 50 characters or less"
                      }
                    }}
                    render={({ field }) => (
                      <input
                        type="text"
                        className={inputBase}
                        list={selectedHomeCountry === "Pakistan" && selectedHomeProvince ? "home-city-datalist" : undefined}
                        placeholder={selectedHomeCountry === "Pakistan" ? "Select from list or type your city" : "Enter city name"}
                        value={field.value || ""}
                        name={field.name}
                        ref={(e) => {
                          field.ref(e);
                          homeCityInputRef.current = e;
                        }}
                        onFocus={() => {
                          isTypingHomeCityRef.current = true;
                        }}
                        onChange={(e) => {
                          isTypingHomeCityRef.current = true;
                          field.onChange(e);
                        }}
                        onBlur={() => {
                          isTypingHomeCityRef.current = false;
                          field.onBlur();
                        }}
                      />
                    )}
                  />
                  {selectedHomeCountry === "Pakistan" && selectedHomeProvince && (
                    <datalist id="home-city-datalist">
                      {homeProvinceCities.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  )}
                </>
              )}
              {errors.homeCity && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.homeCity.message || "City is required"}
                </p>
              )}
            </div>
          </div>
        </section>

      {/* Section 2: Academic Information */}
      <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Academic Information</h2>
          <p className="mt-1 text-xs text-neutral-600">Fields marked with * are required.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelBase}>Campus *</label>
              <select className={inputBase} {...register("campusname", { required: true })}>
                <option value="">Select</option>
                <option value="Lahore">Lahore</option>
                <option value="Sargodha">Sargodha</option>
                <option value="Islamabad">Islamabad</option>
                <option value="Pakpattan">Pakpattan</option>
              </select>
              {errors.campusname && <p className="mt-1 text-xs text-red-600">Campus is required</p>}
            </div>
            <div>
              <label className={labelBase}>Faculty *</label>
              {!facultyOtherSelected ? (
              <select 
                className={inputBase} 
                  {...register("faculty", { 
                    required: true,
                    valueAsNumber: true,
                    onChange: (e) => {
                      const selectedId = e.target.value;
                      if (selectedId === "other") {
                        setFacultyOtherSelected(true);
                        setValue("faculty", null, { shouldValidate: false, shouldDirty: false });
                        return;
                      }
                      
                      // Reset department and program when faculty changes
                      setValue("department", null);
                      setValue("program", null);
                      setValue("degreetitle", "");
                      setDepartmentOtherSelected(false);
                    }
                  })}
                disabled={loadingDbData || (userAccess ? (!userAccess.isSuperAdmin && dbFaculties.length === 0) : false)}
              >
                <option value="">
                  {loadingDbData ? "Loading..." : 
                   userAccess && !userAccess.isSuperAdmin && dbFaculties.length === 0 
                     ? "No access to any faculty" 
                     : "Select"}
                </option>
                {dbFaculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                ))}
                  <option value="other">Other</option>
              </select>
              ) : (
                <>
                  <Controller
                    name="facultyname"
                    control={control}
                    rules={{ 
                      required: "Please specify your faculty",
                      maxLength: 200 
                    }}
                    render={({ field }) => (
                      <input 
                        type="text" 
                        className={inputBase} 
                        value={field.value || ""}
                        onChange={(e) => {
                          isTypingFacultyOther.current = true;
                          field.onChange(e);
                        }}
                        onBlur={() => {
                          isTypingFacultyOther.current = false;
                          field.onBlur();
                        }}
                        name={field.name}
                        ref={field.ref}
                        placeholder="Enter faculty name"
                        autoFocus
                      />
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFacultyOtherSelected(false);
                      setValue("facultyname", "");
                    }}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    ← Back to faculty list
                  </button>
                </>
              )}
              {errors.faculty && (
                <p className="mt-1 text-xs text-red-600">{errors.faculty.message || "Faculty is required"}</p>
              )}
            </div>
            <div>
              <label className={labelBase}>Department *</label>
              {!departmentOtherSelected ? (
              <select 
                className={inputBase} 
                  {...register("department", { 
                    required: true,
                    valueAsNumber: true,
                    onChange: (e) => {
                      const selectedId = e.target.value;
                      if (selectedId === "other") {
                        isTypingDepartmentOther.current = true;
                        setDepartmentOtherSelected(true);
                        setValue("department", null, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
                        setTimeout(() => {
                          isTypingDepartmentOther.current = false;
                        }, 100);
                        return;
                      }
                      
                      // Reset program when department changes
                      setValue("program", null);
                      setValue("degreetitle", "");
                    }
                  })}
                disabled={loadingDbData || !watch("faculty") || (userAccess ? (!userAccess.isSuperAdmin && dbDepartments.length === 0) : false)}
              >
                <option value="">
                  {loadingDbData ? "Loading..." :
                   !watch("faculty") ? "Select Faculty first" :
                   userAccess && !userAccess.isSuperAdmin && dbDepartments.length === 0 
                     ? "No access to any department in this faculty" 
                     : "Select"}
                </option>
                {dbDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                  <option value="other">Other</option>
              </select>
              ) : (
                <>
                  <Controller
                    name="departmentname"
                    control={control}
                    rules={{ 
                      required: "Please specify your department",
                      maxLength: 200 
                    }}
                    render={({ field }) => (
                      <input 
                        type="text" 
                        className={inputBase} 
                        value={field.value || ""}
                        onChange={(e) => {
                          isTypingDepartmentOther.current = true;
                          field.onChange(e);
                        }}
                        onBlur={() => {
                          isTypingDepartmentOther.current = false;
                          field.onBlur();
                        }}
                        name={field.name}
                        ref={field.ref}
                        placeholder="Enter department name"
                        autoFocus
                      />
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDepartmentOtherSelected(false);
                      setValue("departmentname", "");
                    }}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    ← Back to department list
                  </button>
                </>
              )}
              {errors.department && (
                <p className="mt-1 text-xs text-red-600">{errors.department.message || "Department is required"}</p>
              )}
            </div>
            <div>
              <label className={labelBase}>Program *</label>
              <input 
                type="text" 
                className={inputBase} 
                placeholder="Enter program name"
                {...register("degreetitle", { required: true, maxLength: 200 })} 
              />
              {errors.degreetitle && <p className="mt-1 text-xs text-red-600">Program is required</p>}
            </div>
            <div>
              <label className={labelBase}>Admission Year *</label>
              <select className={inputBase} {...register("yearofstarting", { required: true, valueAsNumber: true })}>
                <option value="">Select</option>
                {admissionYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {errors.yearofstarting && <p className="mt-1 text-xs text-red-600">Admission year is required</p>}
            </div>
             <div>
              <label className={labelBase}>Passing Out Year *</label>
              <select className={inputBase} {...register("yearofending", { required: true, valueAsNumber: true })}>
                <option value="">Select</option>
                {passingYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {errors.yearofending && <p className="mt-1 text-xs text-red-600">Passing out year is required</p>}
            </div>
            <div>
              <label className={labelBase}>CGPA (Optional)</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                max="4"
                className={inputBase} 
                placeholder="e.g. 3.50"
                {...register("cgpa", { 
                  valueAsNumber: true,
                  min: { value: 0, message: "CGPA must be 0 or greater" },
                  max: { value: 4, message: "CGPA must be 4 or less" }
                })} 
              />
              {errors.cgpa && <p className="mt-1 text-xs text-red-600">{errors.cgpa.message}</p>}
            </div>
            <div>
              <label className={labelBase}>Major Subject (Optional)</label>
              <input 
                type="text" 
                className={inputBase} 
                placeholder="Enter major subject"
                {...register("majorsubject", { maxLength: 200 })} 
              />
              {errors.majorsubject && <p className="mt-1 text-xs text-red-600">{errors.majorsubject.message}</p>}
            </div>
          </div>
        </section>

      {/* Section 3: Work Status */}
      <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Occupation Details</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="mt-2 flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Employed/Business" {...register("employeed")} /> Employed/Business
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Self-employed" {...register("employeed")} /> Self-employed
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Pursuing Higher Education" {...register("employeed")} /> Pursuing Higher Education
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Unemployed By choice" {...register("employeed")} /> Unemployed By choice
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Unemployed, searching for job" defaultChecked {...register("employeed")} /> Unemployed, searching for job
                </label>
              </div>
            </div>

            {/* Employed Fields */}
            {((employeedVal || "").toLowerCase() === "employed/business" || (employeedVal || "").toLowerCase() === "self-employed") && (
              <>
                {/* Sector = industry */}
                <div>
                  <label className={labelBase}>Sector *</label>
                  <input
                    type="text"
                      className={inputBase} 
                    list="sector-options"
                    placeholder="Select from list or type your sector"
                      {...register("industry", { 
                      required: "Sector is required",
                      maxLength: 100 
                    })}
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
                  {errors.industry && (
                    <p className="mt-1 text-xs text-red-600">{errors.industry.message || "Sector is required"}</p>
                  )}
                </div>

                {/* Start of Career */}
                <div>
                  <label className={labelBase}>Start of Career *</label>
                      <input 
                    type="date" 
                        className={inputBase} 
                    min="1900-01-01"
                    max={new Date().toISOString().split('T')[0]}
                    {...register("startOfCareer", { required: true })} 
                  />
                  {errors.startOfCareer && (
                    <p className="mt-1 text-xs text-red-600">Start of career date is required</p>
                  )}
                </div>

                {/* Current Organization / Business Name */}
                <div>
                  <label className={labelBase}>
                    {(employeedVal || "").toLowerCase() === "self-employed" ? "Business Name *" : "Current Organization *"}
                  </label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business name" : "Enter organization name"}
                    {...register("nameoforganization", { required: true, maxLength: 100 })} 
                  />
                  {errors.nameoforganization && (
                    <p className="mt-1 text-xs text-red-600">
                      {(employeedVal || "").toLowerCase() === "self-employed" ? "Business name is required" : "Current organization is required"}
                    </p>
                  )}
                </div>

                {/* Current Designation */}
                <div>
                  <label className={labelBase}>Current Designation *</label>
                  <input type="text" className={inputBase} placeholder="Enter your designation" {...register("designation", { required: true, maxLength: 100 })} />
                  {errors.designation && (
                    <p className="mt-1 text-xs text-red-600">Current designation is required</p>
                  )}
                </div>

                {/* Work Email */}
                <div>
                  <label className={labelBase}>
                    {(employeedVal || "").toLowerCase() === "self-employed" ? "Business Email *" : "Work Email *"}
                  </label>
                  <input 
                    type="email" 
                    className={inputBase} 
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business email" : "Enter work email"}
                    {...register("officialemail", { 
                      required: true, 
                      maxLength: 100,
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Please enter a valid email address (must contain @)"
                      }
                    })} 
                  />
                  {errors.officialemail && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.officialemail.message || ((employeedVal || "").toLowerCase() === "self-employed" ? "Business email is required" : "Work email is required")}
                    </p>
                  )}
                </div>

                {/* Work Phone */}
                <div>
                  <label className={labelBase}>
                    {(employeedVal || "").toLowerCase() === "self-employed" ? "Business Phone *" : "Work Phone *"}
                  </label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business phone" : "Enter work phone"}
                    {...register("officialnumber", { required: true, maxLength: 50 })} 
                  />
                  {errors.officialnumber && (
                    <p className="mt-1 text-xs text-red-600">
                      {(employeedVal || "").toLowerCase() === "self-employed" ? "Business phone is required" : "Work phone is required"}
                    </p>
                  )}
                </div>

                {/* Work Address */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className={labelBase}>
                    {(employeedVal || "").toLowerCase() === "self-employed" ? "Business Address *" : "Work Address *"}
                  </label>
                  <textarea 
                    className={inputBase} 
                    rows={3}
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business address" : "Enter work address"}
                    {...register("organization_address", { required: true, maxLength: 500 })} 
                  />
                  {errors.organization_address && (
                    <p className="mt-1 text-xs text-red-600">
                      {(employeedVal || "").toLowerCase() === "self-employed" ? "Business address is required" : "Work address is required"}
                    </p>
                  )}
                </div>
                {/* Work City */}
                <div>
                  <label className={labelBase}>{(employeedVal || "").toLowerCase() === "self-employed" ? "Business City *" : "Work City *"}</label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business city" : "Enter work city name"}
                    {...register("workCity", { 
                      required: true
                    })} 
                  />
                  {errors.workCity && (
                    <p className="mt-1 text-xs text-red-600">{(employeedVal || "").toLowerCase() === "self-employed" ? "Business city is required" : "Work city is required"}</p>
                  )}
                </div>
                {/* Work Country */}
                <div>
                  <label className={labelBase}>{(employeedVal || "").toLowerCase() === "self-employed" ? "Business Country *" : "Work Country *"}</label>
                  <input
                    type="text"
                        className={inputBase} 
                    list="work-country-options"
                    placeholder="Select from list or type your country"
                    {...register("workCountry", { 
                      required: "Work country is required",
                      maxLength: 100 
                    })}
                  />
                  <datalist id="work-country-options">
                    {allCountries.map((country) => (
                      <option key={country} value={country} />
                    ))}
                  </datalist>
                  {errors.workCountry && (
                    <p className="mt-1 text-xs text-red-600">{errors.workCountry.message || "Work country is required"}</p>
                  )}
                </div>
              </>
            )}

            {/* Pursuing Higher Education Fields */}
            {(employeedVal || "").toLowerCase() === "pursuing higher education" && (
              <>
                <div>
                  <label className={labelBase}>Institution Name *</label>
                  <input type="text" className={inputBase} placeholder="e.g. University Name" {...register("highereducationinstitute", { required: true, maxLength: 200 })} />
                  {errors.highereducationinstitute && (
                    <p className="mt-1 text-xs text-red-600">Institution name is required</p>
                  )}
                </div>

                <div>
                  <label className={labelBase}>Program Enrolled *</label>
                  <input
                    type="text"
                    className={inputBase}
                    placeholder="e.g. MS (Master of Science), PhD (Doctor of Philosophy), MBA, LLM, etc"
                    {...register("highereducationprogram", { required: "Program enrolled is required", maxLength: 100 })}
                  />
                  {errors.highereducationprogram && (
                    <p className="mt-1 text-xs text-red-600">{errors.highereducationprogram.message || "Program enrolled is required"}</p>
                  )}
                </div>

                <div>
                  <label className={labelBase}>Funding Source *</label>
                  <select className={inputBase} {...register("scholarship", { required: true })}>
                    <option value="">Select</option>
                    <option value="Full Scholarship">Full Scholarship</option>
                    <option value="Partial Scholarship">Partial Scholarship</option>
                    <option value="Self Paid">Self Paid</option>
                  </select>
                  {errors.scholarship && (
                    <p className="mt-1 text-xs text-red-600">Funding source is required</p>
                  )}
                </div>

                <div>
                  <label className={labelBase}>Institution City *</label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    {...register("workCity", { 
                      required: "Institution city is required", 
                      maxLength: 50,
                      validate: (value) => {
                        if (!value || String(value).trim() === "") {
                          return "Institution city is required";
                        }
                        return true;
                      }
                    })} 
                    placeholder="e.g. Lahore"
                  />
                  {errors.workCity && (
                    <p className="mt-1 text-xs text-red-600">{errors.workCity.message || "Institution city is required"}</p>
                  )}
                </div>

                <div>
                  <label className={labelBase}>Institution Country *</label>
                  <input
                    type="text"
                        className={inputBase} 
                    list="institution-country-options"
                    placeholder="Select from list or type your country"
                    {...register("workCountry", { 
                      required: "Institution country is required",
                      maxLength: 100 
                    })}
                  />
                  <datalist id="institution-country-options">
                    {allCountries.map((country) => (
                      <option key={country} value={country} />
                    ))}
                  </datalist>
                  {errors.workCountry && (
                    <p className="mt-1 text-xs text-red-600">{errors.workCountry.message || "Institution country is required"}</p>
                  )}
                </div>

              </>
            )}

            {/* Unemployed Fields - No additional fields needed as reason is in the radio button value */}
          </div>
          <div className="sm:col-span-2 lg:col-span-3 mt-4">
            <label className={labelBase}>About Me (Optional)</label>
            <textarea className={inputBase} {...register("aboutme")} />
          </div>
        </section>

      {/* Section 4: Social Links */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-800">Social Links(Optional)</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelBase}>Facebook</label>
            <input
              type="url"
              className={inputBase}
              placeholder="https://facebook.com/yourprofile"
              {...register("facebook", { maxLength: 200 })}
            />
            {errors.facebook && <p className="mt-1 text-xs text-red-600">{errors.facebook.message}</p>}
          </div>
          <div>
            <label className={labelBase}>Instagram</label>
            <input
              type="url"
              className={inputBase}
              placeholder="https://instagram.com/yourprofile"
              {...register("instagram", { maxLength: 200 })}
            />
            {errors.instagram && <p className="mt-1 text-xs text-red-600">{errors.instagram.message}</p>}
          </div>
          <div>
            <label className={labelBase}>YouTube</label>
            <input
              type="url"
              className={inputBase}
              placeholder="https://youtube.com/@yourchannel"
              {...register("youtube", { maxLength: 200 })}
            />
            {errors.youtube && <p className="mt-1 text-xs text-red-600">{errors.youtube.message}</p>}
          </div>
          <div>
            <label className={labelBase}>LinkedIn</label>
            <input
              type="url"
              className={inputBase}
              placeholder="https://linkedin.com/in/yourprofile"
              {...register("linkedin", { maxLength: 200 })}
            />
            {errors.linkedin && <p className="mt-1 text-xs text-red-600">{errors.linkedin.message}</p>}
          </div>
        </div>
      </section>

      {/* Section 5: Alumni Chapters */}
      {!excludeAdminStep && (
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-800">Alumni Chapters</h2>
        <p className="mt-1 text-xs text-neutral-600">Select up to 3 chapters to join (optional).</p>
        <div className="mt-4 space-y-4">
          {isLoadingChapters ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600"></div>
              <span className="ml-2 text-sm text-neutral-600">Loading chapters...</span>
            </div>
          ) : (
            <>
              {/* National Chapters */}
              {chapters.filter(ch => ch.type === "national").length > 0 && (
                <div>
                  <label className={labelBase}>National Chapters</label>
                  <select
                    className={inputBase}
                    value=""
                    onChange={(e) => {
                      const chapterId = Number(e.target.value);
                      if (chapterId && !selectedChapters.includes(chapterId)) {
                        if (selectedChapters.length < 3) {
                          setSelectedChapters([...selectedChapters, chapterId]);
                        } else {
                          toast.error("You can select up to 3 chapters only.", {
                            duration: 3000,
                          });
                        }
                      }
                    }}
                  >
                    <option value="">Select a national chapter</option>
                    {chapters
                      .filter(ch => ch.type === "national")
                      .map((chapter) => (
                        <option key={chapter.id} value={chapter.id} disabled={selectedChapters.includes(chapter.id)}>
                          {chapter.name} {selectedChapters.includes(chapter.id) ? "(Selected)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* International Chapters */}
              {chapters.filter(ch => ch.type === "international").length > 0 && (
                <div>
                  <label className={labelBase}>International Chapters</label>
                  <select
                    className={inputBase}
                    value=""
                    onChange={(e) => {
                      const chapterId = Number(e.target.value);
                      if (chapterId && !selectedChapters.includes(chapterId)) {
                        if (selectedChapters.length < 3) {
                          setSelectedChapters([...selectedChapters, chapterId]);
                        } else {
                          toast.error("You can select up to 3 chapters only.", {
                            duration: 3000,
                          });
                        }
                      }
                    }}
                  >
                    <option value="">Select an international chapter</option>
                    {chapters
                      .filter(ch => ch.type === "international")
                      .map((chapter) => (
                        <option key={chapter.id} value={chapter.id} disabled={selectedChapters.includes(chapter.id)}>
                          {chapter.name} {selectedChapters.includes(chapter.id) ? "(Selected)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Selected Chapters Display */}
              {selectedChapters.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-600 mb-2">
                    Selected chapters ({selectedChapters.length}/3):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedChapters.map((chapterId) => {
                      const chapter = chapters.find(ch => ch.id === chapterId);
                      if (!chapter) return null;
                      return (
                        <span
                          key={chapterId}
                          className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                        >
                          {chapter.name}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChapters(selectedChapters.filter(id => id !== chapterId));
                            }}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      )}

      {/* Section 6: Admin Section */}
      {!excludeAdminStep && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Admin Section</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelBase}>Source</label>
              <select className={inputBase} {...register("datasource")}> 
                <option value="">Select</option>
                <option value="Website">Website</option>
                <option value="Form">Form</option>
                <option value="Import">Import</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" {...register("verify")} />
              <label className={labelBase}>Verify</label>
              <p className="ml-2 text-xs text-neutral-600">Stored as a string flag on server (Yes/No).</p>
            </div>
            <div>
              <label className={labelBase}>Alumni Status</label>
              <select className={inputBase} {...register("alumnistatus")}> 
                <option value="">Select</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
            <div>
              <label className={labelBase}>Alumni Category</label>
              <select className={inputBase} {...register("category")}> 
                <option value="">Select</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Submit and Reset Buttons */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60">Submit</button>
        <button type="button" disabled={submitting} onClick={() => { reset(); setSelectedChapters([]); }} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50">Reset</button>
      </div>
    </form>
  );
}