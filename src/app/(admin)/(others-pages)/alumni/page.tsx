"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Pagination from "@/components/tables/Pagination";
import {Dropdown} from "@/components/ui/dropdown/Dropdown";
import {DropdownItem} from "@/components/ui/dropdown/DropdownItem";

type TabKey =
  | "addAlumni"
  | "verified"
  | "unVerified"
  | "all"
  | "campusWise"
  | "facultyWise"
  | "departmentWise"
  | "programWise"
  | "passingYearWise"
  | "workCountryWise";

const TABS: { key: TabKey; label: string }[] = [
  { key: "addAlumni", label: "Add Alumni" },
  { key: "all", label: "All" },
  { key: "verified", label: "Verified" },
  { key: "unVerified", label: "Un-Verified" },
 
];

type Alumni = {
  id: string;
  name: string;
  campus: string;
  faculty: string;
  department: string;
  program: string;
  passingYear: number;
  workCountry: string;
  verified: boolean;
  // Optional fields to align table with labels
  mobile?: string;
  email?: string;
  organization?: string;
  designation?: string;
  workCity?: string;
  workStatus?: string;
};

const DUMMY_ALUMNI: Alumni[] = [
  {
    id: "A-1001",
    name: "Ali Raza",
    campus: "Main",
    faculty: "Engineering",
    department: "Computer Science",
    program: "BSCS",
    passingYear: 2021,
    workCountry: "Pakistan",
    verified: true,
  },
  {
    id: "A-1002",
    name: "Sara Khan",
    campus: "City",
    faculty: "Business",
    department: "Finance",
    program: "BBA",
    passingYear: 2020,
    workCountry: "UAE",
    verified: true,
  },
  {
    id: "A-1003",
    name: "Hassan Ali",
    campus: "Main",
    faculty: "Engineering",
    department: "Electrical",
    program: "BEE",
    passingYear: 2019,
    workCountry: "Saudi Arabia",
    verified: false,
  },
  {
    id: "A-1004",
    name: "Fatima Noor",
    campus: "South",
    faculty: "Sciences",
    department: "Biology",
    program: "BS",
    passingYear: 2022,
    workCountry: "UK",
    verified: true,
  },
  {
    id: "A-1005",
    name: "Usman Ahmed",
    campus: "City",
    faculty: "Business",
    department: "Marketing",
    program: "MBA",
    passingYear: 2018,
    workCountry: "USA",
    verified: false,
  },
  {
    id: "A-1006",
    name: "Aisha Siddiqui",
    campus: "Main",
    faculty: "Sciences",
    department: "Chemistry",
    program: "MS",
    passingYear: 2017,
    workCountry: "Germany",
    verified: true,
  },
  {
    id: "A-1007",
    name: "Bilal Khan",
    campus: "South",
    faculty: "Engineering",
    department: "Civil",
    program: "BCE",
    passingYear: 2016,
    workCountry: "Canada",
    verified: false,
  },
  {
    id: "A-1008",
    name: "Nida Rahman",
    campus: "Main",
    faculty: "Arts",
    department: "Design",
    program: "BDes",
    passingYear: 2023,
    workCountry: "Pakistan",
    verified: true,
  },
  {
    id: "A-1009",
    name: "Ahmed Farooq",
    campus: "City",
    faculty: "Engineering",
    department: "Computer Science",
    program: "MSCS",
    passingYear: 2015,
    workCountry: "Australia",
    verified: true,
  },
  {
    id: "A-1010",
    name: "Zara Iqbal",
    campus: "South",
    faculty: "Business",
    department: "Finance",
    program: "MS Finance",
    passingYear: 2014,
    workCountry: "UAE",
    verified: false,
  },
];

