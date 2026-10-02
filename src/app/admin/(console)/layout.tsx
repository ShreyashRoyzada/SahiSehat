import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/server/admin";
import { adminSignOutAction } from "@/app/actions/admin";

export const metadata = { robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentAdmin();
  if (!actor) redirect("/admin/login");
  const links = [["/admin", "Overview"], ["/admin/products", "Products"], ["/admin/reports", "Lab reports & gate"], ["/admin/sources", "Sources"], ["/admin/rules", "Rules"], ["/admin/queue", "Queue"], ["/admin/audit", "Audit log"]];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink px-3 py-2 text-sm text-white">
        <span>Admin · signed in as <strong>{actor}</strong></span>
        <form action={adminSignOutAction}><button className="underline">Sign out</button></form>
      </div>
      <nav className="flex flex-wrap gap-1.5 text-sm" aria-label="Admin">
        {links.map(([href, label]) => <Link key={href} href={href} className="rounded-lg border border-line bg-white px-2.5 py-1.5 hover:border-brand-600/40">{label}</Link>)}
      </nav>
      {children}
    </div>
  );
}
