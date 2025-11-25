"use client";

import React, { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Alert from "@/components/ui/alert/Alert";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import AlumniSqlForm from "@/components/forms/AlumniSqlForm";

type FormErrors = { identifier?: string; password?: string };

export default function SignInForm() {
  const { status, data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const { isOpen, openModal, closeModal } = useModal();

  useEffect(() => {
    const err = params.get("error");
    if (err === "USER_NOT_FOUND") setErrorMessage("User not registered");
    else if (err === "SAPID_NOT_REGISTERED") setErrorMessage("SAP ID not registered");
    else if (err === "EMAIL_NOT_REGISTERED") setErrorMessage("Email not registered");
    else if (err === "USER_BLOCKED") setErrorMessage("This account is blocked");
    else if (err === "INVALID_EMAIL") setErrorMessage("Invalid email received from provider");
    else if (err === "INVALID_IDENTIFIER") setErrorMessage("SAP ID or Email is required");
    else if (err === "RATE_LIMITED") setErrorMessage("Too many attempts. Try again later.");
    else setErrorMessage(null);
  }, [params]);

  const handleCredentials = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setErrorMessage(null);
      setVerificationError(null);
      setIsLoading(true);
      const nextErrors: FormErrors = {};
      if (!identifier.trim()) {
        nextErrors.identifier = "SAP ID or Email is required";
      }
      if (!password) {
        nextErrors.password = "Password is required";
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
      
      const isProd = process.env.NODE_ENV === "production";
      if (isProd && typeof window !== "undefined" && window.location.protocol !== "https:") {
        setErrorMessage("Insecure connection. Use HTTPS to sign in.");
        return;
      }
      
      // Use identifier field (can be SAP ID or Email)
      const result = await signIn("credentials", { identifier: identifier.trim(), password, redirect: false });
      
      if (result?.error) {
        const err = result.error ?? "LOGIN_FAILED";
        if (err === "INVALID_IDENTIFIER") setErrorMessage("SAP ID or Email is required");
        else if (err === "INVALID_EMAIL_FORMAT") setErrorMessage("Invalid email format (staff only)");
        else if (err === "INVALID_PASSWORD") setErrorMessage("Incorrect password");
        else if (err === "SAPID_NOT_REGISTERED") setErrorMessage("SAP ID not found");
        else if (err === "EMAIL_NOT_REGISTERED") setErrorMessage("Email not registered");
        else if (err === "USER_BLOCKED") setErrorMessage("This account is blocked");
        else if (err === "UNDER_APPROVAL") setErrorMessage("Your account is under approval. You will receive an email once it's verified.");
        else if (err === "USER_NOT_STAFF") setErrorMessage("Not an admin account");
        else if (err === "RATE_LIMITED") setErrorMessage("Too many attempts. Try again later.");
        else if (err === "DB_CONNECTION_ERROR") setErrorMessage("Server error. Please try again later.");
        else setErrorMessage("Sign-in failed");
        return;
      }
      
      setErrorMessage(null);
      
      // Successful login - wait for session to update then redirect
      setIsVerifying(true);
      
      // Poll for session update (session updates asynchronously)
      const checkSession = async () => {
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300));
          const newSession = await fetch("/api/auth/session").then(r => r.json()).catch(() => null);
          
          if (newSession?.user) {
            const userType = (newSession.user as { type?: string | null })?.type || "";
            const normalizedType = String(userType).toLowerCase().trim();
            // Treat "user" as "viewer" for backward compatibility
            const isAdmin = normalizedType === "admin";
            const isViewer = normalizedType === "viewer" || normalizedType === "user";
            const isAlumni = normalizedType === "alumni";
            
            // Both admin and viewer (including legacy "user") redirect to admin dashboard (/)
            if (isAdmin || isViewer) {
              router.replace("/");
              return;
            } else if (isAlumni) {
              router.replace("/alumni-profile");
              return;
            }
          }
          
          attempts++;
        }
        
        // If we can't determine type, redirect to alumni profile as default for alumni users
        // (Staff users should have been caught earlier)
        router.replace("/alumni-profile");
      };
      
      try {
        await checkSession();
      } catch (ve) {
        const msg = ve instanceof Error ? ve.message : String(ve);
        setVerificationError(msg || "Failed to verify session");
        router.replace("/alumni-profile"); // Default redirect
      } finally {
        setIsVerifying(false);
      }
    } catch {
      setErrorMessage("Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const t = String(((session.user ?? {}) as { type?: string }).type || "").toLowerCase().trim();
      // Both admin and viewer (including legacy "user") redirect to admin dashboard
      if (t === "admin" || t === "viewer" || t === "user") {
        router.replace("/");
      } else if (t === "alumni") {
        router.replace("/alumni-profile");
      }
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8 lg:gap-12">
        {/* Left Side - University Info */}
        <div className="flex-1 flex flex-col items-center lg:items-start justify-start text-center lg:text-left">
          <div className="mb-6 flex justify-center lg:justify-start">
            <Image src="/images/logo/login-1.jpg" alt="University Logo" width={128} height={128} className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 object-contain rounded-full bg-white p-2 shadow-lg" sizes="(max-width: 640px) 96px, (max-width: 1024px) 128px, 128px" priority />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8">
            University of Lahore
          </h1>
          <h4 className="text-sm sm:text-base lg:text-lg text-white/90 mb-5 sm:mb-6">Your gateway to alumni connections & opportunities</h4>
          <button type="button" onClick={openModal} className="w-full sm:w-auto bg-white text-green-700 px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold text-base sm:text-lg hover:bg-gray-100 transition-colors shadow-lg">
            Register Alumni
          </button>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 w-full">
          <div className="w-full max-w-md mx-auto rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-md bg-gray-100 dark:bg-white/10 bg-gray-600 flex items-center justify-center" aria-label="Logo">
                <Image src="/images/logo/login-1.jpg" alt="Logo" width={40} height={40} className="rounded" sizes="40px" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Welcome !</h1>
                <p className="text-xs sm:text-sm text-slate-600">Please Sign in to your portal</p>
    </div>
    <Modal isOpen={isOpen} onClose={closeModal} isFullscreen={true} showCloseButton={true}>
      <div className="fixed inset-0 flex flex-col overflow-y-auto bg-white dark:bg-gray-900 p-4 sm:p-6">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-semibold text-slate-900">Alumni Registration</h2>
          <button aria-label="Close" onClick={closeModal} className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">Close</button>
        </div>
        <div className="mt-4">
          <AlumniSqlForm excludeAdminStep={true} onSuccess={closeModal} />
        </div>
      </div>
    </Modal>
    </div>

            <form className="mt-4 space-y-4" onSubmit={handleCredentials} aria-label="SAP ID or Email sign in form">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-slate-700">SAP ID</label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter SAP ID"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  aria-invalid={!!errors.identifier}
                />
                {errors.identifier && <p className="mt-1 text-xs text-red-600" role="alert">{errors.identifier}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                </div>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-2 my-auto rounded-md px-2 text-sm text-slate-600 hover:text-slate-800"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600" role="alert">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="submit"
                  aria-label="Sign in"
                  aria-busy={isLoading || isVerifying}
                  disabled={isLoading || isVerifying || status === "loading"}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white text-sm font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
                >
                  {isLoading ? "Signing in..." : isVerifying ? "Verifying..." : "Sign In"}
                </button>
              </div>
            </form>

            <div role="status" aria-live="polite" className="mt-3 sm:mt-4 text-red-600 text-sm min-h-5">
              {errorMessage}
            </div>
            {verificationError && (
              <div className="mt-2">
                <Alert variant="error" title="Verification Failed" message={verificationError} />
              </div>
            )}

            <div className="mt-1 text-xs text-slate-600" aria-live="polite">
              {status === "authenticated" ? "Signed in" : status === "loading" ? "Checking session..." : "Not signed in"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function parseVerify(v: unknown): boolean {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return false;
  return s === "true" || s === "yes" || s === "verified" || s === "1";
}
