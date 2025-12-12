"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import { PencilIcon, TrashBinIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon } from "@/icons";
import {
  useChapters,
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  type Chapter,
} from "@/app/queries/fetch-organization";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import Checkbox from "@/components/form/input/Checkbox";
import Select from "@/components/form/Select";

type ChapterTab = "national" | "international";

const CHAPTER_TABS: { key: ChapterTab; label: string }[] = [
  { key: "national", label: "National Chapters" },
  { key: "international", label: "International Chapters" },
];

export default function ChaptersComponent() {
  const { data: session } = useSession();
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const [selectedTab, setSelectedTab] = useState<ChapterTab>("national");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Modals state
  const [addChapterOpen, setAddChapterOpen] = useState(false);
  const [editChapterId, setEditChapterId] = useState<number | null>(null);
  const [deleteChapterId, setDeleteChapterId] = useState<number | null>(null);

  // Queries
  const { data: chapters = [], isLoading: chaptersLoading } = useChapters();

  // Mutations
  const createChapterMutation = useCreateChapter();
  const updateChapterMutation = useUpdateChapter();
  const deleteChapterMutation = useDeleteChapter();

  // Handle sorting
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  // Filter chapters by selected tab
  const chaptersByTab = useMemo(() => {
    if (selectedTab === "national") {
      return chapters.filter((c) => c.national_chapter !== null && c.national_chapter.trim() !== "");
    } else {
      return chapters.filter((c) => c.international_chapter !== null && c.international_chapter.trim() !== "");
    }
  }, [chapters, selectedTab]);

  // Counts for each tab
  const nationalCount = useMemo(() => {
    return chapters.filter((c) => c.national_chapter !== null && c.national_chapter.trim() !== "").length;
  }, [chapters]);

  const internationalCount = useMemo(() => {
    return chapters.filter((c) => c.international_chapter !== null && c.international_chapter.trim() !== "").length;
  }, [chapters]);

  // Filtered and sorted data
  const filteredChapters = useMemo(() => {
    let filtered = chaptersByTab;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const national = c.national_chapter?.toLowerCase() || "";
        const international = c.international_chapter?.toLowerCase() || "";
        const whatsapp = c.chapter_whatsapp?.toLowerCase() || "";
        const description = c.description?.toLowerCase() || "";
        return national.includes(q) || international.includes(q) || whatsapp.includes(q) || description.includes(q);
      });
    }
    
    // Apply sorting
    if (sortField) {
      const sorted = [...filtered].sort((a, b) => {
        let aValue: string | number | boolean = "";
        let bValue: string | number | boolean = "";
        
        switch (sortField) {
          case "id":
            const aNum = typeof a.id === "number" ? a.id : Number(a.id) || 0;
            const bNum = typeof b.id === "number" ? b.id : Number(b.id) || 0;
            return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
          case "national":
            aValue = (a.national_chapter || "").trim().toLowerCase();
            bValue = (b.national_chapter || "").trim().toLowerCase();
            break;
          case "international":
            aValue = (a.international_chapter || "").trim().toLowerCase();
            bValue = (b.international_chapter || "").trim().toLowerCase();
            break;
          case "whatsapp":
            aValue = (a.chapter_whatsapp || "").trim().toLowerCase();
            bValue = (b.chapter_whatsapp || "").trim().toLowerCase();
            break;
          case "active":
            aValue = a.is_active === true ? 1 : 0;
            bValue = b.is_active === true ? 1 : 0;
            return sortDirection === "asc" ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
          default:
            return 0;
        }
        
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        
        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }
    
    return filtered;
  }, [chaptersByTab, searchQuery, sortField, sortDirection]);

  // Chapter handlers
  const handleCreateChapter = async (chapter: {
    national_chapter?: string | null;
    international_chapter?: string | null;
    chapter_whatsapp?: string | null;
    chapter_image?: string | null;
    is_active?: boolean | null;
    description?: string | null;
  }) => {
    try {
      await createChapterMutation.mutateAsync(chapter);
      toast.success("Chapter created successfully");
      setAddChapterOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create chapter");
    }
  };

  const handleUpdateChapter = async (
    id: number,
    chapter: {
      national_chapter?: string | null;
      international_chapter?: string | null;
      chapter_whatsapp?: string | null;
      chapter_image?: string | null;
      is_active?: boolean | null;
      description?: string | null;
    }
  ) => {
    try {
      await updateChapterMutation.mutateAsync({ id, ...chapter });
      toast.success("Chapter updated successfully");
      setEditChapterId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update chapter");
    }
  };

  const handleDeleteChapter = async (id: number) => {
    try {
      await deleteChapterMutation.mutateAsync(id);
      toast.success("Chapter deleted successfully");
      setDeleteChapterId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete chapter");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          You do not have permission to access this section.
        </p>
      </div>
    );
  }

  return (
    <div className="">
      {/* Counter Cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">National Chapters</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                {chaptersLoading ? "..." : nationalCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">International Chapters</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                {chaptersLoading ? "..." : internationalCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1" aria-label="Tabs">
          {CHAPTER_TABS.map((tab) => {
            const count = tab.key === "national" ? nationalCount : internationalCount;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setSelectedTab(tab.key);
                  setSearchQuery("");
                  setSortField(null);
                  setSortDirection("asc");
                }}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  selectedTab === tab.key
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {chaptersLoading ? "..." : count.toLocaleString()}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search and Add Button */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="w-full sm:w-auto sm:flex-1 max-w-md">
          <Input
            type="text"
            placeholder="Search chapters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          startIcon={<PlusIcon />}
          onClick={() => setAddChapterOpen(true)}
        >
          Add Chapter
        </Button>
      </div>

      {/* Chapters Table */}
      <ChaptersTable
        chapters={filteredChapters}
        loading={chaptersLoading}
        selectedTab={selectedTab}
        onEdit={(id) => setEditChapterId(id)}
        onDelete={(id) => setDeleteChapterId(id)}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Chapter Modals */}
      <ChapterModals
        addOpen={addChapterOpen}
        onAddClose={() => setAddChapterOpen(false)}
        editId={editChapterId}
        onEditClose={() => setEditChapterId(null)}
        deleteId={deleteChapterId}
        onDeleteClose={() => setDeleteChapterId(null)}
        chapters={chapters}
        onCreate={handleCreateChapter}
        onUpdate={handleUpdateChapter}
        onDelete={handleDeleteChapter}
        creating={createChapterMutation.isPending}
        updating={updateChapterMutation.isPending}
        deleting={deleteChapterMutation.isPending}
      />
    </div>
  );
}

