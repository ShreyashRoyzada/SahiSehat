import type { Metadata } from "next";
import Link from "next/link";
import { categories, matchByUrl, searchViews } from "@/lib/server/catalogue";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { fitFor, personContext, trackEvent } from "@/lib/server/person";
import { SearchBox } from "@/components/SearchBox";
import { ProductCard } from "@/components/ProductCard";
import { RequestProduct } from "@/components/RequestProduct";
import { verdictRank } from "@/lib/fit/engine";
import type { EvidenceLevel } from "@/lib/quality";

export const metadata: Metadata = { title: "Search" };

const EVIDENCE: { value: EvidenceLevel | ""; label: string }[] = [
  { value: "", label: "Any evidence" },
  { value: "lab-verified", label: "Lab-verified" },
  { value: "label-analysed", label: "Label-analysed" },
  { value: "insufficient", label: "Insufficient data" },
];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const evidence = typeof sp.evidence === "string" ? sp.evidence : "";
  const fitFilter = typeof sp.fit === "string" ? sp.fit : "";
  // A pasted quick-commerce link opens the product directly (iPhone fallback for share-in).
  if (/^https?:\/\//.test(q.trim())) {
    const hit = matchByUrl(q.trim());
    if (hit) redirect(`/p/${hit.product.id}`);
  }
  const account = await currentAccount();
  const ctx = account ? personContext(account.id) : null;

  let results = searchViews(q, { category: category || undefined, limit: 200 }).map((v) => ({ v, fit: ctx ? fitFor(ctx, v) : null }));
  if (evidence) results = results.filter((r) => r.v.quality.evidence === evidence);
  if (fitFilter && ctx) {
    results = results.filter((r) => (fitFilter === "good" ? r.fit?.verdict === "good" : fitFilter === "ok" ? ["good", "small"].includes(r.fit?.verdict ?? "") : true));
  }
  if (!q && ctx) results.sort((a, b) => verdictRank(a.fit!.verdict) - verdictRank(b.fit!.verdict) || (b.v.quality.score ?? -1) - (a.v.quality.score ?? -1));
  if (q) trackEvent(account?.id ?? null, "search");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{category && !q ? category : "Search"}</h1>
      <SearchBox defaultValue={q} category={category || undefined} autoFocus={!q && !category} />
      <form className="flex flex-wrap gap-2 text-sm" action="/search">
        <input type="hidden" name="q" value={q} />
        <select name="category" defaultValue={category} className="input w-auto min-w-0 flex-1" aria-label="Category">
          <option value="">All categories</option>
          {categories().map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select name="evidence" defaultValue={evidence} className="input w-auto min-w-0 flex-1" aria-label="Evidence level">
          {EVIDENCE.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        {ctx && (
          <select name="fit" defaultValue={fitFilter} className="input w-auto min-w-0 flex-1" aria-label="Fit">
            <option value="">Any Fit</option>
            <option value="good">Good fit only</option>
            <option value="ok">Good fit or small portions</option>
          </select>
        )}
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      <p className="text-sm text-muted" aria-live="polite">
        {results.length} product{results.length === 1 ? "" : "s"}
        {ctx ? " · ranked for your numbers" : ""}
      </p>
      <div className="grid gap-2.5">
        {results.map(({ v, fit }) => (
          <ProductCard key={v.product.id} product={v.product} quality={v.quality} fit={fit} hasLab={v.reports.some((r) => r.status !== "external-rating")} />
        ))}
      </div>
      {results.length === 0 && (
        <div className="card space-y-3 p-4">
          <p>We don&apos;t have that product yet.</p>
          <RequestProduct defaultText={q} />
        </div>
      )}
      {!ctx && results.length > 0 && (
        <p className="hint">
          <Link className="underline" href="/start">Add your numbers</Link> to see which of these are sahi for you.
        </p>
      )}
    </div>
  );
}
