import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/AuthForms";
import { startDemoAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <SignInForm next={typeof sp.next === "string" ? sp.next : undefined} />
      <p className="text-sm">New here? SahiSehat is invite-only during the beta. <Link className="underline" href="/signup">Use an invite code</Link>.</p>
      <form action={startDemoAction} className="card space-y-2 p-4">
        <p className="text-sm">No invite yet? Explore with Riya, a fictional profile, for 24 hours. Nothing you do is kept.</p>
        <button className="btn btn-secondary">Try the Riya demo</button>
      </form>
    </div>
  );
}
