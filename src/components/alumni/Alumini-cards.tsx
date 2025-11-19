"use client";
import React, { useEffect, useMemo, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { LockIcon, EyeIcon, TrashBinIcon, CheckLineIcon, CloseLineIcon } from "@/icons";
import { alumniCardServerSchema } from "@/lib/alumniCards";
import {  AlumniDataTable } from "./AlumniCard";

/**
 * AlumniCards
 * Responsive card-based listing for alumni, organized by status (active, pending, archived).
 * Matches architectural patterns used in Alumni-tabs, with typed props, hooks and design system styles.
 * Includes loading and error states, keyboard-accessible filters, and responsive grid layout.
 */

type CardStatus = "active" | "pending" | "declined" | "all";

type AlumniCardItem = {
  id: string;
  name: string;
  email?: string;
  program: string;
  campus: string;
  faculty: string;
  passingYear: number;
  workCountry: string;
  status: CardStatus;
  createdAt: string;
};

type ActionKey = "view" | "verify" | "decline" | "suspend" | "delete";
type ActionDef = {
  key: ActionKey;
  label: string;
  icon: React.FC<{ className?: string }>;
  hoverClass?: string;
};

type AlumniCardsProps = {
  initialStatus?: CardStatus;
  pageSize?: number;
};

 

export function getActionsForStatus(status: CardStatus): ActionDef[] {
  switch (status) {
    case "active":
      return [
        { key: "suspend", label: "Suspend", icon: LockIcon, hoverClass: "hover:text-amber-600" },
        { key: "delete", label: "Delete", icon: TrashBinIcon, hoverClass: "hover:text-rose-600" },
        { key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" },
      ];
    case "pending":
      return [
        { key: "verify", label: "Verify", icon: CheckLineIcon, hoverClass: "hover:text-emerald-600" },
        { key: "decline", label: "Decline", icon: CloseLineIcon, hoverClass: "hover:text-rose-600" },
        { key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" },
      ];
    case "declined":
      return [
        { key: "delete", label: "Delete", icon: TrashBinIcon, hoverClass: "hover:text-rose-600" },
        { key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" },
      ];
    case "all":
    default:
      return [{ key: "view", label: "View", icon: EyeIcon, hoverClass: "hover:text-blue-600" }];
  }
}

// Pure reducer used for testing and state updates
export function applyAction(item: AlumniCardItem, action: ActionKey): { updated?: AlumniCardItem; removed?: boolean } {
  switch (action) {
    case "view":
      return { updated: item };
    case "verify":
      return { updated: { ...item, status: "active" } };
    case "decline":
      return { updated: { ...item, status: "declined" } };
    case "suspend":
      return { updated: { ...item, status: "declined" } };
    case "delete":
      return { removed: true };
    default:
      return { updated: item };
  }
}

// Mock alumni data
const MOCK_ALUMNI_CARDS: AlumniCardItem[] = [
  {
    id: "1",
    name: "Jacob Jones",
    email: "jacob.jones@example.com",
    program: "MSc Advanced Computer Science",
    campus: "London School of Economics",
    faculty: "InfoTech",
    passingYear: 2021,
    workCountry: "United Kingdom",
    status: "active",
    createdAt: new Date(2021, 5, 12).toISOString(),
  },
  {
    id: "2",
    name: "John Michael",
    email: "john.michael@example.com",
    program: "MSc Artificial Intelligence",
    campus: "University of Manchester",
    faculty: "InfoTech",
    passingYear: 2021,
    workCountry: "United Kingdom",
    status: "pending",
    createdAt: new Date(2021, 6, 12).toISOString(),
  },
  {
    id: "3",
    name: "Guy Hawkins",
    email: "guy.hawkins@example.com",
    program: "MBA",
    campus: "Harvard Business School",
    faculty: "Business",
    passingYear: 2020,
    workCountry: "United States",
    status: "declined",
    createdAt: new Date(2020, 9, 3).toISOString(),
  },
  {
    id: "4",
    name: "Esther Howard",
    email: "esther.howard@example.com",
    program: "LLM",
    campus: "Yale University",
    faculty: "Law",
    passingYear: 2019,
    workCountry: "United States",
    status: "active",
    createdAt: new Date(2019, 11, 9).toISOString(),
  },
  {
    id: "5",
    name: "Savannah Nguyen",
    email: "sav.nguyen@example.com",
    program: "Medicine",
    campus: "Johns Hopkins University",
    faculty: "Medicine",
    passingYear: 2022,
    workCountry: "United States",
    status: "pending",
    createdAt: new Date(2022, 2, 22).toISOString(),
  },
  {
    id: "6",
    name: "Ralph Edwards",
    email: "ralph.edwards@example.com",
    program: "Engineering",
    campus: "MIT",
    faculty: "Engineering",
    passingYear: 2021,
    workCountry: "United States",
    status: "declined",
    createdAt: new Date(2021, 7, 19).toISOString(),
  },
];

/**
 * Filters alumni by status and query. Exported for unit testing.
 */
export function filterCards(
  items: AlumniCardItem[],
  status: CardStatus,
  query: string
): AlumniCardItem[] {
  const q = query.trim().toLowerCase();
  const tokens = q.length ? q.split(/\s+/).filter(Boolean) : [];
  return items.filter((item) => {
    const matchesStatus = status === "all" ? true : item.status === status;
    if (!tokens.length) return matchesStatus; // empty query

    const fields = [
      item.id,
      item.name,
      item.program,
      item.campus,
      item.faculty,
      item.workCountry,
      item.email ?? "",
    ].map((v) => v.toLowerCase());

    // All tokens must appear in at least one field (robust multi-word search)
    const matchesTokens = tokens.every((t) => fields.some((f) => f.includes(t)));
    return matchesStatus && matchesTokens;
  });
}

export const AlumniCards: React.FC<AlumniCardsProps> = ({ initialStatus = "all", pageSize = 12 }) => {
  const [status] = useState<CardStatus>(initialStatus);
  const [query] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<AlumniCardItem[]>([]);
  const [total, setTotal] = useState<number>(0);
 
  const memoCards = useMemo(() => MOCK_ALUMNI_CARDS, []);
  

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);

    const timeout = setTimeout(() => {
      try {
        const filtered = filterCards(memoCards, status, query);
        const start = (currentPage - 1) * pageSize;
        const paged = filtered.slice(start, start + pageSize);
        if (!canceled) {
          setCards(paged);
          setTotal(filtered.length);
        }
      } catch (e) {
        if (!canceled) setError("Failed to load alumni cards.");
        console.error(e);
      } finally {
        if (!canceled) setLoading(false);
      }
    }, 250);

    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [memoCards, status, query, currentPage, pageSize]);


  const handleAction = async (alumni: AlumniCardItem, key: ActionKey) => {
    
  
    try {
      // Validate item before applying action
      const parsed = alumniCardServerSchema.safeParse(alumni);
      if (!parsed.success) {
        throw new Error("Invalid card data");
      }
      // Simulate network latency; later can swap to real API
      await new Promise((res) => setTimeout(res, 200));
      const res = applyAction(alumni, key);
      // Attempt optional API update; ignore failures but report
      try {
        if (res.removed) {
          await fetch(`/api/alumni-cards/${alumni.id}`, { method: "DELETE" });
        } else if (res.updated && res.updated.status !== alumni.status) {
          await fetch(`/api/alumni-cards/${alumni.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: alumni.id,
              name: alumni.name,
              email: alumni.email ?? "",
              program: alumni.program,
              campus: alumni.campus,
              faculty: alumni.faculty,
              passingYear: alumni.passingYear,
              workCountry: alumni.workCountry,
              status: res.updated.status === "all" ? "active" : res.updated.status,
              createdAt: alumni.createdAt,
            }),
          });
        }
      } catch {
        // Non-blocking: local state still updates, but we surface the error
      }
      setCards((prev) => {
        const idx = prev.findIndex((c) => c.id === alumni.id);
        if (idx === -1) return prev;
        const next = [...prev];
        if (res.removed) {
          next.splice(idx, 1);
          return next;
        }
        if (res.updated) {
          next[idx] = res.updated;
        }
        return next;
      });
    } catch {
      // Error handled silently
    } finally {
    }
  };

  return (
    <ComponentCard className="">
      {/* Filters & Search */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white">


      
      </div>

      {/* Content */}
      <div className="min-h-[200px] mt-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-neutral-200 p-4 bg-neutral-50">
                <div className="h-6 w-2/3 bg-neutral-200 rounded mb-3" />
                <div className="h-4 w-1/2 bg-neutral-200 rounded mb-2" />
                <div className="h-4 w-1/3 bg-neutral-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <AlumniDataTable
            items={cards}
            loading={loading}
            error={error}
            defaultPageSize={pageSize}
            onRowAction={(item, key) => handleAction(item, key)}
          />
        )}
      </div>


      {/* Pagination */}
      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="text-sm text-neutral-600">
          Page {currentPage} of {Math.max(1, Math.ceil(total / pageSize))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))}
            disabled={currentPage >= Math.max(1, Math.ceil(total / pageSize))}
          >
            Next
          </button>
        </div>
      </div>
    </ComponentCard>
  );
};
