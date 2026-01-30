"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { useSession } from "next-auth/react";
import { canModify, isAdminUser, isViewerUser, canManageUsers, isSuperAdminUser } from "@/lib/alumniProfile";
import OrganizationComponent from "@/components/setup/OrganizationComponent";
import ChaptersComponent from "@/components/setup/ChaptersComponent";
import SyncedTableScroll from "@/components/tables/SyncedTableScroll";
import { NewsletterTab } from "@/components/alumni/NewsletterTab";

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

// Removed dummy users; only real-time users are shown via API

type ToastItem = { id: string; type: "success" | "error"; message: string };


function SetupPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAdmin = isAdminUser(session?.user);
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const hasModifyAccess = canModify(session?.user);
  const canManage = canManageUsers(session?.user);

  const TABS = [
    { key: "users", label: "Users" },
    { key: "organizations", label: "Organizations" },
    { key: "chapters", label: "Chapters" },
    { key: "newsletters", label: "Newsletters" },
  ] as const;

  // Get initial tab from URL search params, default to "users"
  const tabFromUrlRaw = searchParams.get("tab");
  const tabFromUrl = tabFromUrlRaw === "newsletter" ? "newsletters" : tabFromUrlRaw;
  const validTab = TABS.find(t => t.key === tabFromUrl)?.key || "users";
  const [selected, setSelected] = useState<typeof TABS[number]["key"]>(validTab);

  // Update URL when tab changes
  const handleTabChange = (tab: typeof TABS[number]["key"]) => {
    setSelected(tab);
    router.push(`/setup?tab=${tab}`, { scroll: false });
  };

  // Sync with URL on mount or when URL changes
  useEffect(() => {
    const tabFromUrlRaw = searchParams.get("tab");
    const tabFromUrl = tabFromUrlRaw === "newsletter" ? "newsletters" : tabFromUrlRaw;
    const validTab = TABS.find(t => t.key === tabFromUrl)?.key || "users";
    setSelected(validTab);
  }, [searchParams]);

  // Users management state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Get real-time users count for counter
  const { data: realTimeUsers, isLoading: realTimeUsersLoading } = useUsersList();
  const realTimeUsersCount = realTimeUsers?.length || 0;

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_USERS) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as UserItem[];
        setUsers(parsed);
      } else {
        setUsers([]);
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

  const isNewslettersTab = selected === "newsletters";

  // Calculate total users count after filteredUsers is defined
  const totalUsersCount = filteredUsers.length + realTimeUsersCount;

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const UserCard: React.FC<{ user: UserItem; onEdit: () => void; onRemove: () => void; canModify: boolean }> = ({ user, onEdit, onRemove, canModify }) => {
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
          {canModify ? (
            <>
          <Button size="sm" aria-label={`Edit ${user.name}`} startIcon={<PencilIcon />} onClick={onEdit}>
            <span className="sr-only">Edit</span>
          </Button>
          <Button size="sm" variant="outline" aria-label={`Remove ${user.name}`} startIcon={<TrashBinIcon />} onClick={onRemove}>
            <span className="sr-only">Remove</span>
          </Button>
            </>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">View only</span>
          )}
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


  return (
    <div className="">
      <ComponentCard title="Setup" className="overflow-x-hidden">
        {/* Role indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Super Admin - Full Permissions
              </span>
            ) : isAdmin ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Admin - Modify Permission
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                Viewer - View Permission Only
              </span>
            )}
          </div>
        </div>
        <div
          className="tab-list"
          role="tablist"
          aria-label="Setup sections"
        >
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              className={`tab-item rounded-xl border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out  hover:shadow-sm  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected === tab.key
                  ? "bg-white  text-blue-700 dark:border-blue-500 dark:bg-blue-900/20"
                  : "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-white/[0.03]"
              }`}
              onClick={() => handleTabChange(tab.key)}
              role="tab"
              aria-selected={selected === tab.key}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  const nextIdx = (idx + 1) % TABS.length;
                  handleTabChange(TABS[nextIdx].key);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                  handleTabChange(TABS[prevIdx].key);
                } else if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTabChange(tab.key);
                }
              }}
              aria-label={`Open ${tab.label} tab`}
            >
              <span className="flex items-center gap-2">
              {tab.label}
                {tab.key === "users" && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {usersLoading || realTimeUsersLoading ? "..." : totalUsersCount.toLocaleString()}
                  </span>
                )}
              </span>
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

            {/* Users Counter */}
            <UsersCounter 
              realTimeCount={realTimeUsersCount}
              localStorageCount={filteredUsers.length}
              isLoading={usersLoading || realTimeUsersLoading}
            />

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
              {canManage && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setAddUserOpen(true)}>Add User</Button>
              </div>
              )}
              {!canManage && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{isAdmin ? "Admin access - Cannot manage users" : "Viewer access - Read only"}</span>
                </div>
              )}
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
                  <UserCard key={u.id} user={u} onEdit={() => setEditUserId(u.id)} onRemove={() => setRemoveUserId(u.id)} canModify={hasModifyAccess} />
                ))}
              </div>
            )}

            {/* Dashboard Access Management Table */}
            {!usersLoading && filteredUsers.length > 0 && (
              <div className="mt-6">
                <SyncedTableScroll minWidth={1100}>
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
                            {canManage ? (
                              <>
                            <Button size="sm" aria-label={`Edit ${u.name}`} startIcon={<PencilIcon />} onClick={() => setEditUserId(u.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button size="sm" variant="outline" aria-label={`Remove ${u.name}`} startIcon={<TrashBinIcon />} onClick={() => setRemoveUserId(u.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                              <span className="sr-only">Remove</span>
                            </Button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">{isAdmin ? "Admin - Cannot manage users" : "View only"}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </SyncedTableScroll>
              </div>
            )}

            {/* Add User Modal */}
            {canManage && (
            <Modal isOpen={addUserOpen} onClose={() => setAddUserOpen(false)} className="max-w-[1400px] w-[95vw] max-h-[90vh] overflow-y-auto p-6 lg:p-8">
              <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-2xl font-bold text-gray-900 dark:text-white">Add New User</h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Create a new user account with appropriate access permissions</p>
              </div>
              <UserForm />
            </Modal>
            )}

            {/* Edit User Modal */}
            {canManage && (
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
            )}

            {/* Remove User Modal */}
            {canManage && (
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
            )}
          </div>
        )}

        {selected === "organizations" && (
          <div className="mt-6">
            <OrganizationComponent />
          </div>
        )}

        {selected === "chapters" && (
          <div className="mt-6">
            <ChaptersComponent />
          </div>
        )}

        {isNewslettersTab && (
          <div className="mt-6">
            <NewsletterTab />
          </div>
        )}

        {/* Add/Edit User Form Component */}
        
        

      </ComponentCard>

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

function UsersCounter({ 
  realTimeCount, 
  localStorageCount, 
  isLoading 
}: { 
  realTimeCount: number; 
  localStorageCount: number; 
  isLoading: boolean;
}) {
  const totalCount = realTimeCount + localStorageCount;

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</h3>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {isLoading ? "..." : totalCount.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">Real-time</p>
            <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
              {isLoading ? "..." : realTimeCount.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">Local</p>
            <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">
              {localStorageCount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RealTimeUsers() {
  const { data: session } = useSession();
  const canManage = canManageUsers(session?.user);
  const isAdmin = isAdminUser(session?.user);
  const isViewer = isViewerUser(session?.user);
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const currentUserId = (session?.user as { userId?: number })?.userId;
  const { data, isLoading, error } = useUsersList();
  const queryClient = useQueryClient();
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const AssignedItemsCell: React.FC<{ items: string[]; allowDropdown: boolean }> = ({ items, allowDropdown }) => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      if (!open) return;
      const onDocClick = () => setOpen(false);
      document.addEventListener("click", onDocClick);
      return () => document.removeEventListener("click", onDocClick);
    }, [open]);

    const count = items.length;
    if (!count) {
      return <span className="text-gray-400">-</span>;
    }

    const label = `${count} assigned`;

    if (!allowDropdown) {
      return (
        <span className="inline-flex max-w-[180px] truncate" title={items.join(", ")}>
          {label}
        </span>
      );
    }

    return (
      <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-900"
          aria-haspopup="menu"
          aria-expanded={open}
          title={items.join(", ")}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="max-w-[140px] truncate">{label}</span>
          <span className="text-[10px] leading-none">▼</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 z-50 mt-2 w-64 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="max-h-56 overflow-auto py-1">
              {items.map((it) => (
                <div
                  key={it}
                  role="menuitem"
                  className="px-3 py-2 text-[12px] text-slate-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {it}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
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
  
  function openEdit(u: AdminUser) {
    setEditUserId(u.userid);
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
    <div className="mt-6 overflow-hidden border border-gray-200 max  bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <SyncedTableScroll minWidth={1200} maxHeight={700} className="mx-auto">
        <table className="min-w-full border border-gray-200 dark:border-gray-800" role="table" aria-label="Real-time users list">
          <thead className="bg-white whitespace-nowrap border-b border-gray-200 dark:border-white/[0.06]">
            <tr className="border-b border-gray-200 dark:border-white/[0.06]">
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">User</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Email</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Password</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Department</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Type</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Assigned Faculties</th>
              <th scope="col" className="px-4 py-3 text-left text-[13px] font-medium text-slate-600 border-r border-gray-200 dark:text-gray-300">Assigned Departments</th>
              <th scope="col" className="px-4 py-3 text-center text-[13px] font-medium text-slate-600 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap divide-y divide-gray-200 dark:divide-white/[0.06]">
            {users.map((u) => (
              <tr key={u.userid} className="odd:bg-gray-50">
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">
                  <div className="flex flex-col">
                    <span className={`block font-medium  ${u.blocked ? "text-red-600" : "text-slate-900"} text-[13px] dark:text-white/90`}>{`${u.firstname ?? ""} ${u.lastname ?? ""}`.trim() || u.email || `User #${u.userid}`}</span>
                    
                  </div>
                </td>
                
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.email ?? "-"}</td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300 font-mono text-xs">
                  {(() => {
                    // Super Admin can see all passwords
                    if (isSuperAdmin) {
                      return (
                        <span className="text-gray-700 dark:text-gray-300" title="Password visible to super admin">{u.password || ""}</span>
                      );
                    }
                    // Admins and viewers can only see their own password
                    const isOwnPassword = currentUserId && Number(currentUserId) === u.userid;
                    if (isOwnPassword && u.password) {
                      return (
                        <span className="text-gray-700 dark:text-gray-300" title="Your password">{u.password}</span>
                      );
                    }
                    // Hide password for other users
                    return (
                      <span className="text-gray-400 italic" title="Password hidden">••••••••</span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.department ?? "-"}</td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">{u.type ?? "-"}</td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">
                  <AssignedItemsCell items={u.accessAssignments?.faculties ?? []} allowDropdown={isSuperAdmin} />
                </td>
                <td className="px-4 py-3 border-r border-gray-200 text-slate-900 text-[13px] text-start dark:text-gray-300">
                  <AssignedItemsCell items={u.accessAssignments?.departments ?? []} allowDropdown={isSuperAdmin} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-center">
                    {(() => {
                      // Check if viewer/admin is viewing their own row
                      const isOwnRow = currentUserId && Number(currentUserId) === u.userid;
                      // Only Super Admin can manage users, or users can edit their own account
                      const canEdit = canManage || isOwnRow;
                      
                      if (canEdit) {
                        return (
                          <>
                            <button
                              aria-label={`Edit ${u.email ?? "user"}`}
                              onClick={() => openEdit(u)}
                              className="inline-flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              <PencilIcon className="w-4 h-4 text-gray-700" />
                            </button>
                            {canManage && (
                              <button
                                aria-label={`Delete ${u.email ?? "user"}`}
                                onClick={() => setDeleteId(u.userid)}
                                className="inline-flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                              >
                                <TrashBinIcon className="w-4 h-4 text-gray-700" />
                              </button>
                            )}
                          </>
                        );
                      }
                      return <span className="text-xs text-gray-500 dark:text-gray-400">{(isAdmin || isViewer) ? `${isAdmin ? "Admin" : "Viewer"} - Cannot manage other users` : "View only"}</span>;
                    })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SyncedTableScroll>
      {/* Edit User Modal with UserForm */}
      {editUserId && (
        <Modal isOpen={!!editUserId} onClose={() => setEditUserId(null)} className="max-w-[1400px] w-[95vw] max-h-[90vh] overflow-y-auto p-6 lg:p-8">
          <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-2xl font-bold text-gray-900 dark:text-white">Edit User</h4>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {canManage ? "Update user account and access permissions" : "Update your account"}
            </p>
          </div>
          <UserForm 
            userId={editUserId} 
            onSuccess={() => {
              setEditUserId(null);
              queryClient.invalidateQueries({ queryKey: ["users", "list"] });
            }}
          />
        </Modal>
      )}

      {canManage && (
      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} className="max-w-[520px] p-5 lg:p-8">
        <h4 className="font-semibold text-gray-800 mb-4 text-title-sm dark:text-white/90">Confirm Delete</h4>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">Are you sure you want to delete this user?</p>
        <div className="flex items-center justify-end w-full gap-3 mt-6">
          <Button size="sm" variant="outline" onClick={() => setDeleteId(null)} aria-label="Cancel delete">Cancel</Button>
          <Button size="sm" onClick={performDelete} aria-label="Confirm delete">Delete</Button>
        </div>
      </Modal>
      )}
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SetupPageContent />
    </Suspense>
  );
}