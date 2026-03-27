"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "@/components/common/ComponentCard";
import { EyeIcon, TrashBinIcon, PencilIcon, PlusIcon } from "@/icons";
import { Table, TableHeader, TableBody, TableCell, TableRow } from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { DistinguishedAlumniForm } from "./DistinguishedAlumniForm";
import { DistinguishedAlumniDetails } from "./DistinguishedAlumniDetails";
import { canModify } from "@/lib/alumniProfile";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import Button from "@/components/ui/button/Button";
import type { MasterFilters } from "@/app/queries/master-filter-types";
import { addFilterParamsToUrl } from "@/app/queries/master-filter-types";

interface DistinguishedAlumni {
  id?: number;
  slug: string;
  name: string;
  image: string;
  role: string;
  summary: string;
  faculty_name?: string | null;
  department_name?: string | null;
  program_name?: string | null;
  headline?: string | null;
  quote?: string | null;
  quote_by?: string | null;
  tags?: any[] | null;
  stats?: any | null;
  achievements?: any[] | null;
  story?: any[] | null;
  created_at?: string;
  updated_at?: string;
}

// Sanitize HTML to remove script and style tags
function sanitizeHtml(input: string): string {
  return String(input || "")
    .replace(/<script[^>]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*?>[\s\S]*?<\/style>/gi, "");
}

