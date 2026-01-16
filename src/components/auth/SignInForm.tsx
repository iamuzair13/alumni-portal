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
  const { status } = useSession();
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
  
  // Forgot Password states
  const { isOpen: isForgotPasswordOpen, openModal: openForgotPassword, closeModal: closeForgotPassword } = useModal();
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const err = params.get("error");
    if (err === "USER_NOT_FOUND") setErrorMessage("User not registered");
    else if (err === "SAPID_NOT_REGISTERED") setErrorMessage("SAP ID or Registration Number not found");
    else if (err === "EMAIL_NOT_REGISTERED") setErrorMessage("Email not registered");
    else if (err === "USER_BLOCKED") setErrorMessage("This account is blocked");
    else if (err === "INVALID_EMAIL") setErrorMessage("Invalid email received from provider");
    else if (err === "INVALID_IDENTIFIER") setErrorMessage("SAP ID, Registration Number, or Email is required");
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
        nextErrors.identifier = "SAP ID, Registration Number, or Email is required";
      }
      if (!password) {
        nextErrors.password = "Password is required";
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        setIsLoading(false);
        return;
      }
      
      const isProd = process.env.NODE_ENV === "production";
      if (isProd && typeof window !== "undefined" && window.location.protocol !== "https:") {
        setErrorMessage("Insecure connection. Use HTTPS to sign in.");
        setIsLoading(false);
        return;
      }
      
      // Use identifier field (can be SAP ID or Email)
      const result = await signIn("credentials", { identifier: identifier.trim(), password, redirect: false });
      
      if (result?.error) {
        const err = result.error ?? "LOGIN_FAILED";
        if (err === "INVALID_IDENTIFIER") setErrorMessage("SAP ID, Registration Number, or Email is required");
        else if (err === "INVALID_EMAIL_FORMAT") setErrorMessage("Invalid email format (staff only)");
        else if (err === "INVALID_PASSWORD") setErrorMessage("Incorrect password");
        else if (err === "SAPID_NOT_REGISTERED") setErrorMessage("SAP ID or Registration Number not found");
        else if (err === "EMAIL_NOT_REGISTERED") setErrorMessage("Email not registered");
        else if (err === "USER_BLOCKED") setErrorMessage("This account is blocked");
        else if (err === "UNDER_APPROVAL") setErrorMessage("Your account is under approval. You will receive an email once it's verified.");
        else if (err === "USER_NOT_STAFF") setErrorMessage("Not an admin account");
        else if (err === "RATE_LIMITED") setErrorMessage("Too many attempts. Try again later.");
        else if (err === "DB_CONNECTION_ERROR") setErrorMessage("Server error. Please try again later.");
        else setErrorMessage("Sign-in failed");
        setIsLoading(false);
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
            const isSuperAdmin = normalizedType === "superadmin";
            const isViewer = normalizedType === "viewer" || normalizedType === "user";
            const isAlumni = normalizedType === "alumni";
            
            // Admin, Super Admin, and viewer (including legacy "user") redirect to admin dashboard
            if (isAdmin || isSuperAdmin || isViewer) {
              // Keep loading state active during redirect
              router.replace("/dashboard");
              // Don't set isVerifying to false - let it stay until page navigates
              return;
            } else if (isAlumni) {
              router.replace("/alumni-profile");
              // Don't set isVerifying to false - let it stay until page navigates
              return;
            }
          }
          
          attempts++;
        }
        
        // If we can't determine type, check one more time and redirect accordingly
        const finalSession = await fetch("/api/auth/session").then(r => r.json()).catch(() => null);
        if (finalSession?.user) {
          const userType = (finalSession.user as { type?: string | null })?.type || "";
          const normalizedType = String(userType).toLowerCase().trim();
          const isStaff = normalizedType === "admin" || normalizedType === "superadmin" || normalizedType === "viewer" || normalizedType === "user";
          if (isStaff) {
            router.replace("/dashboard");
            // Don't set isVerifying to false - let it stay until page navigates
            return;
          }
        }
        // Default to alumni profile for alumni users
        router.replace("/alumni-profile");
        // Don't set isVerifying to false - let it stay until page navigates
      };
      
      try {
        await checkSession();
        // Keep isVerifying true during redirect - it will be cleared when component unmounts
      } catch (ve) {
        const msg = ve instanceof Error ? ve.message : String(ve);
        setVerificationError(msg || "Failed to verify session");
        // Try to determine user type for redirect
        try {
          const finalSession = await fetch("/api/auth/session").then(r => r.json()).catch(() => null);
          if (finalSession?.user) {
            const userType = (finalSession.user as { type?: string | null })?.type || "";
            const normalizedType = String(userType).toLowerCase().trim();
            const isStaff = normalizedType === "admin" || normalizedType === "superadmin" || normalizedType === "viewer" || normalizedType === "user";
            if (isStaff) {
              router.replace("/dashboard");
            } else {
              router.replace("/alumni-profile");
            }
          } else {
            router.replace("/alumni-profile"); // Default redirect
          }
        } catch {
          router.replace("/alumni-profile"); // Default redirect on error
        }
        // Only set to false on error, not on successful redirect
        setIsVerifying(false);
      }
    } catch {
      setErrorMessage("Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Removed automatic redirect on authentication to prevent redirect loops
  // Redirects are now handled in the handleCredentials function after successful login

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setForgotPasswordLoading(true);
      setForgotPasswordError(null);
      setForgotPasswordMessage(null);

      if (!forgotPasswordEmail.trim()) {
        setForgotPasswordError("Email is required");
        setForgotPasswordLoading(false);
        return;
      }

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setForgotPasswordMessage(data.message || "A new password has been sent to your email address.");
        setForgotPasswordEmail("");
        // Close modal after 3 seconds
        setTimeout(() => {
          closeForgotPassword();
          setForgotPasswordMessage(null);
        }, 3000);
      } else {
        setForgotPasswordError(data.error || "Failed to reset password. Please try again.");
      }
    } catch (err) {
      setForgotPasswordError("An error occurred. Please try again later.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const isProcessing = isLoading || isVerifying;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center px-4 py-6 sm:py-8 relative">
      {/* Full-page loading overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">
                {isLoading ? "Signing in..." : "Verifying session..."}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {isLoading ? "Please wait while we verify your credentials" : "Redirecting you to your dashboard"}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className={`w-full max-w-6xl flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8 lg:gap-12 ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Left Side - University Info */}
        <div className="flex-1 flex flex-col items-center lg:items-start justify-start text-center lg:text-left">
          <div className="mb-6 flex justify-center lg:justify-start">
            <Image src="/images/logo/UOL-Rebrand-ID_Final-02.png" alt="University Logo" width={128} height={128} className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 object-contain rounded-full bg-white p-2 shadow-lg" sizes="(max-width: 640px) 96px, (max-width: 1024px) 128px, 128px" priority />
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
                <Image src="/images/logo/UOL-Rebrand-ID_Final-02.png" alt="Logo" width={40} height={40} className="rounded" sizes="40px" />
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

    {/* Forgot Password Modal */}
    <Modal isOpen={isForgotPasswordOpen} onClose={closeForgotPassword} isFullscreen={false} showCloseButton={true}>
      <div className="w-full lg:w-1/2 max-w-md mx-auto bg-white rounded-2xl p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Reset Your Password</h2>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email address and we&apos;ll send you a new password.
          </p>
        </div>

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label htmlFor="forgot-password-email" className="block text-sm font-medium text-slate-700">
              Email Address
            </label>
            <input
              id="forgot-password-email"
              type="email"
              placeholder="Enter your personal email"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              disabled={forgotPasswordLoading}
            />
            <p className="mt-1 text-xs text-slate-500">
              Enter the email address registered in your personal email field
            </p>
          </div>

          {forgotPasswordError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{forgotPasswordError}</p>
            </div>
          )}

          {forgotPasswordMessage && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3">
              <p className="text-sm text-green-600">{forgotPasswordMessage}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeForgotPassword}
              disabled={forgotPasswordLoading}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={forgotPasswordLoading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {forgotPasswordLoading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {forgotPasswordLoading ? "Sending..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
    </div>

            <form className="mt-4 space-y-4" onSubmit={handleCredentials} aria-label="SAP ID, Registration Number, or Email sign in form">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-slate-700">SAP ID or Registration Number</label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter SAP ID or Registration Number"
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
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Forgot Password?
                  </button>
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
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white text-sm font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {(isLoading || isVerifying) && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
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
