import Link from "next/link";
import { appDb } from "@/lib/server/db";
import { publishBlockers } from "@/lib/publish";
import type { Product } from "@/lib/types";

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  const sp = await searchParams;
  const filter = typeof sp.f === "string" ? sp.f : "";
  let products = (appDb().prepare("SELECT data FROM products ORDER BY id").all() as { data: string }[]).map((r) => JSON.parse(r.data) as Product);
  if (filter === "unverified") products = products.filter((p) => !p.labelSource.verified);
  if (filter === "missing") products = products.filter((p) => p.labelSource.kind === "missing");
  if (filter === "published") products = products.filter((p) => p.status === "published");
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Products ({products.length})</h1>
      <div className="flex gap-2 text-sm">
        {[["", "All"], ["unverified", "Label not verified"], ["missing", "Label missing"], ["published", "Published"]].map(([f, l]) => <Link key={f} className={`rounded-lg border px-2 py-1 ${filter === f ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`} href={`/admin/products${f ? `?f=${f}` : ""}`}>{l}</Link>)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-1.5">Product</th><th>Status</th><th>Label</th><th>Blocks publish</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-line/60 align-top">
                <td className="py-1.5 pr-2"><Link className="underline" href={`/admin/products/${p.id}`}>{p.brand} {p.name}</Link><div className="text-xs text-muted">{p.category} · v{p.version}</div></td>
                <td className="pr-2">{p.status}</td>
                <td className="pr-2">{p.labelSource.verified ? "verified" : p.labelSource.kind}</td>
                <td className="text-xs text-muted">{publishBlockers(p).join(", ") || "ready"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
