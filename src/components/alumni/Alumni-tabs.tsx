"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "../ui/badge/Badge";
import { CloseLineIcon, EyeIcon, TrashBinIcon, CheckLineIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon } from "@/icons";
import { AlumniExpandableDetails } from "./AlumniExpandableDetails";
import { ErpDataDetails } from "./ErpDataDetails";
import { DistinguishedAlumniTab } from "./DistinguishedAlumniTab";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canModify, isAdminUser, isViewerUser, isSuperAdminUser } from "@/lib/alumniProfile";
import { useAlumniListPaginated, getAlumniCounts, type AlumniListItem, type AlumniCounts } from "@/app/queries/fetch-alumni";
import { useMaritalStatuses } from "@/app/queries/fetch-marital-statuses";
import { useGenders, type GenderOption } from "@/app/queries/fetch-genders";
import { useCampuses, type CampusOption } from "@/app/queries/fetch-campuses";
import { useOccupationStatuses, type OccupationStatusOption } from "@/app/queries/fetch-occupation-statuses";
import { useAlumniFaculties } from "@/app/queries/fetch-alumni-faculties";
import { useAlumniDepartments } from "@/app/queries/fetch-alumni-departments";
import { useAlumniPrograms } from "@/app/queries/fetch-alumni-programs";
import type { MasterFilters } from "@/app/queries/master-filter-types";
import { useHomeCountries } from "@/app/queries/fetch-home-countries";
import { useWorkCountries } from "@/app/queries/fetch-work-countries";
import { useAdmissionYears } from "@/app/queries/fetch-admission-years";
import { usePassingYears } from "@/app/queries/fetch-passing-years";
import { useSectors } from "@/app/queries/fetch-sectors";
import { useWorkCities } from "@/app/queries/fetch-work-cities";
import { useHomeCities } from "@/app/queries/fetch-home-cities";
import { useProvinces } from "@/app/queries/fetch-provinces";
import { useInstitutionNames } from "@/app/queries/fetch-institution-names";
import { useDegreeTitles } from "@/app/queries/fetch-degree-titles";
import { useFundingSources } from "@/app/queries/fetch-funding-sources";
import { useInstitutionCountries } from "@/app/queries/fetch-institution-countries";
import { useInstitutionCities } from "@/app/queries/fetch-institution-cities";
import { useVerifyStatuses } from "@/app/queries/fetch-verify-statuses";
import { usePhotoConsent } from "@/app/queries/fetch-photo-consent";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { exportJsonToExcel, type ColumnOption } from "@/lib/excel-export";
import type { AlumniFilterOption } from "@/app/queries/fetch-alumni-faculties";
import toast from "react-hot-toast";

type TabKey =
  | "total"
  | "verified"
  | "underApproval"
  | "active"
  | "aPlus"
  | "a"
  | "b"
  | "c"
  | "d"
  | "distinguished";

const TABS: { key: TabKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "verified", label: "Verified" },
  { key: "underApproval", label: "Under Approval" },
  { key: "active", label: "Active" },
];

const CATEGORY_TABS: { key: TabKey; label: string }[] = [
  { key: "aPlus", label: "A+ Category" },
  { key: "a", label: "A Category" },
  { key: "b", label: "B Category" },
  { key: "c", label: "C Category" },
  { key: "d", label: "D Category" },
];

const DISTINGUISHED_TAB: { key: TabKey; label: string }[] = [
  { key: "distinguished", label: "Distinguished Alumni" },
];

// Counts are computed dynamically from fetched data

// Per-status color classes to visually distinguish each category
const STATUS_CLASS_MAP: Record<
  TabKey,
  {
    selectedContainer: string;
    hoverBorder: string;
    iconBg: string;
    iconColor: string;
    labelText: string;
  }
> = {
  total: {
    selectedContainer:
      "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20",
    hoverBorder: "hover:border-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-700 dark:text-blue-200",
    labelText: "text-blue-600 dark:text-blue-300",
  },
  verified: {
    selectedContainer:
      "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20",
    hoverBorder: "hover:border-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-800",
    iconColor: "text-emerald-700 dark:text-emerald-200",
    labelText: "text-emerald-600 dark:text-emerald-300",
  },
  underApproval: {
    selectedContainer:
      "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20",
    hoverBorder: "hover:border-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800",
    iconColor: "text-amber-700 dark:text-amber-200",
    labelText: "text-amber-600 dark:text-amber-300",
  },
  active: {
    selectedContainer:
      "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/20",
    hoverBorder: "hover:border-indigo-400",
    iconBg: "bg-indigo-100 dark:bg-indigo-800",
    iconColor: "text-indigo-700 dark:text-indigo-200",
    labelText: "text-indigo-600 dark:text-indigo-300",
  },
  aPlus: {
    selectedContainer:
      "border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-900/20",
    hoverBorder: "hover:border-purple-400",
    iconBg: "bg-purple-100 dark:bg-purple-800",
    iconColor: "text-purple-700 dark:text-purple-200",
    labelText: "text-purple-600 dark:text-purple-300",
  },
  a: {
    selectedContainer:
      "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20",
    hoverBorder: "hover:border-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-700 dark:text-blue-200",
    labelText: "text-blue-600 dark:text-blue-300",
  },
  b: {
    selectedContainer:
      "border-green-500 bg-green-50 dark:border-green-500 dark:bg-green-900/20",
    hoverBorder: "hover:border-green-400",
    iconBg: "bg-green-100 dark:bg-green-800",
    iconColor: "text-green-700 dark:text-green-200",
    labelText: "text-green-600 dark:text-green-300",
  },
  c: {
    selectedContainer:
      "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20",
    hoverBorder: "hover:border-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800",
    iconColor: "text-amber-700 dark:text-amber-200",
    labelText: "text-amber-600 dark:text-amber-300",
  },
  d: {
    selectedContainer:
      "border-gray-500 bg-gray-50 dark:border-gray-500 dark:bg-gray-900/20",
    hoverBorder: "hover:border-gray-400",
    iconBg: "bg-gray-100 dark:bg-gray-800",
    iconColor: "text-gray-700 dark:text-gray-200",
    labelText: "text-gray-600 dark:text-gray-300",
  },
  distinguished: {
    selectedContainer:
      "border-rose-500 bg-rose-50 dark:border-rose-500 dark:bg-rose-900/20",
    hoverBorder: "hover:border-rose-400",
    iconBg: "bg-rose-100 dark:bg-rose-800",
    iconColor: "text-rose-700 dark:text-rose-200",
    labelText: "text-rose-600 dark:text-rose-300",
  },
};


