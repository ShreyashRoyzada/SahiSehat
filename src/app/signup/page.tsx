import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Join the beta" };

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Join the invite-only beta</h1>
      <p className="text-muted">For adults managing blood sugar, cholesterol or blood pressure.</p>
      <SignUpForm />
      <p className="text-sm">Already have an account? <Link className="underline" href="/login">Sign in</Link>.</p>
    </div>
  );
}
