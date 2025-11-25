"use client";
import React, { useEffect, useMemo, useState } from "react";

type UserFormValues = {
  email: string;
  password: string;
  firstname?: string;
  lastname?: string;
  department?: string;
  type: string; // should be "admin" for admin users, "viewer" for view-only users
  blocked?: boolean;
  csrf: string;
};

const inputBase = "mt-1 w-full rounded border border-neutral-300 p-2";
const labelBase = "block text-sm text-neutral-800";

function genToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

import { useQueryClient } from "@tanstack/react-query";

export default function UserForm() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<UserFormValues>({ email: "", password: "", firstname: "", lastname: "", department: "", type: "admin", blocked: false, csrf: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = genToken();
    try {
      document.cookie = `csrf_token=${token}; SameSite=Lax; Path=/`;
    } catch {}
    setValues((v) => ({ ...v, csrf: token }));
  }, []);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()), [values.email]);
  const passwordValid = useMemo(() => values.password.length >= 8, [values.password]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!emailValid) { setError("Invalid email format"); return; }
    if (!passwordValid) { setError("Password must be at least 8 characters"); return; }
    if (process.env.NODE_ENV === "production" && typeof window !== "undefined" && window.location.protocol !== "https:") {
      setError("Insecure connection. Use HTTPS.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save user");
      setMessage(`Saved. New User ID: ${data.userid}`);
      setValues({ email: "", password: "", firstname: "", lastname: "", department: "", type: "admin", blocked: false, csrf: values.csrf });
      try {
        await queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      } catch {}
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 bg-white px-4 py-4" aria-label="Admin user form">
      {(message || error || submitting) && (
        <div className="mb-4" aria-live="polite" aria-atomic="true">
          {submitting && <div className="text-sm text-neutral-600">Submitting...</div>}
          {message && <div role="status" className="text-sm text-green-700">{message}</div>}
          {error && <div role="alert" className="text-sm text-red-700">{error}</div>}
        </div>
      )}

      <input type="hidden" name="csrf" value={values.csrf} />
      <input type="hidden" name="csrf" value={values.csrf} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="email" className={labelBase}>Email *</label>
          <input id="email" type="email" className={inputBase} value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} aria-invalid={!emailValid} required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="password" className={labelBase}>Password *</label>
          <input id="password" type="password" className={inputBase} value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} aria-invalid={!passwordValid} required />
          <p className="mt-1 text-xs text-neutral-600">Minimum 8 characters. Stored encrypted.</p>
        </div>
        <div>
          <label htmlFor="firstname" className={labelBase}>First Name</label>
          <input id="firstname" type="text" className={inputBase} value={values.firstname ?? ""} onChange={(e) => setValues((v) => ({ ...v, firstname: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="lastname" className={labelBase}>Last Name</label>
          <input id="lastname" type="text" className={inputBase} value={values.lastname ?? ""} onChange={(e) => setValues((v) => ({ ...v, lastname: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="department" className={labelBase}>Department</label>
          <input id="department" type="text" className={inputBase} value={values.department ?? ""} onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="type" className={labelBase}>Type</label>
          <select id="type" className={inputBase} value={values.type} onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input id="blocked" type="checkbox" className="h-4 w-4" checked={!!values.blocked} onChange={(e) => setValues((v) => ({ ...v, blocked: e.target.checked }))} />
          <label htmlFor="blocked" className={labelBase}>Blocked</label>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60">Submit</button>
        <button type="button" disabled={submitting} onClick={() => setValues({ email: "", password: "", firstname: "", lastname: "", department: "", type: "staff", blocked: false, csrf: values.csrf })} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50">Reset</button>
      </div>
    </form>
  );
}