// Strip HTML tags for plain text display
function stripHtml(input: string): string {
  return String(input || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalize image path - if it's not a full URL, assume it's in /images/
function normalizeImagePath(image: string | null | undefined): string {
  if (!image) return "/images/placeholder-avatar.webp";
  
  // If it's already a full URL (http/https), use it as-is
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  
  // If it starts with /, use it as-is
  if (image.startsWith("/")) {
    return image;
  }
  
  // Otherwise, assume it's a filename in /images/
  return `/images/${image}`;
}

interface DistinguishedAlumniListResponse {
  items: DistinguishedAlumni[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const fetchDistinguishedAlumni = async (
  page: number = 1,
  limit: number = 10,
  search: string = "",
  masterFilters?: MasterFilters
): Promise<DistinguishedAlumniListResponse> => {
  const url = new URL("/api/distinguished-alumni", window.location.origin);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("limit", limit.toString());
  if (search) url.searchParams.set("search", search);
  addFilterParamsToUrl(url, masterFilters);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch distinguished alumni");
  }
  return response.json();
};

const fetchDistinguishedAlumniCounts = async (search: string = "", masterFilters?: MasterFilters): Promise<{ total: number }> => {
  const url = new URL("/api/distinguished-alumni/counts", window.location.origin);
  if (search) url.searchParams.set("search", search);
  addFilterParamsToUrl(url, masterFilters);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch distinguished alumni counts");
  }
  return response.json();
};

type DistinguishedAlumniTabProps = {
  masterFilters?: MasterFilters;
};

export const DistinguishedAlumniTab: React.FC<DistinguishedAlumniTabProps> = ({ masterFilters }) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<DistinguishedAlumni | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DistinguishedAlumni | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const addModal = useModal();
  const editModal = useModal();
  const detailsModal = useModal();
  const deleteModal = useModal();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<DistinguishedAlumniListResponse>({
    queryKey: ["distinguished-alumni", page, limit, search, masterFilters],
    queryFn: () => fetchDistinguishedAlumni(page, limit, search, masterFilters)
  });

  const {
    data: countsData,
    isLoading: countsLoading
  } = useQuery<{ total: number }>({
    queryKey: ["distinguished-alumni-counts", search, masterFilters],
    queryFn: () => fetchDistinguishedAlumniCounts(search, masterFilters)
  });

  // Sync horizontal scroll between top scrollbar and table container
  useEffect(() => {
    const topScrollbar = topScrollbarRef.current;
    const tableContainer = tableContainerRef.current;

    if (!topScrollbar || !tableContainer) return;

    const handleTableScroll = () => {
      if (topScrollbar) {
        topScrollbar.scrollLeft = tableContainer.scrollLeft;
      }
    };

    const handleTopScroll = () => {
      if (tableContainer) {
        tableContainer.scrollLeft = topScrollbar.scrollLeft;
      }
    };

    tableContainer.addEventListener("scroll", handleTableScroll);
    topScrollbar.addEventListener("scroll", handleTopScroll);

    return () => {
      tableContainer.removeEventListener("scroll", handleTableScroll);
      topScrollbar.removeEventListener("scroll", handleTopScroll);
    };
  }, []);

  const canEdit = canModify(session?.user);

  const handleEdit = (item: DistinguishedAlumni) => {
    setSelectedItem(item);
    editModal.openModal();
  };

  const handleView = (item: DistinguishedAlumni) => {
    setSelectedItem(item);
    detailsModal.openModal();
  };

  const handleDelete = (item: DistinguishedAlumni) => {
    setItemToDelete(item);
    deleteModal.openModal();
  };

  const confirmDelete = async () => {
    if (!itemToDelete?.id) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/distinguished-alumni/${itemToDelete.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete distinguished alumni");
      }

      toast.success("Distinguished alumni deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["distinguished-alumni"] });
      deleteModal.closeModal();
      setItemToDelete(null);
      
      // If current page becomes empty, go to previous page
      if (data && data.items.length === 1 && page > 1) {
        setPage(page - 1);
      }
    } catch (error) {

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete distinguished alumni"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    addModal.openModal();
  };

  const handleFormClose = () => {
    addModal.closeModal();
    editModal.closeModal();
    setSelectedItem(null);
  };

  // Calculate stats from data and counts API
  const totalCount = countsData?.total || data?.total || 0;
  const currentPageCount = data?.items?.length || 0;

  return (
    <ComponentCard className="">
      <div className="flex flex-col gap-6">
        {/* Header with Add Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Distinguished Alumni
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage distinguished alumni profiles
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={handleAddNew}
              startIcon={<PlusIcon />}
            >
              Add New
            </Button>
          )}
        </div>

        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by name, slug, role, summary, or headline..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset to first page when searching
            }}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table – match alumni dashboard list style with horizontal scroll */}
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
            <div className="table-scrollbar-content h-full" style={{ minWidth: '1350px' }}></div>
          </div>
          <div 
            ref={tableContainerRef}
            className="max-w-full overflow-x-hidden custom-scrollbar max-h-[700px] overflow-y-auto relative"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            aria-live="polite"
          >
            <div className="table-content-wrapper" style={{ minWidth: '1350px' }}>
              <Table className="min-w-full">
                <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[80px]">
                      Image
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[160px]">
                      Name
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[160px]">
                      Faculty
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px]">
                      Department
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px]">
                      Program
                    </TableCell>
                  
                    <TableCell className="px-3 sm:px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px]">
                      Role
                    </TableCell>
                    <TableCell className="px-3 sm:px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[140px]">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell>
                      <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              )}

              {isError && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-red-600 dark:text-red-400">
                        {error instanceof Error ? error.message : "Failed to load data"}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => refetch()}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && data && data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No distinguished alumni found{search ? ` for "${search}"` : ""}
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && data && data.items.map((item) => {
                const imagePath = normalizeImagePath(item.image);
                const roleText = stripHtml(item.role);
                const summaryText = stripHtml(item.summary);
                
                return (
                  <TableRow key={item.id} className="px-2">
                    <TableCell>
                      <img
                        src={imagePath}
                        alt={item.name}
                        className="h-16 w-16 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/placeholder-avatar.webp";
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[160px]">{item.name}</TableCell>
                    <TableCell className="text-sm text-gray-700 dark:text-gray-300 max-w-[160px]">
                      {item.faculty_name || <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 dark:text-gray-300 max-w-[160px]">
                      {item.department_name || <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 dark:text-gray-300 max-w-[160px]">
                      {item.program_name || <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 max-w-xs" title={roleText}>
                        {roleText}
                      </div>
                    </TableCell>
                   
                    <TableCell className="px-3 sm:px-6 py-4 text-right min-w-[140px]">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => handleView(item)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <TrashBinIcon className="w-5 h-5" />
                            </button>
                          </>
                        )}
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

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of {data.total} results
            </p>
            <Pagination
              currentPage={page}
              totalPages={data.totalPages}
              onPageChange={(p) => {
                setPage(p);
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

        {/* Add Form Modal */}
        <DistinguishedAlumniForm
          isOpen={addModal.isOpen}
          onClose={handleFormClose}
          editingItem={null}
        />

        {/* Edit Form Modal */}
        <DistinguishedAlumniForm
          isOpen={editModal.isOpen}
          onClose={handleFormClose}
          editingItem={selectedItem}
        />

        {/* Details Modal */}
        <DistinguishedAlumniDetails
          isOpen={detailsModal.isOpen}
          onClose={() => {
            detailsModal.closeModal();
            setSelectedItem(null);
          }}
          item={selectedItem}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => {
            if (!isDeleting) {
              deleteModal.closeModal();
              setItemToDelete(null);
            }
          }}
          className="max-w-lg mx-auto"
          showCloseButton={true}
        >
          <div className="p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrashBinIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
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
                Are you sure you want to delete{" "}
                <strong className="font-semibold text-gray-900 dark:text-gray-100">
                  {itemToDelete?.name}
                </strong>
                ? This will permanently remove their distinguished alumni record.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!isDeleting) {
                    deleteModal.closeModal();
                    setItemToDelete(null);
                  }
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ComponentCard>
  );
};