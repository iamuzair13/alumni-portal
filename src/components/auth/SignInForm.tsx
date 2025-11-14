"use client";

import React, { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export async function googleSignIn(callbackUrl: string = "/"): Promise<void> {
  await signIn("google", { callbackUrl, redirect: true });
}

export default function SignInForm() {
  const { status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const params = useSearchParams();

  React.useEffect(() => {
    const err = params.get("error");
    if (err === "USER_NOT_FOUND") setErrorMessage("Email not registered");
    else if (err === "USER_BLOCKED") setErrorMessage("This account is blocked");
    else if (err === "INVALID_EMAIL") setErrorMessage("Invalid email received from provider");
    else if (err === "RATE_LIMITED") setErrorMessage("Too many attempts. Try again later.");
    else setErrorMessage(null);
  }, [params]);

  const handleGoogle = async () => {
    try {
      setIsLoading(true);
      await googleSignIn("/");
    } catch {
      setErrorMessage("Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentials = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setErrorMessage(null);
      setIsLoading(true);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isProd = process.env.NODE_ENV === "production";
      if (!emailRegex.test(email.trim())) {
        setErrorMessage("Invalid email format");
        return;
      }
      if (isProd && typeof window !== "undefined" && window.location.protocol !== "https:") {
        setErrorMessage("Insecure connection. Use HTTPS to sign in.");
        return;
      }
      const res = await signIn("credentials", { email: email.trim(), password: password, redirect: false });
      if (!res || res.error) {
        const err = res?.error ?? "LOGIN_FAILED";
        if (err === "INVALID_EMAIL_FORMAT") setErrorMessage("Invalid email format");
        else if (err === "INVALID_PASSWORD") setErrorMessage("Incorrect password");
        else if (err === "EMAIL_NOT_REGISTERED") setErrorMessage("User account does not exist");
        else if (err === "USER_BLOCKED") setErrorMessage("This account is blocked");
        else if (err === "USER_NOT_STAFF") setErrorMessage("Not an admin account");
        else if (err === "RATE_LIMITED") setErrorMessage("Too many attempts. Try again later.");
        else if (err === "DB_CONNECTION_ERROR") setErrorMessage("Server error. Please try again later.");
        else setErrorMessage("Sign-in failed");
        return;
      }
      setErrorMessage(null);
    } catch {
      setErrorMessage("Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="grid md:grid-cols-2 items-center gap-6 max-md:gap-8 max-w-6xl max-md:max-w-lg w-full p-4 [box-shadow:0_2px_10px_-3px_rgba(6,81,237,0.3)] rounded-md">
        <div className="md:max-w-md w-full px-4 py-4">
          <form className="mt-6 space-y-4" onSubmit={handleCredentials} aria-label="Email sign in form">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errorMessage && /email/i.test(errorMessage)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                aria-label="Sign in"
                aria-busy={isLoading}
                disabled={isLoading || status === "loading"}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogle}
              aria-label="Continue with Google"
              aria-busy={isLoading}
              disabled={isLoading || status === "loading"}
              className="w-full shadow-xl py-2.5 px-4 text-sm font-medium tracking-wide rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
                <path fill="#fbbd00" d="M120 256c0-25.367 6.989-49.13 19.131-69.477v-86.308H52.823C18.568 144.703 0 198.922 0 256s18.568 111.297 52.823 155.785h86.308v-86.308C126.989 305.13 120 281.367 120 256z" />
                <path fill="#0f9d58" d="m256 392-60 60 60 60c57.079 0 111.297-18.568 155.785-52.823v-86.216h-86.216C305.044 385.147 281.181 392 256 392z" />
                <path fill="#31aa52" d="m139.131 325.477-86.308 86.308a260.085 260.085 0 0 0 22.158 25.235C123.333 485.371 187.62 512 256 512V392c-49.624 0-93.117-26.72-116.869-66.523z" />
                <path fill="#3c79e6" d="M512 256a258.24 258.24 0 0 0-4.192-46.377l-2.251-12.299H256v120h121.452a135.385 135.385 0 0 1-51.884 55.638l86.216 86.216a260.085 260.085 0 0 0 25.235-22.158C485.371 388.667 512 324.38 512 256z" />
                <path fill="#cf2d48" d="m352.167 159.833 10.606 10.606 84.853-84.852-10.606-10.606C388.668 26.629 324.381 0 256 0l-60 60 60 60c36.326 0 70.479 14.146 96.167 39.833z" />
                <path fill="#eb4132" d="M256 120V0C187.62 0 123.333 26.629 74.98 74.98a259.849 259.849 0 0 0-22.158 25.235l86.308 86.308C162.883 146.72 206.376 120 256 120z" />
              </svg>
              <span>{isLoading ? "Signing in..." : "Continue with Google"}</span>
            </button>
          </div>

          <div role="status" aria-live="polite" className="mt-4 text-red-600 text-sm min-h-5">
            {errorMessage}
          </div>

          <div className="mt-2 text-xs text-slate-600" aria-live="polite">
            {status === "authenticated" ? "Signed in" : status === "loading" ? "Checking session..." : "Not signed in"}
          </div>
        </div>

      </div>
    </div>
  );
}
