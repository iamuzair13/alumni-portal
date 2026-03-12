"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type CheckResult = { exists: boolean };

type StatusState =
  | { type: "idle" }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export default function AlumniVerificationPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [checkedExists, setCheckedExists] = useState<boolean | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const canCheck = useMemo(() => identifier.trim().length > 0, [identifier]);
  const showProceed = checkedExists === false;
  const showSendCredentials = checkedExists === true;

  async function handleCheck() {
    try {
      setStatus({ type: "loading", message: "Checking record..." });
      setCheckedExists(null);

      const res = await fetch("/api/alumni/check-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<CheckResult> & { error?: string };
      if (!res.ok) {
        const err = String(data?.error || "Failed to check record");
        setStatus({ type: "error", message: err === "RATE_LIMITED" ? "Too many attempts. Please try again later." : err });
        return;
      }

      const exists = Boolean(data.exists);
      setCheckedExists(exists);

      if (exists) {
        setStatus({ type: "success", message: "Record found. You can request your login credentials." });
      } else {
        setStatus({ type: "success", message: "Record not found. Please register as a new alumni." });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to check record";
      setStatus({ type: "error", message: msg });
    }
  }

  async function handleSendCredentials() {
    try {
      setSending(true);
      setStatus({ type: "loading", message: "Sending credentials..." });

      const res = await fetch("/api/alumni/send-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), email: email.trim() }),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const err = String(data?.error || "Failed to send credentials");
        setStatus({ type: "error", message: err === "RATE_LIMITED" ? "Too many attempts. Please try again later." : err });
        return;
      }

      setStatus({ type: "success", message: "Credentials sent. Please check your email inbox." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send credentials";
      setStatus({ type: "error", message: msg });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center">
          <Image
            src="/images/logo/UOL-Rebrand-ID_Final-02.png"
            alt="University of Lahore"
            width={96}
            height={96}
            className="h-20 w-20 rounded-full bg-white p-2 shadow-lg"
            priority
          />
        </div>

        <div className="rounded-2xl bg-white shadow-2xl border border-white/40 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="text-xs font-semibold text-green-700">Step 1 of 2</div>
            <h1 className="mt-1 text-xl font-bold text-gray-900">Alumni Verification</h1>
            <p className="mt-1 text-sm text-gray-600">
              Enter your SAP ID or Registration Number to check if your record already exists.
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Enter your SAP ID or Registration Number to check if your record already exists.
              </label>
              <input
                type="text"
                placeholder="Enter SAP ID or Registration Number"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
              />
            </div>

            <button
              type="button"
              disabled={!canCheck || status.type === "loading"}
              onClick={handleCheck}
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {status.type === "loading" && status.message.includes("Checking") ? "Checking..." : "Check Record"}
            </button>

            {status.type !== "idle" && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  status.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : status.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
                role="status"
                aria-live="polite"
              >
                {status.message}
              </div>
            )}

            {showProceed && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/alumni-registration")}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Proceed to Registration
                </button>
              </div>
            )}

            {showSendCredentials && (
              <div className="pt-2 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Enter your email address to receive your login credentials.
                  </label>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                  />
                </div>

                <button
                  type="button"
                  disabled={sending || !email.trim()}
                  onClick={handleSendCredentials}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send Credentials"}
                </button>
              </div>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => router.push("/signin")}
                className="text-xs text-gray-600 hover:text-gray-800 hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-white/90">
          Office of Alumni Relations | University of Lahore
        </div>
      </div>
    </div>
  );
}
