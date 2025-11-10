"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "../ui/badge/Badge";
import { GroupIcon } from "@/icons";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useRouter } from "next/navigation";

type TabKey =
  | "total"
  | "verified"
  | "unverified"
  | "underApproval"
  | "active"
  | "inactive";

const TABS: { key: TabKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "verified", label: "Verified" },
  { key: "unverified", label: "Unverified" },
  { key: "underApproval", label: "Under Approval" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const MOCK_COUNTS: Record<TabKey, { count: number; delta?: number }> = {
  total: { count: 3782, delta: 11.01 },
  verified: { count: 2140, delta: 4.2 },
  unverified: { count: 640, delta: -2.1 },
  underApproval: { count: 230, delta: 1.0 },
  active: { count: 1650, delta: 3.3 },
  inactive: { count: 420, delta: -0.8 },
};

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
  unverified: {
    selectedContainer:
      "border-rose-500 bg-rose-50 dark:border-rose-500 dark:bg-rose-900/20",
    hoverBorder: "hover:border-rose-400",
    iconBg: "bg-rose-100 dark:bg-rose-800",
    iconColor: "text-rose-700 dark:text-rose-200",
    labelText: "text-rose-600 dark:text-rose-300",
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
  inactive: {
    selectedContainer:
      "border-gray-500 bg-gray-50 dark:border-gray-500 dark:bg-gray-900/20",
    hoverBorder: "hover:border-gray-400",
    iconBg: "bg-gray-100 dark:bg-gray-800",
    iconColor: "text-gray-700 dark:text-gray-200",
    labelText: "text-gray-600 dark:text-gray-300",
  },
};

export const AlumniTabs: React.FC = () => {
  const router = useRouter();
  const [selected, setSelected] = useState<TabKey>("total");

  // Simple mock alumni list to demonstrate filtering by status
  type AlumniItem = {
    id: string;
    name: string;
    email: string;
    mobile?: string;
    campus: string;
    faculty: string;
    program: string;
    department?: string;
    passingYear: number;
    workCountry: string;
    workCity?: string;
    organization?: string;
    designation?: string;
    verified: boolean;
    underApproval: boolean;
    active: boolean;
  };

  const MOCK_ALUMNI = useMemo<AlumniItem[]>(() => [
    {
      id: "SAP-1001",
      name: "Ayesha Khan",
      email: "ayesha.khan@example.com",
      campus: "Lahore",
      faculty: "Management Sciences",
      program: "BBA",
      passingYear: 2020,
      workCountry: "Pakistan",
      verified: true,
      underApproval: false,
      active: true,
    },
    {
      id: "SAP-1002",
      name: "Usman Ali",
      email: "usman.ali@example.com",
      campus: "Islamabad",
      faculty: "Engineering",
      program: "BS CS",
      passingYear: 2019,
      workCountry: "UAE",
      verified: false,
      underApproval: true,
      active: false,
    },
    {
      id: "SAP-1003",
      name: "Zainab Ahmad",
      email: "zainab.ahmad@example.com",
      campus: "Karachi",
      faculty: "Arts & Humanities",
      program: "BA English",
      passingYear: 2018,
      workCountry: "UK",
      verified: true,
      underApproval: false,
      active: true,
    },
    {
      id: "SAP-1004",
      name: "Hamza Raza",
      email: "hamza.raza@example.com",
      campus: "Lahore",
      faculty: "Engineering",
      program: "BS Electrical",
      passingYear: 2021,
      workCountry: "Saudi Arabia",
      verified: false,
      underApproval: false,
      active: true,
    },
    {
      id: "SAP-1005",
      name: "Sara Malik",
      email: "sara.malik@example.com",
      campus: "Peshawar",
      faculty: "Computer Science",
      program: "MS CS",
      passingYear: 2017,
      workCountry: "Canada",
      verified: true,
      underApproval: false,
      active: false,
    },
    {
    id: "SAP-1001",
    name: "Ayesha Khan",
    email: "ayesha.khan@example.com",
    campus: "Lahore",
    faculty: "Computer Science",
    program: "BSCS",
    passingYear: 2020,
    workCountry: "UAE",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1002",
    name: "Usman Malik",
    email: "usman.malik@example.com",
    campus: "Karachi",
    faculty: "Engineering",
    program: "BSEE",
    passingYear: 2018,
    workCountry: "Canada",
    verified: false,
    underApproval: true,
    active: true,
  },
  {
    id: "SAP-1003",
    name: "Hira Fatima",
    email: "hira.fatima@example.com",
    campus: "Islamabad",
    faculty: "Management Sciences",
    program: "MBA",
    passingYear: 2019,
    workCountry: "UK",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1004",
    name: "Ali Raza",
    email: "ali.raza@example.com",
    campus: "Lahore",
    faculty: "Computer Science",
    program: "MSCS",
    passingYear: 2021,
    workCountry: "Germany",
    verified: false,
    underApproval: true,
    active: false,
  },
  {
    id: "SAP-1005",
    name: "Sana Ahmed",
    email: "sana.ahmed@example.com",
    campus: "Faisalabad",
    faculty: "Education",
    program: "B.Ed",
    passingYear: 2017,
    workCountry: "Pakistan",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1006",
    name: "Bilal Hussain",
    email: "bilal.hussain@example.com",
    campus: "Multan",
    faculty: "Management Sciences",
    program: "MBA",
    passingYear: 2016,
    workCountry: "Pakistan",
    verified: false,
    underApproval: true,
    active: true,
  },
  {
    id: "SAP-1007",
    name: "Nimra Javed",
    email: "nimra.javed@example.com",
    campus: "Rawalpindi",
    faculty: "Computer Science",
    program: "BSIT",
    passingYear: 2022,
    workCountry: "Australia",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1008",
    name: "Hamza Tariq",
    email: "hamza.tariq@example.com",
    campus: "Karachi",
    faculty: "Business Administration",
    program: "BBA",
    passingYear: 2019,
    workCountry: "Saudi Arabia",
    verified: false,
    underApproval: true,
    active: false,
  },
  {
    id: "SAP-1009",
    name: "Sara Iqbal",
    email: "sara.iqbal@example.com",
    campus: "Lahore",
    faculty: "Pharmacy",
    program: "Pharm-D",
    passingYear: 2020,
    workCountry: "Qatar",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1010",
    name: "Imran Yousaf",
    email: "imran.yousaf@example.com",
    campus: "Multan",
    faculty: "Engineering",
    program: "BSc Civil",
    passingYear: 2015,
    workCountry: "Oman",
    verified: false,
    underApproval: false,
    active: false,
  },
  {
    id: "SAP-1011",
    name: "Fatima Zahra",
    email: "fatima.zahra@example.com",
    campus: "Islamabad",
    faculty: "Computer Science",
    program: "BSSE",
    passingYear: 2021,
    workCountry: "USA",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1012",
    name: "Ahmad Nawaz",
    email: "ahmad.nawaz@example.com",
    campus: "Karachi",
    faculty: "Law",
    program: "LLB",
    passingYear: 2016,
    workCountry: "Pakistan",
    verified: false,
    underApproval: true,
    active: true,
  },
  {
    id: "SAP-1013",
    name: "Maryam Riaz",
    email: "maryam.riaz@example.com",
    campus: "Faisalabad",
    faculty: "Economics",
    program: "BSc Economics",
    passingYear: 2018,
    workCountry: "UK",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1014",
    name: "Zain Ul Abidin",
    email: "zain.abidin@example.com",
    campus: "Lahore",
    faculty: "Computer Science",
    program: "BSCS",
    passingYear: 2017,
    workCountry: "Pakistan",
    verified: false,
    underApproval: false,
    active: false,
  },
  {
    id: "SAP-1015",
    name: "Iqra Shabbir",
    email: "iqra.shabbir@example.com",
    campus: "Multan",
    faculty: "Management Sciences",
    program: "BBA",
    passingYear: 2019,
    workCountry: "Malaysia",
    verified: true,
    underApproval: false,
    active: true,
  },
  {
    id: "SAP-1016",
    name: "Taha Mehmood",
    email: "taha.mehmood@example.com",
    campus: "Rawalpindi",
    faculty: "Engineering",
    program: "BS Mechanical",
    passingYear: 2020,
    workCountry: "Canada",
    verified: false,
    underApproval: true,
    active: false,
  },
  ], []);

  // filtering is handled in the server-like fetcher; remove unused memo

  // Pagination types and server-like fetch
  type PaginationParams = { page: number; pageSize: number; status: TabKey; query?: string };
  type PagedResponse<T> = { items: T[]; total: number; totalPages: number; page: number; pageSize: number };

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageItems, setPageItems] = useState<AlumniItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchAlumniPage = useCallback(async (params: PaginationParams): Promise<PagedResponse<AlumniItem>> => {
    const source = (() => {
      switch (params.status) {
        case "verified":
          return MOCK_ALUMNI.filter((a) => a.verified);
        case "unverified":
          return MOCK_ALUMNI.filter((a) => !a.verified);
        case "underApproval":
          return MOCK_ALUMNI.filter((a) => a.underApproval);
        case "active":
          return MOCK_ALUMNI.filter((a) => a.active);
        case "inactive":
          return MOCK_ALUMNI.filter((a) => !a.active);
        case "total":
        default:
          return MOCK_ALUMNI;
      }
    })();

    const q = (params.query ?? "").toLowerCase();
    const filtered = q
      ? source.filter((a) =>
          a.id.toString().toLowerCase().includes(q) ||
          (a.name?.toLowerCase().includes(q)) ||
          (a.email?.toLowerCase().includes(q))
        )
      : source;

    const totalItems = filtered.length;
    const totalPagesCalc = Math.max(1, Math.ceil(totalItems / params.pageSize));
    const safePage = Math.min(Math.max(1, params.page), totalPagesCalc);
    const start = (safePage - 1) * params.pageSize;
    const end = start + params.pageSize;
    const items = filtered.slice(start, end);

    await new Promise((res) => setTimeout(res, 250));

    return { items, total: totalItems, totalPages: totalPagesCalc, page: safePage, pageSize: params.pageSize };
  }, [MOCK_ALUMNI]);

  useEffect(() => { setCurrentPage(1); setSelectedRowId(null); }, [selected, pageSize, debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAlumniPage({ page: currentPage, pageSize, status: selected, query: debouncedQuery })
      .then((res) => {
        if (cancelled) return;
        setPageItems(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => { if (!cancelled) setError("Failed to load data. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, pageSize, selected, debouncedQuery, fetchAlumniPage]);

  return (
    <ComponentCard title="Alumni Status" className="">
      <div className=" flex flex-col gap-4 ">
        <div className="rounded-2xl  dark:bg-white/[0.03]">
         
          <div
            className="tab-list  flex flex-wrap gap-4 lg:gap-6 justify-start "
            role="tablist"
            aria-label="Alumni status categories"
          >
            {TABS.map((tab, idx) => {
              const stat = MOCK_COUNTS[tab.key];
              const statusClasses = STATUS_CLASS_MAP[tab.key];
              return (
                <div
                  key={tab.key}
                  className={`tab-item rounded-2xl border cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out md:p-6 hover:scale-[1.02] hover:shadow-lg ${statusClasses.hoverBorder} ${
                    selected === tab.key
                      ? statusClasses.selectedContainer
                      : "border-gray-200 bg-slate-100 dark:border-gray-800 dark:bg-white/[0.03]"
                  }`}
                  onClick={() => setSelected(tab.key)}
                  role="tab"
                  aria-selected={selected === tab.key}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % TABS.length;
                      setSelected(TABS[nextIdx].key);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                      setSelected(TABS[prevIdx].key);
                    } else if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(tab.key);
                    }
                  }}
                >
                  <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${statusClasses.iconBg}`}>
                    <GroupIcon className={`${statusClasses.iconColor} size-6`} />
                  </div>
                  <div className="flex items-end justify-between mt-5">
                    <div>
                      <span className={`text-sm ${statusClasses.labelText}`}>
                        {tab.label}
                      </span>
                      <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                        {stat.count.toLocaleString()}
                      </h4>
                    </div>
                    
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Search Bar: by SAP ID, email, or name */}
       <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="alumni-search">Search:</label>
          <input
            id="alumni-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SAP ID, name, email"
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[420px] overflow-y-auto">
          <div className="min-w-[950px] xl:min-w-full">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">SAP ID</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Mobile No</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Active Email</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Department</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Work Status</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name of Ordganization</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Designation</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Work Country/City</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading && (
                  Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell className="px-5 py-4"><div className="h-5 w-48 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-28 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-32 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-56 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-36 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-5 w-40 bg-gray-200 animate-pulse rounded" /></TableCell>
                      <TableCell className="px-4 py-3"><div className="h-9 w-24 bg-gray-200 animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!loading && error && (
                  <TableRow>
                    <TableCell className="px-5 py-4 text-red-600" colSpan={10}>{error}</TableCell>
                  </TableRow>
                )}
                {!loading && !error && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell className="px-5 py-6 text-gray-600 dark:text-gray-400" colSpan={10}>
                      No alumni found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}. Try adjusting your search or filters.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && pageItems.map((alum, idx) => (
                  <TableRow
                    key={`${alum.id}-${idx}`}
                    className={`hover:bg-gray-50 dark:hover:bg-white/[0.04] ${selectedRowId === alum.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                    onClick={() => setSelectedRowId(alum.id)}
                    aria-selected={selectedRowId === alum.id}
                  >
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://i.pravatar.cc/32?u=${alum.id}`}
                          alt={alum.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">{alum.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.id}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.mobile ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.email ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.department}</TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      <Badge size="sm" color={alum.verified ? "success" : "error"}>{alum.verified ? "Verified" : "Un-Verified"}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.organization ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.designation ?? "-"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 text-start text-theme-sm dark:text-gray-300">{alum.workCountry}{alum.workCity ? ` / ${alum.workCity}` : ""}</TableCell>
                    <TableCell className="px-4 py-3 text-end">
                      <button
                        className="inline-flex items-center rounded-xl border border-blue-500 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200"
                        onClick={() => router.push(`/alumni/${alum.id}`)}
                      >
                        View Profile
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {(() => {
              const start = (currentPage - 1) * pageSize + 1;
              const end = start + pageItems.length - 1;
              return `Showing ${pageItems.length ? start : 0}-${pageItems.length ? end : 0} of ${total}`;
            })()}
          </span>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 dark:text-gray-400" htmlFor="page-size">Items per page:</label>
            <select
              id="page-size"
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))} />
          </div>
        </div>
      </div>
    </div>
      </div>
      <style jsx>{`
        .tab-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem; /* base spacing between tabs */
        }

        .tab-item {
          /* Flexbox sizing with constraints */
          flex: 1 1 180px; /* grow; shrink; base width */
          min-width: 160px;
          max-width: 320px;
          /* Smooth transitions for resizing and state */
          transition: flex-basis 300ms ease, width 300ms ease,
            background-color 200ms ease, border-color 200ms ease,
            transform 200ms ease;
          will-change: transform;
        }

        /* Desktop (≥1024px) */
        @media (min-width: 1024px) {
          .tab-list {
            gap: 1.5rem; /* more spacing on desktop */
          }
          .tab-item {
            flex-basis: 240px; /* comfortable width on desktop */
          }
        }

        /* Tablet (768px–1023px) */
        @media (min-width: 768px) and (max-width: 1023px) {
          .tab-item {
            flex-basis: 200px; /* medium width on tablets */
          }
        }

        /* Mobile (<768px) */
        @media (max-width: 767px) {
          .tab-item {
            flex-basis: 160px; /* compact width on mobile */
          }
        }
      `}</style>
    </ComponentCard>
  );
};
