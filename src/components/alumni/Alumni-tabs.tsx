"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "../ui/badge/Badge";
import { CloseLineIcon, EyeIcon, TrashBinIcon, CheckLineIcon } from "@/icons";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canModify } from "@/lib/alumniProfile";
import { useAlumniListPaginated, getAlumniCounts, getAlumniList, type AlumniListItem, type AlumniCounts } from "@/app/queries/fetch-alumni";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import * as XLSX from "xlsx";

type TabKey =
  | "total"
  | "verified"
  | "underApproval"
  | "active"
  | "category";

const TABS: { key: TabKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "verified", label: "Verified" },
  { key: "underApproval", label: "Under Approval" },
  { key: "active", label: "Active" },
  { key: "category", label: "Category" },
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
  category: {
    selectedContainer:
      "border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-900/20",
    hoverBorder: "hover:border-purple-400",
    iconBg: "bg-purple-100 dark:bg-purple-800",
    iconColor: "text-purple-700 dark:text-purple-200",
    labelText: "text-purple-600 dark:text-purple-300",
  },
};


export const AlumniTabs: React.FC = () => {
  const router = useRouter();
  const [selected, setSelected] = useState<TabKey>("total");
  const { data: session } = useSession();

  // Unified item type mapped from server response
  type AlumniItem = {
    id: string; // sapId, registrationNo, or alumniid as fallback
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
  };

  // filtering is handled in the server-like fetcher; remove unused memo

  // Query + UI state (UI state does not duplicate cache)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [additionalFilter, setAdditionalFilter] = useState<"unverified" | "inactive" | "">("");
  
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

  // Determine status filter based on selected tab
  const statusFilter = useMemo(() => {
    // If additional filter is set, use it (takes precedence)
    if (additionalFilter === "unverified") return "unverified";
    if (additionalFilter === "inactive") return "inactive";
    
    // Otherwise use tab-based filter
    if (selected === "verified") return "verified";
    if (selected === "underApproval") return "underApproval";
    if (selected === "active") return "active";
    if (selected === "category") return "category";
    return undefined; // No filter for "total"
  }, [selected, additionalFilter]);

  // Reset page to 1 when tab changes or filter changes
  useEffect(() => {
    console.log("[AlumniTabs] Tab changed to:", selected, "Additional filter:", additionalFilter, "Status filter:", statusFilter);
    setCurrentPage(1);
  }, [selected, additionalFilter, statusFilter]);

  // React Query: fetch paginated list for table display with status filter
  const {
    data: paginatedData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAlumniListPaginated(debouncedQuery || undefined, currentPage, pageSize, statusFilter);
  
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
    queryKey: ["alumnilist-counts", debouncedQuery],
    queryFn: ({ signal }) => getAlumniCounts(signal, debouncedQuery || undefined),
    staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchInterval: false, // Disable auto-refetch interval
    enabled: true, // Always enabled
    retry: 2, // Retry failed requests 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
  
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
      };
    }
    
    // Trim array to actual size
    return result.slice(0, idx);
  }, [paginatedData]);

  // Use counts from server (lightweight query) - always use server data for real-time accuracy
  const counts = useMemo(() => {
    // Always use server counts if available (real-time data)
    if (countsData) {
      return {
        total: countsData.total || 0,
        verified: countsData.verified || 0,
        unverified: countsData.unverified || 0,
        underApproval: countsData.underApproval || 0,
        active: countsData.active || 0,
        inactive: countsData.inactive || 0,
        category: countsData.category || { aPlus: 0, a: 0, b: 0, c: 0 },
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
      category: { aPlus: 0, a: 0, b: 0, c: 0 },
    };
  }, [countsData, totalRecords]);

  // Filter by tab only (search is now handled server-side)
  const filteredItems = useMemo(() => {
    // Since search is handled server-side, we only filter by tab status
    const base = items;
    
    // If additional filter is set, items are already filtered server-side
    if (additionalFilter === "unverified" || additionalFilter === "inactive") {
      return base;
    }
    
    switch (selected) {
      case "verified":
      case "underApproval":
        // These are now filtered server-side, so return all items (they're already filtered)
        return base;
      case "active":
        // Active: users who have logged in at least once
        return base.filter((i) => {
          const hasLoggedIn = (i.lastLoginTime && i.lastLoginTime.trim() !== "") || (i.loginCount && i.loginCount > 0);
          return hasLoggedIn;
        });
      case "category":
        // Category tab - for now return empty array (data will be added later)
        return [];
      case "total":
      default:
        return base;
    }
  }, [items, selected, additionalFilter]);

  // Pagination derived values - use server-side pagination
  const total = totalRecords; // Use total from server
  const totalPages = paginatedData?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  
  // No need to slice - server already returns the correct page
  const pageItems = useMemo(() => filteredItems, [filteredItems]);

  useEffect(() => { 
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
    setSelectedRowId(null); 
  }, [selected, pageSize, debouncedQuery, totalPages, currentPage]);

  // Action hooks and handlers must live inside the component body
  const queryClient = useQueryClient();
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Export to Excel function
  const handleExportToExcel = useCallback(async () => {
    try {
      setIsExporting(true);
      
      // First, get the total count to know how many pages we need
      const firstPage = await getAlumniList(
        undefined,
        debouncedQuery || undefined,
        1,
        500, // Max limit per API call
        statusFilter
      );
      
      const totalRecords = firstPage.total;
      const limit = 500; // Max per page
      const totalPages = Math.ceil(totalRecords / limit);
      
      // Fetch all pages
      const allItems: AlumniListItem[] = [...firstPage.items];
      
      // Fetch remaining pages if there are more
      if (totalPages > 1) {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const pagePromises = remainingPages.map((page) =>
          getAlumniList(
            undefined,
            debouncedQuery || undefined,
            page,
            limit,
            statusFilter
          )
        );
        
        const remainingData = await Promise.all(pagePromises);
        remainingData.forEach((data) => {
          allItems.push(...data.items);
        });
      }

      // Apply client-side filtering for "active" tab and additional filters
      let itemsToExport = allItems;
      if (additionalFilter === "unverified") {
        itemsToExport = allItems.filter((i) => {
          return i.verify === "false" || (i.verify && String(i.verify).toLowerCase() === "false");
        });
      } else if (additionalFilter === "inactive") {
        itemsToExport = allItems.filter((i) => {
          const hasLoggedIn = (i.lasttimelogin && i.lasttimelogin.trim() !== "") || (i.logincount && i.logincount > 0);
          return !hasLoggedIn;
        });
      } else if (selected === "active") {
        itemsToExport = allItems.filter((i) => {
          const hasLoggedIn = (i.lasttimelogin && i.lasttimelogin.trim() !== "") || (i.logincount && i.logincount > 0);
          return hasLoggedIn;
        });
      } else if (selected === "category") {
        // Category tab - no data yet
        itemsToExport = [];
      }

      // Map the data to Excel format
      const excelData = itemsToExport.map((item: AlumniListItem) => ({
        "SAP ID": item.sapid || "",
        "Registration No": item.registrationno || "",
        "Full Name": item.alumniname || "",
        "Email (Personal)": item.personalemail || "",
        "Email (Official)": item.officialemail || "",
        "Contact No": item.contactno || "",
        "Faculty": item.facultyname || "",
        "Department": item.departmentname || "",
        "Campus": item.campusname || "",
        "Degree Title": item.degreetitle || "",
        "Year of Ending": item.yearofending || "",
        "Country": item.country || "",
        "City": item.city || "",
        "Employment Status": item.employeed || "",
        "Organization": item.nameoforganization || "",
        "Designation": item.designation || "",
        "Official Number": item.officialnumber || "",
        "Verification Status": item.verify === "true" ? "Verified" : item.verify === "false" ? "Unverified" : item.verify === "pending" || item.verify === null || item.verify === "" ? "Under Approval" : item.verify || "",
        "Last Login": item.lasttimelogin || "",
        "Login Count": item.logincount || 0,
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // SAP ID
        { wch: 15 }, // Registration No
        { wch: 25 }, // Full Name
        { wch: 30 }, // Email (Personal)
        { wch: 30 }, // Email (Official)
        { wch: 15 }, // Contact No
        { wch: 25 }, // Faculty
        { wch: 25 }, // Department
        { wch: 20 }, // Campus
        { wch: 25 }, // Degree Title
        { wch: 12 }, // Year of Ending
        { wch: 20 }, // Country
        { wch: 20 }, // City
        { wch: 18 }, // Employment Status
        { wch: 30 }, // Organization
        { wch: 25 }, // Designation
        { wch: 15 }, // Official Number
        { wch: 18 }, // Verification Status
        { wch: 20 }, // Last Login
        { wch: 12 }, // Login Count
      ];
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Alumni List");

      // Generate filename with current date and filters
      const dateStr = new Date().toISOString().split("T")[0];
      const statusStr = statusFilter ? `_${statusFilter}` : "";
      const searchStr = debouncedQuery ? `_search` : "";
      const filename = `alumni_export${statusStr}${searchStr}_${dateStr}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, filename);
      
      setIsExporting(false);
    } catch (error) {
      console.error("Export error:", error);
      setIsExporting(false);
      alert("Failed to export data. Please try again.");
    }
  }, [debouncedQuery, statusFilter, selected, additionalFilter]);
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
    // Invalidate counts to refetch real-time data
    queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"] });
  }, [queryClient]);

  const removeFromCache = useCallback((sapid: string) => {
    queryClient.setQueryData<AlumniListItem[] | undefined>(["alumnilist"], (old) => {
      if (!old) return old;
      return old.filter((it) => it.sapid !== sapid);
    });
    // Invalidate counts to refetch real-time data
    queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"] });
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
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"] }); // Refresh counts
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
      queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"] }); // Refresh counts
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

  // Open confirmation modal for delete
  const handleDeleteClick = useCallback((sapid: string, name: string) => {
    setPendingAction({ type: "delete", sapid, name });
    confirmModal.openModal();
  }, [confirmModal]);

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
        queryClient.invalidateQueries({ queryKey: ["alumnilist-counts"] }) // Refresh counts
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

  return (
    <ComponentCard className="p-0">
      <div className="flex flex-col gap-8">
        {/* Stats Cards Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 px-6 pt-2">
          {TABS.map((tab, idx) => {
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
                case "category":
                  // For category tab, show total count of all categories
                  const catCounts = counts.category || { aPlus: 0, a: 0, b: 0, c: 0 };
                  return (catCounts.aPlus || 0) + (catCounts.a || 0) + (catCounts.b || 0) + (catCounts.c || 0);
                default:
                  return 0;
              }
            })();
            
            const isSelected = selected === tab.key;
            const statusStyles = STATUS_CLASS_MAP[tab.key];
            const isCategoryTab = tab.key === "category";
            const isDisabled = isCategoryTab;
           
            return (
              <button
                key={tab.key}
                type="button"
                disabled={isDisabled}
                className={`
                  relative group rounded-2xl p-6 text-left transition-all duration-300 ease-out
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
                    setAdditionalFilter("");
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
          })}
        </div>

        {/* Search and Filters Section */}
        <div className="px-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-800/30 rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
            <div className="flex-1 w-full sm:max-w-lg">
              <label htmlFor="alumni-search" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2.5 uppercase tracking-wider">
                Search Alumni
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                <div className="relative">
                  <label htmlFor="alumni-filter" className="sr-only">Filter</label>
                  <select
                    id="alumni-filter"
                    value={additionalFilter}
                    onChange={(e) => setAdditionalFilter(e.target.value as "unverified" | "inactive" | "")}
                    className="h-full px-4 py-3 rounded-xl border border-gray-300/80 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 transition-all duration-200 appearance-none cursor-pointer min-w-[140px]"
                  >
                    <option value="">All Status</option>
                    <option value="unverified">Unverified</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <svg 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Export Button */}
              <button
                type="button"
                onClick={handleExportToExcel}
                disabled={isExporting || isLoading}
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
            <div className="max-w-full overflow-x-auto custom-scrollbar max-h-[750px] overflow-y-auto">
              <div className="min-w-[800px]">
                <Table className="min-w-full">
                <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
                      Full Name
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                      SAP ID / Registration
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px] hidden lg:table-cell">
                      Email
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">
                      Faculty
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] hidden md:table-cell">
                      Department
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] hidden md:table-cell">
                      Program
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                      Status
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] sticky right-0 bg-gradient-to-r from-transparent via-gray-50/95 to-gray-50 dark:via-gray-900/95 dark:to-gray-900/50 backdrop-blur-sm z-20">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {selected === "category" && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-6">
                          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="text-center">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Category Tab</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Category data will be available soon.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 mb-1">
                                  {counts.category?.aPlus || 0}
                                </div>
                                <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">A+</div>
                              </div>
                              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-1">
                                  {counts.category?.a || 0}
                                </div>
                                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">A</div>
                              </div>
                              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                                <div className="text-2xl font-bold text-green-700 dark:text-green-300 mb-1">
                                  {counts.category?.b || 0}
                                </div>
                                <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">B</div>
                              </div>
                              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mb-1">
                                  {counts.category?.c || 0}
                                </div>
                                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">C</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {isLoading && (
                    Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
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
                    <TableCell className="px-6 py-16 text-center" colSpan={8}>
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
                    <TableCell className="px-6 py-16 text-center text-gray-500 dark:text-gray-400" colSpan={8}>
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
                  const sapIdRegNo = (() => {
                    const sapId = alum.id || "";
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
                  <TableRow
                    key={`${alum.id}-${idx}`}
                    className={`hover:bg-blue-50/60 dark:hover:bg-white/[0.05] transition-all duration-200 cursor-pointer ${selectedRowId === alum.id ? "bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-300 dark:ring-blue-700 shadow-sm" : "odd:bg-white even:bg-gray-50/30 dark:odd:bg-gray-800/30 dark:even:bg-gray-800/20"}`}
                    onClick={() => setSelectedRowId(alum.id)}
                    aria-selected={selectedRowId === alum.id}
                  >
                    <TableCell className="px-3 sm:px-6 py-5 text-start">
                      <div className="flex flex-col gap-1">
                        <span className="block font-semibold text-gray-900 text-sm dark:text-gray-100 truncate max-w-[150px] sm:max-w-none">{alum.name || "-"}</span>
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
                          let actions: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; hover?: string }>;
                          
                          if (selected === "total") {
                            // Total tab: show all relevant actions
                            if (alum.verifyStatus === "verified") {
                              // Verified: can unverify, delete, view
                              actions = [
                                { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(alum.id, alum.name), hover: "hover:text-amber-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => handleDeleteClick(alum.id, alum.name), hover: "hover:text-rose-600" },
                                { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                              ];
                            } else if (alum.verifyStatus === "unverified") {
                              // Unverified: can verify, delete, view
                              actions = [
                                { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(alum.id, alum.name), hover: "hover:text-emerald-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => handleDeleteClick(alum.id, alum.name), hover: "hover:text-rose-600" },
                                { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                              ];
                            } else {
                              // Under approval: can verify, unverify, delete, view
                              actions = [
                                { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(alum.id, alum.name), hover: "hover:text-emerald-600" },
                                { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(alum.id, alum.name), hover: "hover:text-amber-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => handleDeleteClick(alum.id, alum.name), hover: "hover:text-rose-600" },
                                { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                              ];
                            }
                          } else {
                            // Other tabs: show context-appropriate actions
                            if (alum.verifyStatus === "verified") {
                              actions = [
                                { label: "Unverify", icon: CloseLineIcon, onClick: () => handleUnverifyClick(alum.id, alum.name), hover: "hover:text-amber-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => handleDeleteClick(alum.id, alum.name), hover: "hover:text-rose-600" },
                                { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
                              ];
                            } else {
                              actions = [
                                { label: "Verify", icon: CheckLineIcon, onClick: () => handleVerifyClick(alum.id, alum.name), hover: "hover:text-emerald-600" },
                                { label: "Delete", icon: TrashBinIcon, onClick: () => handleDeleteClick(alum.id, alum.name), hover: "hover:text-rose-600" },
                                { label: "View", icon: EyeIcon, onClick: () => handleView(alum.id), hover: "hover:text-blue-600" },
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
              const start = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
              const end = Math.min(start + pageItems.length - 1, total);
              return `Showing ${start.toLocaleString()}-${end.toLocaleString()} of ${total.toLocaleString()}`;
            })()}
          </span>
          <div className="flex items-center gap-4">
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
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={(p) => {
                const newPage = Math.max(1, Math.min(totalPages, p));
                setCurrentPage(newPage);
                // Scroll to top of table when page changes
                const tableContainer = document.querySelector('.custom-scrollbar');
                if (tableContainer) {
                  tableContainer.scrollTop = 0;
                }
              }} 
            />
          </div>
        </div>
      </div>
      
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
    </ComponentCard>
  );
};
// (hooks moved inside component; no code should live below the component)