function groupBy<T, K extends keyof any>(
  arr: T[],
  getKey: (item: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = getKey(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

type AlumniListProps = {
  items: Alumni[];
  loading?: boolean;
  emptyMessage?: string;
};

const AlumniList: React.FC<AlumniListProps> = ({ items, loading, emptyMessage }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-xl bg-gray-200 animate-pulse dark:bg-white/10"
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-300">{emptyMessage || "No data found"}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-white/10">
      {items.map((alum) => (
        <li key={alum.id} className="py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="">
              <span className="font-medium text-gray-800 dark:text-white/90">{alum.name}</span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                {alum.program} • {alum.department} • {alum.faculty}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {alum.campus} • {alum.passingYear} • {alum.workCountry} •
              {" "}
              {alum.verified ? (
                <span className="text-emerald-600 dark:text-emerald-300">Verified</span>
              ) : (
                <span className="text-rose-600 dark:text-rose-300">Un-Verified</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

type GroupedProps = {
  groups: Record<string, Alumni[]>;
  loading?: boolean;
  label: string;
};

const GroupedList: React.FC<GroupedProps> = ({ groups, loading, label }) => {
  const entries = Object.entries(groups);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse dark:bg-white/10" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, list]) => (
        <div
          key={key}
          className="rounded-2xl border border-gray-200 bg-slate-100 p-4 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800 dark:text-white/90">
              {label}: {key}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{list.length} alumni</span>
          </div>
          <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            {list.slice(0, 3).map((alum) => alum.name).join(", ")}
            {list.length > 3 ? " …" : ""}
          </div>
        </div>
      ))}
    </div>
  );
};

// Styled Table component with filters, sorting, pagination
const AlumniTable: React.FC<AlumniListProps> = ({ items, loading, emptyMessage }) => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sortKey, setSortKey] = useState<keyof Alumni>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<"All" | "Verified" | "Un-Verified">("All");
  const [campusFilter, setCampusFilter] = useState<string>("All");
  const [facultyFilter, setFacultyFilter] = useState<string>("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [programFilter, setProgramFilter] = useState<string>("All");
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [countryFilter, setCountryFilter] = useState<string>("All");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, campusFilter, facultyFilter, departmentFilter, programFilter, yearFilter, countryFilter, items, searchQuery]);


  const filtered = useMemo(() => {
    let data = items;
    if (statusFilter !== "All") {
      data = data.filter((i) => (statusFilter === "Verified" ? i.verified : !i.verified));
    }
    if (campusFilter !== "All") data = data.filter((i) => i.campus === campusFilter);
    if (facultyFilter !== "All") data = data.filter((i) => i.faculty === facultyFilter);
    if (departmentFilter !== "All") data = data.filter((i) => i.department === departmentFilter);
    if (programFilter !== "All") data = data.filter((i) => i.program === programFilter);
    if (yearFilter !== "All") data = data.filter((i) => String(i.passingYear) === yearFilter);
    if (countryFilter !== "All") data = data.filter((i) => i.workCountry === countryFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter((i) => {
        const fields = [i.id, i.name, i.email ?? ""];
        return fields.some((v) => String(v).toLowerCase().includes(q));
      });
    }
    return data;
  }, [items, statusFilter, campusFilter, facultyFilter, departmentFilter, programFilter, yearFilter, countryFilter, searchQuery]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let comp = 0;
      if (typeof av === "number" && typeof bv === "number") comp = av - bv;
      else comp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? comp : -comp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const paged = sorted.slice(startIdx, startIdx + pageSize);

  const handleSort = (key: keyof Alumni) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-gray-200 animate-pulse dark:bg-white/10" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-300">{emptyMessage || "No data found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300" htmlFor="alumni-search">Search:</label>
          <input
            id="alumni-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SAP ID, name, email"
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto custom-scrollbar">
          <div className="min-w-[950px] xl:min-w-full">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 cursor-pointer" aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} onClick={() => handleSort("name")}>Name</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 cursor-pointer" aria-sort={sortKey === "id" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} onClick={() => handleSort("id")}>SAP ID</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Mobile No</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Active Email</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Department</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 cursor-pointer" aria-sort={sortKey === "verified" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} onClick={() => handleSort("verified")}>Work Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Name of Ordganization</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Designation</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Work Country/City</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {paged.map((alum) => (
                  <TableRow
                    key={alum.id}
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                  >
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
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
          <span className="text-sm text-gray-500 dark:text-gray-400">Showing {paged.length} of {sorted.length}</span>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))} />
        </div>
      </div>
    </div>
  );
};

