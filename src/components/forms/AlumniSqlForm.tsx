"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  getDepartmentsByFaculty,
  getProgramsByFacultyAndDepartment,
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
  facultyname: string | null;
  campusname: string | null;
  departmentname: string | null;
  majorsubject: string | null;
  industry: string | null;
  employeed: string | null;
  reason_of_unemployment: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
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
  higher_education_institute_email: string | null;
  higher_education_intiture_number: string | null;
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

// Constant list of Pakistan provinces for validation
const PAKISTAN_PROVINCES = ["Punjab", "Sindh", "KPK", "Balochistan", "Islamabad", "GB", "AJK"];

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
      facultyname: null,
      campusname: null,
      departmentname: null,
      majorsubject: null,
      industry: null,
      employeed: "Unemployed",
      reason_of_unemployment: null,
      nameoforganization: null,
      designation: null,
      totalyearsofexpereince: null,
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
  const [provinceCustomInput, setProvinceCustomInput] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [homeCitySearch, setHomeCitySearch] = useState("");
  const [showHomeCityDropdown, setShowHomeCityDropdown] = useState(false);
  const isTypingCityRef = useRef(false);
  const lastSetCityValueRef = useRef<string | null>(null);
  const [sectorOtherSelected, setSectorOtherSelected] = useState(false);
  const [userAccess, setUserAccess] = useState<{
    isSuperAdmin: boolean;
    faculties: string[];
    departments: string[];
    programs: string[];
  } | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [chapters, setChapters] = useState<Array<{ id: number; name: string; type: "national" | "international" }>>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);

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
      } finally {
        setLoadingAccess(false);
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
  const employeedVal = (watch("employeed") || "Unemployed") as string;
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

  // Filter programs based on user access, selected faculty and department
  const programOptions = useMemo(() => {
    if (!selectedFaculty || !selectedDepartment || selectedDepartment === "other") {
      return [];
    }
    const allPrograms = getProgramsByFacultyAndDepartment(selectedFaculty, selectedDepartment);
    if (!userAccess || userAccess.isSuperAdmin) {
      return allPrograms;
    }
    if (userAccess.programs.length === 0) {
      // If no program-level access, check if we have department-level access
      if (userAccess.departments.some(d => 
        d.toLowerCase().trim() === selectedDepartment.toLowerCase().trim()
      )) {
        return allPrograms; // Show all programs in the department
      }
      return [];
    }
    // Filter programs that are in the selected department AND in user's access
    return allPrograms.filter(p => 
      userAccess.programs.some(ap => ap.toLowerCase().trim() === p.toLowerCase().trim())
    );
  }, [selectedFaculty, selectedDepartment, userAccess]);
  
  // Get cities for selected province (for home city)
  const homeProvinceCities = useMemo(() => {
    if (selectedHomeCountry === "Pakistan" && selectedHomeProvince) {
      return getCitiesByProvince(selectedHomeProvince);
    }
    return [];
  }, [selectedHomeCountry, selectedHomeProvince]);
  
  // Filter cities based on search input and selected province (for home city)
  const filteredHomeCities = useMemo(() => {
    // If no province selected, show no cities
    if (selectedHomeCountry === "Pakistan" && !selectedHomeProvince) {
      return [];
    }
    
    // If province is selected, filter cities from that province
    if (selectedHomeCountry === "Pakistan" && selectedHomeProvince && homeProvinceCities.length > 0) {
      if (!homeCitySearch.trim()) {
        return homeProvinceCities; // Show all cities if no search text
      }
      const searchLower = homeCitySearch.toLowerCase();
      return homeProvinceCities.filter(city => 
        city.toLowerCase().includes(searchLower)
      );
    }
    
    return [];
  }, [homeCitySearch, selectedHomeCountry, selectedHomeProvince, homeProvinceCities]);

  
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
    setValue("departmentname", "");
    setValue("degreetitle", "");
  }, [selectedFaculty, setValue]);

  // Reset program when department changes
  useEffect(() => {
    setValue("degreetitle", "");
  }, [selectedDepartment, setValue]);
  
  // Reset sector "Other" state when employment status changes
  useEffect(() => {
    if ((employeedVal || "").toLowerCase() !== "employed") {
      setSectorOtherSelected(false);
    }
  }, [employeedVal]);

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
      setHomeCitySearch("");
      setProvinceCustomInput(false);
      isTypingCityRef.current = false;
      lastSetCityValueRef.current = null;
    } else if (selectedHomeCountry === "Pakistan") {
      // If switching back to Pakistan, also reset province if it's "Not applicable"
      const currentProvince = watch("province");
      if (currentProvince === "Not applicable" || (currentProvince && !homeProvinceOptions.find(opt => opt.value === currentProvince))) {
        setValue("province", "", { shouldValidate: false });
        setProvinceCustomInput(false);
      }
    } else {
      setProvinceCustomInput(false);
    }
  }, [selectedHomeCountry, setValue, watch, homeProvinceOptions]);
  
  // Reset home city when province changes
  useEffect(() => {
    if (selectedHomeCountry === "Pakistan" && selectedHomeProvince) {
      // Only reset if current city is not in the new province's cities
      const currentCity = selectedHomeCity || "";
      const validCities = getCitiesByProvince(selectedHomeProvince);
      if (currentCity && !validCities.includes(currentCity)) {
        setValue("homeCity", "");
        setHomeCitySearch("");
        isTypingCityRef.current = false;
        lastSetCityValueRef.current = null;
      }
    } else if (selectedHomeCountry === "Pakistan" && !selectedHomeProvince) {
      // Clear city if province is cleared
      setValue("homeCity", "");
      setHomeCitySearch("");
      isTypingCityRef.current = false;
      lastSetCityValueRef.current = null;
    }
  }, [selectedHomeProvince, selectedHomeCountry, selectedHomeCity, setValue]);
  
  // Initialize homeCitySearch from form value ONLY on mount or when province changes
  // Never sync during typing to prevent input reset
  useEffect(() => {
    if (selectedHomeCountry === "Pakistan" && selectedHomeProvince && selectedHomeCity && !isTypingCityRef.current) {
      const cityStr = String(selectedHomeCity).trim();
      // Only sync if search is empty (initial load) or if it's completely different (province change)
      if (homeCitySearch === "" || (homeCitySearch !== cityStr && lastSetCityValueRef.current !== cityStr)) {
        setHomeCitySearch(cityStr);
        lastSetCityValueRef.current = cityStr;
      }
    } else if (!selectedHomeCity && !isTypingCityRef.current && homeCitySearch !== "") {
      // Clear search only if not typing and form value is cleared
      setHomeCitySearch("");
      lastSetCityValueRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHomeProvince]); // Only depend on province, NOT on homeCity to avoid interference


  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      "facultyname",
      "departmentname",
      "degreetitle",
      "yearofstarting",
      "yearofending",
    ]);
    if (!academicOk) return false;

    // Validate Work Status section
    const workFieldsToValidate: Array<keyof TblAlumniForm> = ["employeed"];
    
    // Only validate work fields if employed or self-employed
    if ((employeedVal || "").toLowerCase() === "employed" || (employeedVal || "").toLowerCase() === "self-employed") {
      workFieldsToValidate.push("industry", "nameoforganization", "designation", "totalyearsofexpereince", "workCity", "workCountry");
    }
    
    // Validate higher education fields if pursuing higher education
    if ((employeedVal || "").toLowerCase() === "pursuing higher education") {
      workFieldsToValidate.push("highereducationdegreetitle", "highereducationinstitute", "highereducationprogram", "workCity", "workCountry");
    }
    
    // Validate unemployed reason if unemployed
    if ((employeedVal || "").toLowerCase() === "unemployed") {
      workFieldsToValidate.push("reason_of_unemployment");
    }
    
    const workOk = await trigger(workFieldsToValidate);
    if (!workOk) return false;
    
    // Conditional: when employed or self-employed, industry/org/designation/experience required
    if ((employeedVal || "").toLowerCase() === "employed" || (employeedVal || "").toLowerCase() === "self-employed") {
      const fields: Array<keyof TblAlumniForm> = [
        "industry",
        "nameoforganization",
        "designation",
        "totalyearsofexpereince",
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
        "highereducationdegreetitle",
        "highereducationinstitute",
        "highereducationprogram",
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
    
    // Conditional: when unemployed, validate reason of unemployment
    if ((employeedVal || "").toLowerCase() === "unemployed") {
      const reason = watch("reason_of_unemployment");
      if (!reason || String(reason).trim() === "") {
        setError("reason_of_unemployment", { type: "required", message: "Please select a reason for unemployment" });
        return false;
      }
    }

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
              <label className={labelBase}>Mobile No.*</label>
              <input type="tel" className={inputBase} placeholder="Enter mobile number"  {...register("contactno", { required: true, maxLength: 50 })} />
              {errors.contactno && <p className="mt-1 text-xs text-red-600">Mobile number is required</p>}
            </div>
            <div>
              <label className={labelBase}>Secondary Contact No.</label>
              <input type="tel" className={inputBase} placeholder="Enter secondary contact number"  {...register("contactno1", { maxLength: 50 })} />
              {errors.contactno1 && <p className="mt-1 text-xs text-red-600">Secondary contact number is not valid</p>}
            </div>
            <div>
              <label className={labelBase}>Personal Email *</label>
              <input type="email" className={inputBase} placeholder="eg. example@gmail.com" {...register("personalemail", { required: true, maxLength: 100 })} />
              {errors.personalemail && <p className="mt-1 text-xs text-red-600">Valid email is required</p>}
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
            <div className="relative">
              <label className={labelBase}>Home City *</label>
              {selectedHomeCountry === "Pakistan" ? (
                <>
                  {!selectedHomeProvince ? (
                    <div className="mt-1 p-2 rounded border border-gray-300 bg-gray-50 text-sm text-gray-500">
                      Please select a province first
                    </div>
                  ) : (
                    <Controller
                      name="homeCity"
                      control={control}
                      rules={{ 
                        required: "City is required",
                        maxLength: {
                          value: 50,
                          message: "City must be 50 characters or less"
                        },
                        validate: (value) => {
                          const val = value ? String(value).trim() : "";
                          if (val === "" || val.length === 0) {
                            return "City is required";
                          }
                          return true;
                        }
                      }}
                      render={({ field }) => (
                        <>
                          <input 
                            type="text" 
                            className={inputBase} 
                            value={homeCitySearch || ""}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              isTypingCityRef.current = true;
                              setHomeCitySearch(newValue);
                              setShowHomeCityDropdown(true);
                              
                              // Always update form value immediately to allow free text entry
                              field.onChange(newValue);
                              lastSetCityValueRef.current = newValue;
                              
                              // If exact match found, close dropdown
                              const trimmedValue = newValue.trim();
                              const matchingCity = homeProvinceCities.find(c => c.toLowerCase() === trimmedValue.toLowerCase());
                              if (matchingCity) {
                                setShowHomeCityDropdown(false);
                                isTypingCityRef.current = false;
                                setTimeout(() => trigger("homeCity"), 0);
                              }
                            }}
                            onFocus={() => {
                              if (selectedHomeProvince) {
                                setShowHomeCityDropdown(true);
                              }
                            }}
                            onBlur={(e) => {
                              // Don't close if clicking inside dropdown
                              const relatedTarget = e.relatedTarget as HTMLElement;
                              if (relatedTarget && relatedTarget.closest('.home-city-dropdown')) {
                                return;
                              }
                              // Delay to allow dropdown click
                              setTimeout(() => {
                                isTypingCityRef.current = false;
                                setShowHomeCityDropdown(false);
                                const trimmedSearch = homeCitySearch.trim();
                                
                                // If empty, clear the field
                                if (trimmedSearch === "") {
                                  lastSetCityValueRef.current = "";
                                  field.onChange("");
                                  setHomeCitySearch("");
                                } else {
                                  // Accept whatever was typed (could be from list or custom)
                                  // Normalize: if exact match exists, use the normalized version from list
                                  const exactMatch = homeProvinceCities.find(c => c.toLowerCase() === trimmedSearch.toLowerCase());
                                  if (exactMatch) {
                                    lastSetCityValueRef.current = exactMatch;
                                    field.onChange(exactMatch);
                                    setHomeCitySearch(exactMatch);
                                  } else {
                                    // Accept custom typed value as-is
                                    lastSetCityValueRef.current = trimmedSearch;
                                    field.onChange(trimmedSearch);
                                    setHomeCitySearch(trimmedSearch);
                                  }
                                  // Trigger validation
                                  setTimeout(() => {
                                    trigger("homeCity");
                                  }, 0);
                                }
                              }, 200);
                            }}
                            placeholder={`Select from list or type custom city name...`}
                            disabled={!selectedHomeProvince}
                            list="home-city-datalist"
                          />
                          <datalist id="home-city-datalist">
                            {homeProvinceCities.map((city) => (
                              <option key={city} value={city} />
                            ))}
                          </datalist>
                          {showHomeCityDropdown && selectedHomeProvince && filteredHomeCities.length > 0 && (
                            <div className="home-city-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {filteredHomeCities.map((city) => (
                                <button
                                  key={city}
                                  type="button"
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent input blur
                                    isTypingCityRef.current = false;
                                    lastSetCityValueRef.current = city;
                                    setHomeCitySearch(city);
                                    field.onChange(city);
                                    setShowHomeCityDropdown(false);
                                    // Trigger validation to clear any error messages
                                    setTimeout(() => {
                                      trigger("homeCity");
                                    }, 0);
                                  }}
                                >
                                  {city}
                                </button>
                              ))}
                            </div>
                          )}
                          {showHomeCityDropdown && selectedHomeProvince && filteredHomeCities.length === 0 && homeCitySearch.trim() && (
                            <div className="home-city-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm text-gray-500">
                              No cities found matching &quot;{homeCitySearch}&quot;. You can use your typed city name.
                            </div>
                          )}
                        </>
                      )}
                    />
                  )}
                </>
              ) : (
                <input 
                  type="text" 
                  className={inputBase} 
                  placeholder="Enter city name"
                  {...register("homeCity", { required: true, maxLength: 50 })} 
                />
              )}
              {errors.homeCity && <p className="mt-1 text-xs text-red-600">City is required</p>}
            </div>
          </div>
        </section>

      {/* Section 2: Academic Information */}
      <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Academic Information</h2>
          <p className="mt-1 text-xs text-neutral-600">All fields are required.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelBase}>Campus *</label>
              <select className={inputBase} {...register("campusname", { required: true })}>
                <option value="">Select</option>
                <option value="lahore">Lahore Campus</option>
                <option value="islamabad">Islamabad Campus</option>
                <option value="sargodha">Sargodha Campus</option>
                <option value="gujrat">Gujrat Campus</option>
              </select>
              {errors.campusname && <p className="mt-1 text-xs text-red-600">Campus is required</p>}
            </div>
            <div>
              <label className={labelBase}>Faculty *</label>
              <select 
                className={inputBase} 
                {...register("facultyname", { required: true })}
                disabled={loadingAccess || (userAccess ? (!userAccess.isSuperAdmin && availableFaculties.length === 0) : false)}
              >
                <option value="">
                  {loadingAccess ? "Loading..." : 
                   userAccess && !userAccess.isSuperAdmin && availableFaculties.length === 0 
                     ? "No access to any faculty" 
                     : "Select"}
                </option>
                {availableFaculties.map((faculty) => (
                  <option key={faculty} value={faculty}>{faculty}</option>
                ))}
                {userAccess?.isSuperAdmin && <option value="other">Other</option>}
              </select>
              {errors.facultyname && <p className="mt-1 text-xs text-red-600">Faculty is required</p>}
            </div>
            <div>
              <label className={labelBase}>Department *</label>
              <select 
                className={inputBase} 
                {...register("departmentname", { required: true })}
                disabled={loadingAccess || !selectedFaculty || (userAccess ? (!userAccess.isSuperAdmin && deptOptions.length === 0) : false)}
              >
                <option value="">
                  {loadingAccess ? "Loading..." :
                   !selectedFaculty ? "Select Faculty first" :
                   userAccess && !userAccess.isSuperAdmin && deptOptions.length === 0 
                     ? "No access to any department in this faculty" 
                     : "Select"}
                </option>
                {userAccess?.isSuperAdmin && <option value="other">Other</option>}
                {deptOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {errors.departmentname && <p className="mt-1 text-xs text-red-600">Department is required</p>}
            </div>
            <div>
              <label className={labelBase}>Program *</label>
              <select 
                className={inputBase} 
                {...register("degreetitle", { required: true })}
                disabled={loadingAccess || !selectedFaculty || !selectedDepartment || selectedDepartment === "other" || programOptions.length === 0 || (userAccess ? (!userAccess.isSuperAdmin && programOptions.length === 0) : false)}
              >
                <option value="">
                  {loadingAccess ? "Loading..." :
                   !selectedFaculty ? "Select Faculty first" : 
                   !selectedDepartment ? "Select Department first" : 
                   selectedDepartment === "other" ? "Other Department Selected" :
                   userAccess && !userAccess.isSuperAdmin && programOptions.length === 0 
                     ? "No access to any program in this department" 
                     : programOptions.length === 0 ? "No Programs Available" 
                     : "Select Program"}
                </option>
                {programOptions.map((program) => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
              {errors.degreetitle && <p className="mt-1 text-xs text-red-600">Program is required</p>}
            </div>
             <div>
              <label className={labelBase}>Year of Admission *</label>
              <input type="number" className={inputBase} placeholder="e.g. 2025" {...register("yearofstarting", { required: true, valueAsNumber: true })} />
              {errors.yearofstarting && <p className="mt-1 text-xs text-red-600">Year is required</p>}
            </div>
            <div>
              <label className={labelBase}>Year of Passing Out *</label>
              <input type="number" className={inputBase} placeholder="e.g. 2025" {...register("yearofending", { required: true, valueAsNumber: true })} />
              {errors.yearofending && <p className="mt-1 text-xs text-red-600">Year is required</p>}
            </div>
          </div>
        </section>

      {/* Section 3: Work Status */}
      <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Work Status</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="mt-2 flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Employed" {...register("employeed")} /> Employed/Business
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Self-employed" {...register("employeed")} /> Self-employed
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Pursuing Higher Education" {...register("employeed")} /> Pursuing Higher Education
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Unemployed" defaultChecked {...register("employeed")} /> Unemployed
                </label>
              </div>
            </div>

            {/* Employed Fields */}
            {((employeedVal || "").toLowerCase() === "employed" || (employeedVal || "").toLowerCase() === "self-employed") && (
              <>
                {/* Sector = industry */}
                <div>
                  <label className={labelBase}>Sector *</label>
                  {!sectorOtherSelected ? (
                    <select 
                      className={inputBase} 
                      {...register("industry", { 
                        required: true,
                        onChange: (e) => {
                          if (e.target.value === "Other (please specify)") {
                            setSectorOtherSelected(true);
                            setValue("industry", "");
                          }
                        }
                      })}
                    >
                      <option value="">Select Sector</option>
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
                      <option value="Other (please specify)">Other (please specify)</option>
                    </select>
                  ) : (
                    <>
                      <input 
                        type="text" 
                        className={inputBase} 
                        {...register("industry", { 
                          required: "Please specify your sector",
                          maxLength: 100 
                        })} 
                        placeholder="Enter your sector"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSectorOtherSelected(false);
                          setValue("industry", "");
                        }}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        ← Back to sector list
                      </button>
                    </>
                  )}
                  {errors.industry && (
                    <p className="mt-1 text-xs text-red-600">{errors.industry.message || "Sector is required"}</p>
                  )}
                </div>

                {/* Name of Organization / Business Name */}
                <div>
                  <label className={labelBase}>
                    {(employeedVal || "").toLowerCase() === "self-employed" ? "Business Name *" : "Name of Organization *"}
                  </label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business name" : "Enter organization name"}
                    {...register("nameoforganization", { required: true, maxLength: 100 })} 
                  />
                  {errors.nameoforganization && (
                    <p className="mt-1 text-xs text-red-600">
                      {(employeedVal || "").toLowerCase() === "self-employed" ? "Business name is required" : "Organization is required"}
                    </p>
                  )}
                </div>

                {/* Designation */}
                <div>
                  <label className={labelBase}>Designation *</label>
                  <input type="text" className={inputBase} {...register("designation", { required: true, maxLength: 100 })} />
                  {errors.designation && (
                    <p className="mt-1 text-xs text-red-600">Designation is required</p>
                  )}
                </div>

                {/* Total Experience */}
                <div>
                  <label className={labelBase}>Total Experience  *</label>
                  <input type="text" className={inputBase} placeholder="e.g. 3" {...register("totalyearsofexpereince", { required: true, maxLength: 10 })} />
                  {errors.totalyearsofexpereince && (
                    <p className="mt-1 text-xs text-red-600">Experience is required</p>
                  )}
                </div>

                {/* Official Email */}
                <div>
                  <label className={labelBase}>
                    {(employeedVal || "").toLowerCase() === "self-employed" ? "Business Email *" : "Work Email *"}
                  </label>
                  <input 
                    type="email" 
                    className={inputBase} 
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business email" : "Enter work email"}
                    {...register("officialemail", { required: true, maxLength: 100 })} 
                  />
                  {errors.officialemail && (
                    <p className="mt-1 text-xs text-red-600">
                      {(employeedVal || "").toLowerCase() === "self-employed" ? "Business email is required" : "Work email is required"}
                    </p>
                  )}
                </div>

                {/* Official Phone */}
                <div>
                  <label className={labelBase}>
                    {(employeedVal || "").toLowerCase() === "self-employed" ? "Business Phone Number *" : "Work Phone Number *"}
                  </label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    placeholder={(employeedVal || "").toLowerCase() === "self-employed" ? "Enter your business phone" : "Enter work phone"}
                    {...register("officialnumber", { required: true, maxLength: 50 })} 
                  />
                  {errors.officialnumber && (
                    <p className="mt-1 text-xs text-red-600">
                      {(employeedVal || "").toLowerCase() === "self-employed" ? "Business phone number is required" : "Work phone number is required"}
                    </p>
                  )}
                </div>

                {/* Company Address */}
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
                {/* Work City/Country */}
                <div>
                  <label className={labelBase}>Work City *</label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    placeholder="Enter work city name"
                    {...register("workCity", { 
                      required: "Work city is required", 
                      maxLength: 50 
                    })} 
                  />
                  {errors.workCity && (
                    <p className="mt-1 text-xs text-red-600">{errors.workCity.message || "Work city is required"}</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-600">Work location city (independent from home city).</p>
                </div>
                <div>
                  <label className={labelBase}>Work Country *</label>
                  <Controller
                    name="workCountry"
                    control={control}
                    rules={{ required: "Work country is required" }}
                    render={({ field }) => (
                      <select 
                        className={inputBase} 
                        {...field}
                        value={field.value || ""}
                      >
                    <option value="">Select</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Other">Other</option>
                  </select>
                    )}
                  />
                  {errors.workCountry && (
                    <p className="mt-1 text-xs text-red-600">Work country is required</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-600">Work location country (independent from home country).</p>
                </div>
              </>
            )}

            {/* Pursuing Higher Education Fields */}
            {(employeedVal || "").toLowerCase() === "pursuing higher education" && (
              <>
                <div>
                  <label className={labelBase}>Degree Title *</label>
                  <input type="text" className={inputBase} placeholder="e.g. Masters in Civil Engineering" {...register("highereducationdegreetitle", { required: true, maxLength: 200 })} />
                  {errors.highereducationdegreetitle && (
                    <p className="mt-1 text-xs text-red-600">Degree title is required</p>
                  )}
                </div>

                <div>
                  <label className={labelBase}>Institute Name *</label>
                  <input type="text" className={inputBase} placeholder="e.g. University Name" {...register("highereducationinstitute", { required: true, maxLength: 200 })} />
                  {errors.highereducationinstitute && (
                    <p className="mt-1 text-xs text-red-600">Institute name is required</p>
                  )}
                </div>

                <div>
                  <label className={labelBase}>Program *</label>
                  <input
                    type="text"
                    className={inputBase}
                    placeholder="e.g. MS (Master of Science), PhD (Doctor of Philosophy), MBA, LLM, etc"
                    {...register("highereducationprogram", { required: "Program is required", maxLength: 100 })}
                  />
                  {errors.highereducationprogram && (
                    <p className="mt-1 text-xs text-red-600">{errors.highereducationprogram.message || "Program is required"}</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-600">
                    Write the program name (for example: MS, MPhil, PhD, MBA, LLM, etc).
                  </p>
                </div>

                <div>
                  <label className={labelBase}>City *</label>
                  <input 
                    type="text" 
                    className={inputBase} 
                    {...register("workCity", { 
                      required: "City is required", 
                      maxLength: 50,
                      validate: (value) => {
                        if (!value || String(value).trim() === "") {
                          return "City is required";
                        }
                        return true;
                      }
                    })} 
                    placeholder="e.g. Lahore"
                  />
                  {errors.workCity && (
                    <p className="mt-1 text-xs text-red-600">{errors.workCity.message || "City is required"}</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-600">City where you are pursuing higher education.</p>
                </div>

                <div>
                  <label className={labelBase}>Country *</label>
                  <Controller
                    name="workCountry"
                    control={control}
                    rules={{ required: "Country is required" }}
                    render={({ field }) => (
                      <select 
                        className={inputBase} 
                        {...field}
                        value={field.value || ""}
                      >
                    <option value="">Select</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                    <option value="Malaysia">Malaysia</option>
                    <option value="Turkey">Turkey</option>
                    <option value="Other">Other</option>
                  </select>
                    )}
                  />
                  {errors.workCountry && (
                    <p className="mt-1 text-xs text-red-600">Country is required</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-600">Country where you are pursuing higher education.</p>
                </div>

                <div>
                  <label className={labelBase}>Scholarship *</label>
                  <select className={inputBase} {...register("scholarship", { required: true })}>
                    <option value="">Select</option>
                    <option value="full funded scholarship">Full Funded Scholarship</option>
                    <option value="partially funded scholarship">Partially Funded Scholarship</option>
                    <option value="self paid">Self Paid</option>
                  </select>
                  {errors.scholarship && (
                    <p className="mt-1 text-xs text-red-600">Scholarship is required</p>
                  )}
                </div>

                <div>
                  <label className={labelBase}>Institute Student Email *</label>
                  <input type="email" className={inputBase} {...register("higher_education_institute_email", { required: true, maxLength: 200 })} />
                  {errors.higher_education_institute_email && (
                    <p className="mt-1 text-xs text-red-600">Institute Student Email is required</p>
                  )}
                </div>
              </>
            )}

            {/* Unemployed Fields */}
            {(employeedVal || "").toLowerCase() === "unemployed" && (
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelBase}>Reason of Unemployment *</label>
                <select 
                  className={inputBase} 
                  {...register("reason_of_unemployment", { required: "Please select a reason" })}
                >
                  <option value="">Select reason</option>
                  <option value="By Choice">By Choice</option>
                  <option value="Searching for Job">Searching for Job</option>
                </select>
                {errors.reason_of_unemployment && (
                  <p className="mt-1 text-xs text-red-600">{errors.reason_of_unemployment.message || "Reason is required"}</p>
                )}
              </div>
            )}
          </div>
        </section>

      {/* Section 4: Alumni Chapters */}
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

      {/* Section 5: Admin Section */}
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
                <option value="B+">B+</option>
                <option value="B">B</option>
                <option value="C+">C+</option>
                <option value="C">C</option>
                <option value="D">D</option>
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