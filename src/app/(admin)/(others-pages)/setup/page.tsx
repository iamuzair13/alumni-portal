"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState } from "react";
import { useUsersList } from "@/app/queries/fetch-users";
import ComponentCard from "@/components/common/ComponentCard";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PencilIcon, TrashBinIcon } from "@/icons";
import Select from "@/components/form/Select";
import Checkbox from "@/components/form/input/Checkbox";
import Alert from "@/components/ui/alert/Alert";
import UserForm from "@/components/forms/UserForm";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminUser } from "@/app/queries/fetch-users";

// ---------------------------
// Users Management (Frontend-Only)
// ---------------------------
type Role = "Admin" | "Editor" | "Viewer";
type UserStatus = "active" | "inactive";
type Permissions = {
  viewDashboard: boolean;
  editContent: boolean;
  manageUsers: boolean;
  viewAnalytics: boolean;
};
type UserItem = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  permissions: Permissions;
  lastAccess: string; // ISO string
  avatarUrl?: string;
};
const STORAGE_KEY_USERS = "setup_users_v1";

const SAMPLE_USERS: UserItem[] = [
  {
    id: "U-1001",
    name: "Ayesha Khan",
    email: "ayesha.khan@example.com",
    role: "Admin",
    status: "active",
    permissions: {
      viewDashboard: true,
      editContent: true,
      manageUsers: true,
      viewAnalytics: true,
    },
    lastAccess: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "U-1002",
    name: "Bilal Ahmed",
    email: "bilal.ahmed@example.com",
    role: "Editor",
    status: "active",
    permissions: {
      viewDashboard: true,
      editContent: true,
      manageUsers: false,
      viewAnalytics: true,
    },
    lastAccess: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    id: "U-1003",
    name: "Chen Li",
    email: "chen.li@example.com",
    role: "Viewer",
    status: "inactive",
    permissions: {
      viewDashboard: true,
      editContent: false,
      manageUsers: false,
      viewAnalytics: true,
    },
    lastAccess: new Date(Date.now() - 86400_000).toISOString(),
  },
  {
    id: "U-1004",
    name: "Diego Martinez",
    email: "diego.martinez@example.com",
    role: "Editor",
    status: "active",
    permissions: {
      viewDashboard: true,
      editContent: true,
      manageUsers: false,
      viewAnalytics: false,
    },
    lastAccess: new Date(Date.now() - 5400_000).toISOString(),
  },
  {
    id: "U-1005",
    name: "Emma Thompson",
    email: "emma.thompson@example.com",
    role: "Viewer",
    status: "active",
    permissions: {
      viewDashboard: true,
      editContent: false,
      manageUsers: false,
      viewAnalytics: true,
    },
    lastAccess: new Date(Date.now() - 1800_000).toISOString(),
  },
  {
    id: "U-1006",
    name: "Farhan Ali",
    email: "farhan.ali@example.com",
    role: "Admin",
    status: "active",
    permissions: {
      viewDashboard: true,
      editContent: true,
      manageUsers: true,
      viewAnalytics: true,
    },
    lastAccess: new Date(Date.now() - 1000_000).toISOString(),
  },
];

type ToastItem = { id: string; type: "success" | "error"; message: string };

type Chapter = {
  category: string;
  code: string;
  title: string;
  location: string;
  whatsapp: string;
};

const INITIAL_CHAPTERS: Chapter[] = [
  { category: "Region", code: "AUS", title: "Chapter Australia", location: "Sydney, Australia", whatsapp: "+61 400 123 456" },
  { category: "Region", code: "EU", title: "Chapter Europe", location: "Berlin, Germany", whatsapp: "+49 151 234 567" },
  { category: "Region", code: "USA", title: "Chapter USA", location: "New York, USA", whatsapp: "+1 917 555 0123" },
  { category: "Region", code: "UK", title: "Chapter United Kingdom", location: "London, UK", whatsapp: "+44 7700 900123" },
  { category: "Region", code: "CA", title: "Chapter Canada", location: "Toronto, Canada", whatsapp: "+1 416 555 0199" },
  { category: "Region", code: "MENA", title: "Chapter Middle East", location: "Dubai, UAE", whatsapp: "+971 50 123 4567" },
  { category: "Region", code: "AFR", title: "Chapter Africa", location: "Nairobi, Kenya", whatsapp: "+254 712 345 678" },
  { category: "Region", code: "SA", title: "Chapter South Asia", location: "Lahore, Pakistan", whatsapp: "+92 300 123 4567" },
  { category: "Region", code: "SEA", title: "Chapter Southeast Asia", location: "Singapore", whatsapp: "+65 8123 4567" },
  { category: "Region", code: "CHN", title: "Chapter China", location: "Shanghai, China", whatsapp: "+86 138 0013 8000" },
];

