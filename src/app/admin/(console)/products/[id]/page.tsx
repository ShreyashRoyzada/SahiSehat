import Link from "next/link";
import { notFound } from "next/navigation";
import { appDb } from "@/lib/server/db";
import { publishBlockers } from "@/lib/publish";
import { setProductStatusAction } from "@/app/actions/admin";
import { ProductEditor } from "@/components/AdminForms";
import type { Product } from "@/lib/types";

export default async function AdminProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const row = appDb().prepare("SELECT data FROM products WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) notFound();
  const p = JSON.parse(row.data) as Product;
  const versions = appDb().prepare("SELECT version, created_at, created_by FROM product_versions WHERE id = ? ORDER BY version DESC").all(id) as { version: number; created_at: string; created_by: string }[];
  const blockers = publishBlockers(p);
  const n = p.nutritionPer100;
  return (
    <div className="space-y-4">
      <div>
        <Link className="text-sm underline" href="/admin/products">← Products</Link>
        <h1 className="text-2xl font-bold">{p.brand} {p.name}</h1>
        <p className="text-sm text-muted">{p.id} · version {p.version} · {p.status} · <Link className="underline" href={`/p/${p.id}`}>public page</Link></p>
      </div>
      {sp.blocked && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm text-bad">Can&apos;t publish. Missing: {String(sp.blocked)}</p>}
      <div className="card flex flex-wrap items-center justify-between gap-2 p-3">
        <span className="text-sm">{blockers.length ? `Publish needs: ${blockers.join(", ")}` : "Ready to publish."}</span>
        <form action={setProductStatusAction}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="status" value={p.status === "published" ? "draft" : "published"} />
          <button className="btn btn-secondary">{p.status === "published" ? "Unpublish" : "Publish"}</button>
        </form>
      </div>
      <div className="card p-4">
        <ProductEditor>
          <input type="hidden" name="id" value={p.id} />
          <div className="grid gap-2 sm:grid-cols-3">
            <div><label className="label" htmlFor="gtin">GTIN</label><input id="gtin" name="gtin" className="input" defaultValue={p.gtin ?? ""} /></div>
            <div><label className="label" htmlFor="fssai">FSSAI licence</label><input id="fssai" name="fssai" className="input" defaultValue={p.fssaiLicence ?? ""} /></div>
            <div><label className="label" htmlFor="servingSize">Serving ({p.unit})</label><input id="servingSize" name="servingSize" className="input" defaultValue={p.servingSize ?? ""} /></div>
          </div>
          <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <legend className="label">Nutrition per 100 {p.unit} (blank = not on label)</legend>
            {(Object.keys(n) as (keyof typeof n)[]).map((k) => (
              <div key={k}><label className="text-xs" htmlFor={`n-${k}`}>{k}</label><input id={`n-${k}`} name={`n.${k}`} className="input" defaultValue={n[k] ?? ""} /></div>
            ))}
          </fieldset>
          <div><label className="label" htmlFor="ingredients">Ingredients (one per line, in label order)</label><textarea id="ingredients" name="ingredients" className="input min-h-28" defaultValue={p.ingredients.join("\n")} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label className="label" htmlFor="contains">Contains (comma-separated codes)</label><input id="contains" name="contains" className="input" defaultValue={p.allergens.contains.join(", ")} /></div>
            <div><label className="label" htmlFor="mayContain">May contain</label><input id="mayContain" name="mayContain" className="input" defaultValue={p.allergens.mayContain.join(", ")} /></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label className="label" htmlFor="nova">NOVA group</label><input id="nova" name="nova" className="input" defaultValue={p.nova ?? ""} /></div>
            <div><label className="label" htmlFor="vegMark">Diet mark</label><select id="vegMark" name="vegMark" className="input" defaultValue={p.vegMark ?? ""}><option value="">unknown</option><option value="veg">veg</option><option value="non-veg">non-veg</option></select></div>
          </div>
          <div><label className="label" htmlFor="claims">Front-of-pack claims (one per line)</label><textarea id="claims" name="claims" className="input" defaultValue={p.claims.join("\n")} /></div>
          <div><label className="label" htmlFor="sourceLinks">Source links (one per line)</label><textarea id="sourceLinks" name="sourceLinks" className="input" defaultValue={p.sourceLinks.join("\n")} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" defaultChecked={p.labelSource.verified} className="h-5 w-5" /> I checked every value above against the pack photo</label>
        </ProductEditor>
      </div>
      <div className="card p-4 text-sm">
        <h2 className="font-bold">Versions</h2>
        <ul>{versions.map((v) => <li key={v.version}>v{v.version} · {v.created_at.slice(0, 16).replace("T", " ")} · {v.created_by}</li>)}</ul>
      </div>
    </div>
  );
}
