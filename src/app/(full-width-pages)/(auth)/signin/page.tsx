import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "UOL Alumni SignIn",
  description: "Sign in to your UOL Alumni account to access exclusive services and features.",
};

export default function SignIn() {
  return (
    <Suspense fallback={<div className="min-h-screen flex  items-center justify-center" aria-busy="true" aria-live="polite">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}