export default function SetupPage() {
  const TABS = [
    { key: "users", label: "Users" },
    { key: "chapters", label: "Chapters" },
  ] as const;

  const [selected, setSelected] = useState<typeof TABS[number]["key"]>("users");
  const [chapters, setChapters] = useState<Chapter[]>(INITIAL_CHAPTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<Chapter | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Users management state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_USERS) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as UserItem[];
        setUsers(parsed);
      } else {
        setUsers(SAMPLE_USERS);
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(SAMPLE_USERS));
      }
      setUsersLoading(false);
    } catch {
      setUsersError("Failed to load users.");
      setUsersLoading(false);
    }
  }, []);

  // persist to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      }
    } catch {}
  }, [users]);

  const pushToast = (type: "success" | "error", message: string) => {
    const id = `${type}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    let list = users.filter((u) =>
      [u.name, u.email, u.role, u.status].join(" ").toLowerCase().includes(q)
    );
    list = list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [users, userSearch]);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const UserCard: React.FC<{ user: UserItem; onEdit: () => void; onRemove: () => void }> = ({ user, onEdit, onRemove }) => {
    return (
      <div className="flex items-center gap-4 p-4 border rounded-xl dark:border-gray-800">
        <div className="relative w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="text-sm font-semibold">{user.name.slice(0, 1)}</span>
          )}
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${user.status === "active" ? "bg-success-500" : "bg-gray-400"}`}></span>
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-800 dark:text-white/90">{user.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">{user.email}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Role: {user.role}</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" aria-label={`Edit ${user.name}`} startIcon={<PencilIcon />} onClick={onEdit}>
            <span className="sr-only">Edit</span>
          </Button>
          <Button size="sm" variant="outline" aria-label={`Remove ${user.name}`} startIcon={<TrashBinIcon />} onClick={onRemove}>
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      </div>
    );
  };

  type UserFormPayload = {
    name: string;
    email: string;
    role: Role;
    status: UserStatus;
    permissions: Permissions;
  };

  const AddOrEditUserForm: React.FC<{
    mode: "add" | "edit";
    initial?: UserItem;
    onCancel: () => void;
    onSubmit: (payload: UserFormPayload) => void;
  }> = ({ mode, initial, onCancel, onSubmit }) => {
    const [name, setName] = useState(initial?.name || "");
    const [email, setEmail] = useState(initial?.email || "");
    const [role, setRole] = useState<Role>(initial?.role || "Viewer");
    const [status, setStatus] = useState<UserStatus>(initial?.status || "active");
    const [permissions, setPermissions] = useState<Permissions>(
      initial?.permissions || {
        viewDashboard: true,
        editContent: false,
        manageUsers: false,
        viewAnalytics: false,
      }
    );
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setError("Valid email is required.");
        return;
      }
      setError(null);
      onSubmit({ name: name.trim(), email: email.trim(), role, status, permissions });
    };

    return (
      <div>
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" />
          </div>
          <div>
            <Label>Email address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email" />
          </div>
          <div>
            <Label>Role</Label>
            <Select
              defaultValue={role}
              onChange={(v: string) => setRole(v as Role)}
              options={[
                { value: "Admin", label: "Admin" },
                { value: "Editor", label: "Editor" },
                { value: "Viewer", label: "Viewer" },
              ]}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              defaultValue={status}
              onChange={(v: string) => setStatus(v as UserStatus)}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </div>
        </div>
        <div className="mt-6">
          <Label>Permissions</Label>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Checkbox
              checked={permissions.viewDashboard}
              onChange={(c) => setPermissions((p) => ({ ...p, viewDashboard: c }))}
              label="View dashboard"
            />
            <Checkbox
              checked={permissions.editContent}
              onChange={(c) => setPermissions((p) => ({ ...p, editContent: c }))}
              label="Edit content"
            />
            <Checkbox
              checked={permissions.manageUsers}
              onChange={(c) => setPermissions((p) => ({ ...p, manageUsers: c }))}
              label="Manage users"
            />
            <Checkbox
              checked={permissions.viewAnalytics}
              onChange={(c) => setPermissions((p) => ({ ...p, viewAnalytics: c }))}
              label="View analytics"
            />
          </div>
        </div>
        <div className="flex items-center justify-end w-full gap-3 mt-6">
          <Button size="sm" variant="outline" onClick={onCancel} aria-label="Cancel adding or editing user">Cancel</Button>
          <Button size="sm" onClick={handleSubmit} aria-label={mode === "add" ? "Add user" : "Save user changes"}>
            {mode === "add" ? "Add User" : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  };

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) =>
      [c.title, c.location, c.code, c.category, c.whatsapp]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [chapters, searchQuery]);

  const openEdit = (idx: number) => {
    setEditingIndex(idx);
    setEditData({ ...chapters[idx] });
    setErrorMsg(null);
  };
  const closeEdit = () => {
    setEditingIndex(null);
    setEditData(null);
    setIsSaving(false);
    setErrorMsg(null);
  };
  const saveEdit = async () => {
    if (!editData) return;
    if (!editData.code.trim() || !editData.title.trim()) {
      setErrorMsg("Code and Title are required.");
      return;
    }
    try {
      setIsSaving(true);
      await new Promise((r) => setTimeout(r, 600));
      if (editingIndex !== null) {
        const next = [...chapters];
        next[editingIndex] = { ...editData };
        setChapters(next);
      }
      closeEdit();
    } catch {
      setErrorMsg("Failed to save changes. Please try again.");
      setIsSaving(false);
    }
  };

  const confirmDelete = (idx: number) => {
    setPendingDeleteIndex(idx);
  };
  const cancelDelete = () => {
    setPendingDeleteIndex(null);
    setDeleteLoading(false);
  };
  const performDelete = async () => {
    if (pendingDeleteIndex === null) return;
    try {
      setDeleteLoading(true);
      await new Promise((r) => setTimeout(r, 500));
      const next = chapters.filter((_, i) => i !== pendingDeleteIndex);
      setChapters(next);
      cancelDelete();
    } catch {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-6">
      <ComponentCard title="Setup" className="">
        <div
          className="tab-list"
          role="tablist"
          aria-label="Setup sections"
        >
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              className={`tab-item rounded-xl border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected === tab.key
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20"
                  : "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-white/[0.03]"
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
              aria-label={`Open ${tab.label} tab`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {selected === "users" && (
          <div className="mt-6">
            {/* Notifications */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
              {toasts.map((t) => (
                <Alert key={t.id} variant={t.type} title={t.type === "success" ? "Success" : "Error"} message={t.message} />
              ))}
            </div>

            {/* Admin Control Panel */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 w-full sm:w-2/3">
                <Label className="sr-only">Search users</Label>
                <Input
                  type="text"
                  placeholder="Search users by name, email, role"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  aria-label="Search users"
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                />
                {userSearch && (
                  <Button size="sm" variant="outline" onClick={() => setUserSearch("")} aria-label="Clear user search" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Clear</Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setAddUserOpen(true)}>Add User</Button>
              </div>
            </div>

            {/* Loading / Error / Empty States */}
            {usersLoading && (
              <div className="mt-6 p-5 border border-gray-200 rounded-2xl dark:border-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-300">Loading users...</p>
              </div>
            )}
            {usersError && (
              <div className="mt-6 p-5 border border-error-500 rounded-2xl bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
                <p className="text-sm text-error-600 dark:text-error-400">{usersError}</p>
              </div>
            )}
            {!usersLoading && !usersError && filteredUsers.length === 0 && (
              <RealTimeUsers />
            )}

            {/* User Cards (preview) */}
            {!usersLoading && filteredUsers.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredUsers.slice(0, 2).map((u) => (
                  <UserCard key={u.id} user={u} onEdit={() => setEditUserId(u.id)} onRemove={() => setRemoveUserId(u.id)} />
                ))}
              </div>
            )}

            {/* Dashboard Access Management Table */}
            {!usersLoading && filteredUsers.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-2xl overflow-hidden dark:border-gray-800" role="table" aria-label="Users with dashboard access">
                  <thead className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
                    <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                      <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">User</th>
                      <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Role</th>
                      <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Status</th>
                      <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Last Access</th>
                      <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Permissions</th>
                      <th scope="col" className="px-4 py-3 text-right text-[13px] font-medium text-slate-600 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="odd:bg-gray-50">
                        <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">
                          <div className="flex flex-col">
                            <span className="block font-medium text-slate-900 text-[13px] dark:text-white/90">{u.name}</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.role}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.status}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{formatDateTime(u.lastAccess)}</td>
                        <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">
                          {Object.entries(u.permissions)
                            .filter(([, v]) => v)
                            .map(([k]) => k.replace(/([A-Z])/g, " $1").toLowerCase())
                            .join(", ") || "None"}
                          </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" aria-label={`Edit ${u.name}`} startIcon={<PencilIcon />} onClick={() => setEditUserId(u.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button size="sm" variant="outline" aria-label={`Remove ${u.name}`} startIcon={<TrashBinIcon />} onClick={() => setRemoveUserId(u.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                              <span className="sr-only">Remove</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add User Modal */}
            <Modal isOpen={addUserOpen} onClose={() => setAddUserOpen(false)} className="max-w-[720px] p-5 lg:p-10">
              <h4 className="font-semibold text-gray-800 mb-5 text-title-sm dark:text-white/90">Add User</h4>
              <UserForm />
            </Modal>

            {/* Edit User Modal */}
            <Modal isOpen={!!editUserId} onClose={() => setEditUserId(null)} className="max-w-[720px] p-5 lg:p-10">
              <h4 className="font-semibold text-gray-800 mb-5 text-title-sm dark:text-white/90">Edit Permissions</h4>
              {editUserId && (
                <AddOrEditUserForm
                  mode="edit"
                  initial={users.find((u) => u.id === editUserId)!}
                  onCancel={() => setEditUserId(null)}
                  onSubmit={(payload) => {
                    setUsers((prev) => prev.map((u) => (u.id === editUserId ? { ...u, ...payload } : u)));
                    setEditUserId(null);
                    pushToast("success", "User updated.");
                  }}
                />
              )}
            </Modal>

            {/* Remove User Modal */}
            <Modal isOpen={!!removeUserId} onClose={() => setRemoveUserId(null)} className="max-w-[520px] p-5 lg:p-8">
              <h4 className="font-semibold text-gray-800 mb-4 text-title-sm dark:text-white/90">Confirm Removal</h4>
              <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">Are you sure you want to remove access for this user?</p>
              <div className="flex items-center justify-end w-full gap-3 mt-6">
                <Button size="sm" variant="outline" onClick={() => setRemoveUserId(null)} aria-label="Cancel removal">Cancel</Button>
                <Button size="sm" onClick={() => {
                  if (!removeUserId) return;
                  setUsers((prev) => prev.filter((u) => u.id !== removeUserId));
                  setRemoveUserId(null);
                  pushToast("success", "User removed.");
                }} aria-label="Confirm removal">Remove</Button>
              </div>
            </Modal>
          </div>
        )}

        {/* Add/Edit User Form Component */}
        
        

        {selected === "chapters" && (
          <div className="mt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 w-full sm:w-1/2">
                <Label className="sr-only">Search</Label>
                <Input
                  type="text"
                  placeholder="Search chapters by title, location, code"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search chapters"
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                />
                {searchQuery && (
                  <Button size="sm" variant="outline" onClick={() => setSearchQuery("")} aria-label="Clear search" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    Clear
                  </Button>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{filteredChapters.length} result(s)</div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-2xl overflow-hidden dark:border-gray-800" role="table" aria-label="Chapters list">
                <thead className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
                  <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                    <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Sr.No.</th>
                    <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Category</th>
                    <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Code</th>
                    <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Title</th>
                    <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Location</th>
                    <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">WhatsApp</th>
                    <th scope="col" className="px-4 py-3 text-right text-[13px] font-medium text-slate-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
                  {filteredChapters.map((c, i) => (
                    <tr key={`${c.code}-${i}`} className="odd:bg-gray-50">
                      <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{i + 1}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{c.category}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{c.code}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{c.title}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{c.location}</td>
                      <td className="px-4 py-3 border-r border-gray-200 text-blue-600 text-[13px] text-start dark:text-blue-300">
                        <a
                          href={`https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                          aria-label={`Open WhatsApp for ${c.title}`}
                        >
                          {c.whatsapp}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => openEdit(chapters.indexOf(c))}
                            aria-label={`Edit ${c.title}`}
                            startIcon={<PencilIcon />}
                            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => confirmDelete(chapters.indexOf(c))}
                            aria-label={`Delete ${c.title}`}
                            startIcon={<TrashBinIcon />}
                            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredChapters.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-gray-600 dark:text-gray-300">No chapters found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ComponentCard>

      <Modal isOpen={editingIndex !== null} onClose={closeEdit} className="max-w-[700px] p-5 lg:p-10">
        <h4 className="font-semibold text-gray-800 mb-5 text-title-sm dark:text-white/90">Edit Chapter</h4>
        {errorMsg && <p className="mb-3 text-sm text-error-500 dark:text-error-400" role="alert">{errorMsg}</p>}
        <form className="space-y-4" aria-label="Edit chapter form">
          <div>
            <Label>Category</Label>
            <Input type="text" value={editData?.category || ""} onChange={(e) => setEditData((prev) => ({ ...(prev as Chapter), category: e.target.value }))} />
          </div>
          <div>
            <Label>Code</Label>
            <Input type="text" value={editData?.code || ""} onChange={(e) => setEditData((prev) => ({ ...(prev as Chapter), code: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <Label>Title</Label>
            <Input type="text" value={editData?.title || ""} onChange={(e) => setEditData((prev) => ({ ...(prev as Chapter), title: e.target.value }))} />
          </div>
          <div>
            <Label>Location</Label>
            <Input type="text" value={editData?.location || ""} onChange={(e) => setEditData((prev) => ({ ...(prev as Chapter), location: e.target.value }))} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input type="text" value={editData?.whatsapp || ""} onChange={(e) => setEditData((prev) => ({ ...(prev as Chapter), whatsapp: e.target.value }))} />
          </div>
          <div className="flex items-center justify-end w-full gap-3 mt-4">
            <Button size="sm" variant="outline" onClick={closeEdit} aria-label="Cancel editing">Cancel</Button>
            <Button size="sm" onClick={saveEdit} disabled={isSaving} aria-label="Save changes">{isSaving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={pendingDeleteIndex !== null} onClose={cancelDelete} className="max-w-[520px] p-5 lg:p-8">
        <h4 className="font-semibold text-gray-800 mb-4 text-title-sm dark:text-white/90">Confirm Delete</h4>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">Are you sure you want to delete this chapter? This action cannot be undone.</p>
        <div className="flex items-center justify-end w-full gap-3 mt-6">
          <Button size="sm" variant="outline" onClick={cancelDelete} aria-label="Cancel delete">Cancel</Button>
          <Button size="sm" onClick={performDelete} disabled={deleteLoading} aria-label="Confirm delete">{deleteLoading ? "Deleting..." : "Delete"}</Button>
        </div>
      </Modal>
      <style jsx>{`
        .tab-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .tab-item {
          flex: 1 1 180px;
          min-width: 160px;
        }
        @media (min-width: 768px) {
          .tab-item { flex-basis: 200px; }
        }
      `}</style>
    </div>
  );
}

function RealTimeUsers() {
  const { data, isLoading, error } = useUsersList();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [values, setValues] = useState<{ userid: number; email: string | null; firstname: string | null; lastname: string | null; department: string | null; type: string | null; blocked: boolean | null; password?: string }>({ userid: 0, email: null, firstname: null, lastname: null, department: null, type: "staff", blocked: false });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  if (isLoading) {
    return (
      <div className="mt-6 p-5 border border-gray-200 rounded-2xl dark:border-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-300">Loading users...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-6 p-5 border border-error-500 rounded-2xl bg-error-50 dark:border-error-500/30 dark:bg-error-500/15">
        <p className="text-sm text-error-600 dark:text-error-400">Failed to fetch users.</p>
      </div>
    );
  }
  const users = data ?? [];
  if (!users.length) {
    return (
      <div className="mt-6 p-5 border border-gray-200 rounded-2xl dark:border-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-300">No users found. Try adding one.</p>
      </div>
    );
  }
  async function openEdit(u: AdminUser) {
    setValues({ userid: u.userid, email: u.email, firstname: u.firstname, lastname: u.lastname, department: u.department, type: u.type, blocked: !!u.blocked });
    setEditOpen(true);
  }

  async function saveEdit() {
    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await fetch(`/api/users/${values.userid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update user");
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  async function performDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete user");
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    } catch {
      setDeleteId(null);
    }
  }

  return (
    <div className="mt-6 overflow-hidden border border-gray-200 bg-white rounded-2xl dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <table className="min-w-full" role="table" aria-label="Real-time users list">
          <thead className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
            <tr className="border-b border-gray-200 dark:border-white/[0.06]">
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">User</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Department</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Type</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Blocked</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 dark:text-gray-300">Last Login</th>
              <th scope="col" className="px-4 py-3 text-right text-[13px] font-medium text-slate-600 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
            {users.map((u) => (
              <tr key={u.userid} className="odd:bg-gray-50">
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">
                  <div className="flex flex-col">
                    <span className="block font-medium text-slate-900 text-[13px] dark:text-white/90">{`${u.firstname ?? ""} ${u.lastname ?? ""}`.trim() || u.email || `User #${u.userid}`}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{u.email ?? "-"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.department ?? "-"}</td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.type ?? "-"}</td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.blocked ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.lastlogindatetime ?? "-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" aria-label={`Edit ${u.email ?? "user"}`} startIcon={<PencilIcon />} onClick={() => openEdit(u)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button size="sm" variant="outline" aria-label={`Delete ${u.email ?? "user"}`} startIcon={<TrashBinIcon />} onClick={() => setDeleteId(u.userid)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} className="max-w-[720px] p-5 lg:p-10">
        <h4 className="font-semibold text-gray-800 mb-5 text-title-sm dark:text-white/90">Edit User</h4>
        {errorMsg && <p className="mb-3 text-sm text-error-500 dark:text-error-400" role="alert">{errorMsg}</p>}
        <form className="space-y-4" aria-label="Edit user form" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Email</Label>
              <Input type="email" value={values.email ?? ""} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
            </div>
            <div>
              <Label>First Name</Label>
              <Input type="text" value={values.firstname ?? ""} onChange={(e) => setValues((v) => ({ ...v, firstname: e.target.value }))} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input type="text" value={values.lastname ?? ""} onChange={(e) => setValues((v) => ({ ...v, lastname: e.target.value }))} />
            </div>
            <div>
              <Label>Department</Label>
              <Input type="text" value={values.department ?? ""} onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))} />
            </div>
            <div>
              <Label>Type</Label>
              <Select defaultValue={values.type ?? "staff"} onChange={(v) => setValues((val) => ({ ...val, type: v }))} options={[{ value: "staff", label: "Staff" }, { value: "user", label: "User" }]} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!values.blocked} onChange={(c) => setValues((v) => ({ ...v, blocked: c }))} label="Blocked" />
            </div>
            <div className="md:col-span-2">
              <Label>New Password (optional)</Label>
              <Input type="password" value={values.password ?? ""} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} placeholder="Leave empty to keep existing password" />
              <p className="mt-1 text-xs text-neutral-600">Minimum 8 characters</p>
            </div>
          </div>
          <div className="flex items-center justify-end w-full gap-3 mt-4">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(false)} aria-label="Cancel editing">Cancel</Button>
            <Button size="sm" onClick={saveEdit} disabled={saving} aria-label="Save changes">{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} className="max-w-[520px] p-5 lg:p-8">
        <h4 className="font-semibold text-gray-800 mb-4 text-title-sm dark:text-white/90">Confirm Delete</h4>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">Are you sure you want to delete this user?</p>
        <div className="flex items-center justify-end w-full gap-3 mt-6">
          <Button size="sm" variant="outline" onClick={() => setDeleteId(null)} aria-label="Cancel delete">Cancel</Button>
          <Button size="sm" onClick={performDelete} aria-label="Confirm delete">Delete</Button>
        </div>
      </Modal>
    </div>
  );
}