// Chapters Table Component
function ChaptersTable({
  chapters,
  loading,
  selectedTab,
  onEdit,
  onDelete,
  sortField,
  sortDirection,
  onSort,
}: {
  chapters: Chapter[];
  loading: boolean;
  selectedTab: ChapterTab;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  sortField: string | null;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg dark:border-gray-700/80 dark:bg-gray-800/50">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <Table className="min-w-full">
          <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900/80 dark:to-gray-900/50">
            <TableRow className="border-b-2 border-gray-200 dark:border-gray-700">
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("id")}
              >
                <div className="flex items-center gap-2">
                  <span>ID</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "id" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "id" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort(selectedTab === "national" ? "national" : "international")}
              >
                <div className="flex items-center gap-2">
                  <span>Chapter Name</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${((sortField === "national" && selectedTab === "national") || (sortField === "international" && selectedTab === "international")) && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${((sortField === "national" && selectedTab === "national") || (sortField === "international" && selectedTab === "international")) && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("whatsapp")}
              >
                <div className="flex items-center gap-2">
                  <span>WhatsApp</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "whatsapp" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "whatsapp" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell 
                className="px-6 py-4 text-left text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => onSort("active")}
              >
                <div className="flex items-center gap-2">
                  <span>Active</span>
                  <div className="flex flex-col">
                    <ArrowUpIcon className={`w-3 h-3 ${sortField === "active" && sortDirection === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                    <ArrowDownIcon className={`w-3 h-3 -mt-1 ${sortField === "active" && sortDirection === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 text-right text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="bg-white dark:bg-gray-800/30">
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : chapters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No {selectedTab === "national" ? "national" : "international"} chapters found
                </TableCell>
              </TableRow>
            ) : (
              chapters.map((chapter) => (
                <TableRow key={chapter.id} className="bg-white dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">{chapter.id}</TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300 font-medium">
                    {selectedTab === "national" ? (chapter.national_chapter || "-") : (chapter.international_chapter || "-")}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">
                    {chapter.chapter_whatsapp || "-"}
                  </TableCell>
                  <TableCell className="px-6 py-5 text-gray-700 dark:text-gray-300">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      chapter.is_active 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {chapter.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<PencilIcon />}
                        onClick={() => onEdit(chapter.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        startIcon={<TrashBinIcon />}
                        onClick={() => onDelete(chapter.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Chapter Modals Component
function ChapterModals({
  addOpen,
  onAddClose,
  editId,
  onEditClose,
  deleteId,
  onDeleteClose,
  chapters,
  onCreate,
  onUpdate,
  onDelete,
  creating,
  updating,
  deleting,
}: {
  addOpen: boolean;
  onAddClose: () => void;
  editId: number | null;
  onEditClose: () => void;
  deleteId: number | null;
  onDeleteClose: () => void;
  chapters: Chapter[];
  onCreate: (chapter: {
    national_chapter?: string | null;
    international_chapter?: string | null;
    chapter_whatsapp?: string | null;
    chapter_image?: string | null;
    is_active?: boolean | null;
    description?: string | null;
  }) => Promise<void>;
  onUpdate: (id: number, chapter: {
    national_chapter?: string | null;
    international_chapter?: string | null;
    chapter_whatsapp?: string | null;
    chapter_image?: string | null;
    is_active?: boolean | null;
    description?: string | null;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}) {
  const [chapterType, setChapterType] = useState<"national" | "international" | "">("");
  const [chapterName, setChapterName] = useState("");
  const [chapterWhatsapp, setChapterWhatsapp] = useState("");
  const [chapterImageFile, setChapterImageFile] = useState<File | null>(null);
  const [chapterImagePreview, setChapterImagePreview] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const editingChapter = editId ? chapters.find((c) => c.id === editId) : null;
  const deletingChapter = deleteId ? chapters.find((c) => c.id === deleteId) : null;

  React.useEffect(() => {
    if (editId && editingChapter) {
      // Determine chapter type from existing data
      if (editingChapter.national_chapter) {
        setChapterType("national");
        setChapterName(editingChapter.national_chapter);
      } else if (editingChapter.international_chapter) {
        setChapterType("international");
        setChapterName(editingChapter.international_chapter);
      } else {
        setChapterType("");
        setChapterName("");
      }
      setChapterWhatsapp(editingChapter.chapter_whatsapp || "");
      setChapterImageFile(null);
      setChapterImagePreview(editingChapter.chapter_image ? `/images/${editingChapter.chapter_image}` : null);
      setIsActive(editingChapter.is_active !== null ? editingChapter.is_active : true);
      setDescription(editingChapter.description || "");
      setError(null);
    } else if (addOpen) {
      setChapterType("");
      setChapterName("");
      setChapterWhatsapp("");
      setChapterImageFile(null);
      setChapterImagePreview(null);
      setIsActive(true);
      setDescription("");
      setError(null);
    }
  }, [editId, editingChapter, addOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.");
        return;
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setError("File size exceeds 5MB limit.");
        return;
      }
      
      setChapterImageFile(file);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setChapterImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!chapterType) {
      setError("Please select chapter type (National or International)");
      return;
    }
    if (!chapterName.trim()) {
      setError("Chapter name is required");
      return;
    }
    setError(null);
    setUploading(true);

    try {
      let imageFilename: string | null = null;

      // Upload image if a new file is selected
      if (chapterImageFile) {
        const formData = new FormData();
        formData.append("image", chapterImageFile);
        
        const uploadRes = await fetch("/api/organization/chapters/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({ error: "Failed to upload image" }));
          throw new Error(errorData.error || "Failed to upload image");
        }

        const uploadData = await uploadRes.json();
        imageFilename = uploadData.filename;
      } else if (editId && editingChapter?.chapter_image) {
        // Keep existing image if no new file is selected
        imageFilename = editingChapter.chapter_image;
      }

      const chapterData = {
        national_chapter: chapterType === "national" ? chapterName.trim() : null,
        international_chapter: chapterType === "international" ? chapterName.trim() : null,
        chapter_whatsapp: chapterWhatsapp.trim() || null,
        chapter_image: imageFilename,
        is_active: isActive,
        description: description.trim() || null,
      };

      if (editId) {
        await onUpdate(editId, chapterData);
      } else {
        await onCreate(chapterData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save chapter");
    } finally {
      setUploading(false);
    }
  };

  const chapterDisplayName = deletingChapter 
    ? (deletingChapter.national_chapter || deletingChapter.international_chapter || "Chapter")
    : "Chapter";

  return (
    <>
      {/* Add Chapter Modal */}
      <Modal isOpen={addOpen} onClose={onAddClose} className="max-w-[600px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add Chapter</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6 space-y-4">
          <div>
            <Label>Chapter Type *</Label>
            <Select
              options={[
                { value: "national", label: "National Chapter" },
                { value: "international", label: "International Chapter" },
              ]}
              placeholder="Select chapter type"
              onChange={(value) => {
                setChapterType(value as "national" | "international");
                setChapterName(""); // Clear name when type changes
              }}
              defaultValue={chapterType}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select whether this is a National or International chapter
            </p>
          </div>
          <div>
            <Label>Chapter Name *</Label>
            <Input
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              placeholder={chapterType === "national" ? "Enter national chapter name" : chapterType === "international" ? "Enter international chapter name" : "Enter chapter name"}
              disabled={creating || !chapterType}
            />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input
              value={chapterWhatsapp}
              onChange={(e) => setChapterWhatsapp(e.target.value)}
              placeholder="Enter WhatsApp number or link (optional)"
              disabled={creating}
            />
          </div>
          <div>
            <Label>Chapter Image</Label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageChange}
              disabled={creating || uploading}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            {chapterImagePreview && (
              <div className="mt-2">
                <img
                  src={chapterImagePreview}
                  alt="Chapter preview"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Upload an image (JPEG, PNG, GIF, or WebP, max 5MB)
            </p>
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter chapter description (optional)"
              disabled={creating}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              rows={3}
            />
          </div>
          <div>
            <Checkbox
              checked={isActive}
              onChange={setIsActive}
              label="Active"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onAddClose} disabled={creating || uploading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={creating || uploading || !chapterType || !chapterName.trim()}>
            {creating || uploading ? "Processing..." : "Create Chapter"}
          </Button>
        </div>
      </Modal>

      {/* Edit Chapter Modal */}
      <Modal isOpen={!!editId} onClose={onEditClose} className="max-w-[600px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Edit Chapter</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="mb-6 space-y-4">
          <div>
            <Label>Chapter Type *</Label>
            <Select
              options={[
                { value: "national", label: "National Chapter" },
                { value: "international", label: "International Chapter" },
              ]}
              placeholder="Select chapter type"
              onChange={(value) => {
                setChapterType(value as "national" | "international");
                if (value !== chapterType) {
                  setChapterName(""); // Clear name when type changes
                }
              }}
              defaultValue={chapterType}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select whether this is a National or International chapter
            </p>
          </div>
          <div>
            <Label>Chapter Name *</Label>
            <Input
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              placeholder={chapterType === "national" ? "Enter national chapter name" : chapterType === "international" ? "Enter international chapter name" : "Enter chapter name"}
              disabled={updating || !chapterType}
            />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input
              value={chapterWhatsapp}
              onChange={(e) => setChapterWhatsapp(e.target.value)}
              placeholder="Enter WhatsApp number or link (optional)"
              disabled={updating}
            />
          </div>
          <div>
            <Label>Chapter Image</Label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageChange}
              disabled={updating || uploading}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            {chapterImagePreview && (
              <div className="mt-2">
                <img
                  src={chapterImagePreview}
                  alt="Chapter preview"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Upload an image (JPEG, PNG, GIF, or WebP, max 5MB). Leave empty to keep existing image.
            </p>
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter chapter description (optional)"
              disabled={updating}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              rows={3}
            />
          </div>
          <div>
            <Checkbox
              checked={isActive}
              onChange={setIsActive}
              label="Active"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onEditClose} disabled={updating || uploading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={updating || uploading || !chapterType || !chapterName.trim()}>
            {updating || uploading ? "Processing..." : "Save Changes"}
          </Button>
        </div>
      </Modal>

      {/* Delete Chapter Modal */}
      <Modal isOpen={!!deleteId} onClose={onDeleteClose} className="max-w-[520px] p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Delete Chapter</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong>{chapterDisplayName}</strong>? This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onDeleteClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteId && onDelete(deleteId)}
            disabled={deleting}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

