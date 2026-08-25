"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "@/components/common/ComponentCard";
import SearchToolbar from "@/components/common/SearchToolbar";
import Badge from "../ui/badge/Badge";
import { CloseLineIcon, EyeIcon, TrashBinIcon, CheckLineIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon, MailIcon } from "@/icons";
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
import { useOccupationTransitionTimings, type OccupationTransitionTimingOption } from "@/app/queries/fetch-occupation-transition-timings";
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
import { useEmployers, type EmployerOption } from "@/app/queries/fetch-employers";
import { useDegreeTitles } from "@/app/queries/fetch-degree-titles";
import { useFundingSources } from "@/app/queries/fetch-funding-sources";
import { useInstitutionCountries } from "@/app/queries/fetch-institution-countries";
import { useInstitutionCities } from "@/app/queries/fetch-institution-cities";
import { useVerifyStatuses } from "@/app/queries/fetch-verify-statuses";
import { usePhotoConsent } from "@/app/queries/fetch-photo-consent";
import { useCategories } from "@/app/queries/fetch-categories";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { useExcelExport, type ColumnOption } from "@/lib/excel-export";
import type { AlumniFilterOption } from "@/app/queries/fetch-alumni-faculties";
import { EmailHistoryModal } from "@/components/email/EmailHistoryModal";
import { SendEmailButton } from "@/components/email/SendEmailButton";
import { EMAIL_ACTION_TYPE, generateAdminActionEmail } from "@/lib/emailTemplates";
import toast from "react-hot-toast";
import { ChangeApprovalsTab } from "@/components/alumni/ChangeApprovalsTab";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import type { DashboardTabKey } from "@/components/dashboard/dashboard-stats-config";

 function formatRegistrationDate(v?: string | null): string {
   if (!v) return "-";
   try {
     return new Date(v).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" });
   } catch {
     return String(v);
   }
 }

type TabKey = DashboardTabKey;

/** Matches animated counters on alumni cards (Alumini-cards TabCounter). */
function useAnimatedCounter(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    if (diff === 0) return;

    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + diff * easeOut));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = target;
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

