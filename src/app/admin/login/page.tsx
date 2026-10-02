import type { Metadata } from "next";
import { adminConfig } from "@/lib/server/admin";
import { AdminSignIn } from "@/components/AdminForms";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false } };

export default function AdminLogin() {
  const cfg = adminConfig();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Admin console</h1>
      {cfg.enabled ? <AdminSignIn twoFactor={cfg.twoFactor} devDefault={cfg.devDefault} /> : <p className="card p-4">Admin is disabled. Set ADMIN_PASSWORD and ADMIN_TOTP_SECRET.</p>}
    </div>
  );
}
