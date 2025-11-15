"use client";

import React, { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export async function googleSignIn(callbackUrl: string = "/"): Promise<void> {
  await signIn("google", { callbackUrl, redirect: true });
}

export default function SignInForm() {
  const { status, data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const params = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    const err = params.get("error");
    if (err === "USER_NOT_FOUND") setErrorMessage("Email not registered");
    else if (err === "USER_BLOCKED") setErrorMessage("This account is blocked");
    else if (err === "INVALID_EMAIL") setErrorMessage("Invalid email received from provider");
    else if (err === "RATE_LIMITED") setErrorMessage("Too many attempts. Try again later.");
    else setErrorMessage(null);
  }, [params]);

  

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
      const result = await signIn("credentials", { email: email.trim(), password: password, redirect: false,  });
      if (result?.error) {
        const err = result.error ?? "LOGIN_FAILED";
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
      // rely on useEffect redirect once session becomes authenticated
    } catch {
      setErrorMessage("Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
    
      const t = String(((session.user ?? {}) as { type?: string }).type || "").toLowerCase();
      const dest = t === "staff" ? "/" : "/alumni-profile";
      router.replace(dest);
    }
  }, [status, session, router]);

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
