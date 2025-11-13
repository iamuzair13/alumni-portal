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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="grid md:grid-cols-2 items-center gap-4 max-md:gap-8 max-w-6xl max-md:max-w-lg w-full p-4 [box-shadow:0_2px_10px_-3px_rgba(6,81,237,0.3)] rounded-md">
        <div className="md:max-w-md w-full px-4 py-4">
          <div className="mt-12">
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

        <div className="w-full h-full flex items-center bg-[#000842] rounded-xl p-8">
          <img src="https://readymadeui.com/signin-image.webp" className="w-full aspect-[12/12] object-contain" alt="login illustration" />
        </div>
      </div>
    </div>
  );
}