function UnderApprovalSubTabCounter({
  count,
  isLoading,
  isSelected,
}: {
  count: number;
  isLoading: boolean;
  isSelected: boolean;
}) {
  const animated = useAnimatedCounter(isLoading ? 0 : count);

  if (isLoading) {
    return (
      <span
        className={`inline-flex h-5 w-8 items-center justify-center rounded-md ${
          isSelected ? "bg-blue-700/30 text-blue-100" : "bg-gray-200 dark:bg-gray-600"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse opacity-80" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1.5 text-[10px] font-bold tabular-nums transition-all duration-300 ${
        isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {animated.toLocaleString()}
    </span>
  );
}

export const AlumniTabs: React.FC = () => {
  const router = useRouter();
  const [selected, setSelected] = useState<TabKey>("total");
  const [underApprovalSubTab, setUnderApprovalSubTab] = useState<"new" | "change">("new");
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
  const employerFilterRef = React.useRef<HTMLDivElement>(null);
  const institutionNameFilterRef = React.useRef<HTMLDivElement>(null);
  const programEnrolledFilterRef = React.useRef<HTMLDivElement>(null);
  const fundingSourceFilterRef = React.useRef<HTMLDivElement>(null);
  const institutionCountryFilterRef = React.useRef<HTMLDivElement>(null);
  const institutionCityFilterRef = React.useRef<HTMLDivElement>(null);
  const genderFilterRef = React.useRef<HTMLDivElement>(null);
  const maritalStatusFilterRef = React.useRef<HTMLDivElement>(null);
  const occupationStatusFilterRef = React.useRef<HTMLDivElement>(null);
  const occupationTransitionTimingFilterRef = React.useRef<HTMLDivElement>(null);
  const photoConsentFilterRef = React.useRef<HTMLDivElement>(null);
  const categoryFilterRef = React.useRef<HTMLDivElement>(null);

  // Unified item type mapped from server response
  type AlumniItem = {
    id: string; // sapId, registrationNo, or alumniid as fallback
    alumniid: number | null;
    sapId?: string;
    rawName?: string;
    registrationNo?: string | null;
    name: string;
    email?: string | null;
    personalEmail?: string | null;
    createdDateTime?: string | null;
    mobile?: string | null;
    primaryContact?: string | null;
    fatherName?: string | null;
    cnicOrPassport?: string | null;
    gender?: string | null;
    campus?: string | null;
    homeCountry?: string | null;
    homeProvince?: string | null;
    homeCity?: string | null;
    faculty?: string | null;
    department?: string | null;
    program?: string | null;
    passingOutYear?: number | string | null;
    occupationStatus?: string | null;
    workCountry?: string | null;
    workCity?: string | null;
    higherEducationCountry?: string | null;
    higherEducationCity?: string | null;
    chapter1?: string | null;
    organization?: string | null;
    designation?: string | null;
    verified?: boolean;
    verifyStatus?: "verified" | "unverified" | "underApproval"; // Computed status
    employmentStatus?: "Employed" | "Unemployed" | null;
    lastLoginTime?: string | null;
    loginCount?: number | null;
    preSapRegistration?: boolean | string | number | null;
  };

  // filtering is handled in the server-like fetcher; remove unused memo

  // Query + UI state (UI state does not duplicate cache)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [additionalFilter, setAdditionalFilter] = useState<string[]>([]); // Array of selected statuses
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [locallyDeletedKeys, setLocallyDeletedKeys] = useState<Set<string>>(new Set());
  
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
  const [selectedOccupationTransitionTimings, setSelectedOccupationTransitionTimings] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedWorkCities, setSelectedWorkCities] = useState<string[]>([]);
  const [selectedWorkCountries, setSelectedWorkCountries] = useState<string[]>([]);
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);
  const [selectedInstitutionNames, setSelectedInstitutionNames] = useState<string[]>([]);
  const [selectedProgramsEnrolled, setSelectedProgramsEnrolled] = useState<string[]>([]);
  const [selectedFundingSources, setSelectedFundingSources] = useState<string[]>([]);
  const [selectedInstitutionCountries, setSelectedInstitutionCountries] = useState<string[]>([]);
  const [selectedInstitutionCities, setSelectedInstitutionCities] = useState<string[]>([]);
  const [selectedAlumniIds, setSelectedAlumniIds] = useState<number[]>([]);
  
  // Export column toggles – control which groups of columns are exported
  const [selectedSapIdStates, setSelectedSapIdStates] = useState<string[]>([]);
  const [selectedRegNoStates, setSelectedRegNoStates] = useState<string[]>([]);
  const [selectedPersonalEmailStates, setSelectedPersonalEmailStates] = useState<string[]>([]);
  const [selectedContactNoStates, setSelectedContactNoStates] = useState<string[]>([]);
  const [selectedCnicPassportStates, setSelectedCnicPassportStates] = useState<string[]>([]);
  const [selectedPhotoConsents, setSelectedPhotoConsents] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { isExporting, openExportModal, ExportModal } = useExcelExport();
  
  // Sorting state
  const [sortField, setSortField] = useState<string | null>("alumniid");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const apiSortBy = useMemo(() => {
    if (!sortField) return undefined;
    switch (sortField) {
      case "alumniid":
        return "alumniid";
      case "name":
        return "alumniname";
      case "sapId":
        return "sapid";
      case "email":
        return "personalemail";
      case "faculty":
        return "facultyname";
      case "department":
        return "departmentname";
      case "program":
        return "degreetitle";
      case "status":
        return "verify";
      default:
        return undefined;
    }
  }, [sortField]);

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
    employer: boolean;
    institutionName: boolean;
    programEnrolled: boolean;
    fundingSource: boolean;
    institutionCountry: boolean;
    institutionCity: boolean;
    gender: boolean;
    maritalStatus: boolean;
    occupationStatus: boolean;
    occupationTransitionTiming: boolean;
    photoConsent: boolean;
    category: boolean;
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
    employer: false,
    institutionName: false,
    programEnrolled: false,
    fundingSource: false,
    institutionCountry: false,
    institutionCity: false,
    gender: false,
    maritalStatus: false,
    occupationStatus: false,
    occupationTransitionTiming: false,
    photoConsent: false,
    category: false,
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
        case "goldMedalist":
          return "medal:gold";
        case "silverMedalist":
          return "medal:silver";
        case "bronzeMedalist":
          return "medal:bronze";
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
    if (selectedOccupationTransitionTimings.length > 0) {
      filters.occupationTransitionTiming = selectedOccupationTransitionTimings;
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
    if (selectedEmployers.length > 0) {
      filters.employer = selectedEmployers;
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
    if (selectedSapIdStates.length > 0) {
      filters.sapIdState = selectedSapIdStates;
    }
    if (selectedRegNoStates.length > 0) {
      filters.regNoState = selectedRegNoStates;
    }
    if (selectedPersonalEmailStates.length > 0) {
      filters.personalEmailState = selectedPersonalEmailStates;
    }
    if (selectedContactNoStates.length > 0) {
      filters.contactNoState = selectedContactNoStates;
    }
    if (selectedCnicPassportStates.length > 0) {
      filters.cnicPassportState = selectedCnicPassportStates;
    }
    if (selectedPhotoConsents.length > 0) {
      filters.photoConsent = selectedPhotoConsents;
    }
    if (selectedCategories.length > 0) {
      filters.category = selectedCategories;
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
    selectedOccupationTransitionTimings,
    selectedSectors,
    selectedWorkCities,
    selectedWorkCountries,
    selectedEmployers,
    selectedInstitutionNames,
    selectedProgramsEnrolled,
    selectedFundingSources,
    selectedInstitutionCountries,
    selectedInstitutionCities,
    selectedPhotoConsents,
    selectedSapIdStates,
    selectedRegNoStates,
    selectedPersonalEmailStates,
    selectedContactNoStates,
    selectedCnicPassportStates,
    selectedCategories,
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
  const { data: occupationTransitionTimingsData, error: occupationTransitionTimingsError, isLoading: isLoadingOccupationTransitionTimings } = useOccupationTransitionTimings(masterFilters);
  
  // Additional master filter hooks - pass masterFilters to get dynamic counts
  const { data: homeCountriesData } = useHomeCountries(masterFilters);
  const { data: workCountriesData } = useWorkCountries(masterFilters);
  const { data: admissionYearsData } = useAdmissionYears(masterFilters);
  const { data: passingYearsData } = usePassingYears(masterFilters);
  const { data: sectorsData } = useSectors(masterFilters);
  const { data: workCitiesData } = useWorkCities(masterFilters);
  const { data: homeCitiesData } = useHomeCities(masterFilters);
  const { data: provincesData } = useProvinces(masterFilters);
  const { data: employersData } = useEmployers(masterFilters);
  
  // Institution-related master filter hooks - pass masterFilters to get dynamic counts
  const { data: institutionNamesData } = useInstitutionNames(masterFilters);
  const { data: degreeTitlesData } = useDegreeTitles(masterFilters);
  const { data: fundingSourcesData } = useFundingSources(masterFilters);
  const { data: institutionCountriesData } = useInstitutionCountries(masterFilters);
  const { data: institutionCitiesData } = useInstitutionCities(masterFilters);
  const { data: photoConsentData } = usePhotoConsent(masterFilters);
  const { data: categoriesData } = useCategories(masterFilters);

  // Debug logging
  React.useEffect(() => {
    if (maritalStatusesError) {

    }
    if (maritalStatusesData) {

    }
    if (gendersError) {

    }
    if (gendersData) {

    }
    if (campusesError) {

    }
    if (campusesData) {

    }
    if (occupationStatusesError) {

    }
    if (occupationStatusesData) {

    }
  }, [maritalStatusesData, maritalStatusesError, gendersData, gendersError, campusesData, campusesError, occupationStatusesData, occupationStatusesError]);

  const facultyOptions: AlumniFilterOption[] = alumniFacultiesData?.faculties ?? [];
  const departmentOptions: AlumniFilterOption[] = alumniDepartmentsData?.departments ?? [];
  const programOptions: AlumniFilterOption[] = alumniProgramsData?.programs ?? [];
  
  // Confirmation modal state
  const confirmModal = useModal();
  const duplicatesModal = useModal();
  const incompleteProfileModal = useModal();
  const emailHistoryModal = useModal();
  const [emailHistoryAlumniId, setEmailHistoryAlumniId] = useState<number | null>(null);
  const [incompleteFields, setIncompleteFields] = useState<Array<{ key: string; label: string }>>([]);
  const [incompleteTarget, setIncompleteTarget] = useState<AlumniItem | null>(null);
  const [incompleteHighlightKeys, setIncompleteHighlightKeys] = useState<string[]>([]);
  /** Admin session override for "Pre Sap Registration" (moved to Alumni details panel). */
  const [preSapByAlumniId, setPreSapByAlumniId] = useState<Record<string, boolean>>({});

  const [expandedHighlightRowId, setExpandedHighlightRowId] = useState<number | null>(null);
  const [expandedHighlightKeys, setExpandedHighlightKeys] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<{
    type: "verify" | "unverify" | "delete";
    sapid: string;
    name: string;
    alumniId: number | null;
    email: string | null;
  } | null>(null);
  const [pendingDuplicateGate, setPendingDuplicateGate] = useState<{
    type: "verify" | "unverify";
    targetKey: string;
    name: string;
    alumniId: number | null;
    email: string | null;
  } | null>(null);
  const [duplicateSearch, setDuplicateSearch] = useState<string>("");
  const [duplicateSortKey, setDuplicateSortKey] = useState<
    "name" | "sapId" | "registrationNo" | "gender" | "verifyStatus"
  >("name");
  const [duplicateSortDir, setDuplicateSortDir] = useState<"asc" | "desc">("asc");
  const [duplicateDeleteCount, setDuplicateDeleteCount] = useState<number>(0);

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
      if (employerFilterRef.current && !employerFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, employer: false }));
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
      if (occupationTransitionTimingFilterRef.current && !occupationTransitionTimingFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, occupationTransitionTiming: false }));
      }
      if (photoConsentFilterRef.current && !photoConsentFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, photoConsent: false }));
      }
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target as Node)) {
        setExpandedFilters(prev => ({ ...prev, category: false }));
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
    setSelectedOccupationTransitionTimings([]);
    setSelectedSectors([]);
    setSelectedWorkCities([]);
    setSelectedWorkCountries([]);
    setSelectedEmployers([]);
    setSelectedInstitutionNames([]);
    setSelectedProgramsEnrolled([]);
    setSelectedFundingSources([]);
    setSelectedInstitutionCountries([]);
    setSelectedInstitutionCities([]);
    setSelectedPhotoConsents([]);
    setSelectedCategories([]);
    setSelectedSapIdStates([]);
    setSelectedRegNoStates([]);
    setSelectedPersonalEmailStates([]);
    setSelectedContactNoStates([]);
    setSelectedCnicPassportStates([]);
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
      selectedOccupationTransitionTimings.length > 0 ||
      selectedSectors.length > 0 ||
      selectedWorkCities.length > 0 ||
      selectedWorkCountries.length > 0 ||
      selectedEmployers.length > 0 ||
      selectedInstitutionNames.length > 0 ||
      selectedProgramsEnrolled.length > 0 ||
      selectedFundingSources.length > 0 ||
      selectedInstitutionCountries.length > 0 ||
      selectedInstitutionCities.length > 0 ||
      selectedPhotoConsents.length > 0 ||
      selectedCategories.length > 0 ||
      selectedSapIdStates.length > 0 ||
      selectedRegNoStates.length > 0 ||
      selectedPersonalEmailStates.length > 0 ||
      selectedContactNoStates.length > 0 ||
      selectedCnicPassportStates.length > 0
    );
  }, [query, selectedFaculties, selectedDepartments, selectedPrograms, additionalFilter, selectedGenders, selectedMaritalStatuses, selectedHomeCountries, selectedHomeCities, selectedProvinces, selectedCampuses, selectedAdmissionYears, selectedPassingYears, selectedOccupationStatuses, selectedOccupationTransitionTimings, selectedSectors, selectedWorkCities, selectedWorkCountries, selectedInstitutionNames, selectedProgramsEnrolled, selectedFundingSources, selectedInstitutionCountries, selectedInstitutionCities,  selectedPhotoConsents, selectedCategories, selectedSapIdStates, selectedRegNoStates, selectedPersonalEmailStates, selectedContactNoStates, selectedCnicPassportStates]);
  
  const handleStatusToggle = (status: string) => {
    setAdditionalFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };
  
  const handleStatusSelectAll = () => {
    const allStatusValues = statusOptions.map(s => s.value);
    const isAllSelected =
      allStatusValues.length > 0 &&
      allStatusValues.every(v => additionalFilter.includes(v)) &&
      additionalFilter.length === allStatusValues.length;

    if (isAllSelected) {
      setAdditionalFilter([]);
      return;
    }

    setAdditionalFilter(allStatusValues);
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

  // Category filter handlers
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  const handleCategorySelectAll = () => {
    if (categoriesData?.categories && selectedCategories.length === categoriesData.categories.length && categoriesData.categories.length > 0) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(categoriesData?.categories?.map(c => c.value) || []);
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

  const handlePersonalEmailStateToggle = (value: string) => {
    setSelectedPersonalEmailStates(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleContactNoStateToggle = (value: string) => {
    setSelectedContactNoStates(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleCnicPassportStateToggle = (value: string) => {
    setSelectedCnicPassportStates(prev =>
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

  const handleOccupationTransitionTimingToggle = (value: string) => {
    setSelectedOccupationTransitionTimings((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleOccupationTransitionTimingSelectAll = () => {
    if (
      occupationTransitionTimingsData?.occupationTransitionTimings &&
      selectedOccupationTransitionTimings.length === occupationTransitionTimingsData.occupationTransitionTimings.length &&
      occupationTransitionTimingsData.occupationTransitionTimings.length > 0
    ) {
      setSelectedOccupationTransitionTimings([]);
    } else {
      setSelectedOccupationTransitionTimings(occupationTransitionTimingsData?.occupationTransitionTimings?.map((t) => t.value) || []);
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

  const handleEmployerToggle = (employer: string) => {
    setSelectedEmployers(prev =>
      prev.includes(employer)
        ? prev.filter(e => e !== employer)
        : [...prev, employer]
    );
  };

  const handleEmployerSelectAll = () => {
    const allValues = employersData?.employers?.map(e => e.value) || [];
    if (selectedEmployers.length === allValues.length && allValues.length > 0) {
      setSelectedEmployers([]);
    } else {
      setSelectedEmployers(allValues);
    }
  };

  // Reset page to 1 when tab changes or filter changes (but not when statusFilter recalculates with same value)
  useEffect(() => {
    setCurrentPage(1);
  }, [selected, additionalFilter, debouncedQuery, showAll, pageSize]);

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
    selectedOccupationTransitionTimings.length > 0 ? selectedOccupationTransitionTimings : undefined,
    selectedSectors.length > 0 ? selectedSectors : undefined,
    selectedWorkCities.length > 0 ? selectedWorkCities : undefined,
    selectedWorkCountries.length > 0 ? selectedWorkCountries : undefined,
    selectedEmployers.length > 0 ? selectedEmployers : undefined,
    selectedInstitutionNames.length > 0 ? selectedInstitutionNames : undefined,
    selectedProgramsEnrolled.length > 0 ? selectedProgramsEnrolled : undefined,
    selectedFundingSources.length > 0 ? selectedFundingSources : undefined,
    selectedInstitutionCountries.length > 0 ? selectedInstitutionCountries : undefined,
    selectedInstitutionCities.length > 0 ? selectedInstitutionCities : undefined,
    undefined,
    selectedPhotoConsents.length > 0 ? selectedPhotoConsents : undefined,
    selectedSapIdStates.length > 0 ? selectedSapIdStates : undefined,
    selectedRegNoStates.length > 0 ? selectedRegNoStates : undefined,
    selectedPersonalEmailStates.length > 0 ? selectedPersonalEmailStates : undefined,
    selectedContactNoStates.length > 0 ? selectedContactNoStates : undefined,
    selectedCnicPassportStates.length > 0 ? selectedCnicPassportStates : undefined,
    selectedCategories.length > 0 ? selectedCategories : undefined,
    apiSortBy,
    sortDirection
  );

  useEffect(() => {
    const firstId = (paginatedData?.items?.[0] as any)?.alumniid;
    console.log("[AlumniTabs pagination]", {
      currentPage,
      responsePage: paginatedData?.page,
      limit: paginatedData?.limit,
      totalPages: paginatedData?.totalPages,
      firstAlumniId: firstId,
      itemsLen: paginatedData?.items?.length,
    });
  }, [currentPage, paginatedData?.page, paginatedData?.limit, paginatedData?.totalPages, paginatedData?.items]);
  
  // Debug logging - commented out to fix build issue
  // useEffect(() => {
  //   if (paginatedData?.items) {
  //     const underApprovalItems = paginatedData.items.filter((item: any) => {
  //       const verifyVal = item.verify;
  //       return verifyVal === null || verifyVal === undefined || verifyVal === "" || 
  //              String(verifyVal).toLowerCase().trim() === 'pending';
  //     });
  //   }
  // }, [selected, statusFilter, paginatedData]);
  
  // Fetch counts separately (lightweight query) - stable caching to prevent reloading
  // NOTE: statusFilter (tab selection) is intentionally EXCLUDED from the counts query
  // so that clicking KPI tabs does NOT recalculate counts. Counts are only recalculated
  // when actual filters (faculty, department, search, etc.) are applied.
  const {
    data: countsData,
    isLoading: isLoadingCounts,
  } = useQuery<AlumniCounts, Error>({
    queryKey: [
      "alumnilist-counts",
      debouncedQuery,
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
      selectedOccupationTransitionTimings,
      selectedSectors,
      selectedWorkCities,
      selectedWorkCountries,
      selectedEmployers,
      selectedInstitutionNames,
      selectedProgramsEnrolled,
      selectedFundingSources,
      selectedInstitutionCountries,
      selectedInstitutionCities,
      selectedPhotoConsents,
      selectedSapIdStates,
      selectedRegNoStates,
      selectedPersonalEmailStates,
      selectedContactNoStates,
      selectedCnicPassportStates,
      selectedCategories
    ],
    queryFn: ({ signal }) => getAlumniCounts(
      signal,
      debouncedQuery || undefined,
      undefined, // statusFilter intentionally omitted — tab clicks should not recalculate counts
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
      selectedOccupationTransitionTimings.length > 0 ? selectedOccupationTransitionTimings : undefined,
      selectedSectors.length > 0 ? selectedSectors : undefined,
      selectedWorkCities.length > 0 ? selectedWorkCities : undefined,
      selectedWorkCountries.length > 0 ? selectedWorkCountries : undefined,
      selectedEmployers.length > 0 ? selectedEmployers : undefined,
      selectedInstitutionNames.length > 0 ? selectedInstitutionNames : undefined,
      selectedProgramsEnrolled.length > 0 ? selectedProgramsEnrolled : undefined,
      selectedFundingSources.length > 0 ? selectedFundingSources : undefined,
      selectedInstitutionCountries.length > 0 ? selectedInstitutionCountries : undefined,
      selectedInstitutionCities.length > 0 ? selectedInstitutionCities : undefined,
      undefined,
      selectedPhotoConsents.length > 0 ? selectedPhotoConsents : undefined,
      selectedSapIdStates.length > 0 ? selectedSapIdStates : undefined,
      selectedRegNoStates.length > 0 ? selectedRegNoStates : undefined,
      selectedPersonalEmailStates.length > 0 ? selectedPersonalEmailStates : undefined,
      selectedContactNoStates.length > 0 ? selectedContactNoStates : undefined,
      selectedCnicPassportStates.length > 0 ? selectedCnicPassportStates : undefined,
      selectedCategories.length > 0 ? selectedCategories : undefined
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
    const seenAlumniIds = new Set<number>();
    
    for (let i = 0; i < sourceItems.length; i++) {
      const r = sourceItems[i];

      const localKey = String(r.alumniid ?? (r.sapid?.trim() || r.registrationno?.trim() || ""));
      if (locallyDeletedKeys.has(localKey)) {
        continue;
      }

      const verifyStrEarly = String(r.verify ?? "").toLowerCase().trim();

      // Optimize verification status check (handle string, boolean, or null)
      // Handle verify='underApproval' as "underApproval"
      const verifyRaw = r.verify;
      let verifyStatus: "verified" | "unverified" | "underApproval";
      let verified: boolean;

      const verifyStr = verifyStrEarly;
      if (verifyStr === "true") {
        verifyStatus = "verified";
        verified = true;
      } else if (verifyStr === "false") {
        verifyStatus = "unverified";
        verified = false;
      } else if (verifyStr === "underapproval") {
        verifyStatus = "underApproval";
        verified = false;
      } else {
        verifyStatus = "unverified";
        verified = false;
      }
      
      // Optimize employment status check (single lowercase conversion)
      const employmentStatus: "Employed" | "Unemployed" = (() => {
        const v = (r.employeed || "").toLowerCase().trim();
        return v === "employed" || v === "employed/business" ? "Employed" : "Unemployed";
      })();
      
      // Use sapid as ID if available, otherwise use registrationno, otherwise use alumniid as fallback
      const itemId = String(r.alumniid ?? (r.sapid?.trim() || r.registrationno?.trim() || ""));

      const alumniIdNum = r.alumniid === null || r.alumniid === undefined ? null : Number(r.alumniid);
      if (alumniIdNum && Number.isFinite(alumniIdNum)) {
        if (seenAlumniIds.has(alumniIdNum)) continue;
        seenAlumniIds.add(alumniIdNum);
      }
      
      result[idx++] = {
        id: itemId,
        alumniid: r.alumniid ?? null,
        sapId: r.sapid?.trim() || "",
        registrationNo: r.registrationno ?? null,
        name: r.alumniname ?? "",
        email: r.personalemail ?? r.officialemail ?? null,
        personalEmail: r.personalemail ?? null,
        createdDateTime: (r as unknown as { createddatetime?: string | null }).createddatetime ?? null,
        mobile: r.contactno ?? null,
        primaryContact: (r as unknown as { contactno?: string | null }).contactno ?? r.contactno ?? null,
        fatherName:
          (r as unknown as { fathername?: string | null }).fathername ??
          (r as unknown as { father_name?: string | null }).father_name ??
          null,
        cnicOrPassport:
          (r as unknown as { cnicpassport?: string | null }).cnicpassport ??
          (r as unknown as { cnic_passport?: string | null }).cnic_passport ??
          null,
        gender: (r as unknown as { gender?: string | null }).gender ?? null,
        campus: r.campusname ?? null,
        homeCountry: r.country ?? null,
        homeProvince: r.province ?? null,
        homeCity: r.city ?? null,
        faculty: r.facultyname ?? null,
        department: r.departmentname ?? null,
        program: r.degreetitle ?? null,
        passingOutYear: (r as unknown as { yearofending?: number | string | null }).yearofending ?? null,
        occupationStatus: (r as unknown as { employeed?: string | null }).employeed ?? null,
        workCountry: (r as unknown as { work_country?: string | null }).work_country ?? null,
        workCity: (r as unknown as { work_city?: string | null }).work_city ?? null,
        higherEducationCountry: (r as unknown as { higher_education_institute_country?: string | null }).higher_education_institute_country ?? null,
        higherEducationCity: (r as unknown as { higher_education_institute_city?: string | null }).higher_education_institute_city ?? null,
        chapter1: (r as unknown as { chapter1name?: string | null }).chapter1name ?? null,
        organization: r.nameoforganization ?? null,
        designation: r.designation ?? null,
        preSapRegistration:
          (r as unknown as { preSapRegistration?: boolean | string | number | null }).preSapRegistration ??
          (r as unknown as { pre_sap_registration?: boolean | string | number | null }).pre_sap_registration ??
          (r as unknown as { presapregistration?: boolean | string | number | null }).presapregistration ??
          null,
        verified,
        verifyStatus,
        employmentStatus,
        lastLoginTime: r.lasttimelogin ?? null,
        loginCount: r.logincount ?? null,
        // Store raw values for sorting
        rawName: r.alumniname || "",
      } as AlumniItem;
    }
    
    // Trim array to actual size
    return result.slice(0, idx);
  }, [paginatedData, locallyDeletedKeys]);

  const normalizeDupKey = useCallback((v: string | null | undefined): string => {
    return String(v ?? "").trim().toLowerCase();
  }, []);

  const isMissingRequiredValue = useCallback((value: unknown) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim() === "";
    if (typeof value === "number") return !Number.isFinite(value);
    return String(value).trim() === "";
  }, []);

  const isPreSapRegistrationEnabled = useCallback((alumni: AlumniItem): boolean => {
    const raw = alumni as unknown as Record<string, unknown>;
    const flag =
      raw.preSapRegistration ??
      raw.pre_sap_registration ??
      raw.presapregistration ??
      raw.preSap ??
      null;

    if (typeof flag === "boolean") return flag;
    if (typeof flag === "number") return flag === 1;
    if (typeof flag === "string") {
      const normalized = flag.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
    }
    return false;
  }, []);

  const mergeWithPreSapOverride = useCallback(
    (alumni: AlumniItem): AlumniItem => {
      const id = String(alumni.alumniid ?? alumni.id);
      if (Object.prototype.hasOwnProperty.call(preSapByAlumniId, id)) {
        return { ...alumni, preSapRegistration: preSapByAlumniId[id] };
      }
      return alumni;
    },
    [preSapByAlumniId]
  );

  const getMissingRequiredFields = useCallback(
    (alumni: AlumniItem) => {
      const requiredFields = [
        { key: "sapId", label: "SAP ID" },
        { key: "name", label: "Full Name" },
        { key: "fatherName", label: "Father Name" },
        { key: "cnicOrPassport", label: "CNIC/Passport" },
        { key: "primaryContact", label: "Phone Number" },
        { key: "personalEmail", label: "Personal Email" },
        { key: "faculty", label: "Faculty (Association)" },
        { key: "department", label: "Department" },
        { key: "program", label: "Program" },
        { key: "campus", label: "Campus" },
        { key: "passingOutYear", label: "Passing Out Year" },
        { key: "registrationNo", label: "Registration No" },
      ] as const;

      return requiredFields.filter((field) => {
        if (field.key === "sapId" && isPreSapRegistrationEnabled(alumni)) {
          return false;
        }

        if (field.key === "registrationNo") {
          if (!isPreSapRegistrationEnabled(alumni)) {
            return false;
          }
          const raw = alumni as unknown as Record<string, unknown>;
          const reg = raw.registrationNo ?? raw.registrationno ?? null;
          return isMissingRequiredValue(reg);
        }

        const raw = alumni as unknown as Record<string, unknown>;
        const value = (() => {
          switch (field.key) {
            case "fatherName":
              return raw.fatherName ?? raw.fathername ?? raw.father_name ?? null;
            case "cnicOrPassport":
              return raw.cnicOrPassport ?? raw.cnicpassport ?? raw.cnic_passport ?? null;
            case "primaryContact":
              return raw.primaryContact ?? raw.mobile ?? raw.contactno ?? null;
            default:
              return raw[field.key];
          }
        })();
        return isMissingRequiredValue(value);
      });
    },
    [isMissingRequiredValue, isPreSapRegistrationEnabled]
  );

  const getItemLocalKey = useCallback((item: AlumniItem): string => {
    return String(item.alumniid ?? item.id);
  }, []);

  const findDuplicatesFor = useCallback((target: AlumniItem, dataset: AlumniItem[]): AlumniItem[] => {
    const sap = normalizeDupKey(target.sapId);
    const reg = normalizeDupKey(target.registrationNo);
    const targetKey = getItemLocalKey(target);
    if (!sap && !reg) return [];

    return dataset.filter((it) => {
      const k = getItemLocalKey(it);
      if (k === targetKey) return false;
      const itSap = normalizeDupKey(it.sapId);
      const itReg = normalizeDupKey(it.registrationNo);
      const sapMatch = !!sap && !!itSap && itSap === sap;
      const regMatch = !!reg && !!itReg && itReg === reg;
      return sapMatch || regMatch;
    });
  }, [getItemLocalKey, normalizeDupKey]);

  // Use counts from server (lightweight query) - always use server data for real-time accuracy
  const counts = useMemo(() => {
    // Always use server counts if available (real-time data)
    if (countsData) {
      const category = countsData.category || { aPlus: 0, a: 0, b: 0, c: 0, d: 0, distinguished: 0 };
      const medal = countsData.medal || { gold: 0, silver: 0, bronze: 0 };
      const n = (v: unknown) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : 0;
      };
      return {
        total: n(countsData.total),
        verified: n(countsData.verified),
        unverified: n(countsData.unverified),
        underApproval: n(countsData.underApproval),
        active: n(countsData.active),
        inactive: n(countsData.inactive),
        category: {
          aPlus: n(category.aPlus),
          a: n(category.a),
          b: n(category.b),
          c: n(category.c),
          d: n(category.d),
          distinguished: n(category.distinguished),
        },
        medal: {
          gold: n(medal.gold),
          silver: n(medal.silver),
          bronze: n(medal.bronze),
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
      medal: { gold: 0, silver: 0, bronze: 0 },
    };
  }, [countsData, totalRecords]);

  const { data: changeApprovalsCountData, isPending: isPendingChangeApprovalCount } = useQuery<{
    changeApprovalCount: number;
  }>({
    queryKey: ["change-approvals", "count"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/change-approvals/count", { signal, headers: { accept: "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Failed to load change approvals count");
      return data as { changeApprovalCount: number };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const changeApprovalCount = useMemo(() => {
    const n = Number(changeApprovalsCountData?.changeApprovalCount ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [changeApprovalsCountData]);

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

  const allStatusesSelected = useMemo(() => {
    const allValues = statusOptions.map(s => s.value);
    return (
      allValues.length > 0 &&
      allValues.every(v => additionalFilter.includes(v)) &&
      additionalFilter.length === allValues.length
    );
  }, [statusOptions, additionalFilter]);

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
  // No client-side sorting needed - server returns globally sorted and paginated data
  const filteredItems = useMemo(() => {
    // Since all filtering (search, status, active, category) is handled server-side,
    // we just return the items as-is from the server
    return items;
  }, [items]);

  // Pagination derived values - use server-side pagination
  const total = totalRecords; // Use total from server
  const totalPages = showAll ? 1 : (paginatedData?.totalPages ?? Math.max(1, Math.ceil(total / pageSize)));
  
  // No need to slice - server already returns the correct page
  const pageItems = useMemo(() => filteredItems, [filteredItems]);

  const pageAlumniIds = useMemo(() => {
    const ids: number[] = [];
    pageItems.forEach((it) => {
      const n = Number(it.alumniid);
      if (Number.isFinite(n) && n > 0) ids.push(Math.floor(n));
    });
    return ids;
  }, [pageItems]);

  const pageAllSelected = useMemo(() => {
    if (pageAlumniIds.length === 0) return false;
    const set = new Set(selectedAlumniIds);
    return pageAlumniIds.every((id) => set.has(id));
  }, [pageAlumniIds, selectedAlumniIds]);

  const pageSomeSelected = useMemo(() => {
    if (pageAlumniIds.length === 0) return false;
    const set = new Set(selectedAlumniIds);
    return pageAlumniIds.some((id) => set.has(id)) && !pageAllSelected;
  }, [pageAlumniIds, selectedAlumniIds, pageAllSelected]);

  // Reset page only when filters/tabs change, not when page changes
  useEffect(() => { 
    // Only reset if current page is invalid after filter/tab change
    if (!paginatedData || isFetching) return;
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
    setSelectedRowId(null); 
  }, [selected, pageSize, debouncedQuery, totalPages, currentPage, paginatedData, isFetching]);

  // Clear selected checkboxes when the dataset meaningfully changes
  useEffect(() => {
    setSelectedAlumniIds([]);
  }, [selected, debouncedQuery, pageSize]);
  
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
  const handleExportToExcel = useCallback(() => {
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
      if (selectedOccupationTransitionTimings.length > 0) {
        selectedOccupationTransitionTimings.forEach((v) => {
          url.searchParams.append("occupationTransitionTiming", v);
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
      if (selectedEmployers.length > 0) {
        selectedEmployers.forEach((employer) => {
          url.searchParams.append("employer", employer);
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
      if (selectedPersonalEmailStates.length > 0) {
        selectedPersonalEmailStates.forEach(state => {
          url.searchParams.append("personalEmailState", state);
        });
      }
      if (selectedContactNoStates.length > 0) {
        selectedContactNoStates.forEach(state => {
          url.searchParams.append("contactNoState", state);
        });
      }
      if (selectedCnicPassportStates.length > 0) {
        selectedCnicPassportStates.forEach(state => {
          url.searchParams.append("cnicPassportState", state);
        });
      }
      if (selectedAlumniIds.length > 0) {
        selectedAlumniIds.forEach((id) => {
          url.searchParams.append("selectedAlumniIds", String(id));
        });
      }
      if (selectedCategories.length > 0) {
        selectedCategories.forEach(category => {
          url.searchParams.append("category", category);
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

      }
      
      if (!allItems || allItems.length === 0) {
        throw new Error("No data found to export with the applied filters.");
      }

      // Map ALL fields to Excel format
      return allItems.map((item: Record<string, unknown>) => ({
        // Basic Information
        "SR.No": item.alumniid || "",
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationno || "",
        "Full Name": item.alumniname || "",
        "Gender": item.gender || "",
        "Father Name": item.fathername || "",
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
        "Wrok Email": item.officialemail || "",
        "Wrok Number": item.officialnumber || "",
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
        "Employment Status": (() => {
          const v = String(item.employeed || "").trim();
          const lower = v.toLowerCase();
          if (lower === "employed" || lower === "employed/business") return "Employed";
          if (lower === "self-emplo" || lower === "self-employed" || lower === "self-employed/enterpreneur") return "Self-Employed/Enterpreneur";
          if (lower === "highered") return "Pursuing Higher Education";
          return v;
        })(),
        "Post-Graduation Transition": item.occupation_transition_timing || "",
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
        "Chapter 1": item.chapter1_national || item.chapter1_international || "",
        "Chapter 2": item.chapter2_national || item.chapter2_international || "",
        "Chapter 3": item.chapter3_national || item.chapter3_international || "",
        "All Chapters": formatChapters(item),
        "Chapter Remarks": item.chapter_remarks || "",
        
        // Association
        "Association Title": item.association_title || "",
        "Association Description": item.association_description || "",
        "Association Dean": item.association_dean || "",
        "Association Phone": item.association_phone || "",
        "Association Email": item.association_email || "",
        "Association Address": item.association_address || "",
        
        // Chapter Leadership
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
          if (String(verifyValue || "").trim().toLowerCase() === "underapproval") return "Under Approval";
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
        "Category": item.category || "",
        "Registration Date": item.createddatetime || "",
        "Today Date": item.todaydate || "",
      }));
    };

    // Define column options
    const columns: ColumnOption[] = [
        { key: "SR.No", label: "SR.No", defaultSelected: true },
        { key: "SAP ID", label: "SAP ID", defaultSelected: true },
        { key: "Registration No", label: "Registration No", defaultSelected: true },
        { key: "Full Name", label: "Full Name", defaultSelected: true },
        { key: "Gender", label: "Gender", defaultSelected: true },
        { key: "Father Name", label: "Father Name", defaultSelected: false },
        { key: "Date of Birth", label: "Date of Birth", defaultSelected: false },
        { key: "Marital Status", label: "Marital Status", defaultSelected: false },
        { key: "CNIC/Passport", label: "CNIC/Passport", defaultSelected: true },
        { key: "Contact No", label: "Primary Contact", defaultSelected: true },
        { key: "Contact No 1", label: "Secondary Contact", defaultSelected: true },
        { key: "Personal Email", label: "Personal Email", defaultSelected: true },
        { key: "University Email", label: "University Email", defaultSelected: false },
        { key: "Wrok Email", label: "Wrok Email", defaultSelected: false },
        { key: "Wrok Number", label: "Wrok Number", defaultSelected: false },
        { key: "Address", label: "Home Address", defaultSelected: false },
        { key: "Country", label: "Home Country", defaultSelected: true },
        { key: "Province", label: "Home Province", defaultSelected: false },
        { key: "City", label: "Home City", defaultSelected: true },
        { key: "Degree Title", label: "Program", defaultSelected: true },
        { key: "CGPA", label: "CGPA", defaultSelected: false },
        { key: "Year of Starting", label: "Year of Starting", defaultSelected: false },
        { key: "Year of Ending", label: "Year of Ending", defaultSelected: true },
        { key: "Faculty", label: "Faculty", defaultSelected: true },
        { key: "Campus", label: "Campus", defaultSelected: true },
        { key: "Department", label: "Department", defaultSelected: true },
        { key: "Major Subject", label: "Major Subject", defaultSelected: false },
        { key: "Industry", label: "Sector", defaultSelected: false },
        { key: "Employment Status", label: "Employment Status", defaultSelected: false },
        { key: "Post-Graduation Transition", label: "Post-Graduation Transition", defaultSelected: false },
        { key: "Organization", label: "Employer", defaultSelected: false },
        { key: "Designation", label: "Designation", defaultSelected: false },
        { key: "Total Years of Experience", label: "Total Years of Experience", defaultSelected: false },
        { key: "Work City", label: "Work City", defaultSelected: false },
        { key: "Work Country", label: "Work Country", defaultSelected: false },
        { key: "Organization Address", label: "Organization Address", defaultSelected: false },
        { key: "Higher Education Institute Name", label: "Higher Education Institute Name", defaultSelected: false },
        { key: "Is Scholarship", label: "Funding source", defaultSelected: false },
        { key: "Higher Education Program", label: "Higher Education Program", defaultSelected: false },
        { key: "Higher Education Institute Country", label: "Higher Education Institute Country", defaultSelected: false },
        { key: "Higher Education Institute Province", label: "Higher Education Institute Province", defaultSelected: false },
        { key: "Higher Education Institute City", label: "Higher Education Institute City", defaultSelected: false },
        { key: "Chapter 1", label: "Chapter 1", defaultSelected: false },
        { key: "Chapter 2", label: "Chapter 2", defaultSelected: false },
        { key: "Chapter 3", label: "Chapter 3", defaultSelected: false },
        { key: "Chapter Remarks", label: "Chapter Remarks", defaultSelected: false },
        { key: "Association Title", label: "Association Title", defaultSelected: false },
        { key: "Association Description", label: "Association Description", defaultSelected: false },
        { key: "Association Dean", label: "Association Dean", defaultSelected: false },
        { key: "Association Phone", label: "Association Phone", defaultSelected: false },
        { key: "Association Email", label: "Association Email", defaultSelected: false },
        { key: "Association Address", label: "Association Address", defaultSelected: false },
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
        { key: "Facebook", label: "Facebook", defaultSelected: false },
        { key: "Instagram", label: "Instagram", defaultSelected: false },
        { key: "YouTube", label: "YouTube", defaultSelected: false },
        { key: "LinkedIn", label: "LinkedIn", defaultSelected: false },
        { key: "Verification Status", label: "Verification Status", defaultSelected: true },
        { key: "Last Login", label: "Last Login", defaultSelected: false },
        { key: "Login Count", label: "Login Count", defaultSelected: false },
        { key: "Email Send Count", label: "Email Send Count", defaultSelected: false },
        { key: "Alumni Status", label: "Alumni Status", defaultSelected: false },
        { key: "Photo Usage Consent", label: "Photo Usage Consent", defaultSelected: false },
        { key: "Category", label: "Category", defaultSelected: false },
        { key: "Registration Date", label: "Registration Date", defaultSelected: false },
      ];

    const statusStr = statusFilter ? `_${statusFilter}` : "";
    const searchStr = debouncedQuery ? `_search` : "";
    const filenameBase = `alumni_export${statusStr}${searchStr}`;

    openExportModal({
      data: fetchAndTransformData,
      columns,
      filename: filenameBase,
      sheetName: "Alumni List",
    });
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
    selectedOccupationTransitionTimings,
    selectedSectors,
    selectedWorkCities,
    selectedWorkCountries,
    selectedInstitutionNames,
    selectedProgramsEnrolled,
    selectedFundingSources,
    selectedInstitutionCountries,
    selectedInstitutionCities,
    selectedPhotoConsents,
    selectedSapIdStates,
    selectedRegNoStates,
    additionalFilter, // Status columns depend on selected statuses in dropdown
    openExportModal,
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

  const updateCacheVerify = useCallback((identifier: string, alumniId: number | null, verify: boolean) => {
    queryClient.setQueryData<AlumniListItem[] | undefined>(["alumnilist"], (old) => {
      if (!old) return old;
      if (alumniId) {
        return old.map((it) => (Number(it.alumniid) === Number(alumniId) ? { ...it, verify: verify ? "true" : "false" } : it));
      }
      return old.map((it) => (it.sapid === identifier ? { ...it, verify: verify ? "true" : "false" } : it));
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

  const removeFromCache = useCallback((identifier: string, alumniId: number | null) => {
    queryClient.setQueryData<AlumniListItem[] | undefined>(["alumnilist"], (old) => {
      if (!old) return old;
      if (alumniId) {
        return old.filter((it) => Number(it.alumniid) !== Number(alumniId));
      }
      return old.filter((it) => it.sapid !== identifier);
    });
    // Invalidate counts to refetch real-time data (matches all query keys starting with ["alumnilist-counts"])
    queryClient.invalidateQueries({
      queryKey: ["alumnilist-counts"],
      exact: false,
    });
    // Force refetch to get immediate updates
    queryClient.refetchQueries({
      queryKey: ["alumnilist-counts"],
      exact: false,
    });
  }, [queryClient]);

  const handleOpenEmailHistory = useCallback(
    (alumniId: number | null) => {
      const n = alumniId === null || alumniId === undefined ? NaN : Number(alumniId);
      if (!Number.isFinite(n) || n <= 0) return;
      setEmailHistoryAlumniId(n);
      emailHistoryModal.openModal();
    },
    [emailHistoryModal]
  );

  // Open confirmation modal for verify
  const handleVerifyClick = useCallback(
    (sapid: string, name: string, alumniId: number | null, email: string | null) => {
      const localKey = String(alumniId ?? sapid);
      const target = items.find((x) => String(x.alumniid ?? x.id) === localKey);
      const targetMerged = target ? mergeWithPreSapOverride(target) : null;

      if (targetMerged) {
        const missing = getMissingRequiredFields(targetMerged);
        if (missing.length > 0) {
          setIncompleteFields(missing.map((m) => ({ key: m.key, label: m.label })));
          setIncompleteTarget(targetMerged);
          setIncompleteHighlightKeys(
            missing
              .map((m) => {
                switch (m.key) {
                  case "sapId":
                    return "sapid";
                  case "name":
                    return "alumniname";
                  case "fatherName":
                    return "fathername";
                  case "cnicOrPassport":
                    return "cnicpassport";
                  case "primaryContact":
                    return "contactno";
                  case "personalEmail":
                    return "personalemail";
                  case "faculty":
                    return "faculty";
                  case "department":
                    return "department";
                  case "program":
                    return "program";
                  case "campus":
                    return "campusname";
                  case "passingOutYear":
                    return "yearofending";
                  case "registrationNo":
                    return "registrationno";
                  default:
                    return null;
                }
              })
              .filter((x): x is Exclude<typeof x, null> => x !== null)
          );
          incompleteProfileModal.openModal();
          return;
        }
      }

      const dups = target ? findDuplicatesFor(target, items) : [];
      if (dups.length > 0) {
        setPendingDuplicateGate({ type: "verify", targetKey: localKey, name, alumniId, email });
        setDuplicateSearch("");
        setDuplicateSortKey("name");
        setDuplicateSortDir("asc");
        setDuplicateDeleteCount(0);
        duplicatesModal.openModal();
        return;
      }

      setPendingAction({ type: "verify", sapid, name, alumniId, email });
      confirmModal.openModal();
    },
    [confirmModal, duplicatesModal, findDuplicatesFor, getMissingRequiredFields, incompleteProfileModal, items, mergeWithPreSapOverride]
  );

  // Execute verify after confirmation
  const handleVerify = useCallback(async (identifier: string, alumniId: number | null): Promise<void> => {
    if (!identifier || String(identifier).trim() === "") {
      const errorMsg = "Invalid identifier. Cannot verify alumni.";
      setActionError(errorMsg);
      throw new Error(errorMsg);
    }

    setActionError(null);
    startMut(identifier);
    // optimistic
    updateCacheVerify(identifier, alumniId, true);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(identifier)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: true }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to verify: ${res.status}` }));
        throw new Error(errorData.error || `Failed to verify: ${res.status}`);
      }
      const responseData = await res.json();

      if (responseData.verify === false || responseData.verify === "false") {
        throw new Error("Verification failed - server returned false");
      }

      setActionMessage("Alumni verified successfully.");
      queryClient.invalidateQueries({ queryKey: ["alumni", "profile", identifier] });
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false });
      queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["alumnilist"] });
    } catch (e: unknown) {
      // revert
      updateCacheVerify(identifier, alumniId, false);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to verify alumni.");
      throw e;
    } finally {
      stopMut(identifier);
    }
  }, [startMut, stopMut, updateCacheVerify, queryClient]);

  // Open confirmation modal for unverify
  const handleUnverifyClick = useCallback((sapid: string, name: string, alumniId: number | null, email: string | null) => {
    const localKey = String(alumniId ?? sapid);
    const target = items.find((x) => String(x.alumniid ?? x.id) === localKey);
    const dups = target ? findDuplicatesFor(target, items) : [];
    if (dups.length > 0) {
      setPendingDuplicateGate({ type: "unverify", targetKey: localKey, name, alumniId, email });
      setDuplicateSearch("");
      setDuplicateSortKey("name");
      setDuplicateSortDir("asc");
      setDuplicateDeleteCount(0);
      duplicatesModal.openModal();
      return;
    }

    setPendingAction({ type: "unverify", sapid, name, alumniId, email });
    confirmModal.openModal();
  }, [confirmModal, duplicatesModal, findDuplicatesFor, items]);

  // Execute unverify after confirmation
  const handleUnverify = useCallback(async (identifier: string, alumniId: number | null): Promise<void> => {
    if (!identifier || String(identifier).trim() === "") {
      const errorMsg = "Invalid identifier. Cannot unverify alumni.";
      setActionError(errorMsg);
      throw new Error(errorMsg);
    }

    setActionError(null);
    startMut(identifier);
    // optimistic
    updateCacheVerify(identifier, alumniId, false);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(identifier)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verify: false }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to unverify: ${res.status}` }));
        throw new Error(errorData.error || `Failed to unverify: ${res.status}`);
      }
      const responseData = await res.json();

      setActionMessage("Alumni marked as unverified.");
      queryClient.invalidateQueries({ queryKey: ["alumni", "profile", identifier] });
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Refresh counts
      queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false }); // Force immediate refetch
      queryClient.invalidateQueries({ queryKey: ["alumnilist"] }); // Refresh list
    } catch (e: unknown) {
      // revert
      updateCacheVerify(identifier, alumniId, true);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to update verification.");
      throw e; // Re-throw so executePendingAction can catch it
    } finally {
      stopMut(identifier);
    }
  }, [startMut, stopMut, updateCacheVerify, queryClient]);

  // Open confirmation modal for delete (kept for potential future use)
  // const handleDeleteClick = useCallback((sapid: string, name: string) => {
  //   setPendingAction({ type: "delete", sapid, name });
  //   confirmModal.openModal();
  // }, [confirmModal]);

  // Execute delete after confirmation
  const handleDelete = useCallback(async (identifier: string, alumniId: number | null) => {
    if (!identifier || String(identifier).trim() === "") {
      setActionError("Invalid identifier. Cannot delete alumni.");
      return;
    }

    setActionError(null);
    setActionMessage(null);
    startMut(identifier);
    const prev = queryClient.getQueryData<AlumniListItem[] | undefined>(["alumnilist"]);
    // optimistic remove
    removeFromCache(identifier, alumniId);
    try {
      const res = await fetch(`/api/alumni/${encodeURIComponent(identifier)}`, { 
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
        queryClient.invalidateQueries({ queryKey: ["alumni", "profile", identifier] }),
        queryClient.invalidateQueries({ queryKey: ["alumnilist"] }),
        queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"], exact: false }), // Refresh counts
        queryClient.refetchQueries({ queryKey: ["alumnilist-counts"], exact: false }) // Force immediate refetch
      ]);
    } catch (e: unknown) {
      // rollback
      if (prev) queryClient.setQueryData(["alumnilist"], prev);
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg || "Failed to delete alumni.");

    } finally {
      stopMut(identifier);
    }
  }, [removeFromCache, startMut, stopMut, queryClient]);

  // Execute pending action after confirmation
  const executePendingAction = useCallback(async () => {
    if (!pendingAction) {

      return;
    }
    
    const { type, sapid, alumniId } = pendingAction;
    
    // Store the action locally before async operations
    const actionType = type;
    const actionSapid = sapid;
    const actionAlumniId = alumniId ?? null;
    
    try {
      if (actionType === "verify") {
        await handleVerify(actionSapid, actionAlumniId);
      } else if (actionType === "unverify") {
        await handleUnverify(actionSapid, actionAlumniId);
      } else if (actionType === "delete") {
        await handleDelete(actionSapid, actionAlumniId);
      }
      
      // Close modal and clear pending action after successful execution

      confirmModal.closeModal();
      setPendingAction(null);
    } catch (error) {
      // Error is already handled in the individual handlers (setActionError)
      // Keep modal open if there's an error so user can see the error message

      // Don't close modal on error - let user see the error and try again or cancel
    }
  }, [pendingAction, confirmModal, handleVerify, handleUnverify, handleDelete]);
  
  // Wrapper for button click to ensure it works
  const handleConfirmClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!pendingAction) {

      return;
    }
    
    if (mutatingIds.has(pendingAction.sapid)) {

      return;
    }
    
    await executePendingAction();
  }, [pendingAction, mutatingIds, executePendingAction]);

  const handleView = useCallback((sapId?: string | null, registrationNo?: string | null) => {
    if (typeof window === "undefined") return;
    const identifier = String(sapId || registrationNo || "").trim();
    if (!identifier) return;
    const url = `/alumni-profile?sapid=${encodeURIComponent(identifier)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const duplicateGateTarget = useMemo(() => {
    if (!pendingDuplicateGate) return null;
    return items.find((x) => String(x.alumniid ?? x.id) === pendingDuplicateGate.targetKey) ?? null;
  }, [items, pendingDuplicateGate]);

  const duplicateGateList = useMemo(() => {
    if (!duplicateGateTarget) return [];
    const raw = findDuplicatesFor(duplicateGateTarget, items);
    const q = String(duplicateSearch || "").trim().toLowerCase();
    const filtered = !q
      ? raw
      : raw.filter((it) => {
          const hay = [it.name, it.sapId, it.registrationNo, it.gender, it.verifyStatus].map((x) => String(x ?? "")).join(" ").toLowerCase();
          return hay.includes(q);
        });

    const dir = duplicateSortDir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const va = ((): string => {
        if (duplicateSortKey === "name") return String(a.name || "");
        if (duplicateSortKey === "sapId") return String(a.sapId || "");
        if (duplicateSortKey === "registrationNo") return String(a.registrationNo || "");
        if (duplicateSortKey === "gender") return String(a.gender || "");
        return String(a.verifyStatus || "");
      })();
      const vb = ((): string => {
        if (duplicateSortKey === "name") return String(b.name || "");
        if (duplicateSortKey === "sapId") return String(b.sapId || "");
        if (duplicateSortKey === "registrationNo") return String(b.registrationNo || "");
        if (duplicateSortKey === "gender") return String(b.gender || "");
        return String(b.verifyStatus || "");
      })();
      return va.localeCompare(vb) * dir;
    });

    return sorted;
  }, [duplicateGateTarget, duplicateSearch, duplicateSortDir, duplicateSortKey, findDuplicatesFor, items]);

  const handleLocalDeleteDuplicate = useCallback((item: AlumniItem) => {
    const k = String(item.alumniid ?? item.id);
    const ok = typeof window === "undefined" ? false : window.confirm(`Delete duplicate record for ${item.name || "this alumni"}? This is frontend-only and will not affect the backend.`);
    if (!ok) return;

    setLocallyDeletedKeys((prev) => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });
    setDuplicateDeleteCount((n) => n + 1);
    setActionMessage("Duplicate removed from the current view. You can now proceed once duplicates are resolved.");
  }, []);

  const handleProceedAfterDuplicateResolution = useCallback(() => {
    if (!pendingDuplicateGate) return;
    if (!duplicateGateTarget) return;
    const remaining = findDuplicatesFor(duplicateGateTarget, items);
    if (remaining.length > 0) {
      setActionError("You must delete at least one duplicate and resolve duplicates before proceeding.");
      return;
    }
    if (duplicateDeleteCount < 1) {
      setActionError("Delete at least one duplicate record before proceeding.");
      return;
    }

    duplicatesModal.closeModal();
    setPendingDuplicateGate(null);
    setDuplicateSearch("");
    setDuplicateDeleteCount(0);

    setPendingAction({
      type: pendingDuplicateGate.type,
      sapid: String(pendingDuplicateGate.alumniId ?? pendingDuplicateGate.targetKey),
      name: pendingDuplicateGate.name,
      alumniId: pendingDuplicateGate.alumniId,
      email: pendingDuplicateGate.email ?? null,
    });
    confirmModal.openModal();
  }, [confirmModal, duplicateDeleteCount, duplicateGateTarget, duplicatesModal, findDuplicatesFor, items, pendingDuplicateGate]);

  const handleDashboardStatSelect = useCallback((key: TabKey) => {
    setSelected(key);
    setAdditionalFilter([]);
  }, []);

  return (
    <div className="p-0">
      <div className="flex flex-col gap-4">
        <DashboardStats
          selected={selected}
          onSelect={handleDashboardStatSelect}
          counts={counts}
          isLoadingCounts={isLoadingCounts && !countsData}
          underApprovalChangeCount={changeApprovalCount}
          isLoadingChangeCount={isPendingChangeApprovalCount}
        />

        {/* Distinguished Alumni Tab Content */}
        <div style={{ display: selected === "distinguished" ? "block" : "none" }}>
          <DistinguishedAlumniTab masterFilters={masterFilters} />
        </div>

        {/* Regular Alumni Tab Content */}
        <div style={{ display: selected !== "distinguished" ? "block" : "none" }}>
        <>
        {selected === "underApproval" && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUnderApprovalSubTab("new")}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                underApprovalSubTab === "new"
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300"
              }`}
            >
              New Approvals
              <UnderApprovalSubTabCounter
                count={counts.underApproval || 0}
                isLoading={isLoadingCounts && !countsData}
                isSelected={underApprovalSubTab === "new"}
              />
            </button>
            <button
              type="button"
              onClick={() => setUnderApprovalSubTab("change")}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                underApprovalSubTab === "change"
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300"
              }`}
            >
              Change Approvals
              <UnderApprovalSubTabCounter
                count={changeApprovalCount}
                isLoading={isPendingChangeApprovalCount}
                isSelected={underApprovalSubTab === "change"}
              />
            </button>
          </div>
        )}

        {selected === "underApproval" && underApprovalSubTab === "change" ? (
          <ChangeApprovalsTab />
        ) : (
        <>
        {/* Search and Filters Section */}
        <SearchToolbar
          title="Search Alumni"
          searchValue={query}
          searchOnChange={setQuery}
          searchPlaceholder="Search by SR.No, name, SAP ID, registration no, email, faculty, department, or program..."
          searchId="alumni-search"
          filtersActive={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onResetSort={handleResetSort}
          showResetSort={!!sortField}
          onExport={handleExportToExcel}
          exportDisabled={isLoading || isExporting}
          isExporting={isExporting}
          isFetching={isFetching && !isLoading}
        >
          <ExportModal />
          {/* Filters Row - Checkbox-based multi-select with dropdown styling */}
            <div className="flex flex-wrap gap-2.5 items-start sm:items-end pt-2">
              {/* Faculty Filter */}
              <div className="flex-1 sm:min-w-[180px]">
                <label
                  htmlFor="faculty-filter"
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2"
                >
                  <span>Faculty</span>
                </label>
                <div className="relative" ref={facultyFilterRef}>
                  <button
                    type="button"
                    id="faculty-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, faculty: !prev.faculty }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
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
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.faculty ? 'rotate-180' : ''}`}
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
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2"
                >
                  <span>Department</span>
                </label>
                <div className="relative" ref={departmentFilterRef}>
                  <button
                    type="button"
                    id="department-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, department: !prev.department }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
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
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.department ? 'rotate-180' : ''}`}
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
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2"
                >
                  <span>Program</span>
                </label>
                <div className="relative" ref={programFilterRef}>
                  <button
                    type="button"
                    id="program-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, program: !prev.program }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
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
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.program ? 'rotate-180' : ''}`}
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
                  className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider"
                >
                  Status
                </label>
                <div className="relative" ref={statusFilterRef}>
                  <button
                    type="button"
                    id="status-filter"
                    onClick={() => setExpandedFilters(prev => ({ ...prev, status: !prev.status }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer text-left flex items-center justify-between"
                  >
                    <span>
                      {additionalFilter.length === 0 
                        ? `All Status (${counts.total.toLocaleString()})` 
                        : allStatusesSelected
                        ? `All Status (${counts.total.toLocaleString()})`
                        : `${additionalFilter.length} Selected`}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.status ? 'rotate-180' : ''}`}
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
                              checked={allStatusesSelected}
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
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 flex items-center justify-between"
                >
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    Master Filters
                  </span>
                  <svg 
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expandedFilters.masterFilters ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedFilters.masterFilters && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {/* Gender Filter */}
                      <div className="relative" ref={genderFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Gender</span>
                        </label>
                        {isLoadingGenders ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : gendersError ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                            Error loading genders
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedFilters(prev => ({ ...prev, gender: !prev.gender }))}
                              className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {selectedGenders.length === 0
                                  ? "Select genders..."
                                  : selectedGenders.length === 1
                                  ? gendersData?.genders?.find(g => g.value === selectedGenders[0])?.label || selectedGenders[0]
                                  : `${selectedGenders.length} genders selected`}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${expandedFilters.gender ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedGenders.length} selected</p>
                        )}
                      </div>
                      
                      {/* Marital Status Filter */}
                      <div className="relative" ref={maritalStatusFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Marital Status</span>
                        </label>
                        {isLoadingMaritalStatuses ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : maritalStatusesError ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                            Error loading marital statuses
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedFilters(prev => ({ ...prev, maritalStatus: !prev.maritalStatus }))}
                              className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {selectedMaritalStatuses.length === 0
                                  ? "Select marital statuses..."
                                  : selectedMaritalStatuses.length === 1
                                  ? maritalStatusesData?.maritalStatuses?.find(s => s.value === selectedMaritalStatuses[0])?.label || selectedMaritalStatuses[0]
                                  : `${selectedMaritalStatuses.length} statuses selected`}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${expandedFilters.maritalStatus ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedMaritalStatuses.length} selected</p>
                        )}
                      </div>
                      
                      {/* Home Country Filter */}
                      <div className="relative" ref={homeCountryFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Home Country</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, homeCountry: !prev.homeCountry }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedHomeCountries.length === 0
                              ? "Select countries..."
                              : selectedHomeCountries.length === 1
                              ? selectedHomeCountries[0]
                              : `${selectedHomeCountries.length} countries selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.homeCountry ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedHomeCountries.length} selected</p>
                        )}
                      </div>

                      {/* Province Filter */}
                      <div className="relative" ref={provinceFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Home Province (Pakistan)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, province: !prev.province }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedProvinces.length === 0
                              ? "Select provinces..."
                              : selectedProvinces.length === 1
                              ? provincesData?.provinces?.find(p => p.value === selectedProvinces[0])?.label || selectedProvinces[0]
                              : `${selectedProvinces.length} provinces selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.province ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedProvinces.length} selected</p>
                        )}
                      </div>
                      
                      {/* Home City Filter */}
                      <div className="relative" ref={homeCityFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Home City</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, homeCity: !prev.homeCity }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedHomeCities.length === 0
                              ? "Select cities..."
                              : selectedHomeCities.length === 1
                              ? selectedHomeCities[0]
                              : `${selectedHomeCities.length} cities selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.homeCity ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedHomeCities.length} selected</p>
                        )}
                      </div>
                      
                    
                      
                      {/* Campus Filter */}
                      <div className="relative" ref={campusFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Campus</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, campus: !prev.campus }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedCampuses.length === 0
                              ? "Select campuses..."
                              : selectedCampuses.length === 1
                              ? selectedCampuses[0]
                              : `${selectedCampuses.length} campuses selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.campus ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedCampuses.length} selected</p>
                        )}
                      </div>
                      
                      {/* Admission Year Filter */}
                      <div className="relative" ref={admissionYearFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Admission Year</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, admissionYear: !prev.admissionYear }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedAdmissionYears.length === 0
                              ? "Select years..."
                              : selectedAdmissionYears.length === 1
                              ? selectedAdmissionYears[0]
                              : `${selectedAdmissionYears.length} years selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.admissionYear ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedAdmissionYears.length} selected</p>
                        )}
                      </div>
                      
                      {/* Passing Year Filter */}
                      <div className="relative" ref={passingYearFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Passing Year</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, passingYear: !prev.passingYear }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedPassingYears.length === 0
                              ? "Select years..."
                              : selectedPassingYears.length === 1
                              ? selectedPassingYears[0]
                              : `${selectedPassingYears.length} years selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.passingYear ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedPassingYears.length} selected</p>
                        )}
                      </div>
                      
                      {/* Occupation Status Filter */}
                      <div className="relative" ref={occupationStatusFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Occupation Status</span>
                        </label>
                        {isLoadingOccupationStatuses ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : occupationStatusesError ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                            Error loading occupation statuses
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedFilters(prev => ({ ...prev, occupationStatus: !prev.occupationStatus }))}
                              className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {selectedOccupationStatuses.length === 0
                                  ? "Select occupation statuses..."
                                  : selectedOccupationStatuses.length === 1
                                  ? occupationStatusesData?.occupationStatuses?.find(s => s.value === selectedOccupationStatuses[0])?.label || selectedOccupationStatuses[0]
                                  : `${selectedOccupationStatuses.length} statuses selected`}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${expandedFilters.occupationStatus ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedOccupationStatuses.length} selected</p>
                        )}
                      </div>

                      {/* Post-graduation transition (occupation_transition_timing) */}
                      <div className="relative" ref={occupationTransitionTimingFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Post-graduation transition</span>
                        </label>
                        {isLoadingOccupationTransitionTimings ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : occupationTransitionTimingsError ? (
                          <div className="w-full px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                            Error loading transition options
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedFilters((prev) => ({ ...prev, occupationTransitionTiming: !prev.occupationTransitionTiming }))}
                              className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {selectedOccupationTransitionTimings.length === 0
                                  ? "Select transition timing..."
                                  : selectedOccupationTransitionTimings.length === 1
                                  ? occupationTransitionTimingsData?.occupationTransitionTimings?.find((t) => t.value === selectedOccupationTransitionTimings[0])?.label || selectedOccupationTransitionTimings[0]
                                  : `${selectedOccupationTransitionTimings.length} selected`}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 transition-transform ${expandedFilters.occupationTransitionTiming ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {expandedFilters.occupationTransitionTiming && (
                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                <div className="p-2">
                                  <label
                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOccupationTransitionTimingSelectAll();
                                    }}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={
                                          occupationTransitionTimingsData?.occupationTransitionTimings &&
                                          selectedOccupationTransitionTimings.length === occupationTransitionTimingsData.occupationTransitionTimings.length &&
                                          occupationTransitionTimingsData.occupationTransitionTimings.length > 0
                                        }
                                        onChange={handleOccupationTransitionTimingSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All options</span>
                                    </div>
                                  </label>
                                  <div className="max-h-48 overflow-y-auto">
                                    {occupationTransitionTimingsData?.occupationTransitionTimings &&
                                    occupationTransitionTimingsData.occupationTransitionTimings.length > 0 ? (
                                      occupationTransitionTimingsData.occupationTransitionTimings.map((opt: OccupationTransitionTimingOption) => {
                                        const isChecked = selectedOccupationTransitionTimings.includes(opt.value);
                                        return (
                                          <label
                                            key={opt.value}
                                            className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleOccupationTransitionTimingToggle(opt.value)}
                                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                            />
                                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                              {opt.label} ({opt.count.toLocaleString()})
                                            </span>
                                          </label>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-sm text-gray-500">No values available</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {selectedOccupationTransitionTimings.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedOccupationTransitionTimings.length} selected</p>
                        )}
                      </div>
                      
                      {/* Sector Filter */}
                      <div className="relative" ref={sectorFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Sector</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, sector: !prev.sector }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedSectors.length === 0
                              ? "Select sectors..."
                              : selectedSectors.length === 1
                              ? selectedSectors[0]
                              : `${selectedSectors.length} sectors selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.sector ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedSectors.length} selected</p>
                        )}
                      </div>
                      
                      
                      
                      {/* Work Country Filter */}
                      <div className="relative" ref={workCountryFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Work Country</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, workCountry: !prev.workCountry }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedWorkCountries.length === 0
                              ? "Select countries..."
                              : selectedWorkCountries.length === 1
                              ? selectedWorkCountries[0]
                              : `${selectedWorkCountries.length} countries selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.workCountry ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedWorkCountries.length} selected</p>
                        )}
                      </div>

                      {/* Employer Filter */}
                      <div className="relative" ref={employerFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Employer</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, employer: !prev.employer }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedEmployers.length === 0
                              ? "Select employers..."
                              : selectedEmployers.length === 1
                              ? employersData?.employers?.find((e: EmployerOption) => e.value === selectedEmployers[0])?.label || selectedEmployers[0]
                              : `${selectedEmployers.length} employers selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.employer ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.employer && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEmployerSelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={employersData?.employers && selectedEmployers.length === employersData.employers.length && employersData.employers.length > 0}
                                    onChange={handleEmployerSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Employers</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {employersData?.employers?.map((employer: EmployerOption) => {
                                  const isChecked = selectedEmployers.includes(employer.value);
                                  return (
                                    <label
                                      key={employer.value}
                                      className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleEmployerToggle(employer.value)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{employer.label} ({employer.count})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedEmployers.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedEmployers.length} selected</p>
                        )}
                      </div>

                      {/* Work City Filter */}
                      <div className="relative" ref={workCityFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Work City</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, workCity: !prev.workCity }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedWorkCities.length === 0
                              ? "Select cities..."
                              : selectedWorkCities.length === 1
                              ? selectedWorkCities[0]
                              : `${selectedWorkCities.length} cities selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.workCity ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedWorkCities.length} selected</p>
                        )}
                      </div>
                      
                      {/* Institution Name Filter */}
                      <div className="relative" ref={institutionNameFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Institution Name</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, institutionName: !prev.institutionName }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedInstitutionNames.length === 0
                              ? "Select institutions..."
                              : selectedInstitutionNames.length === 1
                              ? selectedInstitutionNames[0]
                              : `${selectedInstitutionNames.length} institutions selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.institutionName ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedInstitutionNames.length} selected</p>
                        )}
                      </div>
                      
                      {/* Program Enrolled Filter */}
                      <div className="relative" ref={programEnrolledFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Program Enrolled</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, programEnrolled: !prev.programEnrolled }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedProgramsEnrolled.length === 0
                              ? "Select programs..."
                              : selectedProgramsEnrolled.length === 1
                              ? selectedProgramsEnrolled[0]
                              : `${selectedProgramsEnrolled.length} programs selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.programEnrolled ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedProgramsEnrolled.length} selected</p>
                        )}
                      </div>
                      
                      {/* Funding Source Filter */}
                      <div className="relative" ref={fundingSourceFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Funding Source</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, fundingSource: !prev.fundingSource }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedFundingSources.length === 0
                              ? "Select funding sources..."
                              : selectedFundingSources.length === 1
                              ? selectedFundingSources[0]
                              : `${selectedFundingSources.length} sources selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.fundingSource ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedFundingSources.length} selected</p>
                        )}
                      </div>
                      
                      {/* Institution Country Filter */}
                      <div className="relative" ref={institutionCountryFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Institution Country</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, institutionCountry: !prev.institutionCountry }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedInstitutionCountries.length === 0
                              ? "Select countries..."
                              : selectedInstitutionCountries.length === 1
                              ? selectedInstitutionCountries[0]
                              : `${selectedInstitutionCountries.length} countries selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.institutionCountry ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedInstitutionCountries.length} selected</p>
                        )}
                      </div>
                      
                      {/* Institution City Filter */}
                      <div className="relative" ref={institutionCityFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Institution City</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, institutionCity: !prev.institutionCity }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedInstitutionCities.length === 0
                              ? "Select cities..."
                              : selectedInstitutionCities.length === 1
                              ? selectedInstitutionCities[0]
                              : `${selectedInstitutionCities.length} cities selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.institutionCity ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedInstitutionCities.length} selected</p>
                        )}
                      </div>
                      
                      {/* Photo Consent Filter */}
                      <div className="relative" ref={photoConsentFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Photo Consent</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, photoConsent: !prev.photoConsent }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedPhotoConsents.length === 0
                              ? "Select photo consent..."
                              : selectedPhotoConsents.length === 1
                              ? photoConsentData?.photoConsents?.find(c => c.value === selectedPhotoConsents[0])?.label || selectedPhotoConsents[0]
                              : `${selectedPhotoConsents.length} selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.photoConsent ? "rotate-180" : ""}`}
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
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedPhotoConsents.length} selected</p>
                        )}
                      </div>

                      {/* Category Filter */}
                      <div className="relative" ref={categoryFilterRef}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                          <span>Category</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setExpandedFilters(prev => ({ ...prev, category: !prev.category }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                        >
                          <span className="truncate">
                            {selectedCategories.length === 0
                              ? "Select categories..."
                              : selectedCategories.length === 1
                              ? (() => {
                                  const category = categoriesData?.categories?.find(c => c.value === selectedCategories[0]);
                                  return category ? category.label : selectedCategories[0];
                                })()
                              : `${selectedCategories.length} categories selected`}
                          </span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform ${expandedFilters.category ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedFilters.category && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2">
                              <label
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors border-b border-gray-200 dark:border-gray-700 mb-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCategorySelectAll();
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={categoriesData?.categories && selectedCategories.length === categoriesData.categories.length && categoriesData.categories.length > 0}
                                    onChange={handleCategorySelectAll}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                  />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Categories</span>
                                </div>
                              </label>
                              <div className="max-h-48 overflow-y-auto">
                                {categoriesData?.categories && categoriesData.categories.length > 0 ? (
                                  categoriesData.categories.map((category) => {
                                    const isChecked = selectedCategories.includes(category.value);
                                    return (
                                      <label
                                        key={category.value}
                                        className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleCategoryToggle(category.value)}
                                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                        />
                                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                          {category.label} ({category.count.toLocaleString()})
                                        </span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <div className="p-2 text-sm text-gray-500">No category options available</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedCategories.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedCategories.length} selected</p>
                        )}
                      </div>

                      {/* SAP ID State Filter (NULL/EXISTS) */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                          SAP ID (Missing/Existing)
                        </label>
                        <div className="space-y-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedSapIdStates.includes("NULL")}
                              onChange={() => handleSapIdStateToggle("NULL")}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>NULL</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedSapIdStates.includes("EXISTS")}
                              onChange={() => handleSapIdStateToggle("EXISTS")}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>EXISTS</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedSapIdStates.includes("DUPLICATE")}
                              onChange={() => handleSapIdStateToggle("DUPLICATE")}
                              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>Duplicate</span>
                          </label>
                        </div>
                      </div>

                      {/* Registration No State Filter (NULL/EXISTS) */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                          Registration No (Missing/Existing)
                        </label>
                        <div className="space-y-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRegNoStates.includes("NULL")}
                              onChange={() => handleRegNoStateToggle("NULL")}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>NULL</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRegNoStates.includes("EXISTS")}
                              onChange={() => handleRegNoStateToggle("EXISTS")}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>EXISTS</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRegNoStates.includes("DUPLICATE")}
                              onChange={() => handleRegNoStateToggle("DUPLICATE")}
                              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>Duplicated</span>
                          </label>
                        </div>
                      </div>

                      {/* Personal Email State Filter (NULL/EXISTS) */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                          Personal Email (Missing/Existing)
                        </label>
                        <div className="space-y-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPersonalEmailStates.includes("NULL")}
                              onChange={() => handlePersonalEmailStateToggle("NULL")}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>NULL</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPersonalEmailStates.includes("EXISTS")}
                              onChange={() => handlePersonalEmailStateToggle("EXISTS")}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>EXISTS</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPersonalEmailStates.includes("DUPLICATE")}
                              onChange={() => handlePersonalEmailStateToggle("DUPLICATE")}
                              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>Duplicate</span>
                          </label>
                        </div>
                      </div>

                      {/* Contact No State Filter (NULL/EXISTS) */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                          Contact No (Missing/Existing)
                        </label>
                        <div className="space-y-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedContactNoStates.includes("NULL")}
                              onChange={() => handleContactNoStateToggle("NULL")}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>NULL</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedContactNoStates.includes("EXISTS")}
                              onChange={() => handleContactNoStateToggle("EXISTS")}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>EXISTS</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedContactNoStates.includes("DUPLICATE")}
                              onChange={() => handleContactNoStateToggle("DUPLICATE")}
                              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>Duplicate</span>
                          </label>
                        </div>
                      </div>

                      {/* CNIC/Passport State Filter (NULL/EXISTS/DUPLICATE) */}
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                          CNIC/Passport (Missing/Existing)
                        </label>
                        <div className="space-y-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCnicPassportStates.includes("NULL")}
                              onChange={() => handleCnicPassportStateToggle("NULL")}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>NULL</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCnicPassportStates.includes("EXISTS")}
                              onChange={() => handleCnicPassportStateToggle("EXISTS")}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>EXISTS</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedCnicPassportStates.includes("DUPLICATE")}
                              onChange={() => handleCnicPassportStateToggle("DUPLICATE")}
                              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-gray-300 dark:border-gray-600"
                            />
                            <span>Duplicate</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </SearchToolbar>

        {/* Table Section */}
        <div className="pb-8 mt-4">
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
              className="max-w-full overflow-x-auto overflow-y-hidden"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <div className="table-content-wrapper " style={{ minWidth: '1800px' }}>
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
                      className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[140px] hidden lg:table-cell cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleSort("createdDateTime")}
                    >
                      Registration Date
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
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[90px] hidden lg:table-cell">
                      Gender
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[110px] hidden lg:table-cell">
                      Campus
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[140px] hidden xl:table-cell">
                      Primary Contact
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[130px] hidden xl:table-cell">
                      Home Country
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden xl:table-cell">
                      Home Province
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden xl:table-cell">
                      Home City
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] hidden xl:table-cell">
                      Occupation Status
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[130px] hidden 2xl:table-cell">
                      Work Country
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[130px] hidden 2xl:table-cell">
                      Work City
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden 2xl:table-cell">
                      Higher Education Country
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[160px] hidden 2xl:table-cell">
                      Higher Education City
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[140px] hidden 2xl:table-cell">
                      Chapter 1
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
                    <TableCell className="sticky right-0 z-20 min-w-[120px] bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 px-3 py-4 text-right text-xs font-extrabold uppercase tracking-wider text-gray-700 backdrop-blur-sm dark:bg-gray-900 dark:bg-none dark:text-gray-200 sm:px-6">
                      Actions
                    </TableCell>
                    </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {isLoading && (
                    Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                        <TableCell className="px-3 sm:px-6 py-5">
                          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                        </TableCell>
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
                        <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                          <div className="h-5 w-24 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
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
                        <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden lg:table-cell">
                          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden xl:table-cell">
                          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden xl:table-cell">
                          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden xl:table-cell">
                          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden xl:table-cell">
                          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden xl:table-cell">
                          <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden 2xl:table-cell">
                          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden 2xl:table-cell">
                          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden 2xl:table-cell">
                          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden 2xl:table-cell">
                          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 hidden 2xl:table-cell">
                          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5">
                          <div className="h-7 w-20 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 sticky right-0 bg-white dark:bg-gray-900 z-10">
                          <div className="h-9 w-24 sm:w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                {!isLoading && isError && (
                  <TableRow>
                    <TableCell className="px-6 py-6 text-center" colSpan={23}>
                      <div className="flex flex-col items-center gap-4">
                        
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
                    <TableCell className="px-6 py-6 text-center text-gray-500 dark:text-gray-400" colSpan={23}>
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
                    <React.Fragment key={`${String(alum.alumniid ?? alum.id)}-fragment`}>
                      <TableRow
                        key={`${String(alum.alumniid ?? alum.id)}-row`}
                        className={`hover:bg-blue-50/60 dark:hover:bg-white/[0.05] transition-all duration-200 cursor-pointer ${selectedRowId === (alum.alumniid ?? null) ? "bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-700 shadow-sm" : "odd:bg-white even:bg-gray-50/30 dark:odd:bg-gray-800/30 dark:even:bg-gray-800/20"}`}
                        onClick={() => setSelectedRowId(alum.alumniid ?? null)}
                        aria-selected={selectedRowId === (alum.alumniid ?? null)}
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
                                    if (!alum.alumniid) return;
                                    setExpandedRowId(expandedRowId === alum.alumniid ? null : alum.alumniid);
                                  }}
                                  className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                                    expandedRowId === (alum.alumniid ?? null)
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                                  }`}
                                  aria-label={expandedRowId === (alum.alumniid ?? null) ? "Collapse details" : "Expand details"}
                                  title={expandedRowId === (alum.alumniid ?? null) ? "Collapse details" : "Expand details"}
                                >
                                  <PlusIcon className={`w-3.5 h-3.5 transition-transform ${expandedRowId === (alum.alumniid ?? null) ? "rotate-45" : ""}`} />
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
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          {formatRegistrationDate(alum.createdDateTime)}
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
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          <span className="truncate block max-w-[90px]">{alum.gender || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden lg:table-cell">
                          <span className="truncate block max-w-[110px]">{alum.campus || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden xl:table-cell">
                          <span className="truncate block max-w-[140px]">{alum.primaryContact || alum.mobile || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden xl:table-cell">
                          <span className="truncate block max-w-[130px]">{alum.homeCountry || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden xl:table-cell">
                          <span className="truncate block max-w-[120px]">{alum.homeProvince || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden xl:table-cell">
                          <span className="truncate block max-w-[120px]">{alum.homeCity || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden xl:table-cell">
                          <span className="truncate block max-w-[150px]">{alum.occupationStatus || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden 2xl:table-cell">
                          <span className="truncate block max-w-[130px]">{alum.workCountry || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden 2xl:table-cell">
                          <span className="truncate block max-w-[130px]">{alum.workCity || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden 2xl:table-cell">
                          <span className="truncate block max-w-[180px]">{alum.higherEducationCountry || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden 2xl:table-cell">
                          <span className="truncate block max-w-[160px]">{alum.higherEducationCity || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 sm:px-6 py-5 text-gray-700 text-sm text-start dark:text-gray-300 hidden 2xl:table-cell">
                          <span className="truncate block max-w-[140px]">{alum.chapter1 || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 py-5 text-start text-gray-700 dark:text-gray-200 sm:px-6">
                   
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
                          selectedRowId === (alum.alumniid ?? null) 
                            ? "bg-blue-50/80 dark:bg-gray-900" 
                            : "bg-white dark:bg-gray-900"
                        }`}>
                          <div role="group" aria-label="Row actions" className="flex w-40 items-center gap-1.5 sm:gap-2.5 flex-wrap justify-end">
                            {(() => {
                              const actionKey = String(alum.alumniid ?? alum.id);
                              const isBusy = mutatingIds.has(actionKey);
                              const canPerformActions = canModify(session?.user);
                              
                              // For viewers, only show View button
                              if (!canPerformActions) {
                                return (
                                  <button
                                    key={`${alum.id}-action-view`}
                                    type="button"
                                    onClick={() => handleView(alum.sapId, alum.registrationNo)}
                                    disabled={isBusy}
                                    aria-disabled={isBusy}
                                    className={`p-1.5 sm:p-2 text-blue-600 dark:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
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
                              let actions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; defaultClass: string; hover?: string }>;
                              
                              if (selected === "total") {
                                // Total tab: show all relevant actions
                                if (alum.verifyStatus === "verified") {
                                  // Verified: can unverify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.sapId, alum.registrationNo), defaultClass: "text-blue-600 dark:text-blue-400", hover: "hover:text-blue-700 dark:hover:text-blue-300" },
                                    { label: "Email", icon: MailIcon, onClick: () => handleOpenEmailHistory(alum.alumniid), defaultClass: "text-indigo-600 dark:text-indigo-400", hover: "hover:text-indigo-700 dark:hover:text-indigo-300" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-amber-600 dark:text-amber-400", hover: "hover:text-amber-700 dark:hover:text-amber-300" },
                                  ];
                                } else if (alum.verifyStatus === "unverified") {
                                  // Unverified: can verify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.sapId, alum.registrationNo), defaultClass: "text-blue-600 dark:text-blue-400", hover: "hover:text-blue-700 dark:hover:text-blue-300" },
                                    { label: "Email", icon: MailIcon, onClick: () => handleOpenEmailHistory(alum.alumniid), defaultClass: "text-indigo-600 dark:text-indigo-400", hover: "hover:text-indigo-700 dark:hover:text-indigo-300" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-emerald-600 dark:text-emerald-400", hover: "hover:text-emerald-700 dark:hover:text-emerald-300" },
                                  ];
                                } else {
                                  // Under approval (first-time registration): can verify, unverify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.sapId, alum.registrationNo), defaultClass: "text-blue-600 dark:text-blue-400", hover: "hover:text-blue-700 dark:hover:text-blue-300" },
                                    { label: "Email", icon: MailIcon, onClick: () => handleOpenEmailHistory(alum.alumniid), defaultClass: "text-indigo-600 dark:text-indigo-400", hover: "hover:text-indigo-700 dark:hover:text-indigo-300" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-emerald-600 dark:text-emerald-400", hover: "hover:text-emerald-700 dark:hover:text-emerald-300" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-amber-600 dark:text-amber-400", hover: "hover:text-amber-700 dark:hover:text-amber-300" },
                                  ];
                                }
                              } else {
                                // Other tabs: show context-appropriate actions
                                if (alum.verifyStatus === "verified") {
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.sapId, alum.registrationNo), defaultClass: "text-blue-600 dark:text-blue-400", hover: "hover:text-blue-700 dark:hover:text-blue-300" },
                                    { label: "Email", icon: MailIcon, onClick: () => handleOpenEmailHistory(alum.alumniid), defaultClass: "text-indigo-600 dark:text-indigo-400", hover: "hover:text-indigo-700 dark:hover:text-indigo-300" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-amber-600 dark:text-amber-400", hover: "hover:text-amber-700 dark:hover:text-amber-300" },
                                  ];
                                } else if (alum.verifyStatus === "unverified") {
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.sapId, alum.registrationNo), defaultClass: "text-blue-600 dark:text-blue-400", hover: "hover:text-blue-700 dark:hover:text-blue-300" },
                                    { label: "Email", icon: MailIcon, onClick: () => handleOpenEmailHistory(alum.alumniid), defaultClass: "text-indigo-600 dark:text-indigo-400", hover: "hover:text-indigo-700 dark:hover:text-indigo-300" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-emerald-600 dark:text-emerald-400", hover: "hover:text-emerald-700 dark:hover:text-emerald-300" },
                                  ];
                                } else {
                                  // Under approval (first-time registration): can verify, unverify
                                  actions = [
                                    { label: "View", icon: EyeIcon, onClick: () => handleView(alum.sapId, alum.registrationNo), defaultClass: "text-blue-600 dark:text-blue-400", hover: "hover:text-blue-700 dark:hover:text-blue-300" },
                                    { label: "Email", icon: MailIcon, onClick: () => handleOpenEmailHistory(alum.alumniid), defaultClass: "text-indigo-600 dark:text-indigo-400", hover: "hover:text-indigo-700 dark:hover:text-indigo-300" },
                                    { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-emerald-600 dark:text-emerald-400", hover: "hover:text-emerald-700 dark:hover:text-emerald-300" },
                                    { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(String(alum.alumniid ?? alum.id), alum.name, alum.alumniid ?? null, alum.email ?? null), defaultClass: "text-amber-600 dark:text-amber-400", hover: "hover:text-amber-700 dark:hover:text-amber-300" },
                                  ];
                                }
                              }
                              
                              return actions.map(({ label, icon: Icon, onClick, defaultClass, hover }, i) => (
                                <button
                                  key={`${alum.id}-action-${i}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onClick();
                                  }}
                                  disabled={isBusy}
                                  aria-disabled={isBusy}
                                  className={`p-1.5 sm:p-2 rounded-lg ${defaultClass} transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${hover ?? "hover:text-gray-700 dark:hover:text-gray-200"} hover:bg-gray-100 dark:hover:bg-gray-700/50 ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
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
                      {expandedRowId === (alum.alumniid ?? null) && (isSuperAdminUser(session?.user) || isAdminUser(session?.user) || isViewerUser(session?.user)) && (
                        <TableRow key={`${String(alum.alumniid ?? alum.id)}-expanded`} className="bg-blue-50/30 dark:bg-blue-900/10">
                          <TableCell colSpan={11} className="px-0 py-6">
                            <div className="w-full overflow-x-hidden" style={{ maxWidth: 'calc(100vw - 2rem)', boxSizing: 'border-box' }}>
                              <div className="w-full max-w-full overflow-x-hidden flex flex-row justify-start ">
                                <AlumniExpandableDetails
                                  sapId={String(alum.alumniid ?? alum.id)}
                                  onClose={() => {
                                    setExpandedRowId(null);
                                    setExpandedHighlightRowId(null);
                                    setExpandedHighlightKeys([]);
                                  }}
                                  readOnly={!canModify(session?.user)}
                                  isPreSapEnabled={(() => {
                                    const k = String(alum.alumniid ?? alum.id);
                                    return Object.prototype.hasOwnProperty.call(preSapByAlumniId, k)
                                      ? preSapByAlumniId[k]
                                      : isPreSapRegistrationEnabled(alum);
                                  })()}
                                  onPreSapEnabledChange={
                                    canModify(session?.user)
                                      ? (v) => {
                                          setPreSapByAlumniId((s) => ({
                                            ...s,
                                            [String(alum.alumniid ?? alum.id)]: v,
                                          }));
                                        }
                                      : undefined
                                  }
                                  highlightMissingFields={
                                    expandedHighlightRowId && alum.alumniid === expandedHighlightRowId
                                      ? expandedHighlightKeys
                                      : undefined
                                  }
                                />
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
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
                </span>
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
              </div>
            )}
          </div>
        </div>
        </>
        )}
        </>
        </div>
      
      {/* Confirmation Modal */}
      {duplicatesModal.isOpen && pendingDuplicateGate && duplicateGateTarget && (
        <Modal
          isOpen={duplicatesModal.isOpen}
          onClose={() => {
            duplicatesModal.closeModal();
            setPendingDuplicateGate(null);
            setDuplicateSearch("");
            setDuplicateDeleteCount(0);
          }}
          className="max-w-6xl mx-auto"
          showCloseButton={true}
        >
          <div className="p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Duplicate Records Detected
                  </h3>
                  <p className="text-sm text-rose-700 dark:text-rose-300 font-semibold mt-1">
                    You can’t proceed with {pendingDuplicateGate.type === "verify" ? "verify" : "unverify"} until you delete duplicates.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center mr-14">
                  <input
                    value={duplicateSearch}
                    onChange={(e) => setDuplicateSearch(e.target.value)}
                    placeholder="Search duplicates..."
                    className="w-full sm:w-72 px-3 py-2 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-gray-100 transition-all duration-200"
                  />
                  <select
                    value={duplicateSortKey}
                    onChange={(e) => setDuplicateSortKey(e.target.value as any)}
                    className="px-3 py-2 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200"
                  >
                    <option value="name">Sort: Name</option>
                    <option value="sapId">Sort: SAPID</option>
                    <option value="registrationNo">Sort: Reg No</option>
                    <option value="gender">Sort: Gender</option>
                    <option value="verifyStatus">Sort: Verify Status</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setDuplicateSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="px-3 py-2 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
                  >
                    {duplicateSortDir === "asc" ? "Asc" : "Desc"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-1 rounded-2xl border border-blue-200/60 bg-blue-50/60 dark:bg-blue-900/10 dark:border-blue-800/40 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-2">
                    Current Record
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {duplicateGateTarget.name || "-"}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <div className="truncate"><span className="font-bold">SAPID:</span> {duplicateGateTarget.sapId || "-"}</div>
                    <div className="truncate"><span className="font-bold">Reg No:</span> {duplicateGateTarget.registrationNo || "-"}</div>
                    <div className="truncate"><span className="font-bold">Gender:</span> {duplicateGateTarget.gender || "-"}</div>
                    <div className="truncate"><span className="font-bold">Status:</span> {duplicateGateTarget.verifyStatus || "-"}</div>
                  </div>
                </div>
                <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 flex items-center justify-between">
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      Duplicates ({duplicateGateList.length})
                    </div>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                      Deleted in this session: {duplicateDeleteCount}
                    </div>
                  </div>
                  <div className="max-h-[55vh] overflow-auto">
                    <Table>
                      <TableHeader >
                        <TableRow>
                          <TableCell className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Full Name</TableCell>
                          <TableCell className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">SAPID</TableCell>
                          <TableCell className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Reg No</TableCell>
                          <TableCell className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Gender</TableCell>
                          <TableCell className="font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Verify</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicateGateList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600 dark:text-gray-400">
                              No duplicates found in the currently loaded dataset.
                            </TableCell>
                          </TableRow>
                        ) : (
                          duplicateGateList.map((it) => (
                            <TableRow key={String(it.alumniid ?? it.id)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                              <TableCell className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {it.name || "-"}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{it.sapId || "-"}</TableCell>
                              <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{it.registrationNo || "-"}</TableCell>
                              <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{it.gender || "-"}</TableCell>
                              <TableCell className="px-4 py-3">
                                <Badge
                                  size="sm"
                                  color={
                                    it.verifyStatus === "verified"
                                      ? "success"
                                      : it.verifyStatus === "unverified"
                                      ? "error"
                                      : "warning"
                                  }
                                >
                                  {it.verifyStatus === "verified"
                                    ? "Verified"
                                    : it.verifyStatus === "unverified"
                                    ? "Unverified"
                                    : "Under Approval"}
                                </Badge>
                              </TableCell>
                             
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Requirement: delete at least one duplicate before proceeding.
                </div>
                
              </div>
            </div>
          </div>
        </Modal>
      )}

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
              {pendingAction.alumniId && pendingAction.email ? (
                (() => {
                  const mappedActionType =
                    pendingAction.type === "verify"
                      ? EMAIL_ACTION_TYPE.ALUMNI_VERIFY
                      : pendingAction.type === "unverify"
                      ? EMAIL_ACTION_TYPE.ALUMNI_UNVERIFY
                      : EMAIL_ACTION_TYPE.ALUMNI_DELETE;

                  const tpl = generateAdminActionEmail({
                    actionType: mappedActionType,
                    alumniName: pendingAction.name,
                  });

                  return (
                    <SendEmailButton
                      alumniId={pendingAction.alumniId}
                      recipientEmail={pendingAction.email}
                      actionType={mappedActionType}
                      initialSubject={tpl.subject}
                      initialBody={tpl.html}
                      disabled={mutatingIds.has(pendingAction.sapid)}
                    />
                  );
                })()
              ) : null}
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

      {incompleteProfileModal.isOpen && (
        <Modal
          isOpen={incompleteProfileModal.isOpen}
          onClose={() => {
            incompleteProfileModal.closeModal();
            setIncompleteFields([]);
            setIncompleteTarget(null);
            setIncompleteHighlightKeys([]);
          }}
          className="max-w-lg mx-auto"
          showCloseButton={true}
        >
          <div className="p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-rose-100 dark:bg-rose-900/30">
                <CloseLineIcon className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Incomplete Alumni Profile</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  The following required fields must be completed before verification:
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 p-4">
              <div className="space-y-2">
                {incompleteFields.length === 0 ? (
                  <div className="text-sm text-rose-800 dark:text-rose-200">-</div>
                ) : (
                  incompleteFields.map((f) => (
                    <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 dark:bg-gray-900/20 border border-rose-200 dark:border-rose-900/40 px-3 py-2">
                      <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">{f.label}</div>
                      <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">Missing</div>
                    </div>
                  ))
                )}
              </div>
              {incompleteFields.length > 0 ? (
                <div className="mt-3 text-sm text-rose-800 dark:text-rose-200">
                  Open <span className="font-semibold">Go to Edit</span> to expand the row, then in Alumni Details set <span className="font-semibold">Pre Sap Registration</span> and fill any missing fields. With Pre Sap Registration on, a <span className="font-semibold">Registration No</span> is required to verify; save the profile before verifying.
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  incompleteProfileModal.closeModal();
                  setIncompleteFields([]);
                  setIncompleteTarget(null);
                  setIncompleteHighlightKeys([]);
                }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                Close
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rowId = incompleteTarget?.alumniid ?? null;
                  if (!rowId) return;

                  setExpandedHighlightRowId(rowId);
                  setExpandedHighlightKeys(incompleteHighlightKeys);
                  setExpandedRowId(rowId);

                  incompleteProfileModal.closeModal();
                }}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
              >
                Go to Edit
              </button>
            </div>
          </div>
        </Modal>
      )}

      <EmailHistoryModal
        isOpen={emailHistoryModal.isOpen}
        onClose={() => {
          emailHistoryModal.closeModal();
          setEmailHistoryAlumniId(null);
        }}
        alumniId={emailHistoryAlumniId}
      />
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