export default function AlumniPage() {
  const [selected, setSelected] = useState<TabKey>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(t);
  }, [selected]);

  const filtered = useMemo(() => {
    switch (selected) {
      case "verified":
        return DUMMY_ALUMNI.filter((a) => a.verified);
      case "unVerified":
        return DUMMY_ALUMNI.filter((a) => !a.verified);
      case "all":
        return DUMMY_ALUMNI;
      default:
        return [];
    }
  }, [selected]);

  const campusGroups = useMemo(
    () => groupBy(DUMMY_ALUMNI, (a) => a.campus),
    []
  );
  const facultyGroups = useMemo(
    () => groupBy(DUMMY_ALUMNI, (a) => a.faculty),
    []
  );
  const departmentGroups = useMemo(
    () => groupBy(DUMMY_ALUMNI, (a) => a.department),
    []
  );
  const programGroups = useMemo(
    () => groupBy(DUMMY_ALUMNI, (a) => a.program),
    []
  );
  const yearGroups = useMemo(
    () => groupBy(DUMMY_ALUMNI, (a) => String(a.passingYear)),
    []
  );
  const countryGroups = useMemo(
    () => groupBy(DUMMY_ALUMNI, (a) => a.workCountry),
    []
  );

  return (
    <ComponentCard title="Alumni" className="">
      <div
        className="tab-list flex flex-wrap gap-4 lg:gap-6 justify-start"
        role="tablist"
        aria-label="Alumni filters"
      >
        {TABS.map((tab, idx) => (
          <button
            key={tab.key}
            className={`rounded-xl border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm ${
              selected === tab.key
                ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
                : "border-gray-200 bg-slate-100 dark:border-gray-800 dark:bg-white/[0.03]"
            } ${
              tab.key === "verified"
                ? selected
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-emerald-600 dark:text-emerald-300"
                : tab.key === "unVerified"
                ? selected
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-rose-600 dark:text-rose-300"
                : tab.key === "addAlumni"
                ? selected
                  ? "text-blue-700 dark:text-blue-200"
                  : "text-blue-600 dark:text-blue-200"
                : "text-gray-700 dark:text-gray-300"
            }`}
            onClick={() => setSelected(tab.key)}
            role="tab"
            aria-selected={selected === tab.key}
            tabIndex={selected === tab.key ? 0 : -1}
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
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {selected === "addAlumni" && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-gray-600 dark:text-gray-300">No alumni records yet.</p>
            <button
              className="mt-4 inline-flex items-center rounded-xl border border-blue-500 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200"
              onClick={() => alert("Add New Alumni action")}
            >
              Add New
            </button>
          </div>
        )}

        {(selected === "verified" || selected === "unVerified" || selected === "all") && (
          <AlumniTable
            items={filtered}
            loading={loading}
            emptyMessage={selected === "verified" ? "No verified alumni found" : selected === "unVerified" ? "No un-verified alumni found" : "No alumni found"}
          />
        )}

        {(selected === "campusWise" || selected === "facultyWise" || selected === "departmentWise" || selected === "programWise" || selected === "passingYearWise" || selected === "workCountryWise") && (
          <AlumniTable items={DUMMY_ALUMNI} loading={loading} emptyMessage="No alumni found" />
        )}
      </div>

      <style jsx>{`
        .tab-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        @media (min-width: 1024px) {
          .tab-list { gap: 1.25rem; }
        }
      `}</style>
    </ComponentCard>
  );
}
