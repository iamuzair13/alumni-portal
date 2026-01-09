"use client";

import React, { useState } from "react";
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

interface DistinguishedAlumni {
  id?: number;
  slug: string;
  name: string;
  image: string;
  role: string;
  summary: string;
  headline?: string | null;
  quote?: string | null;
  quote_by?: string | null;
  tags?: any[] | null;
  stats?: any[] | null;
  achievements?: any[] | null;
  story?: any[] | null;
  created_at?: string;
  updated_at?: string;
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
  search: string = ""
): Promise<DistinguishedAlumniListResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });
  if (search) {
    params.append("search", search);
  }

  const response = await fetch(`/api/distinguished-alumni?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch distinguished alumni");
  }
  return response.json();
};

export const DistinguishedAlumniTab: React.FC = () => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<DistinguishedAlumni | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DistinguishedAlumni | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
    queryKey: ["distinguished-alumni", page, limit, search],
    queryFn: () => fetchDistinguishedAlumni(page, limit, search)
  });

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
      console.error("Error deleting distinguished alumni:", error);
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

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                <TableCell className="font-semibold">Image</TableCell>
                <TableCell className="font-semibold">Name</TableCell>
                <TableCell className="font-semibold">Slug</TableCell>
                <TableCell className="font-semibold">Role</TableCell>
                <TableCell className="font-semibold">Summary</TableCell>
                <TableCell className="font-semibold text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                      <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              )}

              {isError && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
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
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No distinguished alumni found{search ? ` for "${search}"` : ""}
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && data && data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No Image</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                      {item.slug}
                    </span>
                  </TableCell>
                  <TableCell>{item.role}</TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 max-w-md">
                      {item.summary}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
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
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of {data.total} results
            </p>
            <Pagination
              currentPage={page}
              totalPages={data.totalPages}
              onPageChange={setPage}
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