export const AlumniTabs: React.FC = () => {
  const router = useRouter();
  const [selected, setSelected] = useState<TabKey>("total");
  const { data: session } = useSession();
  
  // Refs for scroll synchronization
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const topScrollbarRef = React.useRef<HTMLDivElement>(null);
  const isScrollingRef = React.useRef(false);
  
  // Refs for filter dropdowns (click outside to close)
  const facultyFilterRef = React.useRef<HTMLDivElement>(null);
  const departmentFilterRef = React.useRef<HTMLDivElement>(null);
  const programFilterRef = React.useRef<HTMLDivElement>(null);
  const statusFilterRef = React.useRef<HTMLDivElement>(null);
  const homeCountryFilterRef = React.useRef<HTMLDivElement>(null);
  const provinceFilterRef = React.useRef<HTMLDivElement>(null);
  const homeCityFilterRef = React.useRef<HTMLDivElement>(null);
  const campusFilterRef = React.useRef<HTMLDivElement>(null);
  const admissionYearFilterRef = React.useRef<HTMLDivElement>(null);
  const passingYearFilterRef = React.useRef<HTMLDivElement>(null);
  const workCountryFilterRef = React.useRef<HTMLDivElement>(null);
  const workCityFilterRef = React.useRef<HTMLDivElement>(null);
  const sectorFilterRef = React.useRef<HTMLDivElement>(null);
  const institutionNameFilterRef = React.useRef<HTMLDivElement>(null);
  const programEnrolledFilterRef = React.useRef<HTMLDivElement>(null);
  const fundingSourceFilterRef = React.useRef<HTMLDivElement>(null);
  const institutionCountryFilterRef = React.useRef<HTMLDivElement>(null);
  const institutionCityFilterRef = React.useRef<HTMLDivElement>(null);
  const genderFilterRef = React.useRef<HTMLDivElement>(null);
  const maritalStatusFilterRef = React.useRef<HTMLDivElement>(null);
  const occupationStatusFilterRef = React.useRef<HTMLDivElement>(null);
  const photoConsentFilterRef = React.useRef<HTMLDivElement>(null);

  // Unified item type mapped from server response
  type AlumniItem = {
    id: string; // sapId, registrationNo, or alumniid as fallback
    alumniid?: number | null; // Alumni ID from database
    registrationNo?: string | null;
    name: string;
    email?: string | null;
    mobile?: string | null;
    campus?: string | null;
    faculty?: string | null;
    program?: string | null;
    department?: string | null;
    passingYear?: number | null;
    workCountry?: string | null;
    workCity?: string | null;
    organization?: string | null;
    designation?: string | null;
    verified?: boolean;
    verifyStatus?: "verified" | "unverified" | "underApproval"; // Computed status
    employmentStatus?: "Employed" | "Unemployed" | null;
    lastLoginTime?: string | null;
    loginCount?: number | null;
    sapId?: string; // Raw SAP ID for sorting
    rawName?: string; // Raw name for sorting
  };

  // filtering is handled in the server-like fetcher; remove unused memo

  // Query + UI state (UI state does not duplicate cache)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [additionalFilter, setAdditionalFilter] = useState<string[]>([]); // Array of selected statuses
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Filter state for faculty, department, and program (cascading) - arrays for multi-select
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  
  // Additional master filter states
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedMaritalStatuses, setSelectedMaritalStatuses] = useState<string[]>([]);
  const [selectedHomeCountries, setSelectedHomeCountries] = useState<string[]>([]);
  const [selectedHomeCities, setSelectedHomeCities] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([]);
  const [selectedAdmissionYears, setSelectedAdmissionYears] = useState<string[]>([]);
  const [selectedPassingYears, setSelectedPassingYears] = useState<string[]>([]);
  const [selectedOccupationStatuses, setSelectedOccupationStatuses] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedWorkCities, setSelectedWorkCities] = useState<string[]>([]);
  const [selectedWorkCountries, setSelectedWorkCountries] = useState<string[]>([]);
  const [selectedInstitutionNames, setSelectedInstitutionNames] = useState<string[]>([]);
  const [selectedProgramsEnrolled, setSelectedProgramsEnrolled] = useState<string[]>([]);
  const [selectedFundingSources, setSelectedFundingSources] = useState<string[]>([]);
  const [selectedInstitutionCountries, setSelectedInstitutionCountries] = useState<string[]>([]);
  const [selectedInstitutionCities, setSelectedInstitutionCities] = useState<string[]>([]);

  // Export column toggles – control which groups of columns are exported
  const [exportFaculty, setExportFaculty] = useState<boolean>(true);
  const [exportDepartment, setExportDepartment] = useState<boolean>(true);
  const [exportProgram, setExportProgram] = useState<boolean>(true);
  const [exportMaster, setExportMaster] = useState<boolean>(false);
  // Master filter–specific export toggles
  const [exportGender, setExportGender] = useState<boolean>(true);
  const [exportMaritalStatus, setExportMaritalStatus] = useState<boolean>(true);
  const [exportHomeCountry, setExportHomeCountry] = useState<boolean>(true);
  const [exportHomeCity, setExportHomeCity] = useState<boolean>(true);
  const [exportProvince, setExportProvince] = useState<boolean>(true);
  const [exportCampus, setExportCampus] = useState<boolean>(true);
  const [exportAdmissionYear, setExportAdmissionYear] = useState<boolean>(true);
  const [exportPassingYear, setExportPassingYear] = useState<boolean>(true);
  const [exportOccupationStatus, setExportOccupationStatus] = useState<boolean>(true);
  const [exportSector, setExportSector] = useState<boolean>(true);
  const [exportWorkCity, setExportWorkCity] = useState<boolean>(true);
  const [exportWorkCountry, setExportWorkCountry] = useState<boolean>(true);
  const [exportInstitutionName, setExportInstitutionName] = useState<boolean>(true);
  const [exportProgramEnrolled, setExportProgramEnrolled] = useState<boolean>(true);
  const [exportFundingSource, setExportFundingSource] = useState<boolean>(true);
  const [exportInstitutionCountry, setExportInstitutionCountry] = useState<boolean>(true);
  const [exportInstitutionCity, setExportInstitutionCity] = useState<boolean>(true);
  const [exportMrNo, setExportMrNo] = useState<boolean>(true);
  const [exportPhotoConsent, setExportPhotoConsent] = useState<boolean>(true);
  const [selectedMrNos, setSelectedMrNos] = useState<string[]>([]);
  const [selectedSapIdStates, setSelectedSapIdStates] = useState<string[]>([]);
  const [selectedRegNoStates, setSelectedRegNoStates] = useState<string[]>([]);
  const [selectedPhotoConsents, setSelectedPhotoConsents] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // State for expanded filter sections
  const [expandedFilters, setExpandedFilters] = useState<{
    faculty: boolean;
    department: boolean;
    program: boolean;
    status: boolean;
    masterFilters: boolean;
    homeCountry: boolean;
    province: boolean;
    homeCity: boolean;
    campus: boolean;
    admissionYear: boolean;
    passingYear: boolean;
    workCountry: boolean;
    workCity: boolean;
    sector: boolean;
    institutionName: boolean;
    programEnrolled: boolean;
    fundingSource: boolean;
    institutionCountry: boolean;
    institutionCity: boolean;
    gender: boolean;
    maritalStatus: boolean;
    occupationStatus: boolean;
    photoConsent: boolean;
  }>({
    faculty: false,
    department: false,
    program: false,
    status: false,
    masterFilters: false,
    homeCountry: false,
    province: false,
    homeCity: false,
    campus: false,
    admissionYear: false,
    passingYear: false,
    workCountry: false,
    workCity: false,
    sector: false,
    institutionName: false,
    programEnrolled: false,
    fundingSource: false,
    institutionCountry: false,
    institutionCity: false,
    gender: false,
    maritalStatus: false,
    occupationStatus: false,
    photoConsent: false,
  });
  
  // Countries are now fetched from database via useHomeCountries() and useWorkCountries()
  
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
  
  // Campus options, admission years, and passing years are now fetched dynamically from database
  
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
  
  // Get cities for selected provinces
  const availableCities = useMemo(() => {
    if (selectedProvinces.length === 0) return [];
    const citySet = new Set<string>();
    selectedProvinces.forEach(province => {
      const cities = citiesByProvince[province] || [];
      cities.forEach(city => citySet.add(city));
    });
    return Array.from(citySet).sort((a, b) => a.localeCompare(b));
  }, [selectedProvinces]);
  
  // Status filter: combine selected tab and additionalFilter
  const statusFilter = useMemo(() => {
    if (selected === "total") {
      return additionalFilter.length > 0 ? additionalFilter : undefined;
    }
    // Map tab keys to API status values
    const mapTabToStatus = (tab: TabKey): string => {
      switch (tab) {
        case "aPlus":
          return "category:aPlus";
        case "a":
          return "category:a";
        case "b":
          return "category:b";
        case "c":
          return "category:c";
        case "d":
          return "category:d";
        case "distinguished":
          return "distinguished";
        default:
          return tab; // "verified", "underApproval", "active" map directly
      }
    };
    
    // For specific tabs, combine tab status with additionalFilter
    const tabStatus = mapTabToStatus(selected);
    if (additionalFilter.length > 0) {
      return [tabStatus, ...additionalFilter];
    }
    return [tabStatus];
  }, [selected, additionalFilter]);
  
  // Master filters: consolidate all selected filter states
  const masterFilters = useMemo(() => {
    const filters: MasterFilters = {};
    if (statusFilter) {
      filters.status = statusFilter;
    }
    if (selectedFaculties.length > 0) {
      filters.faculty = selectedFaculties;
    }
    if (selectedDepartments.length > 0) {
      filters.department = selectedDepartments;
    }
    if (selectedPrograms.length > 0) {
      filters.program = selectedPrograms;
    }
    if (selectedGenders.length > 0) {
      filters.gender = selectedGenders;
    }
    if (selectedMaritalStatuses.length > 0) {
      filters.maritalStatus = selectedMaritalStatuses;
    }
    if (selectedHomeCountries.length > 0) {
      filters.homeCountry = selectedHomeCountries;
    }
    if (selectedHomeCities.length > 0) {
      filters.homeCity = selectedHomeCities;
    }
    if (selectedProvinces.length > 0) {
      filters.province = selectedProvinces;
    }
    if (selectedCampuses.length > 0) {
      filters.campus = selectedCampuses;
    }
    if (selectedAdmissionYears.length > 0) {
      filters.admissionYear = selectedAdmissionYears;
    }
    if (selectedPassingYears.length > 0) {
      filters.passingYear = selectedPassingYears;
    }
    if (selectedOccupationStatuses.length > 0) {
      filters.occupationStatus = selectedOccupationStatuses;
    }
    if (selectedSectors.length > 0) {
      filters.sector = selectedSectors;
    }
    if (selectedWorkCities.length > 0) {
      filters.workCity = selectedWorkCities;
    }
    if (selectedWorkCountries.length > 0) {
      filters.workCountry = selectedWorkCountries;
    }
    if (selectedInstitutionNames.length > 0) {
      filters.institutionName = selectedInstitutionNames;
    }
    if (selectedProgramsEnrolled.length > 0) {
      filters.programEnrolled = selectedProgramsEnrolled;
    }
    if (selectedFundingSources.length > 0) {
      filters.fundingSource = selectedFundingSources;
    }
    if (selectedInstitutionCountries.length > 0) {
      filters.institutionCountry = selectedInstitutionCountries;
    }
    if (selectedInstitutionCities.length > 0) {
      filters.institutionCity = selectedInstitutionCities;
    }
    if (selectedMrNos.length > 0) {
      filters.mrNo = selectedMrNos;
    }
    if (selectedSapIdStates.length > 0) {
      filters.sapIdState = selectedSapIdStates;
    }
    if (selectedRegNoStates.length > 0) {
      filters.regNoState = selectedRegNoStates;
    }
    if (selectedPhotoConsents.length > 0) {
      filters.photoConsent = selectedPhotoConsents;
    }
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [
    statusFilter,
    selectedFaculties,
    selectedDepartments,
    selectedPrograms,
    selectedGenders,
    selectedMaritalStatuses,
    selectedHomeCountries,
    selectedHomeCities,
    selectedProvinces,
    selectedCampuses,
    selectedAdmissionYears,
    selectedPassingYears,
    selectedOccupationStatuses,
    selectedSectors,
    selectedWorkCities,
    selectedWorkCountries,
    selectedInstitutionNames,
    selectedProgramsEnrolled,
    selectedFundingSources,
    selectedInstitutionCountries,
    selectedInstitutionCities,
    selectedMrNos,
    selectedPhotoConsents,
    selectedSapIdStates,
    selectedRegNoStates,
  ]);
  
  // Faculty / Department / Program options - fetched dynamically from database (tbl_alumni)
  // Pass current filter selections to get dynamic counts
  const { data: alumniFacultiesData } = useAlumniFaculties(masterFilters);
  const { data: alumniDepartmentsData } = useAlumniDepartments(masterFilters);
  const { data: alumniProgramsData } = useAlumniPrograms(masterFilters);
  
  // Master filter hooks - pass masterFilters to get dynamic counts
  const { data: maritalStatusesData, error: maritalStatusesError, isLoading: isLoadingMaritalStatuses } = useMaritalStatuses(masterFilters);
  const { data: gendersData, error: gendersError, isLoading: isLoadingGenders } = useGenders(masterFilters);
  const { data: campusesData, error: campusesError, isLoading: isLoadingCampuses } = useCampuses(masterFilters);
  const { data: occupationStatusesData, error: occupationStatusesError, isLoading: isLoadingOccupationStatuses } = useOccupationStatuses(masterFilters);
  
  // Additional master filter hooks - pass masterFilters to get dynamic counts
  const { data: homeCountriesData } = useHomeCountries(masterFilters);
  const { data: workCountriesData } = useWorkCountries(masterFilters);
  const { data: admissionYearsData } = useAdmissionYears(masterFilters);
  const { data: passingYearsData } = usePassingYears(masterFilters);
  const { data: sectorsData } = useSectors(masterFilters);
  const { data: workCitiesData } = useWorkCities(masterFilters);
  const { data: homeCitiesData } = useHomeCities(masterFilters);
  const { data: provincesData } = useProvinces(masterFilters);
  
  // Institution-related master filter hooks - pass masterFilters to get dynamic counts
  const { data: institutionNamesData } = useInstitutionNames(masterFilters);
  const { data: degreeTitlesData } = useDegreeTitles(masterFilters);
  const { data: fundingSourcesData } = useFundingSources(masterFilters);
  const { data: institutionCountriesData } = useInstitutionCountries(masterFilters);
  const { data: institutionCitiesData } = useInstitutionCities(masterFilters);
  const { data: photoConsentData } = usePhotoConsent(masterFilters);

  // Debug logging
  React.useEffect(() => {
    if (maritalStatusesError) {
      console.error("[AlumniTabs] Error fetching marital statuses:", maritalStatusesError);
    }
    if (maritalStatusesData) {
      console.log("[AlumniTabs] Marital statuses data:", maritalStatusesData);
    }
    if (gendersError) {
      console.error("[AlumniTabs] Error fetching genders:", gendersError);
    }
    if (gendersData) {
      console.log("[AlumniTabs] Genders data:", gendersData);
    }
    if (campusesError) {
      console.error("[AlumniTabs] Error fetching campuses:", campusesError);
    }
    if (campusesData) {
      console.log("[AlumniTabs] Campuses data:", campusesData);
    }
    if (occupationStatusesError) {
      console.error("[AlumniTabs] Error fetching occupation statuses:", occupationStatusesError);
    }
    if (occupationStatusesData) {
      console.log("[AlumniTabs] Occupation statuses data:", occupationStatusesData);
    }
  }, [maritalStatusesData, maritalStatusesError, gendersData, gendersError, campusesData, campusesError, occupationStatusesData, occupationStatusesError]);

  const facultyOptions: AlumniFilterOption[] = alumniFacultiesData?.faculties ?? [];
  const departmentOptions: AlumniFilterOption[] = alumniDepartmentsData?.departments ?? [];
  const programOptions: AlumniFilterOption[] = alumniProgramsData?.programs ?? [];
  
  // Confirmation modal state
  const confirmModal = useModal();
  const [pendingAction, setPendingAction] = useState<{
    type: "verify" | "unverify" | "delete";
    sapid: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  
  // Reset home cities when provinces change - remove cities that are no longer available
  useEffect(() => {
    if (homeCitiesData?.homeCities) {
      const availableCityValues = homeCitiesData.homeCities.map(c => c.value);
      setSelectedHomeCities(prev => prev.filter(city => availableCityValues.includes(city)));
    }
  }, [homeCitiesData]);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFaculties, selectedDepartments, selectedPrograms, additionalFilter]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (facultyFilterRef.current && !facultyFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, faculty: false }));
      }
      if (departmentFilterRef.current && !departmentFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, department: false }));
      }
      if (programFilterRef.current && !programFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, program: false }));
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, status: false }));
      }
      if (homeCountryFilterRef.current && !homeCountryFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, homeCountry: false }));
      }
      if (provinceFilterRef.current && !provinceFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, province: false }));
      }
      if (homeCityFilterRef.current && !homeCityFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, homeCity: false }));
      }
      if (campusFilterRef.current && !campusFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, campus: false }));
      }
      if (admissionYearFilterRef.current && !admissionYearFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, admissionYear: false }));
      }
      if (passingYearFilterRef.current && !passingYearFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, passingYear: false }));
      }
      if (workCountryFilterRef.current && !workCountryFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, workCountry: false }));
      }
      if (workCityFilterRef.current && !workCityFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, workCity: false }));
      }
      if (sectorFilterRef.current && !sectorFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, sector: false }));
      }
      if (institutionNameFilterRef.current && !institutionNameFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, institutionName: false }));
      }
      if (programEnrolledFilterRef.current && !programEnrolledFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, programEnrolled: false }));
      }
      if (fundingSourceFilterRef.current && !fundingSourceFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, fundingSource: false }));
      }
      if (institutionCountryFilterRef.current && !institutionCountryFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, institutionCountry: false }));
      }
      if (institutionCityFilterRef.current && !institutionCityFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, institutionCity: false }));
      }
      if (genderFilterRef.current && !genderFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, gender: false }));
      }
      if (maritalStatusFilterRef.current && !maritalStatusFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, maritalStatus: false }));
      }
      if (occupationStatusFilterRef.current && !occupationStatusFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, occupationStatus: false }));
      }
      if (photoConsentFilterRef.current && !photoConsentFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, photoConsent: false }));
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handlers for checkbox toggles
  const handleFacultyToggle = (facultyValue: string) => {
    setSelectedFaculties(prev => 
      prev.includes(facultyValue) 
        ? prev.filter(f => f !== facultyValue)
        : [...prev, facultyValue]
    );
  };
  
  const handleFacultySelectAll = () => {
    const allFacultyValues = facultyOptions.map(f => f.value);
    if (allFacultyValues.length > 0 && selectedFaculties.length === allFacultyValues.length) {
      setSelectedFaculties([]);
    } else {
      setSelectedFaculties([...allFacultyValues]);
    }
  };
  
  const handleDepartmentToggle = (deptValue: string) => {
    setSelectedDepartments(prev => 
      prev.includes(deptValue) 
        ? prev.filter(d => d !== deptValue)
        : [...prev, deptValue]
    );
  };
  
  const handleDepartmentSelectAll = () => {
    const allDepartmentValues = departmentOptions.map(d => d.value);
    if (allDepartmentValues.length > 0 && selectedDepartments.length === allDepartmentValues.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments([...allDepartmentValues]);
    }
  };
  
  const handleProgramToggle = (progValue: string) => {
    setSelectedPrograms(prev => 
      prev.includes(progValue) 
        ? prev.filter(p => p !== progValue)
        : [...prev, progValue]
    );
  };
  
  const handleProgramSelectAll = () => {
    const allProgramValues = programOptions.map(p => p.value);
    if (allProgramValues.length > 0 && selectedPrograms.length === allProgramValues.length) {
      setSelectedPrograms([]);
    } else {
      setSelectedPrograms([...allProgramValues]);
    }
  };

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setQuery("");
    setSelectedFaculties([]);
    setSelectedDepartments([]);
    setSelectedPrograms([]);
    setAdditionalFilter([]);
    setSelectedGenders([]);
    setSelectedMaritalStatuses([]);
    setSelectedHomeCountries([]);
    setSelectedHomeCities([]);
    setSelectedProvinces([]);
    setSelectedCampuses([]);
    setSelectedAdmissionYears([]);
    setSelectedPassingYears([]);
    setSelectedOccupationStatuses([]);
    setSelectedSectors([]);
    setSelectedWorkCities([]);
    setSelectedWorkCountries([]);
    setSelectedInstitutionNames([]);
    setSelectedProgramsEnrolled([]);
    setSelectedFundingSources([]);
    setSelectedInstitutionCountries([]);
    setSelectedInstitutionCities([]);
    setSelectedMrNos([]);
    setSelectedPhotoConsents([]);
    setCurrentPage(1);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      query.trim() !== "" ||
      selectedFaculties.length > 0 ||
      selectedDepartments.length > 0 ||
      selectedPrograms.length > 0 ||
      additionalFilter.length > 0 ||
      selectedGenders.length > 0 ||
      selectedMaritalStatuses.length > 0 ||
      selectedHomeCountries.length > 0 ||
      selectedHomeCities.length > 0 ||
      selectedProvinces.length > 0 ||
      selectedCampuses.length > 0 ||
      selectedAdmissionYears.length > 0 ||
      selectedPassingYears.length > 0 ||
      selectedOccupationStatuses.length > 0 ||
      selectedSectors.length > 0 ||
      selectedWorkCities.length > 0 ||
      selectedWorkCountries.length > 0 ||
      selectedInstitutionNames.length > 0 ||
      selectedProgramsEnrolled.length > 0 ||
      selectedFundingSources.length > 0 ||
      selectedInstitutionCountries.length > 0 ||
      selectedInstitutionCities.length > 0 ||
      selectedMrNos.length > 0 ||
      selectedPhotoConsents.length > 0 ||
      selectedSapIdStates.length > 0 ||
      selectedRegNoStates.length > 0
    );
  }, [query, selectedFaculties, selectedDepartments, selectedPrograms, additionalFilter, selectedGenders, selectedMaritalStatuses, selectedHomeCountries, selectedHomeCities, selectedProvinces, selectedCampuses, selectedAdmissionYears, selectedPassingYears, selectedOccupationStatuses, selectedSectors, selectedWorkCities, selectedWorkCountries, selectedInstitutionNames, selectedProgramsEnrolled, selectedFundingSources, selectedInstitutionCountries, selectedInstitutionCities, selectedMrNos, selectedPhotoConsents, selectedSapIdStates, selectedRegNoStates]);
  
  const handleStatusToggle = (status: string) => {
    setAdditionalFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };
  
  const handleStatusSelectAll = () => {
    const allStatuses = ["verified", "unverified", "underApproval", "active", "inactive"];
    if (additionalFilter.length === allStatuses.length) {
      setAdditionalFilter([]);
    } else {
      setAdditionalFilter(allStatuses);
    }
  };
  
  // Handlers for home country, province, and city filters
  const handleHomeCountryToggle = (country: string) => {
    setSelectedHomeCountries(prev => 
      prev.includes(country) 
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };
  
  const handleHomeCountrySelectAll = () => {
    const allValues = homeCountriesData?.homeCountries?.map(c => c.value) || [];
    if (selectedHomeCountries.length === allValues.length && allValues.length > 0) {
      setSelectedHomeCountries([]);
    } else {
      setSelectedHomeCountries(allValues);
    }
  };
  
  const handleProvinceToggle = (province: string) => {
    setSelectedProvinces(prev => 
      prev.includes(province) 
        ? prev.filter(p => p !== province)
        : [...prev, province]
    );
  };
  
  const handleProvinceSelectAll = () => {
    if (selectedProvinces.length === pakistanProvinces.length) {
      setSelectedProvinces([]);
    } else {
      setSelectedProvinces(pakistanProvinces.map(p => p.value));
    }
  };
  
  const handleHomeCityToggle = (city: string) => {
    setSelectedHomeCities(prev => 
      prev.includes(city) 
        ? prev.filter(c => c !== city)
        : [...prev, city]
    );
  };
  
  const handleHomeCitySelectAll = () => {
    if (selectedHomeCities.length === availableCities.length) {
      setSelectedHomeCities([]);
    } else {
      setSelectedHomeCities([...availableCities]);
    }
  };
  
  const handleCampusToggle = (campus: string) => {
    setSelectedCampuses(prev => 
      prev.includes(campus) 
        ? prev.filter(c => c !== campus)
        : [...prev, campus]
    );
  };
  
  const handleCampusSelectAll = () => {
    const allCampusValues = campusesData?.campuses ? campusesData.campuses.map(c => c.value) : [];
    if (selectedCampuses.length === allCampusValues.length && allCampusValues.length > 0) {
      setSelectedCampuses([]);
    } else {
      setSelectedCampuses([...allCampusValues]);
    }
  };

  // Gender filter handlers
  const handleGenderToggle = (gender: string) => {
    setSelectedGenders(prev => 
      prev.includes(gender) 
        ? prev.filter(g => g !== gender)
        : [...prev, gender]
    );
  };
  
  const handleGenderSelectAll = () => {
    if (gendersData?.genders && selectedGenders.length === gendersData.genders.length && gendersData.genders.length > 0) {
      setSelectedGenders([]);
    } else {
      setSelectedGenders(gendersData?.genders?.map(g => g.value) || []);
    }
  };

  // Marital Status filter handlers
  const handleMaritalStatusToggle = (status: string) => {
    setSelectedMaritalStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };
  
  const handleMaritalStatusSelectAll = () => {
    if (maritalStatusesData?.maritalStatuses && selectedMaritalStatuses.length === maritalStatusesData.maritalStatuses.length && maritalStatusesData.maritalStatuses.length > 0) {
      setSelectedMaritalStatuses([]);
    } else {
      setSelectedMaritalStatuses(maritalStatusesData?.maritalStatuses?.map(s => s.value) || []);
    }
  };

  // Photo Consent filter handlers
  const handlePhotoConsentToggle = (consent: string) => {
    setSelectedPhotoConsents(prev => 
      prev.includes(consent) 
        ? prev.filter(c => c !== consent)
        : [...prev, consent]
    );
  };
  
  const handlePhotoConsentSelectAll = () => {
    if (photoConsentData?.photoConsents && selectedPhotoConsents.length === photoConsentData.photoConsents.length && photoConsentData.photoConsents.length > 0) {
      setSelectedPhotoConsents([]);
    } else {
      setSelectedPhotoConsents(photoConsentData?.photoConsents?.map(c => c.value) || []);
    }
  };

  // SAP ID / Registration No state filter handlers (NULL / EMPTY only)
  const handleSapIdStateToggle = (value: string) => {
    setSelectedSapIdStates(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleRegNoStateToggle = (value: string) => {
    setSelectedRegNoStates(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  // Occupation Status filter handlers
  const handleOccupationStatusToggle = (status: string) => {
    setSelectedOccupationStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };
  
  const handleOccupationStatusSelectAll = () => {
    if (occupationStatusesData?.occupationStatuses && selectedOccupationStatuses.length === occupationStatusesData.occupationStatuses.length && occupationStatusesData.occupationStatuses.length > 0) {
      setSelectedOccupationStatuses([]);
    } else {
      setSelectedOccupationStatuses(occupationStatusesData?.occupationStatuses?.map(s => s.value) || []);
    }
  };
  
  const handleAdmissionYearToggle = (year: string) => {
    setSelectedAdmissionYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };
  
  const handleAdmissionYearSelectAll = () => {
    const allValues = admissionYearsData?.admissionYears?.map(y => y.value) || [];
    if (selectedAdmissionYears.length === allValues.length && allValues.length > 0) {
      setSelectedAdmissionYears([]);
    } else {
      setSelectedAdmissionYears(allValues);
    }
  };
  
  const handlePassingYearToggle = (year: string) => {
    setSelectedPassingYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };
  
  const handlePassingYearSelectAll = () => {
    const allValues = passingYearsData?.passingYears?.map(y => y.value) || [];
    if (selectedPassingYears.length === allValues.length && allValues.length > 0) {
      setSelectedPassingYears([]);
    } else {
      setSelectedPassingYears(allValues);
    }
  };
  
  const handleWorkCountryToggle = (country: string) => {
    setSelectedWorkCountries(prev => 
      prev.includes(country) 
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };
  
  const handleWorkCountrySelectAll = () => {
    const allValues = workCountriesData?.workCountries?.map(c => c.value) || [];
    if (selectedWorkCountries.length === allValues.length && allValues.length > 0) {
      setSelectedWorkCountries([]);
    } else {
      setSelectedWorkCountries(allValues);
    }
  };

  // Reset page to 1 when tab changes or filter changes (but not when statusFilter recalculates with same value)
  useEffect(() => {
    console.log("[AlumniTabs] Tab changed to:", selected, "Additional filter:", additionalFilter, "Status filter:", statusFilter);
    setCurrentPage(1);
  }, [selected, additionalFilter]); // Removed statusFilter since it's derived from selected and additionalFilter

  // React Query: fetch paginated list for table display with status filter and filters
  const {
    data: paginatedData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAlumniListPaginated(
    debouncedQuery || undefined, 
    currentPage, 
    showAll ? 500 : pageSize, // Use 500 (max allowed) when showAll is true
    statusFilter,
    selectedFaculties.length > 0 ? selectedFaculties : undefined,
    selectedDepartments.length > 0 ? selectedDepartments : undefined,
    selectedPrograms.length > 0 ? selectedPrograms : undefined,
    selectedGenders.length > 0 ? selectedGenders : undefined,
    selectedMaritalStatuses.length > 0 ? selectedMaritalStatuses : undefined,
    selectedHomeCountries.length > 0 ? selectedHomeCountries : undefined,
    selectedHomeCities.length > 0 ? selectedHomeCities : undefined,
    selectedProvinces.length > 0 ? selectedProvinces : undefined,
    selectedCampuses.length > 0 ? selectedCampuses : undefined,
    selectedAdmissionYears.length > 0 ? selectedAdmissionYears : undefined,
    selectedPassingYears.length > 0 ? selectedPassingYears : undefined,
    selectedOccupationStatuses.length > 0 ? selectedOccupationStatuses : undefined,
    selectedSectors.length > 0 ? selectedSectors : undefined,
    selectedWorkCities.length > 0 ? selectedWorkCities : undefined,
    selectedWorkCountries.length > 0 ? selectedWorkCountries : undefined,
    selectedInstitutionNames.length > 0 ? selectedInstitutionNames : undefined,
    selectedProgramsEnrolled.length > 0 ? selectedProgramsEnrolled : undefined,
    selectedFundingSources.length > 0 ? selectedFundingSources : undefined,
    selectedInstitutionCountries.length > 0 ? selectedInstitutionCountries : undefined,
      selectedInstitutionCities.length > 0 ? selectedInstitutionCities : undefined,
      selectedMrNos.length > 0 ? selectedMrNos : undefined,
      selectedPhotoConsents.length > 0 ? selectedPhotoConsents : undefined,
      selectedSapIdStates.length > 0 ? selectedSapIdStates : undefined,
      selectedRegNoStates.length > 0 ? selectedRegNoStates : undefined
  );
  
  // Debug logging - commented out to fix build issue
  // useEffect(() => {
  //   console.log("[AlumniTabs] Selected tab:", selected, "Status filter:", statusFilter);
  //   console.log("[AlumniTabs] Paginated data:", paginatedData);
  //   if (paginatedData?.items) {
  //     console.log("[AlumniTabs] Items count:", paginatedData.items.length);
  //     const underApprovalItems = paginatedData.items.filter((item: any) => {
  //       const verifyVal = item.verify;
  //       return verifyVal === null || verifyVal === undefined || verifyVal === "" || 
  //              String(verifyVal).toLowerCase().trim() === 'pending';
  //     });
  //     console.log("[AlumniTabs] Items with verify = 'pending' or null:", underApprovalItems.length);
  //   }
  // }, [selected, statusFilter, paginatedData]);
  
  // Fetch counts separately (lightweight query) - stable caching to prevent reloading
  const {
    data: countsData,
    isLoading: isLoadingCounts,
  } = useQuery<AlumniCounts, Error>({
    queryKey: [
      "alumnilist-counts", 
      debouncedQuery,
      statusFilter,
      selectedFaculties, 
      selectedDepartments, 
      selectedPrograms,
      selectedGenders,
      selectedMaritalStatuses,
      selectedHomeCountries,
      selectedHomeCities,
      selectedProvinces,
      selectedCampuses,
      selectedAdmissionYears,
      selectedPassingYears,
      selectedOccupationStatuses,
      selectedSectors,
      selectedWorkCities,
      selectedWorkCountries,
      selectedInstitutionNames,
      selectedProgramsEnrolled,
      selectedFundingSources,
      selectedInstitutionCountries,
      selectedInstitutionCities,
      selectedMrNos,
      selectedPhotoConsents,
      selectedSapIdStates,
      selectedRegNoStates
    ],
    queryFn: ({ signal }) => getAlumniCounts(
      signal, 
      debouncedQuery || undefined,
      statusFilter,
      selectedFaculties.length > 0 ? selectedFaculties : undefined,
      selectedDepartments.length > 0 ? selectedDepartments : undefined,
      selectedPrograms.length > 0 ? selectedPrograms : undefined,
      selectedGenders.length > 0 ? selectedGenders : undefined,
      selectedMaritalStatuses.length > 0 ? selectedMaritalStatuses : undefined,
      selectedHomeCountries.length > 0 ? selectedHomeCountries : undefined,
      selectedHomeCities.length > 0 ? selectedHomeCities : undefined,
      selectedProvinces.length > 0 ? selectedProvinces : undefined,
      selectedCampuses.length > 0 ? selectedCampuses : undefined,
      selectedAdmissionYears.length > 0 ? selectedAdmissionYears : undefined,
      selectedPassingYears.length > 0 ? selectedPassingYears : undefined,
      selectedOccupationStatuses.length > 0 ? selectedOccupationStatuses : undefined,
      selectedSectors.length > 0 ? selectedSectors : undefined,
      selectedWorkCities.length > 0 ? selectedWorkCities : undefined,
      selectedWorkCountries.length > 0 ? selectedWorkCountries : undefined,
      selectedInstitutionNames.length > 0 ? selectedInstitutionNames : undefined,
      selectedProgramsEnrolled.length > 0 ? selectedProgramsEnrolled : undefined,
      selectedFundingSources.length > 0 ? selectedFundingSources : undefined,
      selectedInstitutionCountries.length > 0 ? selectedInstitutionCountries : undefined,
      selectedInstitutionCities.length > 0 ? selectedInstitutionCities : undefined,
      selectedMrNos.length > 0 ? selectedMrNos : undefined,
      selectedPhotoConsents.length > 0 ? selectedPhotoConsents : undefined,
      selectedSapIdStates.length > 0 ? selectedSapIdStates : undefined,
      selectedRegNoStates.length > 0 ? selectedRegNoStates : undefined
    ),
    staleTime: 0, // Always consider stale - refetch when invalidated to get real-time updates
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchOnMount: true, // Always refetch when component mounts
    enabled: true, // Always enabled
    retry: 2, // Retry failed requests 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
  
  // Dynamic verify-based statuses fetched from database (verify column)
  const { data: verifyStatusesData } = useVerifyStatuses();
  
  const totalRecords = paginatedData?.total ?? 0;

  // Map server items to UI shape (optimized for performance)
  // Use paginated items for display
  const items: AlumniItem[] = useMemo(() => {
    const sourceItems = paginatedData?.items ?? [];
    if (!sourceItems || sourceItems.length === 0) return [];
    
    // Pre-allocate array for better performance
    const result: AlumniItem[] = [];
    result.length = sourceItems.length;
    let idx = 0;
    
    for (let i = 0; i < sourceItems.length; i++) {
      const r = sourceItems[i];
      
      // Allow records with either sapid OR registrationno for all tabs
      // This includes "Under Approval" records that might have null sapid
      if ((!r.sapid || !r.sapid.trim()) && (!r.registrationno || !r.registrationno.trim())) {
        // Skip only if both sapid and registrationno are missing
        continue;
      }
      
      // Optimize verification status check (handle string, boolean, or null)
      // Handle 'pending', null, undefined, empty string, or any non-true/false value as "underApproval"
      const verifyRaw = r.verify;
      let verifyStatus: "verified" | "unverified" | "underApproval";
      let verified: boolean;
      
      // Check if verify is null, undefined, empty, or 'pending'
      if (verifyRaw === null || verifyRaw === undefined || verifyRaw === "") {
        verifyStatus = "underApproval";
        verified = false;
      } else {
        // Convert to string and check value
        const verifyStr = String(verifyRaw).toLowerCase().trim();
        if (verifyStr === "true") {
          verifyStatus = "verified";
          verified = true;
        } else if (verifyStr === "false") {
          verifyStatus = "unverified";
          verified = false;
        } else if (verifyStr === "pending") {
          // Explicitly handle 'pending' status
          verifyStatus = "underApproval";
          verified = false;
        } else {
          // Any other value (empty string after trim, or unexpected value) = under approval
          verifyStatus = "underApproval";
          verified = false;
        }
      }
      
      // Debug logging for new registrations (verify = 'pending' or null)
      if (verifyRaw === null || verifyRaw === undefined || String(verifyRaw).toLowerCase().trim() === 'pending') {
        console.log("[AlumniTabs] Found alumni under approval:", r.sapid || r.registrationno || r.alumniid, "verify:", verifyRaw, "status:", verifyStatus);
      }
      
      // Optimize employment status check (single lowercase conversion)
      const employmentStatus: "Employed" | "Unemployed" = 
        (r.employeed?.toLowerCase() === "employed") ? "Employed" : "Unemployed";
      
      // Use sapid as ID if available, otherwise use registrationno, otherwise use alumniid as fallback
      const itemId = r.sapid?.trim() || r.registrationno?.trim() || String(r.alumniid);
      
      result[idx++] = {
        id: itemId,
        alumniid: r.alumniid ?? null,
        registrationNo: r.registrationno ?? null,
        name: r.alumniname ?? "",
        email: r.personalemail ?? r.officialemail ?? null,
        mobile: r.contactno ?? null,
        campus: r.campusname ?? null,
        faculty: r.facultyname ?? null,
        program: r.degreetitle ?? null,
        department: r.departmentname ?? null,
        passingYear: r.yearofending ?? null,
        workCountry: r.country ?? null,
        workCity: r.city ?? null,
        organization: r.nameoforganization ?? null,
        designation: r.designation ?? null,
        verified,
        verifyStatus,
        employmentStatus,
        lastLoginTime: r.lasttimelogin ?? null,
        loginCount: r.logincount ?? null,
        // Store raw values for sorting
        sapId: r.sapid?.trim() || "",
        rawName: r.alumniname || "",
      } as AlumniItem & { sapId: string; rawName: string };
    }
    
    // Trim array to actual size
    return result.slice(0, idx);
  }, [paginatedData]);

  // Use counts from server (lightweight query) - always use server data for real-time accuracy
  const counts = useMemo(() => {
    // Always use server counts if available (real-time data)
    if (countsData) {
      const category = countsData.category || { aPlus: 0, a: 0, b: 0, c: 0, d: 0, distinguished: 0 };
      return {
        total: countsData.total || 0,
        verified: countsData.verified || 0,
        unverified: countsData.unverified || 0,
        underApproval: countsData.underApproval || 0,
        active: countsData.active || 0,
        inactive: countsData.inactive || 0,
        category: {
          aPlus: category.aPlus || 0,
          a: category.a || 0,
          b: category.b || 0,
          c: category.c || 0,
          d: category.d || 0,
          distinguished: category.distinguished || 0,
        },
      };
    }
    // Fallback: use total from paginated response while counts are loading
    return {
      total: totalRecords || 0,
      verified: 0,
      unverified: 0,
      underApproval: 0,
      active: 0,
      inactive: 0,
      category: { aPlus: 0, a: 0, b: 0, c: 0, d: 0, distinguished: 0 },
    };
  }, [countsData, totalRecords]);

  // Build dynamic status options based on verify statuses from DB, with fallback and counts
  const statusOptions: { value: string; label: string; count: number }[] = useMemo(() => {
    const opts: { value: string; label: string; count: number }[] = [];

    const verifyMap: Record<string, { label: string; count: number }> = {
      verified: { label: "Verified", count: counts.verified },
      unverified: { label: "Unverified", count: counts.unverified },
      underApproval: { label: "Under Approval", count: counts.underApproval },
    };

    if (verifyStatusesData?.statuses && verifyStatusesData.statuses.length > 0) {
      for (const s of verifyStatusesData.statuses) {
        const key = s.key as keyof typeof verifyMap;
        const base = verifyMap[key];
        const label = s.label || base?.label || s.key;
        const count = base?.count ?? 0;
        opts.push({ value: s.key, label, count });
      }
    } else {
      // Fallback to default verify-based statuses if API not available
      opts.push(
        { value: "verified", label: "Verified", count: counts.verified },
        { value: "unverified", label: "Unverified", count: counts.unverified },
        { value: "underApproval", label: "Under Approval", count: counts.underApproval },
      );
    }

    // Always append synthetic statuses derived from activity
    opts.push(
      { value: "active", label: "Active", count: counts.active },
      { value: "inactive", label: "Inactive", count: counts.inactive },
    );

    return opts;
  }, [counts, verifyStatusesData]);

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  // Reset sorting
  const handleResetSort = useCallback(() => {
    setSortField(null);
    setSortDirection("asc");
  }, []);

  // Filter by tab only (search and status filtering are now handled server-side)
  // No client-side filtering needed - server already returns the correct filtered and paginated data
  // Apply sorting to items
  const filteredItems = useMemo(() => {
    // Since all filtering (search, status, active, category) is handled server-side,
    // we just return the items as-is from the server
    
    // Apply sorting if a sort field is selected
    if (!sortField) {
    return items;
    }
    
    const sorted = [...items].sort((a, b) => {
      let aValue: string | number | null | undefined = "";
      let bValue: string | number | null | undefined = "";
      
      switch (sortField) {
        case "alumniid":
          // Sort numerically by alumniid
          aValue = a.alumniid ?? null;
          bValue = b.alumniid ?? null;
          // Handle null values - put them at the end
          if (aValue === null && bValue === null) return 0;
          if (aValue === null) return 1;
          if (bValue === null) return -1;
          // Compare as numbers
          return sortDirection === "asc" 
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
        case "name":
          // Use rawName if available, otherwise use name
          aValue = (a.rawName || a.name || "").trim().toLowerCase();
          bValue = (b.rawName || b.name || "").trim().toLowerCase();
          break;
        case "sapId":
          // Sort by SAP ID first, then registration number, then ID
          const aSapId = (a.sapId || "").trim().toLowerCase();
          const bSapId = (b.sapId || "").trim().toLowerCase();
          const aRegNo = (a.registrationNo || "").trim().toLowerCase();
          const bRegNo = (b.registrationNo || "").trim().toLowerCase();
          // Compare SAP ID first, if equal compare registration number
          if (aSapId && bSapId) {
            aValue = aSapId;
            bValue = bSapId;
          } else if (aSapId) {
            aValue = aSapId;
            bValue = bRegNo || aSapId; // Prefer SAP ID
          } else if (bSapId) {
            aValue = aRegNo || bSapId;
            bValue = bSapId;
          } else {
            // Both don't have SAP ID, compare by registration number or ID
            aValue = (aRegNo || a.id || "").trim().toLowerCase();
            bValue = (bRegNo || b.id || "").trim().toLowerCase();
          }
          break;
        case "email":
          aValue = (a.email || "").trim().toLowerCase();
          bValue = (b.email || "").trim().toLowerCase();
          break;
        case "faculty":
          aValue = (a.faculty || "").trim().toLowerCase();
          bValue = (b.faculty || "").trim().toLowerCase();
          break;
        case "department":
          aValue = (a.department || "").trim().toLowerCase();
          bValue = (b.department || "").trim().toLowerCase();
          break;
        case "program":
          aValue = (a.program || "").trim().toLowerCase();
          bValue = (b.program || "").trim().toLowerCase();
          break;
        case "status":
          aValue = (a.verifyStatus || "").toLowerCase();
          bValue = (b.verifyStatus || "").toLowerCase();
          break;
        default:
          return 0;
      }
      
      // Ensure values are strings for comparison
      const aStr = String(aValue || "");
      const bStr = String(bValue || "");
      
      // Compare values
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [items, selected, sortField, sortDirection]);

  // Pagination derived values - use server-side pagination
  const total = totalRecords; // Use total from server
  const totalPages = showAll ? 1 : (paginatedData?.totalPages ?? Math.max(1, Math.ceil(total / pageSize)));
  
  // No need to slice - server already returns the correct page
  const pageItems = useMemo(() => filteredItems, [filteredItems]);

  // Reset page only when filters/tabs change, not when page changes
  useEffect(() => { 
    // Only reset if current page is invalid after filter/tab change
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
    setSelectedRowId(null); 
  }, [selected, pageSize, debouncedQuery, totalPages]);
  
  // Separate effect to clear selected row when page changes (but don't reset page)
  useEffect(() => {
    setSelectedRowId(null);
  }, [currentPage]);

  // Sync scroll between top scrollbar and table container
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const topScrollbar = topScrollbarRef.current;
    
    if (!tableContainer || !topScrollbar) return;

    // Sync scrollbar width with table content
    const syncScrollbarWidth = () => {
      const tableContent = tableContainer.querySelector('.table-content-wrapper') as HTMLElement;
      if (tableContent) {
        const scrollbarContent = topScrollbar.querySelector('.table-scrollbar-content') as HTMLElement;
        if (scrollbarContent) {
          scrollbarContent.style.minWidth = `${tableContent.scrollWidth}px`;
        }
      }
    };

    const handleTableScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        topScrollbar.scrollLeft = tableContainer.scrollLeft;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 10);
      }
    };

    const handleTopScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        tableContainer.scrollLeft = topScrollbar.scrollLeft;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 10);
      }
    };

    // Initial sync
    syncScrollbarWidth();

    // Watch for content changes
    const resizeObserver = new ResizeObserver(() => {
      syncScrollbarWidth();
    });

    const tableContent = tableContainer.querySelector('.table-content-wrapper');
    if (tableContent) {
      resizeObserver.observe(tableContent);
    }

    tableContainer.addEventListener('scroll', handleTableScroll);
    topScrollbar.addEventListener('scroll', handleTopScroll);

    return () => {
      resizeObserver.disconnect();
      tableContainer.removeEventListener('scroll', handleTableScroll);
      topScrollbar.removeEventListener('scroll', handleTopScroll);
    };
  }, [pageItems, isLoading]);

  // Action hooks and handlers must live inside the component body
  const queryClient = useQueryClient();
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  // Export to Excel function with column selection
  const handleExportToExcel = useCallback(async () => {
    // Helper function to format chapter names
    const formatChapters = (item: Record<string, unknown>) => {
      const chapters: string[] = [];
      const chapter1 = String(item.chapter1_national || item.chapter1_international || "");
      const chapter2 = String(item.chapter2_national || item.chapter2_international || "");
      const chapter3 = String(item.chapter3_national || item.chapter3_international || "");
      if (chapter1) chapters.push(chapter1);
      if (chapter2) chapters.push(chapter2);
      if (chapter3) chapters.push(chapter3);
      return chapters.filter(c => c).join(", ") || "";
    };

    // Async function to fetch and transform data (only called when Export is clicked)
    const fetchAndTransformData = async (): Promise<Record<string, unknown>[]> => {
      // Fetch comprehensive data from export endpoint
      const url = new URL("/api/alumni/export", typeof window !== "undefined" ? window.location.origin : "");
      if (debouncedQuery) {
        url.searchParams.set("search", debouncedQuery);
      }
      if (statusFilter) {
        if (Array.isArray(statusFilter)) {
          statusFilter.forEach(s => url.searchParams.append("status", s));
        } else {
        url.searchParams.set("status", statusFilter);
        }
      }
      if (selectedFaculties.length > 0) {
        selectedFaculties.forEach(faculty => {
          url.searchParams.append("faculty", faculty);
        });
      }
      if (selectedDepartments.length > 0) {
        selectedDepartments.forEach(dept => {
          url.searchParams.append("department", dept);
        });
      }
      if (selectedPrograms.length > 0) {
        selectedPrograms.forEach(prog => {
          url.searchParams.append("program", prog);
        });
      }
      if (selectedGenders.length > 0) {
        selectedGenders.forEach(gender => {
          url.searchParams.append("gender", gender);
        });
      }
      if (selectedMaritalStatuses.length > 0) {
        selectedMaritalStatuses.forEach(status => {
          url.searchParams.append("maritalStatus", status);
        });
      }
      if (selectedHomeCountries.length > 0) {
        selectedHomeCountries.forEach(country => {
          url.searchParams.append("homeCountry", country);
        });
      }
      if (selectedHomeCities.length > 0) {
        selectedHomeCities.forEach(city => {
          url.searchParams.append("homeCity", city);
        });
      }
      if (selectedProvinces.length > 0) {
        selectedProvinces.forEach(province => {
          url.searchParams.append("province", province);
        });
      }
      if (selectedCampuses.length > 0) {
        selectedCampuses.forEach(campus => {
          url.searchParams.append("campus", campus);
        });
      }
      if (selectedAdmissionYears.length > 0) {
        selectedAdmissionYears.forEach(year => {
          url.searchParams.append("admissionYear", year);
        });
      }
      if (selectedPassingYears.length > 0) {
        selectedPassingYears.forEach(year => {
          url.searchParams.append("passingYear", year);
        });
      }
      if (selectedOccupationStatuses.length > 0) {
        selectedOccupationStatuses.forEach(status => {
          url.searchParams.append("occupationStatus", status);
        });
      }
      if (selectedSectors.length > 0) {
        selectedSectors.forEach(sector => {
          url.searchParams.append("sector", sector);
        });
      }
      if (selectedWorkCities.length > 0) {
        selectedWorkCities.forEach(city => {
          url.searchParams.append("workCity", city);
        });
      }
      if (selectedWorkCountries.length > 0) {
        selectedWorkCountries.forEach(country => {
          url.searchParams.append("workCountry", country);
        });
      }
      if (selectedInstitutionNames.length > 0) {
        selectedInstitutionNames.forEach(name => {
          url.searchParams.append("institutionName", name);
        });
      }
      if (selectedProgramsEnrolled.length > 0) {
        selectedProgramsEnrolled.forEach(program => {
          url.searchParams.append("programEnrolled", program);
        });
      }
      if (selectedFundingSources.length > 0) {
        selectedFundingSources.forEach(source => {
          url.searchParams.append("fundingSource", source);
        });
      }
      if (selectedInstitutionCountries.length > 0) {
        selectedInstitutionCountries.forEach(country => {
          url.searchParams.append("institutionCountry", country);
        });
      }
      if (selectedInstitutionCities.length > 0) {
        selectedInstitutionCities.forEach(city => {
          url.searchParams.append("institutionCity", city);
        });
      }
      if (selectedMrNos.length > 0) {
        selectedMrNos.forEach(mrNo => {
          url.searchParams.append("mrNo", mrNo);
        });
      }
      if (selectedPhotoConsents.length > 0) {
        selectedPhotoConsents.forEach(consent => {
          url.searchParams.append("photoConsent", consent);
        });
      }
      if (selectedSapIdStates.length > 0) {
        selectedSapIdStates.forEach(state => {
          url.searchParams.append("sapIdState", state);
        });
      }
      if (selectedRegNoStates.length > 0) {
        selectedRegNoStates.forEach(state => {
          url.searchParams.append("regNoState", state);
        });
      }
      
      // Add timeout and abort controller for large exports
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
      
      const res = await fetch(url.toString(), {
        headers: { "accept": "application/json" },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        // Read body ONCE, then try to parse JSON from the raw text.
        // This avoids "body stream already read" errors in some environments.
        let errorMessage = `Failed to fetch export data: ${res.status}`;
        const rawBody = await res.text().catch(() => "");

        if (rawBody) {
          try {
            const errorData = JSON.parse(rawBody);
            if (errorData.error) {
              errorMessage = errorData.error;
              if (errorData.suggestion) {
                errorMessage += `\n\n${errorData.suggestion}`;
              }
              if (errorData.totalCount) {
                errorMessage += `\n\nTotal records matching filters: ${errorData.totalCount}`;
              }
            } else {
              // Fallback to plain text if no structured error
              errorMessage = rawBody || errorMessage;
            }
          } catch {
            // Not JSON, use raw text
            errorMessage = rawBody || errorMessage;
          }
        }

        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      const allItems = data.items || [];
      
      // Show warning if dataset is large
      if (data.warning) {
        console.warn(data.warning);
      }
      
      if (!allItems || allItems.length === 0) {
        throw new Error("No data found to export with the applied filters.");
      }

      // Map ALL fields to Excel format
      return allItems.map((item: Record<string, unknown>) => ({
        // Basic Information
        "Alumni ID": item.alumniid || "",
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationno || "",
        "MR No": item.registrationno || "",
        "Alumni Email": item.alumniemail || "",
        "Full Name": item.alumniname || "",
        "Gender": item.gender || "",
        "Father Name": item.fathername || "",
        "Father CNIC": item.father_cnic || "",
        "Date of Birth": item.dateofbirth || "",
        "Marital Status": item.maritalstatus || "",
        "CNIC/Passport": item.cnicpassport || "",
        
        // Contact Information
        "Contact No": item.contactno || "",
        "Contact No 1": item.contactno1 || "",
        "Contact No 1 Show": item.contactno1show || "",
        "Personal Email": item.personalemail || "",
        "Personal Email Show": item.personalemailshow || "",
        "University Email": item.universityemail || "",
        "Official Email": item.officialemail || "",
        "Official Number": item.officialnumber || "",
        "Address": item.address || "",
        "Country": item.country || "",
        "Province": item.province || "",
        "City": item.city || "",
        
        // Academic Information
        "Academic Session": item.academicsession || "",
        "Degree Title": item.degreetitle || "",
        "CGPA": item.cgpa || "",
        "Year of Starting": item.yearofstarting || "",
        "Year of Ending": item.yearofending || "",
        "Faculty": item.facultyname || "",
        "Campus": item.campusname || "",
        "Department": item.departmentname || "",
        "Major Subject": item.majorsubject || "",
        
        // Professional Information
        "Industry": item.industry || "",
        "Employment Status": item.employeed || "",
        "Organization": item.nameoforganization || "",
        "Designation": item.designation || "",
        "Total Years of Experience": item.totalyearsofexpereince || "",
        "Work City": item.work_city || "",
        "Work Country": item.work_country || "",
        "Organization Address": item.organization_address || "",
        "Supervisor Designation": item.supervisordesignation || "",
        "Supervisor Number": item.supervisornumber || "",
        
        // Higher Education
        "Higher Education Institute Name": item.higher_education_institute_name || "",
        "Higher Education Degree Title": item.degree_title || "",
        "Is Scholarship": item.is_scholarship || "",
        "Higher Education Program": item.higher_education_program || "",
        "Higher Education Institute Country": item.higher_education_institute_country || "",
        "Higher Education Institute Province": item.higher_education_institute_province || "",
        "Higher Education Institute City": item.higher_education_institute_city || "",
        
        // Chapters
        "Chapter 1 ID": item.chapter1_id || "",
        "Chapter 1": item.chapter1_national || item.chapter1_international || "",
        "Chapter 2 ID": item.chapter2_id || "",
        "Chapter 2": item.chapter2_national || item.chapter2_international || "",
        "Chapter 3 ID": item.chapter3_id || "",
        "Chapter 3": item.chapter3_national || item.chapter3_international || "",
        "All Chapters": formatChapters(item),
        "Chapter Remarks": item.chapter_remarks || "",
        
        // Association
        "Association ID": item.association_id_value || "",
        "Association Title": item.association_title || "",
        "Association Description": item.association_description || "",
        "Association Dean": item.association_dean || "",
        "Association Phone": item.association_phone || "",
        "Association Email": item.association_email || "",
        "Association Address": item.association_address || "",
        
        // Chapter Leadership
        "Chapter Leadership ID": item.chapter_leadership_id || "",
        "Chapter Leadership Post": item.chapter_leadership_post || "",
        "Chapter Leadership Status": item.chapter_leadership_status || "",
        "Chapter Leadership Rejection Reason": item.chapter_leadership_rejection_reason || "",
        "Chapter Leadership Created At": item.chapter_leadership_created_at || "",
        "Chapter Leadership Updated At": item.chapter_leadership_updated_at || "",
        
        // Memberships
        "Gym Membership Month": item.gym_membership_month || "",
        "Swimming Pool Membership Month": item.swimmingpool_membership_month || "",
        "Membership Created At": item.membership_created_at || "",
        
        // Scholarships
        "Scholarship Kinship First Name": item.kinship_firstname || "",
        "Scholarship Kinship Last Name": item.kinship_lastname || "",
        "Scholarship Kinship CNIC": item.kinship_cnic || "",
        "Scholarship Apply For": item.apply_for || "",
        "Scholarship Degree Title": item.scholarship_degree_title || "",
        "Scholarship Created At": item.scholarship_created_at || "",
        
        // Additional Information
        "About Me": item.aboutme || "",
        "About": item.about || "",
        "Image 1": item.image1 || "",
        "Image 2": item.image2 || "",
        "CV": item.cv || "",
        
        // Social Links
        "Facebook": item.facebook || "",
        "Instagram": item.instagram || "",
        "YouTube": item.youtube || "",
        "LinkedIn": item.linkedin || "",
        
        // System Information
        "Verification Status": (() => {
          const verifyValue = item.verify;
          if (verifyValue === "true") return "Verified";
          if (verifyValue === "false") return "Unverified";
          if (verifyValue === "pending" || verifyValue === null || verifyValue === "" || verifyValue === undefined) return "Under Approval";
          return String(verifyValue || "");
        })(),
        "Last Login": item.lasttimelogin || "",
        "Login Count": item.logincount || 0,
        "Email Send Count": item.emailsendcount || 0,
        "Email Send Status": item.emailsendstatus || "",
        "Data Source": item.datasource || "",
        "Alumni Status": (() => {
          const hasLogin = (item.lasttimelogin && String(item.lasttimelogin).trim() !== "") || (item.logincount && Number(item.logincount) > 0);
          return hasLogin ? "Active" : "Inactive";
        })(),
        "Photo Usage Consent": item.alumni_consent_pic === true ? "Allowed" : item.alumni_consent_pic === false ? "Not Allowed" : "Null",
        "Created Date Time": item.createddatetime || "",
        "Today Date": item.todaydate || "",
      }));
    };

    // Define column options
    const columns: ColumnOption[] = [
        { key: "Alumni ID", label: "Alumni ID", defaultSelected: true },
        { key: "SAP ID", label: "SAP ID", defaultSelected: true },
        { key: "Registration No", label: "Registration No", defaultSelected: true },
        { key: "MR No", label: "MR No", defaultSelected: false },
        { key: "Alumni Email", label: "Alumni Email", defaultSelected: true },
        { key: "Full Name", label: "Full Name", defaultSelected: true },
        { key: "Gender", label: "Gender", defaultSelected: true },
        { key: "Father Name", label: "Father Name", defaultSelected: false },
        { key: "Father CNIC", label: "Father CNIC", defaultSelected: false },
        { key: "Date of Birth", label: "Date of Birth", defaultSelected: false },
        { key: "Marital Status", label: "Marital Status", defaultSelected: false },
        { key: "CNIC/Passport", label: "CNIC/Passport", defaultSelected: true },
        { key: "Contact No", label: "Contact No", defaultSelected: true },
        { key: "Contact No 1", label: "Contact No 1", defaultSelected: true },
        { key: "Contact No 1 Show", label: "Contact No 1 Show", defaultSelected: false },
        { key: "Personal Email", label: "Personal Email", defaultSelected: true },
        { key: "Personal Email Show", label: "Personal Email Show", defaultSelected: false },
        { key: "University Email", label: "University Email", defaultSelected: false },
        { key: "Official Email", label: "Official Email", defaultSelected: false },
        { key: "Official Number", label: "Official Number", defaultSelected: false },
        { key: "Address", label: "Address", defaultSelected: false },
        { key: "Country", label: "Country", defaultSelected: true },
        { key: "Province", label: "Province", defaultSelected: false },
        { key: "City", label: "City", defaultSelected: true },
        { key: "Degree Title", label: "Degree Title", defaultSelected: true },
        { key: "CGPA", label: "CGPA", defaultSelected: false },
        { key: "Year of Starting", label: "Year of Starting", defaultSelected: false },
        { key: "Year of Ending", label: "Year of Ending", defaultSelected: true },
        { key: "Faculty", label: "Faculty", defaultSelected: true },
        { key: "Campus", label: "Campus", defaultSelected: true },
        { key: "Department", label: "Department", defaultSelected: true },
        { key: "Major Subject", label: "Major Subject", defaultSelected: false },
        { key: "Industry", label: "Industry", defaultSelected: false },
        { key: "Employment Status", label: "Employment Status", defaultSelected: false },
        { key: "Organization", label: "Organization", defaultSelected: false },
        { key: "Designation", label: "Designation", defaultSelected: false },
        { key: "Total Years of Experience", label: "Total Years of Experience", defaultSelected: false },
        { key: "Work City", label: "Work City", defaultSelected: false },
        { key: "Work Country", label: "Work Country", defaultSelected: false },
        { key: "Organization Address", label: "Organization Address", defaultSelected: false },
        { key: "Supervisor Designation", label: "Supervisor Designation", defaultSelected: false },
        { key: "Supervisor Number", label: "Supervisor Number", defaultSelected: false },
        { key: "Higher Education Institute Name", label: "Higher Education Institute Name", defaultSelected: false },
        { key: "Higher Education Degree Title", label: "Higher Education Degree Title", defaultSelected: false },
        { key: "Is Scholarship", label: "Is Scholarship", defaultSelected: false },
        { key: "Higher Education Program", label: "Higher Education Program", defaultSelected: false },
        { key: "Higher Education Institute Country", label: "Higher Education Institute Country", defaultSelected: false },
        { key: "Higher Education Institute Province", label: "Higher Education Institute Province", defaultSelected: false },
        { key: "Higher Education Institute City", label: "Higher Education Institute City", defaultSelected: false },
        { key: "Chapter 1 ID", label: "Chapter 1 ID", defaultSelected: false },
        { key: "Chapter 1", label: "Chapter 1", defaultSelected: false },
        { key: "Chapter 2 ID", label: "Chapter 2 ID", defaultSelected: false },
        { key: "Chapter 2", label: "Chapter 2", defaultSelected: false },
        { key: "Chapter 3 ID", label: "Chapter 3 ID", defaultSelected: false },
        { key: "Chapter 3", label: "Chapter 3", defaultSelected: false },
        { key: "All Chapters", label: "All Chapters", defaultSelected: false },
        { key: "Chapter Remarks", label: "Chapter Remarks", defaultSelected: false },
        { key: "Association ID", label: "Association ID", defaultSelected: false },
        { key: "Association Title", label: "Association Title", defaultSelected: false },
        { key: "Association Description", label: "Association Description", defaultSelected: false },
        { key: "Association Dean", label: "Association Dean", defaultSelected: false },
        { key: "Association Phone", label: "Association Phone", defaultSelected: false },
        { key: "Association Email", label: "Association Email", defaultSelected: false },
        { key: "Association Address", label: "Association Address", defaultSelected: false },
        { key: "Chapter Leadership ID", label: "Chapter Leadership ID", defaultSelected: false },
        { key: "Chapter Leadership Post", label: "Chapter Leadership Post", defaultSelected: false },
        { key: "Chapter Leadership Status", label: "Chapter Leadership Status", defaultSelected: false },
        { key: "Chapter Leadership Rejection Reason", label: "Chapter Leadership Rejection Reason", defaultSelected: false },
        { key: "Chapter Leadership Created At", label: "Chapter Leadership Created At", defaultSelected: false },
        { key: "Chapter Leadership Updated At", label: "Chapter Leadership Updated At", defaultSelected: false },
        { key: "Gym Membership Month", label: "Gym Membership Month", defaultSelected: false },
        { key: "Swimming Pool Membership Month", label: "Swimming Pool Membership Month", defaultSelected: false },
        { key: "Membership Created At", label: "Membership Created At", defaultSelected: false },
        { key: "Scholarship Kinship First Name", label: "Scholarship Kinship First Name", defaultSelected: false },
        { key: "Scholarship Kinship Last Name", label: "Scholarship Kinship Last Name", defaultSelected: false },
        { key: "Scholarship Kinship CNIC", label: "Scholarship Kinship CNIC", defaultSelected: false },
        { key: "Scholarship Apply For", label: "Scholarship Apply For", defaultSelected: false },
        { key: "Scholarship Degree Title", label: "Scholarship Degree Title", defaultSelected: false },
        { key: "Scholarship Created At", label: "Scholarship Created At", defaultSelected: false },
        { key: "About Me", label: "About Me", defaultSelected: false },
        { key: "About", label: "About", defaultSelected: false },
        { key: "Image 1", label: "Image 1", defaultSelected: false },
        { key: "Image 2", label: "Image 2", defaultSelected: false },
        { key: "CV", label: "CV", defaultSelected: false },
        { key: "Facebook", label: "Facebook", defaultSelected: false },
        { key: "Instagram", label: "Instagram", defaultSelected: false },
        { key: "YouTube", label: "YouTube", defaultSelected: false },
        { key: "LinkedIn", label: "LinkedIn", defaultSelected: false },
        { key: "Verification Status", label: "Verification Status", defaultSelected: true },
        { key: "Last Login", label: "Last Login", defaultSelected: false },
        { key: "Login Count", label: "Login Count", defaultSelected: false },
        { key: "Email Send Count", label: "Email Send Count", defaultSelected: false },
        { key: "Email Send Status", label: "Email Send Status", defaultSelected: false },
        { key: "Data Source", label: "Data Source", defaultSelected: false },
        { key: "Alumni Status", label: "Alumni Status", defaultSelected: false },
        { key: "Photo Usage Consent", label: "Photo Usage Consent", defaultSelected: false },
        { key: "Created Date Time", label: "Created Date Time", defaultSelected: false },
        { key: "Today Date", label: "Today Date", defaultSelected: false },
      ];

    // Decide which columns to include based on export toggles
    // Core columns that are ALWAYS exported by default
    const coreKeys = [
      "SAP ID",
      "Registration No",
      "Full Name", // Alumni Name
      "Alumni Email",
      "Contact No",
      "Contact No 1",
      "Personal Email",
    ];

    const facultyKeys = ["Faculty"];
    const departmentKeys = ["Department"];
    const programKeys = ["Academic Session", "Degree Title"];
    // Status columns - only include if at least one status is selected in the dropdown
    const statusKeys = additionalFilter.length > 0 ? ["Verification Status", "Alumni Status"] : [];

    // Master filter column groups
    const genderKeys = ["Gender"];
    const maritalStatusKeys = ["Marital Status"];
    const homeCountryKeys = ["Country"];
    const homeCityKeys = ["City"];
    const provinceKeys = ["Province"];
    const campusKeys = ["Campus"];
    const admissionYearKeys = ["Year of Starting"];
    const passingYearKeys = ["Year of Ending"];
    const occupationStatusKeys = ["Employment Status"];
    const sectorKeys = ["Industry"];
    const workCityKeys = ["Work City"];
    const workCountryKeys = ["Work Country"];
    const institutionNameKeys = ["Higher Education Institute Name"];
    const programEnrolledKeys = ["Higher Education Program"];
    const fundingSourceKeys = ["Is Scholarship"];
    const institutionCountryKeys = ["Higher Education Institute Country"];
    const institutionCityKeys = ["Higher Education Institute City"];
    const mrNoKeys = ["MR No"];
    const photoConsentKeys = ["Photo Usage Consent"];

    // Create a comprehensive mapping of all columns to their groups
    // This ensures every column is properly categorized
    const columnGroupMap = new Map<string, boolean>();
    
    // Map all columns to their groups
    columns.forEach((col) => {
      const key = col.key;
      
      // Core columns are always included
      if (coreKeys.includes(key)) {
        columnGroupMap.set(key, true);
        return;
      }
      
      // Map to checkbox groups
      if (facultyKeys.includes(key)) {
        columnGroupMap.set(key, exportFaculty);
      } else if (departmentKeys.includes(key)) {
        columnGroupMap.set(key, exportDepartment);
      } else if (programKeys.includes(key)) {
        columnGroupMap.set(key, exportProgram);
      } else if (statusKeys.includes(key)) {
        columnGroupMap.set(key, additionalFilter.length > 0);
      } else if (genderKeys.includes(key)) {
        columnGroupMap.set(key, exportGender);
      } else if (maritalStatusKeys.includes(key)) {
        columnGroupMap.set(key, exportMaritalStatus);
      } else if (homeCountryKeys.includes(key)) {
        columnGroupMap.set(key, exportHomeCountry);
      } else if (homeCityKeys.includes(key)) {
        columnGroupMap.set(key, exportHomeCity);
      } else if (provinceKeys.includes(key)) {
        columnGroupMap.set(key, exportProvince);
      } else if (campusKeys.includes(key)) {
        columnGroupMap.set(key, exportCampus);
      } else if (admissionYearKeys.includes(key)) {
        columnGroupMap.set(key, exportAdmissionYear);
      } else if (passingYearKeys.includes(key)) {
        columnGroupMap.set(key, exportPassingYear);
      } else if (occupationStatusKeys.includes(key)) {
        columnGroupMap.set(key, exportOccupationStatus);
      } else if (sectorKeys.includes(key)) {
        columnGroupMap.set(key, exportSector);
      } else if (workCityKeys.includes(key)) {
        columnGroupMap.set(key, exportWorkCity);
      } else if (workCountryKeys.includes(key)) {
        columnGroupMap.set(key, exportWorkCountry);
      } else if (institutionNameKeys.includes(key)) {
        columnGroupMap.set(key, exportInstitutionName);
      } else if (programEnrolledKeys.includes(key)) {
        columnGroupMap.set(key, exportProgramEnrolled);
      } else if (fundingSourceKeys.includes(key)) {
        columnGroupMap.set(key, exportFundingSource);
      } else if (institutionCountryKeys.includes(key)) {
        columnGroupMap.set(key, exportInstitutionCountry);
      } else if (institutionCityKeys.includes(key)) {
        columnGroupMap.set(key, exportInstitutionCity);
      } else if (mrNoKeys.includes(key)) {
        columnGroupMap.set(key, exportMrNo);
      } else if (photoConsentKeys.includes(key)) {
        columnGroupMap.set(key, exportPhotoConsent);
      } else {
        // Columns not in any group are NOT exported (explicit exclusion)
        columnGroupMap.set(key, false);
      }
    });

    // Filter columns based on the mapping - ONLY include columns that are marked as true
    const filteredColumns = columns.filter((col) => {
      return columnGroupMap.get(col.key) === true;
    });

    // Verify we have at least core columns (which should always be present)
    const coreColumnKeys = new Set(coreKeys);
    const hasCoreColumns = filteredColumns.some(col => coreColumnKeys.has(col.key));
    
    if (filteredColumns.length === 0 || !hasCoreColumns) {
      toast.error("Please select at least one column group to export");
      return;
    }
    
    // Use filteredColumns directly - no need for double filtering
    const finalFilteredColumns = filteredColumns;

    const dateStr = new Date().toISOString().split("T")[0];
    const statusStr = statusFilter ? `_${statusFilter}` : "";
    const searchStr = debouncedQuery ? `_search` : "";
    const filenameBase = `alumni_export${statusStr}${searchStr}`;

    // Set loading state and show toast
    setIsExporting(true);
    let loadingToast: string | undefined;
    let processingToast: string | undefined;

    try {
      loadingToast = toast.loading("Preparing export data...");

      // Fetch data (already filtered by statusFilter and other filters via API)
      const data = await fetchAndTransformData();
      
      // Dismiss loading toast and show processing toast
      if (loadingToast) toast.dismiss(loadingToast);
      processingToast = toast.loading(`Processing ${data.length} records for export...`);
      
      // Get the list of selected column keys from finalFilteredColumns (not filteredColumns)
      const selectedColumnKeys = new Set(finalFilteredColumns.map(col => col.key));
      
      // Filter data to ONLY include selected columns
      const filteredData = data.map((row) => {
        const filteredRow: Record<string, unknown> = {};
        selectedColumnKeys.forEach((key) => {
          // Only include columns that are in the selected columns list
          if (row.hasOwnProperty(key)) {
            filteredRow[key] = row[key] ?? "";
          }
        });
        return filteredRow;
      });
      
      // Export to Excel with filtered data and columns
      await exportJsonToExcel({
        data: filteredData,
        columns: finalFilteredColumns,
        filename: filenameBase,
        sheetName: "Alumni List",
      });
      
      // Dismiss processing toast (success toast will be shown by exportJsonToExcel)
      if (processingToast) toast.dismiss(processingToast);
    } catch (err) {
      // Dismiss any active toasts
      if (loadingToast) toast.dismiss(loadingToast);
      if (processingToast) toast.dismiss(processingToast);
      
      const msg =
        err instanceof Error ? err.message : "Failed to export data";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  }, [
    debouncedQuery,
    statusFilter,
    selectedFaculties,
    selectedDepartments,
    selectedPrograms,
    selectedGenders,
    selectedMaritalStatuses,
    selectedHomeCountries,
    selectedHomeCities,
    selectedProvinces,
    selectedCampuses,
    selectedAdmissionYears,
    selectedPassingYears,
    selectedOccupationStatuses,
    selectedSectors,
    selectedWorkCities,
    selectedWorkCountries,
    selectedInstitutionNames,
    selectedProgramsEnrolled,
    selectedFundingSources,
    selectedInstitutionCountries,
    selectedInstitutionCities,
    selectedMrNos,
    selectedPhotoConsents,
    selectedSapIdStates,
    selectedRegNoStates,
    exportFaculty,
    exportDepartment,
    exportProgram,
    additionalFilter, // Status columns depend on selected statuses in dropdown
    exportMaster,
  ]);
  const [actionError, setActionError] = useState<string | null>(null);

  const startMut = useCallback((id: string) => {
    setMutatingIds((prev) => new Set(prev).add(id));
  }, []);

  const stopMut = useCallback((id: string) => {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const updateCacheVerify = useCallback((sapid: string, verify: boolean) => {
    queryClient.setQueryData<AlumniListItem[] | undefined>(["alumnilist"], (old) => {
      if (!old) return old;
      return old.map((it) => (it.sapid === sapid ? { ...it, verify: verify ? "true" : "false" } : it));
    });
    // Invalidate counts to refetch real-time data (matches all query keys starting with ["alumnilist-counts"])
    queryClient.invalidateQueries({ 
      queryKey: ["alumnilist-counts"], 
      exact: false 
    });
    // Force refetch to get immediate updates
    queryClient.refetchQueries({ 
      queryKey: ["alumnilist-counts"], 
      exact: false 
    });
  }, [queryClient]);

  const removeFromCache = useCallback((sapid: string) => {
    queryClient.setQueryData<AlumniListItem[] | undefined>(["alumnilist"], (old) => {
      if (!old) return old;
      return old.filter((it) => it.sapid !== sapid);
    });
    // Invalidate counts to refetch real-time data (matches all query keys starting with ["alumnilist-counts"])
    queryClient.invalidateQueries({ 
      queryKey: ["alumnilist-counts"], 
      exact: false 
    });
    // Force refetch to get immediate updates
    queryClient.refetchQueries({ 
      queryKey: ["alumnilist-counts"], 
      exact: false 
    });
  }, [queryClient]);

  // Open confirmation modal for verify
  const handleVerifyClick = useCallback((sapid: string, name: string) => {
    setPendingAction({ type: "verify", sapid, name });
    confirmModal.openModal();
  }, [confirmModal]);

  // Execute verify after confirmation
  const handleVerify = useCallback(async (sapid: string): Promise<void> => {
    // Validate sapid before proceeding
    if (!sapid || sapid === "null" || sapid === "undefined" || sapid.trim() === "") {
      const errorMsg = "Invalid SAP ID. Cannot verify alumni without a valid SAP ID.";
      setActionError(errorMsg);
      throw new Error(errorMsg);
    }

    setActionError(null);
    startMut(sapid);
    // optimistic
    updateCacheVerify(sapid, true);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: true }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to verify: ${res.status}` }));
        throw new Error(errorData.error || `Failed to verify: ${res.status}`);
      }
      const responseData = await res.json();
      console.log("[AlumniTabs] Verify response:", responseData);
      if (responseData.verify === false || responseData.verify === "false") {
        console.error("[AlumniTabs] Verify returned false when it should be true!");
        throw new Error("Verification failed - server returned false");
      }
      setActionMessage("Alumni verified successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni", "profile", sapid] });
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Refresh counts
      queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Force immediate refetch
      queryClient.invalidateQueries({ queryKey: ["alumnilist"] }); // Refresh list
    } catch (e: unknown) {
      // revert
      updateCacheVerify(sapid, false);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to verify alumni.");
      throw e; // Re-throw so executePendingAction can catch it
    } finally {
      stopMut(sapid);
    }
  }, [startMut, stopMut, updateCacheVerify, queryClient]);

  // Open confirmation modal for unverify
  const handleUnverifyClick = useCallback((sapid: string, name: string) => {
    setPendingAction({ type: "unverify", sapid, name });
    confirmModal.openModal();
  }, [confirmModal]);

  // Execute unverify after confirmation
  const handleUnverify = useCallback(async (sapid: string): Promise<void> => {
    // Validate sapid before proceeding
    if (!sapid || sapid === "null" || sapid === "undefined" || sapid.trim() === "") {
      const errorMsg = "Invalid SAP ID. Cannot unverify alumni without a valid SAP ID.";
      setActionError(errorMsg);
      throw new Error(errorMsg);
    }

    setActionError(null);
    startMut(sapid);
    // optimistic
    updateCacheVerify(sapid, false);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: false }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to unverify: ${res.status}` }));
        throw new Error(errorData.error || `Failed to unverify: ${res.status}`);
      }
      const responseData = await res.json();
      console.log("[AlumniTabs] Unverify response:", responseData);
      setActionMessage("Alumni marked as unverified.");
      queryClient.invalidateQueries({ queryKey: ["alumni", "profile", sapid] });
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Refresh counts
      queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Force immediate refetch
      queryClient.invalidateQueries({ queryKey: ["alumnilist"] }); // Refresh list
    } catch (e: unknown) {
      // revert
      updateCacheVerify(sapid, true);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to update verification.");
      throw e; // Re-throw so executePendingAction can catch it
    } finally {
      stopMut(sapid);
    }
  }, [startMut, stopMut, updateCacheVerify, queryClient]);

  // Open confirmation modal for delete (kept for potential future use)
  // const handleDeleteClick = useCallback((sapid: string, name: string) => {
  //   setPendingAction({ type: "delete", sapid, name });
  //   confirmModal.openModal();
  // }, [confirmModal]);

  // Execute delete after confirmation
  const handleDelete = useCallback(async (sapid: string) => {
    // Validate sapid before proceeding
    if (!sapid || sapid === "null" || sapid === "undefined" || sapid.trim() === "") {
      setActionError("Invalid SAP ID. Cannot delete alumni without a valid SAP ID.");
      return;
    }

    setActionError(null);
    setActionMessage(null);
    startMut(sapid);
    const prev = queryClient.getQueryData<AlumniListItem[] | undefined>(["alumnilist"]);
    // optimistic remove
    removeFromCache(sapid);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(sapid)}`, { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to delete: ${res.status}` }));
        throw new Error(errorData.error || `Failed to delete: ${res.status}`);
      }
      
      setActionMessage("Alumni deleted successfully.");
      // Invalidate both profile and list queries to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alumni", "profile", sapid] }),
        queryClient.invalidateQueries({ queryKey: ["alumnilist"] }),
        queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false }), // Refresh counts
        queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false }) // Force immediate refetch
      ]);
    } catch (e: unknown) {
      // rollback
      if (prev) queryClient.setQueryData(["alumnilist"], prev);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to delete alumni.");
      console.error("[AlumniTabs] Delete error:", msg, e);
    } finally {
      stopMut(sapid);
    }
  }, [removeFromCache, startMut, stopMut, queryClient]);

  // Execute pending action after confirmation
  const executePendingAction = useCallback(async () => {
    if (!pendingAction) {
      console.warn("[AlumniTabs] No pending action to execute");
      return;
    }
    
    const { type, sapid } = pendingAction;
    console.log("[AlumniTabs] Executing action:", type, "for SAP ID:", sapid);
    
    // Store the action locally before async operations
    const actionType = type;
    const actionSapid = sapid;
    
    try {
      if (actionType === "verify") {
        await handleVerify(actionSapid);
      } else if (actionType === "unverify") {
        await handleUnverify(actionSapid);
      } else if (actionType === "delete") {
        await handleDelete(actionSapid);
      }
      
      // Close modal and clear pending action after successful execution
      console.log("[AlumniTabs] Action completed successfully, closing modal");
      confirmModal.closeModal();
      setPendingAction(null);
    } catch (error) {
      // Error is already handled in the individual handlers (setActionError)
      // Keep modal open if there's an error so user can see the error message
      console.error("[AlumniTabs] Error executing action:", error);
      // Don't close modal on error - let user see the error and try again or cancel
    }
  }, [pendingAction, confirmModal, handleVerify, handleUnverify, handleDelete]);
  
  // Wrapper for button click to ensure it works
  const handleConfirmClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!pendingAction) {
      console.warn("[AlumniTabs] No pending action in confirm click");
      return;
    }
    
    if (mutatingIds.has(pendingAction.sapid)) {
      console.log("[AlumniTabs] Action already in progress, ignoring click");
      return;
    }
    
    console.log("[AlumniTabs] Confirm button clicked, executing action:", pendingAction.type, "for", pendingAction.sapid);
    await executePendingAction();
  }, [pendingAction, mutatingIds, executePendingAction]);

  const handleView = useCallback((sapid: string) => {
    router.push(`/alumni-profile?sapid=${encodeURIComponent(sapid)}`);
  }, [router]);

  // Helper function to render a tab button
  const renderTabButton = (tab: { key: TabKey; label: string }, idx: number, allTabs: { key: TabKey; label: string }[]) => {
    const statCount = (() => {
      switch (tab.key) {
        case "total":
          return counts.total;
        case "verified":
          return counts.verified;
        case "underApproval":
          return counts.underApproval;
        case "active":
          return counts.active;
        case "aPlus":
          return counts.category?.aPlus || 0;
        case "a":
          return counts.category?.a || 0;
        case "b":
          return counts.category?.b || 0;
        case "c":
          return counts.category?.c || 0;
        case "d":
          return counts.category?.d || 0;
        case "distinguished":
          return counts.category?.distinguished || 0;
        default:
          return 0;
      }
    })();
    
    const isSelected = selected === tab.key;
    const statusStyles = STATUS_CLASS_MAP[tab.key];
    const isDisabled = false; // All tabs are now functional
   
    return (
      <button
        key={tab.key}
        type="button"
        disabled={isDisabled}
        className={`
          relative group rounded-2xl p-4 text-left transition-all duration-300 ease-out w-50
          ${isSelected 
            ? `${statusStyles.selectedContainer} shadow-xl ring-2 ring-offset-2 ${statusStyles.iconColor.includes('blue') ? 'ring-blue-500' : statusStyles.iconColor.includes('emerald') ? 'ring-emerald-500' : statusStyles.iconColor.includes('rose') ? 'ring-rose-500' : statusStyles.iconColor.includes('amber') ? 'ring-amber-500' : statusStyles.iconColor.includes('indigo') ? 'ring-indigo-500' : statusStyles.iconColor.includes('purple') ? 'ring-purple-500' : 'ring-gray-500'} dark:ring-offset-gray-900 transform scale-[1.02]` 
            : 'bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:scale-[1.01]'
          }
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900
        `}
        onClick={() => {
          if (!isDisabled) {
            console.log("[AlumniTabs] Tab clicked:", tab.key);
            setSelected(tab.key);
            // Clear additional filter when switching tabs
            setAdditionalFilter([]);
          }
        }}
        role="tab"
        aria-selected={isSelected}
        aria-disabled={isDisabled}
        aria-label={`${tab.label} (${statCount.toLocaleString()})`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            const nextIdx = (idx + 1) % allTabs.length;
            setSelected(allTabs[nextIdx].key);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            const prevIdx = (idx - 1 + allTabs.length) % allTabs.length;
            setSelected(allTabs[prevIdx].key);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelected(tab.key);
          }
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h6 className={`text-xs font-bold uppercase tracking-wider ${statusStyles.labelText}`}>
            {tab.label}
          </h6>
          {isSelected && (
            <div className={`w-2.5 h-2.5 rounded-full ${statusStyles.iconBg} animate-pulse`} />
          )}
        </div>
        {isLoadingCounts && !countsData ? (
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" aria-label="Loading count" />
        ) : (
          <h3 className={`text-4xl font-extrabold tracking-tight ${statusStyles.labelText}`}>
            {statCount.toLocaleString()}
          </h3>
        )}
      </button>
    );
  };
  
  return (
    <div className="p-0">
      <div className="flex flex-col gap-8">
        {/* Stats Cards Section */}
        <div className="px-6 pt-2">
          {/* Regular Tabs */}
          <div className="flex flex-wrap gap-4 mb-6">
            {TABS.map((tab, idx) => renderTabButton(tab, idx, TABS))}
          </div>
          
          {/* Category Tabs with Label */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
              
            
              <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
            </div>
            <div className="flex flex-wrap gap-4">
              {CATEGORY_TABS.map((tab, idx) => renderTabButton(tab, idx, CATEGORY_TABS))}
            </div>
          </div>

          {/* Distinguished Alumni Tab */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
                Special
              </span>
              <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
            </div>
            <div className="flex flex-wrap gap-4">
              {DISTINGUISHED_TAB.map((tab, idx) => renderTabButton(tab, idx, DISTINGUISHED_TAB))}
            </div>
          </div>
        </div>

        {/* Distinguished Alumni Tab Content */}
        {selected === "distinguished" && <DistinguishedAlumniTab />}

        {/* Regular Alumni Tab Content */}
        {selected !== "distinguished" && (
        <>
        {/* Search and Filters Section */}
        <div className="px-6">
          <div className="flex flex-col  gap-4 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
            {/* Search Row */}
            <div className="flex-1 w-full">
              <label htmlFor="alumni-search" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5 uppercase tracking-wider">
                Search Alumni
              </label>
              <div className="relative">
                <svg 
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="alumni-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, SAP ID, registration no, email, faculty, department, or program..."
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-gray-100 transition-all duration-200"
                />
                </div>
            </div>
            
            {/* Filters Row - Checkbox-based multi-select with dropdown styling */}
            <div className="flex flex-wrap gap-3 items-start sm:items-end">
              {/* Faculty Filter */}
              <div className="flex-1 sm:min-w-[180px]">
                <label
                  htmlFor="faculty-filter"
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2"
                >
                  <span>Faculty</span>
                  <input
                    type="checkbox"
                    checked={exportFaculty}
                    onChange={(e) => setExportFaculty(e.target.checked)}
                    className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                    title="Include Faculty column in Excel export"
                  />
                </label>
                <div className="relative" ref={facultyFilterRef}>
                  <button
                    type="button"
                    id="faculty-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, faculty: !prev.faculty }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
                  >
                    <span>
                      {(() => {
                        const allValues = facultyOptions.map(f => f.value);
                        const isAllSelected = allValues.length > 0 && selectedFaculties.length === allValues.length;
                        if (selectedFaculties.length === 0 || isAllSelected) return "All Faculties";
                        return `${selectedFaculties.length} Selected`;
                      })()}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.faculty ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  </button>
                  {expandedFilters.faculty && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFacultySelectAll();
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={(() => {
                              const allValues = facultyOptions.map(f => f.value);
                              return allValues.length > 0 && selectedFaculties.length === allValues.length;
                            })()}
                            onChange={handleFacultySelectAll}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                          />
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Faculties</span>
                        </label>
                        <div className="max-h-48 overflow-y-auto">
                          {facultyOptions.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 p-2">No faculties found.</p>
                          ) : (
                            facultyOptions.map((faculty) => {
                              const isChecked = selectedFaculties.includes(faculty.value);
                            return (
                              <label
                                  key={faculty.value}
                                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                    onChange={() => handleFacultyToggle(faculty.value)}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{faculty.label}</span>
                                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{faculty.count.toLocaleString()}</span>
                              </label>
                            );
                            })
                          )}
                </div>
              </div>
            </div>
                  )}
                </div>
              </div>
              
              {/* Department Filter */}
              <div className="flex-1 sm:min-w-[180px]">
                <label
                  htmlFor="department-filter"
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2"
                >
                  <span>Department</span>
                  <input
                    type="checkbox"
                    checked={exportDepartment}
                    onChange={(e) => setExportDepartment(e.target.checked)}
                    className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                    title="Include Department column in Excel export"
                  />
                </label>
                <div className="relative" ref={departmentFilterRef}>
                  <button
                    type="button"
                    id="department-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, department: !prev.department }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
                  >
                    <span>
                      {(() => {
                        const allValues = departmentOptions.map(d => d.value);
                        const isAllSelected = allValues.length > 0 && selectedDepartments.length === allValues.length;
                        if (selectedDepartments.length === 0 || isAllSelected) return "All Departments";
                        return `${selectedDepartments.length} Selected`;
                      })()}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.department ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.department && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                            <label
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDepartmentSelectAll();
                              }}
                            >
                              <input
                                type="checkbox"
                            checked={(() => {
                              const allValues = departmentOptions.map(d => d.value);
                              return allValues.length > 0 && selectedDepartments.length === allValues.length;
                            })()}
                                onChange={handleDepartmentSelectAll}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                              />
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Departments</span>
                            </label>
                            <div className="max-h-48 overflow-y-auto">
                          {departmentOptions.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 p-2">No departments found.</p>
                          ) : (
                            departmentOptions.map((dept) => {
                              const isChecked = selectedDepartments.includes(dept.value);
                                return (
                                  <label
                                  key={dept.value}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                    onChange={() => handleDepartmentToggle(dept.value)}
                                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                    />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{dept.label}</span>
                                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{dept.count.toLocaleString()}</span>
                                  </label>
                                );
                            })
                        )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Program Filter */}
              <div className="flex-1 sm:min-w-[180px]">
                <label
                  htmlFor="program-filter"
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2"
                >
                  <span>Program</span>
                  <input
                    type="checkbox"
                    checked={exportProgram}
                    onChange={(e) => setExportProgram(e.target.checked)}
                    className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                    title="Include Program columns in Excel export"
                  />
                </label>
                <div className="relative" ref={programFilterRef}>
                  <button
                    type="button"
                    id="program-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, program: !prev.program }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
                  >
                    <span>
                      {(() => {
                        const allValues = programOptions.map(p => p.value);
                        const isAllSelected = allValues.length > 0 && selectedPrograms.length === allValues.length;
                        if (selectedPrograms.length === 0 || isAllSelected) return "All Programs";
                        return `${selectedPrograms.length} Selected`;
                      })()}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.program ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.program && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                            <label
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProgramSelectAll();
                              }}
                            >
                              <input
                                type="checkbox"
                            checked={(() => {
                              const allValues = programOptions.map(p => p.value);
                              return allValues.length > 0 && selectedPrograms.length === allValues.length;
                            })()}
                                onChange={handleProgramSelectAll}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                              />
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Programs</span>
                            </label>
                            <div className="max-h-48 overflow-y-auto">
                          {programOptions.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400 p-2">No programs found.</p>
                          ) : (
                            programOptions.map((prog) => {
                              const isChecked = selectedPrograms.includes(prog.value);
                                return (
                                  <label
                                  key={prog.value}
                                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                    onChange={() => handleProgramToggle(prog.value)}
                                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                    />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{prog.label}</span>
                                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{prog.count.toLocaleString()}</span>
                                  </label>
                                );
                            })
                        )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status Filter */}
              <div className="flex-1  sm:min-w-[160px]">
                <label
                  htmlFor="status-filter"
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider"
                >
                  Status
                </label>
                <div className="relative" ref={statusFilterRef}>
                  <button
                    type="button"
                    id="status-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, status: !prev.status }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
                  >
                    <span>
                      {additionalFilter.length === 0 
                        ? `All Status (${counts.total.toLocaleString()})` 
                        : additionalFilter.length === statusOptions.length
                        ? `All Status (${counts.total.toLocaleString()})`
                        : `${additionalFilter.length} Selected`}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.status ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.status && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <label
                          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusSelectAll();
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={additionalFilter.length === statusOptions.length}
                              onChange={handleStatusSelectAll}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                            />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Status</span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {counts.total.toLocaleString()}
                          </span>
                        </label>
                        <div className="max-h-48 overflow-y-auto">
                          {statusOptions.map((status) => {
                            const isChecked = additionalFilter.includes(status.value);
                            return (
                              <label
                                key={status.value}
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleStatusToggle(status.value)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{status.label}</span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {status.count.toLocaleString()}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Master Filters Section - Collapsible */}
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => setExpandedFilters(prev => ({ ...prev, masterFilters: !prev.masterFilters }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 flex items-center justify-between"
                >
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    Master Filters
                    <input
                      type="checkbox"
                      checked={exportMaster}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setExportMaster(checked);
                        // When master filter checkbox is toggled, toggle all master filter checkboxes
                        setExportGender(checked);
                        setExportMaritalStatus(checked);
                        setExportHomeCountry(checked);
                        setExportHomeCity(checked);
                        setExportProvince(checked);
                        setExportCampus(checked);
                        setExportAdmissionYear(checked);
                        setExportPassingYear(checked);
                        setExportOccupationStatus(checked);
                        setExportSector(checked);
                        setExportWorkCity(checked);
                        setExportWorkCountry(checked);
                        setExportInstitutionName(checked);
                        setExportProgramEnrolled(checked);
                        setExportFundingSource(checked);
                        setExportInstitutionCountry(checked);
                        setExportInstitutionCity(checked);
                        setExportMrNo(checked);
                        setExportPhotoConsent(checked);
                      }}
                      className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                      title="Include all additional (master) columns in Excel export"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                  <svg 
                    className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.masterFilters ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedFilters.masterFilters && (
                  <div className="mt-4 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {/* Gender Filter */}
                      <div className="relative" ref={genderFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Gender</span>
                          <input
                            type="checkbox"
                            checked={exportGender}
                            onChange={(e) => setExportGender(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Gender column in Excel export"
                          />
                        </label>
                        {isLoadingGenders ? (
                          <div className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : gendersError ? (
                          <div className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                            Error loading genders
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedFilters(prev => ({ ...prev, gender: !prev.gender }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {selectedGenders.length === 0
                                  ? "Select genders..."
                                  : selectedGenders.length === 1
                                  ? gendersData?.genders?.find(g => g.value === selectedGenders[0])?.label || selectedGenders[0]
                                  : `${selectedGenders.length} genders selected`}
                              </span>
                              <svg
                                className={`w-4 h-4 transition-transform ${expandedFilters.gender ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {expandedFilters.gender && (
                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                <div className="p-2">
                                  <label
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGenderSelectAll();
                                    }}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={gendersData?.genders && selectedGenders.length === gendersData.genders.length && gendersData.genders.length > 0}
                                        onChange={handleGenderSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Genders</span>
                                    </div>
                                  </label>
                                  <div className="max-h-48 overflow-y-auto">
                                    {gendersData?.genders && gendersData.genders.length > 0 ? (
                                      gendersData.genders.map((gender: GenderOption) => {
                                        const isChecked = selectedGenders.includes(gender.value);
                                        return (
                                          <label
                                            key={gender.value}
                                            className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleGenderToggle(gender.value)}
                                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                            />
                                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                              {gender.label} ({gender.count.toLocaleString()})
                                            </span>
                                          </label>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-sm text-gray-500">No genders available</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {selectedGenders.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedGenders.length} selected</p>
                        )}
                      </div>
                      
                      {/* Marital Status Filter */}
                      <div className="relative" ref={maritalStatusFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Marital Status</span>
                          <input
                            type="checkbox"
                            checked={exportMaritalStatus}
                            onChange={(e) => setExportMaritalStatus(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Marital Status column in Excel export"
                          />
                        </label>
                        {isLoadingMaritalStatuses ? (
                          <div className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : maritalStatusesError ? (
                          <div className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                            Error loading marital statuses
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedFilters(prev => ({ ...prev, maritalStatus: !prev.maritalStatus }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {selectedMaritalStatuses.length === 0
                                  ? "Select marital statuses..."
                                  : selectedMaritalStatuses.length === 1
                                  ? maritalStatusesData?.maritalStatuses?.find(s => s.value === selectedMaritalStatuses[0])?.label || selectedMaritalStatuses[0]
                                  : `${selectedMaritalStatuses.length} statuses selected`}
                              </span>
                              <svg
                                className={`w-4 h-4 transition-transform ${expandedFilters.maritalStatus ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {expandedFilters.maritalStatus && (
                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                <div className="p-2">
                                  <label
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMaritalStatusSelectAll();
                                    }}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={maritalStatusesData?.maritalStatuses && selectedMaritalStatuses.length === maritalStatusesData.maritalStatuses.length && maritalStatusesData.maritalStatuses.length > 0}
                                        onChange={handleMaritalStatusSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Statuses</span>
                                    </div>
                                  </label>
                                  <div className="max-h-48 overflow-y-auto">
                                    {maritalStatusesData?.maritalStatuses && maritalStatusesData.maritalStatuses.length > 0 ? (
                                      maritalStatusesData.maritalStatuses.map((status) => {
                                        const isChecked = selectedMaritalStatuses.includes(status.value);
                                        return (
                                          <label
                                            key={status.value}
                                            className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleMaritalStatusToggle(status.value)}
                                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                            />
                                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                              {status.label} ({status.count.toLocaleString()})
                                            </span>
                                          </label>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-sm text-gray-500">No marital statuses available</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {selectedMaritalStatuses.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedMaritalStatuses.length} selected</p>
                        )}
                      </div>
                      
                      {/* Home Country Filter */}
                      <div className="relative" ref={homeCountryFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Home Country</span>
                          <input
                            type="checkbox"
                            checked={exportHomeCountry}
                            onChange={(e) => setExportHomeCountry(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Home Country column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, homeCountry: !prev.homeCountry }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedHomeCountries.length === 0
                              ? "Select countries..."
                              : selectedHomeCountries.length === 1
                              ? selectedHomeCountries[0]
                              : `${selectedHomeCountries.length} countries selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.homeCountry ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.homeCountry && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleHomeCountrySelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={homeCountriesData?.homeCountries && selectedHomeCountries.length === homeCountriesData.homeCountries.length && homeCountriesData.homeCountries.length > 0}
                                    onChange={handleHomeCountrySelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Countries</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {homeCountriesData?.homeCountries?.map((country) => {
                                  const isChecked = selectedHomeCountries.includes(country.value);
                                  return (
                                    <label
                                      key={country.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleHomeCountryToggle(country.value)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{country.label} ({country.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedHomeCountries.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedHomeCountries.length} selected</p>
                        )}
                      </div>

                      {/* Province Filter */}
                      <div className="relative" ref={provinceFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Home Province (Pakistan)</span>
                          <input
                            type="checkbox"
                            checked={exportProvince}
                            onChange={(e) => setExportProvince(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Province column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, province: !prev.province }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedProvinces.length === 0
                              ? "Select provinces..."
                              : selectedProvinces.length === 1
                              ? provincesData?.provinces?.find(p => p.value === selectedProvinces[0])?.label || selectedProvinces[0]
                              : `${selectedProvinces.length} provinces selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.province ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.province && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProvinceSelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={provincesData?.provinces && selectedProvinces.length === provincesData.provinces.length && provincesData.provinces.length > 0}
                                    onChange={handleProvinceSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Provinces</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {provincesData?.provinces && provincesData.provinces.length > 0 ? (
                                  provincesData.provinces.map((province) => {
                                    const isChecked = selectedProvinces.includes(province.value);
                                    return (
                                      <label
                                        key={province.value}
                                        className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleProvinceToggle(province.value)}
                                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                        />
                                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                          {province.label} ({province.count.toLocaleString()})
                                        </span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">No provinces available</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedProvinces.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedProvinces.length} selected</p>
                        )}
                      </div>
                      
                      {/* Home City Filter */}
                      <div className="relative" ref={homeCityFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Home City</span>
                          <input
                            type="checkbox"
                            checked={exportHomeCity}
                            onChange={(e) => setExportHomeCity(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Home City column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, homeCity: !prev.homeCity }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedHomeCities.length === 0
                              ? "Select cities..."
                              : selectedHomeCities.length === 1
                              ? selectedHomeCities[0]
                              : `${selectedHomeCities.length} cities selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.homeCity ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.homeCity && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleHomeCitySelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={homeCitiesData?.homeCities && selectedHomeCities.length === homeCitiesData.homeCities.length && homeCitiesData.homeCities.length > 0}
                                    onChange={handleHomeCitySelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Cities</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {homeCitiesData?.homeCities && homeCitiesData.homeCities.length > 0 ? (
                                  homeCitiesData.homeCities.map((city) => {
                                    const isChecked = selectedHomeCities.includes(city.value);
                                    return (
                                      <label
                                        key={city.value}
                                        className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleHomeCityToggle(city.value)}
                                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                        />
                                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                          {city.label} ({city.count.toLocaleString()})
                                        </span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">No cities available</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedHomeCities.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedHomeCities.length} selected</p>
                        )}
                      </div>
                      
                    
                      
                      {/* Campus Filter */}
                      <div className="relative" ref={campusFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Campus</span>
                          <input
                            type="checkbox"
                            checked={exportCampus}
                            onChange={(e) => setExportCampus(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Campus column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, campus: !prev.campus }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedCampuses.length === 0
                              ? "Select campuses..."
                              : selectedCampuses.length === 1
                              ? selectedCampuses[0]
                              : `${selectedCampuses.length} campuses selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.campus ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.campus && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCampusSelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={campusesData?.campuses && selectedCampuses.length === campusesData.campuses.length && campusesData.campuses.length > 0}
                                    onChange={handleCampusSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Campuses</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {isLoadingCampuses ? (
                                  <div className="p-2 text-sm text-gray-500">Loading campuses...</div>
                                ) : campusesError ? (
                                  <div className="p-2 text-sm text-red-600 dark:text-red-400">Error loading campuses</div>
                                ) : campusesData?.campuses && campusesData.campuses.length > 0 ? (
                                  campusesData.campuses.map((campus: CampusOption) => {
                                    const isChecked = selectedCampuses.includes(campus.value);
                                  return (
                                    <label
                                        key={campus.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                          onChange={() => handleCampusToggle(campus.value)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                          {campus.label} ({campus.count.toLocaleString()})
                                        </span>
                                    </label>
                                  );
                                  })
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">No campuses available</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedCampuses.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedCampuses.length} selected</p>
                        )}
                      </div>
                      
                      {/* Admission Year Filter */}
                      <div className="relative" ref={admissionYearFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Admission Year</span>
                          <input
                            type="checkbox"
                            checked={exportAdmissionYear}
                            onChange={(e) => setExportAdmissionYear(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Admission Year columns in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, admissionYear: !prev.admissionYear }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedAdmissionYears.length === 0
                              ? "Select years..."
                              : selectedAdmissionYears.length === 1
                              ? selectedAdmissionYears[0]
                              : `${selectedAdmissionYears.length} years selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.admissionYear ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.admissionYear && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdmissionYearSelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={admissionYearsData?.admissionYears && selectedAdmissionYears.length === admissionYearsData.admissionYears.length && admissionYearsData.admissionYears.length > 0}
                                    onChange={handleAdmissionYearSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Years</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {admissionYearsData?.admissionYears?.map((year) => {
                                  const isChecked = selectedAdmissionYears.includes(year.value);
                                  return (
                                    <label
                                      key={year.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleAdmissionYearToggle(year.value)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{year.label} ({year.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedAdmissionYears.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedAdmissionYears.length} selected</p>
                        )}
                      </div>
                      
                      {/* Passing Year Filter */}
                      <div className="relative" ref={passingYearFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Passing Year</span>
                          <input
                            type="checkbox"
                            checked={exportPassingYear}
                            onChange={(e) => setExportPassingYear(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Passing Year column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, passingYear: !prev.passingYear }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedPassingYears.length === 0
                              ? "Select years..."
                              : selectedPassingYears.length === 1
                              ? selectedPassingYears[0]
                              : `${selectedPassingYears.length} years selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.passingYear ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.passingYear && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePassingYearSelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={passingYearsData?.passingYears && selectedPassingYears.length === passingYearsData.passingYears.length && passingYearsData.passingYears.length > 0}
                                    onChange={handlePassingYearSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Years</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {passingYearsData?.passingYears?.map((year) => {
                                  const isChecked = selectedPassingYears.includes(year.value);
                                  return (
                                    <label
                                      key={year.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handlePassingYearToggle(year.value)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{year.label} ({year.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedPassingYears.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedPassingYears.length} selected</p>
                        )}
                      </div>
                      
                      {/* Occupation Status Filter */}
                      <div className="relative" ref={occupationStatusFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Occupation Status</span>
                          <input
                            type="checkbox"
                            checked={exportOccupationStatus}
                            onChange={(e) => setExportOccupationStatus(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Occupation Status column in Excel export"
                          />
                        </label>
                        {isLoadingOccupationStatuses ? (
                          <div className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : occupationStatusesError ? (
                          <div className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                            Error loading occupation statuses
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedFilters(prev => ({ ...prev, occupationStatus: !prev.occupationStatus }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {selectedOccupationStatuses.length === 0
                                  ? "Select occupation statuses..."
                                  : selectedOccupationStatuses.length === 1
                                  ? occupationStatusesData?.occupationStatuses?.find(s => s.value === selectedOccupationStatuses[0])?.label || selectedOccupationStatuses[0]
                                  : `${selectedOccupationStatuses.length} statuses selected`}
                              </span>
                              <svg
                                className={`w-4 h-4 transition-transform ${expandedFilters.occupationStatus ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {expandedFilters.occupationStatus && (
                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                <div className="p-2">
                                  <label
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOccupationStatusSelectAll();
                                    }}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={occupationStatusesData?.occupationStatuses && selectedOccupationStatuses.length === occupationStatusesData.occupationStatuses.length && occupationStatusesData.occupationStatuses.length > 0}
                                        onChange={handleOccupationStatusSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Statuses</span>
                                    </div>
                                  </label>
                                  <div className="max-h-48 overflow-y-auto">
                                    {occupationStatusesData?.occupationStatuses && occupationStatusesData.occupationStatuses.length > 0 ? (
                                      occupationStatusesData.occupationStatuses.map((status: OccupationStatusOption) => {
                                        const isChecked = selectedOccupationStatuses.includes(status.value);
                                        return (
                                          <label
                                            key={status.value}
                                            className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleOccupationStatusToggle(status.value)}
                                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                            />
                                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                              {status.label} ({status.count.toLocaleString()})
                                            </span>
                                          </label>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-sm text-gray-500">No occupation statuses available</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {selectedOccupationStatuses.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedOccupationStatuses.length} selected</p>
                        )}
                      </div>
                      
                      {/* Sector Filter */}
                      <div className="relative" ref={sectorFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Sector</span>
                          <input
                            type="checkbox"
                            checked={exportSector}
                            onChange={(e) => setExportSector(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Sector column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, sector: !prev.sector }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedSectors.length === 0
                              ? "Select sectors..."
                              : selectedSectors.length === 1
                              ? selectedSectors[0]
                              : `${selectedSectors.length} sectors selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.sector ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.sector && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allValues = sectorsData?.sectors?.map(s => s.value) || [];
                                  if (selectedSectors.length === allValues.length && allValues.length > 0) {
                                    setSelectedSectors([]);
                                  } else {
                                    setSelectedSectors(allValues);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={sectorsData?.sectors && selectedSectors.length === sectorsData.sectors.length && sectorsData.sectors.length > 0}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Sectors</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {sectorsData?.sectors?.map((sector) => {
                                  const isChecked = selectedSectors.includes(sector.value);
                                  return (
                                    <label
                                      key={sector.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedSectors(prev =>
                                            prev.includes(sector.value)
                                              ? prev.filter(s => s !== sector.value)
                                              : [...prev, sector.value]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{sector.label} ({sector.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedSectors.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedSectors.length} selected</p>
                        )}
                      </div>
                      
                      
                      
                      {/* Work Country Filter */}
                      <div className="relative" ref={workCountryFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Work Country</span>
                          <input
                            type="checkbox"
                            checked={exportWorkCountry}
                            onChange={(e) => setExportWorkCountry(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Work Country column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, workCountry: !prev.workCountry }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedWorkCountries.length === 0
                              ? "Select countries..."
                              : selectedWorkCountries.length === 1
                              ? selectedWorkCountries[0]
                              : `${selectedWorkCountries.length} countries selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.workCountry ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.workCountry && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWorkCountrySelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={workCountriesData?.workCountries && selectedWorkCountries.length === workCountriesData.workCountries.length && workCountriesData.workCountries.length > 0}
                                    onChange={handleWorkCountrySelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Countries</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {workCountriesData?.workCountries?.map((country) => {
                                  const isChecked = selectedWorkCountries.includes(country.value);
                                  return (
                                    <label
                                      key={country.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleWorkCountryToggle(country.value)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{country.label} ({country.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedWorkCountries.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedWorkCountries.length} selected</p>
                        )}
                      </div>

                      {/* Work City Filter */}
                      <div className="relative" ref={workCityFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Work City</span>
                          <input
                            type="checkbox"
                            checked={exportWorkCity}
                            onChange={(e) => setExportWorkCity(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Work City column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, workCity: !prev.workCity }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedWorkCities.length === 0
                              ? "Select cities..."
                              : selectedWorkCities.length === 1
                              ? selectedWorkCities[0]
                              : `${selectedWorkCities.length} cities selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.workCity ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.workCity && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allValues = workCitiesData?.workCities?.map(c => c.value) || [];
                                  if (selectedWorkCities.length === allValues.length && allValues.length > 0) {
                                    setSelectedWorkCities([]);
                                  } else {
                                    setSelectedWorkCities(allValues);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={workCitiesData?.workCities && selectedWorkCities.length === workCitiesData.workCities.length && workCitiesData.workCities.length > 0}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Cities</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {workCitiesData?.workCities?.map((city) => {
                                  const isChecked = selectedWorkCities.includes(city.value);
                                  return (
                                    <label
                                      key={city.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedWorkCities(prev =>
                                            prev.includes(city.value)
                                              ? prev.filter(c => c !== city.value)
                                              : [...prev, city.value]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{city.label} ({city.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedWorkCities.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedWorkCities.length} selected</p>
                        )}
                      </div>
                      
                      {/* Institution Name Filter */}
                      <div className="relative" ref={institutionNameFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Institution Name</span>
                          <input
                            type="checkbox"
                            checked={exportInstitutionName}
                            onChange={(e) => setExportInstitutionName(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Institution Name column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, institutionName: !prev.institutionName }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedInstitutionNames.length === 0
                              ? "Select institutions..."
                              : selectedInstitutionNames.length === 1
                              ? selectedInstitutionNames[0]
                              : `${selectedInstitutionNames.length} institutions selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.institutionName ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.institutionName && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allValues = institutionNamesData?.institutionNames?.map(i => i.value) || [];
                                  if (selectedInstitutionNames.length === allValues.length && allValues.length > 0) {
                                    setSelectedInstitutionNames([]);
                                  } else {
                                    setSelectedInstitutionNames(allValues);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={institutionNamesData?.institutionNames && selectedInstitutionNames.length === institutionNamesData.institutionNames.length && institutionNamesData.institutionNames.length > 0}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Institutions</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {institutionNamesData?.institutionNames?.map((institution) => {
                                  const isChecked = selectedInstitutionNames.includes(institution.value);
                                  return (
                                    <label
                                      key={institution.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedInstitutionNames(prev =>
                                            prev.includes(institution.value)
                                              ? prev.filter(i => i !== institution.value)
                                              : [...prev, institution.value]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{institution.label} ({institution.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedInstitutionNames.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedInstitutionNames.length} selected</p>
                        )}
                      </div>
                      
                      {/* Program Enrolled Filter */}
                      <div className="relative" ref={programEnrolledFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Program Enrolled</span>
                          <input
                            type="checkbox"
                            checked={exportProgramEnrolled}
                            onChange={(e) => setExportProgramEnrolled(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Program Enrolled column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, programEnrolled: !prev.programEnrolled }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedProgramsEnrolled.length === 0
                              ? "Select programs..."
                              : selectedProgramsEnrolled.length === 1
                              ? selectedProgramsEnrolled[0]
                              : `${selectedProgramsEnrolled.length} programs selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.programEnrolled ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.programEnrolled && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allValues = degreeTitlesData?.degreeTitles?.map(p => p.value) || [];
                                  if (selectedProgramsEnrolled.length === allValues.length && allValues.length > 0) {
                                    setSelectedProgramsEnrolled([]);
                                  } else {
                                    setSelectedProgramsEnrolled(allValues);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={degreeTitlesData?.degreeTitles && selectedProgramsEnrolled.length === degreeTitlesData.degreeTitles.length && degreeTitlesData.degreeTitles.length > 0}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Programs</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {degreeTitlesData?.degreeTitles?.map((program) => {
                                  const isChecked = selectedProgramsEnrolled.includes(program.value);
                                  return (
                                    <label
                                      key={program.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedProgramsEnrolled(prev =>
                                            prev.includes(program.value)
                                              ? prev.filter(p => p !== program.value)
                                              : [...prev, program.value]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{program.label} ({program.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedProgramsEnrolled.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedProgramsEnrolled.length} selected</p>
                        )}
                      </div>
                      
                      {/* Funding Source Filter */}
                      <div className="relative" ref={fundingSourceFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Funding Source</span>
                          <input
                            type="checkbox"
                            checked={exportFundingSource}
                            onChange={(e) => setExportFundingSource(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Funding Source column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, fundingSource: !prev.fundingSource }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedFundingSources.length === 0
                              ? "Select funding sources..."
                              : selectedFundingSources.length === 1
                              ? selectedFundingSources[0]
                              : `${selectedFundingSources.length} sources selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.fundingSource ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.fundingSource && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allValues = fundingSourcesData?.fundingSources?.map(f => f.value) || [];
                                  if (selectedFundingSources.length === allValues.length && allValues.length > 0) {
                                    setSelectedFundingSources([]);
                                  } else {
                                    setSelectedFundingSources(allValues);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={fundingSourcesData?.fundingSources && selectedFundingSources.length === fundingSourcesData.fundingSources.length && fundingSourcesData.fundingSources.length > 0}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Sources</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {fundingSourcesData?.fundingSources?.map((source) => {
                                  const isChecked = selectedFundingSources.includes(source.value);
                                  return (
                                    <label
                                      key={source.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedFundingSources(prev =>
                                            prev.includes(source.value)
                                              ? prev.filter(f => f !== source.value)
                                              : [...prev, source.value]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{source.label} ({source.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedFundingSources.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedFundingSources.length} selected</p>
                        )}
                      </div>
                      
                      {/* Institution Country Filter */}
                      <div className="relative" ref={institutionCountryFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Institution Country</span>
                          <input
                            type="checkbox"
                            checked={exportInstitutionCountry}
                            onChange={(e) => setExportInstitutionCountry(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Institution Country column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, institutionCountry: !prev.institutionCountry }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedInstitutionCountries.length === 0
                              ? "Select countries..."
                              : selectedInstitutionCountries.length === 1
                              ? selectedInstitutionCountries[0]
                              : `${selectedInstitutionCountries.length} countries selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.institutionCountry ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.institutionCountry && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allValues = institutionCountriesData?.institutionCountries?.map(c => c.value) || [];
                                  if (selectedInstitutionCountries.length === allValues.length && allValues.length > 0) {
                                    setSelectedInstitutionCountries([]);
                                  } else {
                                    setSelectedInstitutionCountries(allValues);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={institutionCountriesData?.institutionCountries && selectedInstitutionCountries.length === institutionCountriesData.institutionCountries.length && institutionCountriesData.institutionCountries.length > 0}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Countries</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {institutionCountriesData?.institutionCountries?.map((country) => {
                                  const isChecked = selectedInstitutionCountries.includes(country.value);
                                  return (
                                    <label
                                      key={country.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedInstitutionCountries(prev =>
                                            prev.includes(country.value)
                                              ? prev.filter(c => c !== country.value)
                                              : [...prev, country.value]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{country.label} ({country.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedInstitutionCountries.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedInstitutionCountries.length} selected</p>
                        )}
                      </div>
                      
                      {/* Institution City Filter */}
                      <div className="relative" ref={institutionCityFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Institution City</span>
                          <input
                            type="checkbox"
                            checked={exportInstitutionCity}
                            onChange={(e) => setExportInstitutionCity(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Institution City column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, institutionCity: !prev.institutionCity }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedInstitutionCities.length === 0
                              ? "Select cities..."
                              : selectedInstitutionCities.length === 1
                              ? selectedInstitutionCities[0]
                              : `${selectedInstitutionCities.length} cities selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.institutionCity ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.institutionCity && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allValues = institutionCitiesData?.institutionCities?.map(c => c.value) || [];
                                  if (selectedInstitutionCities.length === allValues.length && allValues.length > 0) {
                                    setSelectedInstitutionCities([]);
                                  } else {
                                    setSelectedInstitutionCities(allValues);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={institutionCitiesData?.institutionCities && selectedInstitutionCities.length === institutionCitiesData.institutionCities.length && institutionCitiesData.institutionCities.length > 0}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Cities</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {institutionCitiesData?.institutionCities?.map((city) => {
                                  const isChecked = selectedInstitutionCities.includes(city.value);
                                  return (
                                    <label
                                      key={city.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedInstitutionCities(prev =>
                                            prev.includes(city.value)
                                              ? prev.filter(c => c !== city.value)
                                              : [...prev, city.value]
                                          );
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{city.label} ({city.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedInstitutionCities.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedInstitutionCities.length} selected</p>
                        )}
                      </div>
                      
                      {/* MR No Filter */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Alumni MR No.</span>
                          <input
                            type="checkbox"
                            checked={exportMrNo}
                            onChange={(e) => setExportMrNo(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include MR No column in Excel export"
                          />
                        </label>
                        <input
                          type="text"
                          placeholder="Type registration numbers..."
                          value={selectedMrNos.join(", ")}
                          onChange={(e) => {
                            const values = e.target.value.split(",").map(v => v.trim()).filter(Boolean);
                            setSelectedMrNos(values);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      {/* Photo Consent Filter */}
                      <div className="relative" ref={photoConsentFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <span>Photo Consent</span>
                          <input
                            type="checkbox"
                            checked={exportPhotoConsent}
                            onChange={(e) => setExportPhotoConsent(e.target.checked)}
                            className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                            title="Include Photo Consent column in Excel export"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, photoConsent: !prev.photoConsent }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedPhotoConsents.length === 0
                              ? "Select photo consent..."
                              : selectedPhotoConsents.length === 1
                              ? photoConsentData?.photoConsents?.find(c => c.value === selectedPhotoConsents[0])?.label || selectedPhotoConsents[0]
                              : `${selectedPhotoConsents.length} selected`}
                          </span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedFilters.photoConsent ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.photoConsent && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePhotoConsentSelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={photoConsentData?.photoConsents && selectedPhotoConsents.length === photoConsentData.photoConsents.length && photoConsentData.photoConsents.length > 0}
                                    onChange={handlePhotoConsentSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Options</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {photoConsentData?.photoConsents && photoConsentData.photoConsents.length > 0 ? (
                                  photoConsentData.photoConsents.map((consent) => {
                                    const isChecked = selectedPhotoConsents.includes(consent.value);
                                    return (
                                      <label
                                        key={consent.value}
                                        className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handlePhotoConsentToggle(consent.value)}
                                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                        />
                                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                          {consent.label} ({consent.count.toLocaleString()})
                                        </span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">No photo consent options available</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedPhotoConsents.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{selectedPhotoConsents.length} selected</p>
                        )}
                      </div>

                      {/* SAP ID State Filter (NULL only) */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                          SAP ID (Missing)
                        </label>
                        <div className="space-y-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedSapIdStates.includes("NULL")}
                                onChange={() => handleSapIdStateToggle("NULL")}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                              />
                              <span>NULL</span>
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Registration No State Filter (NULL only) */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                          Registration No (Missing)
                        </label>
                        <div className="space-y-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedRegNoStates.includes("NULL")}
                                onChange={() => handleRegNoStateToggle("NULL")}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                              />
                              <span>NULL</span>
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Actions Row */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
            {sortField && (
              <button
                type="button"
                onClick={handleResetSort}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
                title="Reset sorting"
              >
                <CloseLineIcon className="w-4 h-4" />
                Reset Sort
              </button>
            )}
              {/* Clear Filters Button */}
              <button
                type="button"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gray-600 text-white text-xs sm:text-sm font-semibold hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                aria-label="Clear all filters"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Clear Filters</span>
                <span className="sm:hidden">Clear</span>
              </button>
              {/* Export Button */}
              <button
                type="button"
                onClick={handleExportToExcel}
                disabled={isLoading || isExporting}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-green-600 text-white text-xs sm:text-sm font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                aria-label="Export to Excel"
              >
                {isExporting ? (
                  <>
                    <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">Exporting...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="hidden sm:inline">Export Excel</span>
                    <span className="sm:hidden">Export</span>
                  </>
                )}
              </button>
              {/* Background refetch indicator */}
              {isFetching && !isLoading && (
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-gray-600/80 shadow-sm">
                  <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">Updating...</span>
                  <span className="sm:hidden">...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-3 sm:px-1 pb-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
            {/* Top Horizontal Scrollbar - Prominent and Easy to Interact */}
            <div 
              ref={topScrollbarRef}
              className="top-horizontal-scrollbar w-full overflow-x-auto overflow-y-hidden border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
              style={{
                height: '24px',
                scrollbarWidth: 'auto' as const,
                scrollbarColor: '#3b82f6 #e5e7eb',
              }}
            >
              <div className="table-scrollbar-content h-full" style={{ minWidth: '800px' }}></div>
            </div>
            <div 
              ref={tableContainerRef}
              className="max-w-full overflow-x-hidden custom-scrollbar max-h-[750px] overflow-y-auto relative"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <div className="table-content-wrapper" style={{ minWidth: '800px' }}>
                <Table className="min-w-full">
                <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("alumniid")}
                    >
                      <div className="flex items-center gap-2">
                        <span>SR.No</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "alumniid" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "alumniid" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        <span>Full Name</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "name" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "name" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("sapId")}
                    >
                      <div className="flex items-center gap-2">
                        <span>SAP ID / Registration</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "sapId" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "sapId" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          </div>
                                </div>
                    </TableCell>
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("email")}
                    >
                      <div className="flex items-center gap-2">
                        <span>Email</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "email" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "email" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                              </div>
                                </div>
                    </TableCell>
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("faculty")}
                    >
                      <div className="flex items-center gap-2">
                        <span>Faculty</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "faculty" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "faculty" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                              </div>
                                </div>
                    </TableCell>
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("department")}
                    >
                      <div className="flex items-center gap-2">
                        <span>Department</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "department" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "department" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                              </div>
                                </div>
                    </TableCell>
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] hidden md:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("program")}
                    >
                      <div className="flex items-center gap-2">
                        <span>Program</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "program" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "program" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                              </div>
                            </div>
                    </TableCell>
                    <TableCell 
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-2">
                        <span>Status</span>
                        <div className="flex flex-col">
                          <ArrowUpIcon className={`w-3 h-3 ${sortField === "status" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "status" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                          </div>
                        </div>
                      </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">
                      Actions
                    </TableCell>
                    </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {isLoading && (
                    Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                        <TableCell className="px-3 sm:px-6 py-5">
                          <div className="h-5 w-16 sm:w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5">
                          <div className="h-5 w-32 sm:w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5">
                          <div className="h-5 w-24 sm:w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                          <div className="h-5 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell">
                          <div className="h-5 w-28 sm:w-36 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell">
                          <div className="h-5 w-32 sm:w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden md:table-cell">
                          <div className="h-5 w-36 sm:w-44 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5">
                          <div className="h-7 w-20 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 sticky right-0 bg-white dark:bg-gray-800/30 z-10">
                          <div className="h-9 w-24 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                {!isLoading && isError && (
                  <TableRow>
                    <TableCell className="px-6 py-16 text-center" colSpan={9}>
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-red-600 dark:text-red-400 mb-1">{error?.message ?? "Failed to load data."}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500">Please try again</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => refetch()}
                          disabled={isFetching}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          {isFetching ? (
                            <>
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Retrying...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Retry</span>
                            </>
                          )}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !isError && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell className="px-6 py-16 text-center text-gray-500 dark:text-gray-400" colSpan={9}>
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No alumni found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your search or filters</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !isError && pageItems.map((alum, idx) => {
                  // Format SapId/Registration No as --/1234 or 1234/-- (memoized)
                  // Use sapId from the item (which is the actual SAP ID, not the fallback id)
                  const sapIdRegNo = (() => {
                    const sapId = alum.sapId || ""; // Use the actual SAP ID field
                    const regNo = alum.registrationNo || "";
                    
                    if (sapId && regNo) {
                      return `${sapId}/${regNo}`;
                    } else if (sapId) {
                      return `${sapId}/--`;
                    } else if (regNo) {
                      return `--/${regNo}`;
                    }
                    return "--/--";
                  })();

                  return (
                    <React.Fragment key={`${alum.id}-fragment-${idx}`}>
                      <TableRow
                        key={`${alum.id}-${idx}`}
                        className={`hover:bg-blue-50/60 dark:hover:bg-white/[0.05] transition-all duration-200 cursor-pointer ${selectedRowId === alum.id ? "bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-700 shadow-sm" : "odd:bg-white even:bg-gray-50/30 dark:odd:bg-gray-800/30 dark:even:bg-gray-800/20"}`}
                        onClick={() => setSelectedRowId(alum.id)}
                        aria-selected={selectedRowId === alum.id}
                      >
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 font-mono text-xs">
                          <span className="truncate block max-w-[100px] sm:max-w-none">{alum.alumniid ?? "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-start">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {(isSuperAdminUser(session?.user) || isAdminUser(session?.user) || isViewerUser(session?.user)) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedRowId(expandedRowId === alum.id ? null : alum.id);
                                  }}
                                  className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                                    expandedRowId === alum.id
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                                  }`}
                                  aria-label={expandedRowId === alum.id ? "Collapse details" : "Expand details"}
                                  title={expandedRowId === alum.id ? "Collapse details" : "Expand details"}
                                >
                                  <PlusIcon className={`w-4 h-4 transition-transform ${expandedRowId === alum.id ? "rotate-45" : ""}`} />
                                </button>
                              )}
                              <span className="block font-semibold text-gray-900 text-sm dark:text-gray-100 truncate max-w-[150px] sm:max-w-none">{alum.name || "-"}</span>
                            </div>
                            {/* Show email on small screens when hidden in table */}
                            <a 
                              href={alum.email ? `mailto:${alum.email}` : "#"} 
                              className={`lg:hidden text-xs ${alum.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors truncate" : "text-gray-400"}`}
                            >
                              {alum.email || ""}
                            </a>
                            {/* Show faculty, department, and program on small screens when hidden in table */}
                            <div className="md:hidden flex flex-col gap-0.5 text-xs text-gray-600 dark:text-gray-400">
                              {alum.faculty && <span className="truncate">{alum.faculty}</span>}
                              {alum.department && <span className="truncate">{alum.department}</span>}
                              {alum.program && <span className="truncate">{alum.program}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 font-mono text-xs">
                          <span className="truncate block max-w-[120px] sm:max-w-none">{sapIdRegNo}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          <a 
                            href={alum.email ? `mailto:${alum.email}` : "#"} 
                            className={`${alum.email ? "text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors truncate block max-w-[180px]" : "text-gray-400"}`}
                          >
                            {alum.email || "-"}
                          </a>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
                          <span className="truncate block max-w-[120px]">{alum.faculty || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
                          <span className="truncate block max-w-[120px]">{alum.department || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden md:table-cell">
                          <span className="truncate block max-w-[150px]">{alum.program || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-start">
                          <Badge 
                            size="sm" 
                            color={
                              alum.verifyStatus === "verified" 
                                ? "success" 
                                : alum.verifyStatus === "unverified" 
                                ? "error" 
                                : "warning"
                            }
                          >
                            {alum.verifyStatus === "verified" 
                              ? "Verified" 
                              : alum.verifyStatus === "unverified" 
                              ? "Unverified" 
                              : "Under Approval"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`px-3 sm:px-6 py-5 text-end sticky right-0 z-10 ${
                          selectedRowId === alum.id 
                            ? "bg-blue-50/80 dark:bg-blue-900/30" 
                            : "bg-white dark:bg-gray-800/30"
                        }`}>
                          <div role="group" aria-label="Row actions" className="inline-flex items-center gap-1.5 sm:gap-2.5 flex-wrap justify-end">
                            {(() => {
                              const isBusy = mutatingIds.has(alum.id);
                              const canPerformActions = canModify(session?.user);
                              
                              // For viewers, only show View button
                              if (!canPerformActions) {
                                return (
                                  <button
                                    key={`${alum.id}-action-view`}
                                    type="button"
                                    onClick={() => handleView(alum.id)}
                                    disabled={isBusy}
                                    aria-disabled={isBusy}
                                    className={`p-1.5 sm:p-2 text-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                                    aria-label="View"
                                    title="View"
                                  >
                                    <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                  </button>
                                );
                              }
                              
                              // For admins, show all actions based on status
                              // In "total" tab, show both verify and unverify options based on current status
                              // In other tabs, show context-appropriate actions
                              // Always include View action for admins
                              let actions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; hover?: string }>;
                              
                              if (selected === "total") {
                                // Total tab: show all relevant actions
                                if (alum.verifyStatus === "verified") {
                                  // Verified: can unverify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(alum.id, alum.name), hover: "hover:text-amber-600" },
                                  ];
                                } else if (alum.verifyStatus === "unverified") {
                                  // Unverified: can verify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(alum.id, alum.name), hover: "hover:text-emerald-600" },
                                  ];
                                } else {
                                  // Under approval (first-time registration): can verify, unverify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(alum.id, alum.name), hover: "hover:text-emerald-600" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(alum.id, alum.name), hover: "hover:text-amber-600" },
                                  ];
                                }
                              } else {
                                // Other tabs: show context-appropriate actions
                                if (alum.verifyStatus === "verified") {
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(alum.id, alum.name), hover: "hover:text-amber-600" },
                                  ];
                                } else if (alum.verifyStatus === "unverified") {
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(alum.id, alum.name), hover: "hover:text-emerald-600" },
                                  ];
                                } else {
                                  // Under approval (first-time registration): can verify, unverify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(alum.id, alum.name), hover: "hover:text-emerald-600" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(alum.id, alum.name), hover: "hover:text-amber-600" },
                                  ];
                                }
                              }
                              
                              return actions.map(({ label, icon: Icon, onClick, hover }, i) => (
                                <button
                                  key={`${alum.id}-action-${i}`}
                                  type="button"
                                  onClick={onClick}
                                  disabled={isBusy}
                                  aria-disabled={isBusy}
                                  className={`p-1.5 sm:p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${hover ?? "hover:text-gray-700 dark:hover:text-gray-200"} hover:bg-gray-100 dark:hover:bg-gray-700/50 ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                                  aria-label={label}
                                  title={label}
                                >
                                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                              ));
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRowId === alum.id && (isSuperAdminUser(session?.user) || isAdminUser(session?.user) || isViewerUser(session?.user)) && (
                        <TableRow key={`${alum.id}-expanded`} className="bg-blue-50/30 dark:bg-blue-900/10">
                          <TableCell colSpan={9} className="px-0 py-6">
                            <div className="w-full overflow-x-hidden" style={{ maxWidth: 'calc(100vw - 2rem)', boxSizing: 'border-box' }}>
                              <div className="w-full max-w-full overflow-x-hidden flex flex-row justify-start ">
                                <AlumniExpandableDetails sapId={alum.id} onClose={() => setExpandedRowId(null)} readOnly={!canModify(session?.user)} />
                                <ErpDataDetails sapId={alum.sapId || undefined} registrationNo={alum.registrationNo || undefined} onClose={() => setExpandedRowId(null)} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
              </div>
            </div>
          </div>
        </div>
        {/* Live region for action feedback */}
        <div className="px-6" aria-live="polite" aria-atomic="true">
          {actionMessage && (
            <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 dark:bg-emerald-900/20 dark:border-emerald-800/50 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200 shadow-sm">
              {actionMessage}
            </div>
          )}
          {actionError && (
            <div className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50/80 dark:bg-rose-900/20 dark:border-rose-800/50 px-4 py-3 text-sm font-medium text-rose-800 dark:text-rose-200 shadow-sm">
              {actionError}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {(() => {
              if (showAll) {
                return `Showing all ${pageItems.length.toLocaleString()} of ${total.toLocaleString()} records${total > 500 ? " (max 500 per request)" : ""}`;
              }
              const start = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
              const end = Math.min(start + pageItems.length - 1, total);
              return `Showing ${start.toLocaleString()}-${end.toLocaleString()} of ${total.toLocaleString()}`;
            })()}
          </span>
          <div className="flex items-center gap-4">
            
            {!showAll && (
              <>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400" htmlFor="page-size">Items per page:</label>
                <select
                  id="page-size"
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  value={pageSize}
                  onChange={(e) => {
                    const newPageSize = Number(e.target.value);
                    setPageSize(newPageSize);
                    setCurrentPage(1); // Reset to first page when changing page size
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </>
            )}
            {canModify(session?.user) && (
              <>
                {!showAll ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAll(true);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
                  >
                    Show All
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAll(false);
                      setCurrentPage(1);
                      setPageSize(10); // Reset to default page size
                    }}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
                  >
                    Show Paginated
                  </button>
                )}
              </>
            )}
            {!showAll && (
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={(p) => {
                  const newPage = Math.max(1, Math.min(totalPages, p));
                  setCurrentPage(newPage);
                  // Scroll to top of table when page changes
                  if (tableContainerRef.current) {
                    tableContainerRef.current.scrollTop = 0;
                  }
                  // Also reset horizontal scroll
                  if (topScrollbarRef.current) {
                    topScrollbarRef.current.scrollLeft = 0;
                  }
                }} 
              />
            )}
          </div>
        </div>
        </>
        )}
      
      {/* Confirmation Modal */}
      {confirmModal.isOpen && pendingAction && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => {
            if (!mutatingIds.has(pendingAction?.sapid || "")) {
              confirmModal.closeModal();
              setPendingAction(null);
            }
          }}
          className="max-w-lg mx-auto"
          showCloseButton={true}
        >
          <div className="p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                pendingAction.type === "delete"
                  ? "bg-rose-100 dark:bg-rose-900/30"
                  : pendingAction.type === "unverify"
                  ? "bg-amber-100 dark:bg-amber-900/30"
                  : "bg-emerald-100 dark:bg-emerald-900/30"
              }`}>
                {pendingAction.type === "delete" && (
                  <TrashBinIcon className={`h-6 w-6 text-rose-600 dark:text-rose-400`} />
                )}
                {pendingAction.type === "unverify" && (
                  <CloseLineIcon className={`h-6 w-6 text-amber-600 dark:text-amber-400`} />
                )}
                {pendingAction.type === "verify" && (
                  <CheckLineIcon className={`h-6 w-6 text-emerald-600 dark:text-emerald-400`} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {pendingAction.type === "verify" && "Confirm Verification"}
                  {pendingAction.type === "unverify" && "Confirm Unverification"}
                  {pendingAction.type === "delete" && "Confirm Deletion"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {pendingAction.type === "verify" && "This will mark the alumni as verified and send them a welcome email."}
                  {pendingAction.type === "unverify" && "This will mark the alumni as unverified."}
                  {pendingAction.type === "delete" && "This action cannot be undone."}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {pendingAction.type === "verify" && (
                  <>Are you sure you want to verify <strong className="font-semibold text-gray-900 dark:text-gray-100">{pendingAction.name}</strong>?</>
                )}
                {pendingAction.type === "unverify" && (
                  <>Are you sure you want to unverify <strong className="font-semibold text-gray-900 dark:text-gray-100">{pendingAction.name}</strong>?</>
                )}
                {pendingAction.type === "delete" && (
                  <>Are you sure you want to delete <strong className="font-semibold text-gray-900 dark:text-gray-100">{pendingAction.name}</strong>? This will permanently remove their record.</>
                )}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={mutatingIds.has(pendingAction.sapid)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!mutatingIds.has(pendingAction.sapid)) {
                    confirmModal.closeModal();
                    setPendingAction(null);
                  }
                }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutatingIds.has(pendingAction.sapid)}
                onClick={handleConfirmClick}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md ${
                  pendingAction.type === "delete"
                    ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
                    : pendingAction.type === "unverify"
                    ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
                    : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
                }`}
              >
                {mutatingIds.has(pendingAction.sapid) ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <>
                    {pendingAction.type === "verify" && "Verify"}
                    {pendingAction.type === "unverify" && "Unverify"}
                    {pendingAction.type === "delete" && "Delete"}
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <style jsx global>{`
        .top-horizontal-scrollbar::-webkit-scrollbar {
          height: 24px !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-track {
          background: #e5e7eb !important;
          border-radius: 0 !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-thumb {
          background: #3b82f6 !important;
          border-radius: 12px !important;
          border: 3px solid #e5e7eb !important;
          min-width: 50px !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2563eb !important;
          border-color: #d1d5db !important;
        }
        .top-horizontal-scrollbar::-webkit-scrollbar-thumb:active {
          background: #1d4ed8 !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .custom-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      {/* Export modal removed for alumni list; export now uses filter checkboxes instead of a modal */}
      </div>
    </div>
  );
};
// (hooks moved inside component; no code should live below the component)
