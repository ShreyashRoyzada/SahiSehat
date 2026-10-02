import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { activeRules, getView } from "@/lib/server/catalogue";
import { currentAccount } from "@/lib/server/auth";
import { fitFor, personContext, savedProducts, swapsFor, trackEvent } from "@/lib/server/person";
import { perServing } from "@/lib/fit/engine";
import { ALLERGEN_LABELS, detectedAllergens } from "@/lib/ingredients";
import { formatDate } from "@/lib/dates";
import type { Allergen, NutrientKey } from "@/lib/types";
import { EvidenceChip, Pill, ScoreBadge, VerdictBadge } from "@/components/Badges";
import { PreviewNotice } from "@/components/PreviewNotice";
import { FlagButton } from "@/components/FlagButton";
import { saveSwapAction, removeSavedAction } from "@/app/actions/profile";
import { startDemoAction } from "@/app/actions/auth";
import { unitPrice } from "@/lib/swaps";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const v = getView((await params).id);
  if (!v) return { title: "Product not found" };
  return {
    title: `${v.product.brand} ${v.product.name}`,
    description: `Quality Score ${v.quality.score ?? "n/a"} (${v.quality.band ?? "insufficient data"}) for ${v.product.brand} ${v.product.name}. Check whether it fits your blood sugar, cholesterol and blood pressure numbers.`,
  };
}

const ROWS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: "energyKcal", label: "Energy", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbohydrate", label: "Carbohydrate", unit: "g" },
  { key: "totalSugar", label: "Total sugar", unit: "g" },
  { key: "addedSugar", label: "Added sugar", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "saturatedFat", label: "Saturated fat", unit: "g" },
  { key: "transFat", label: "Trans fat", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
  { key: "fibre", label: "Fibre", unit: "g" },
];

function fmt(n: number | null, unit: string) {
  if (n === null) return "—";
  const v = unit === "mg" || unit === "kcal" ? Math.round(n).toLocaleString("en-IN") : (Math.round(n * 10) / 10).toString();
  return `${v} ${unit}`;
}

export default async function ProductPage({ params, searchParams }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const v = getView(id);
  if (!v) notFound();
  const { product, quality } = v;
  const account = await currentAccount();
  const ctx = account ? personContext(account.id) : null;
  const fit = ctx ? fitFor(ctx, v, { record: true }) : null;
  if (fit) trackEvent(account!.id, "verdict_view", product.id);
  if (typeof sp.from === "string") trackEvent(account?.id ?? null, "swap_open", product.id);
  const swaps = swapsFor(ctx, v);
  const saved = account ? new Set(savedProducts(account.id)) : new Set<string>();
  const rules = activeRules();
  const allergens = [...new Set([...product.allergens.contains, ...detectedAllergens(product.ingredients)])] as Allergen[];
  const own = v.reports.filter((r) => r.status !== "external-rating");
  const external = v.reports.filter((r) => r.status === "external-rating");

  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <Link href={`/search?category=${encodeURIComponent(product.category)}`} className="text-sm text-brand-700 underline">{product.category}</Link>
        <p className="text-sm font-medium uppercase tracking-wide text-muted">{product.brand}</p>
        <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
        <p className="text-sm text-muted">
          Serving on the label: {product.servingSize ? `${product.servingSize} ${product.unit}` : "not captured"}
          {product.price && ` · ₹${product.price.amount} for ${product.price.packQty >= 1000 ? `${product.price.packQty / 1000} ${product.unit === "g" ? "kg" : "L"}` : `${product.price.packQty} ${product.unit}`} on ${product.price.platform} (seen ${formatDate(product.price.capturedAt)})`}
        </p>
      </header>

      <PreviewNotice compact />

      {/* Fit verdict (C3) */}
      <section aria-labelledby="fit-h" className="card space-y-3 p-4">
        <h2 id="fit-h" className="text-lg font-bold">Is it sahi for me?</h2>
        {fit ? (
          <>
            {fit.verdict === "no-verdict" ? (
              <div className="space-y-2">
                <VerdictBadge verdict="no-verdict" size="lg" />
                <p className="text-sm">{fit.note}</p>
              </div>
            ) : (
              <>
                <VerdictBadge verdict={fit.verdict} size="lg" />
                {fit.reasons.length > 0 && (
                  <ul className="space-y-2">
                    {fit.reasons.map((r, i) => (
                      <li key={i} className="rounded-lg bg-paper p-2.5 text-sm">
                        <p className="font-medium">{r.text}</p>
                        {r.trigger && <p className="text-muted">{r.trigger}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {fit.note && <p className="text-sm text-muted">{fit.note}</p>}
                <details className="rounded-lg border border-line p-2.5 text-sm">
                  <summary className="cursor-pointer font-medium">Why? Rules, numbers and sources</summary>
                  <div className="mt-2 space-y-1.5">
                    <p>Rule table v{fit.ruleVersion} ({rules.status === "approved" ? `signed by ${rules.approval.approver}` : "placeholder, not yet clinically signed"}). Rule sets switched on: {fit.ruleSets.length ? fit.ruleSets.join(", ") : "none"}.</p>
                    {fit.reasons.map((r, i) => (
                      <p key={i}>
                        <code className="rounded bg-paper px-1">{r.ruleId}</code>{" "}
                        {r.perServing !== undefined && r.dailyLimit !== undefined
                          ? `${fmt(r.perServing, r.unit ?? "g")} per serving ÷ ${fmt(r.dailyLimit, r.unit ?? "g")} daily limit = ${Math.round((r.share ?? 0) * 100)}%. Bands: up to ${rules.bands.good * 100}% good fit, up to ${rules.bands.small * 100}% small portions.`
                          : r.text}
                      </p>
                    ))}
                    <p>Sources: {Object.values(rules.dailyLimits).filter((l) => l.amount > 0).map((l) => l.source).join(" ")}</p>
                    <p className="text-xs text-muted">Verdict record {fit.inputsHash.slice(0, 12)} · product v{product.version}</p>
                  </div>
                </details>
              </>
            )}
          </>
        ) : (
          <div className="space-y-2 text-sm">
            <p>Add your numbers to see whether one serving fits your own daily limits for sugar, saturated fat and sodium.</p>
            <div className="flex flex-wrap gap-2">
              {account ? (
                <Link href="/start" className="btn btn-primary">Add my numbers</Link>
              ) : (
                <form action={startDemoAction}>
                  <button className="btn btn-primary">See it as Riya (demo)</button>
                </form>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Quality Score and evidence (A3, A4) */}
      <section aria-labelledby="q-h" className="card space-y-3 p-4">
        <h2 id="q-h" className="sr-only">Quality Score</h2>
        <ScoreBadge quality={quality} />
        {quality.score !== null && (
          <dl className="grid grid-cols-4 gap-2 text-center text-xs">
            {(["N", "I", "H", "L"] as const).map((k) => (
              <div key={k} className="rounded-lg bg-paper p-2">
                <dt className="text-muted">{{ N: "Nutrition", I: "Ingredients", H: "Label honesty", L: "Lab safety" }[k]}</dt>
                <dd className="text-base font-semibold">{quality.pillars[k] ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {quality.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <div className="space-y-2">
          <h3 className="font-semibold">Lab evidence</h3>
          {own.length === 0 && external.length === 0 && <p className="text-sm text-muted">No public lab report found for this product yet.</p>}
          {own.map((d) => (
            <div key={d.report.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${d.tone === "pass" ? "bg-good-bg text-good" : d.tone === "fail" ? "bg-bad-bg text-bad" : d.tone === "stale" ? "bg-small-bg text-small" : "bg-neutral-bg text-neutral"}`}>{d.label}</span>
                <span className="text-muted">{d.report.source}</span>
              </div>
              {d.showDetails ? (
                <p className="mt-1.5">Lab: {d.report.lab ?? "not shown"} · Batch: {d.report.batch ?? "not shown"} · Report date: {formatDate(d.report.reportDate)}</p>
              ) : (
                <p className="mt-1.5 text-muted">
                  {d.status === "expired" ? "The source marks this report as expired." : "We show the verdict, batch and date once our licence to display this source and, for any negative finding, our publication review are complete."}
                </p>
              )}
              <a className="mt-1.5 inline-block font-medium text-brand-700 underline" href={d.report.url} target="_blank" rel="noopener noreferrer">Open the original report ↗</a>
            </div>
          ))}
          {external.map((d) => (
            <p key={d.report.id} className="text-sm">
              Also rated by a third party: <a className="text-brand-700 underline" href={d.report.url} target="_blank" rel="noopener noreferrer">Unbox Health ↗</a> (link out only)
            </p>
          ))}
          {v.swapBlock && <p className="rounded-lg bg-small-bg p-2.5 text-sm">{v.swapBlock}</p>}
        </div>
      </section>

      {/* Swaps (E1) */}
      <section aria-labelledby="swap-h" className="space-y-2.5">
        <h2 id="swap-h" className="text-lg font-bold">Better swaps</h2>
        {swaps.swaps.length === 0 ? (
          <p className="card p-3.5 text-sm text-muted">{swaps.reason}</p>
        ) : (
          swaps.swaps.map((s) => (
            <div key={s.product.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/p/${s.product.id}?from=${product.id}`} className="min-w-0 hover:underline">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">{s.product.brand}</div>
                  <div className="font-semibold">{s.product.name}</div>
                </Link>
                <ScoreBadge quality={s.quality} size="sm" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.fit && s.fit.verdict !== "cant-tell" && <VerdictBadge verdict={s.fit.verdict} size="sm" />}
                <EvidenceChip level={s.quality.evidence} />
                {s.unitPrice !== null && <Pill>₹{s.unitPrice.toFixed(0)} per 100 {s.product.unit}</Pill>}
              </div>
              {s.differences.length > 0 && <p className="mt-1.5 text-sm font-medium text-brand-800">{s.differences.join(" · ")}</p>}
              {account && (
                <form action={saved.has(s.product.id) ? removeSavedAction : saveSwapAction} className="mt-2">
                  <input type="hidden" name="productId" value={s.product.id} />
                  <input type="hidden" name="from" value={product.id} />
                  <button className="text-sm font-medium text-brand-700 underline">{saved.has(s.product.id) ? "Saved ✓ (remove)" : "Save to my list"}</button>
                </form>
              )}
            </div>
          ))
        )}
        <p className="hint">Ranked by your Fit, then Quality Score, then price per 100 g. Commission never affects this order.</p>
      </section>

      {/* Where to buy (E2) */}
      <section aria-labelledby="buy-h" className="card space-y-2 p-4">
        <h2 id="buy-h" className="text-lg font-bold">Where to buy</h2>
        {v.listings.length === 0 ? (
          <p className="text-sm text-muted">We haven&apos;t captured a quick-commerce listing for this product yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {v.listings.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <span>
                  <strong>{l.platform}</strong>: {l.seen}
                  {l.ratingsCount ? <span className="text-muted"> · {l.ratingsCount.toLocaleString("en-IN")} ratings</span> : null}
                </span>
                <a className="shrink-0 font-medium text-brand-700 underline" href={`/go/${product.id}?i=${i}`} target="_blank" rel="noopener noreferrer nofollow">Open ↗</a>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Links to listings we saw on {formatDate(v.listings[0]?.capturedAt ?? "2026-10-02")} without a delivery pincode; prices and stock change. These are plain links: we don&apos;t earn a commission from them yet, and if we ever do we&apos;ll say so here.</p>
      </section>

      {/* Label */}
      <section aria-labelledby="label-h" className="card space-y-3 p-4">
        <h2 id="label-h" className="text-lg font-bold">From the label</h2>
        <p className={`rounded-lg p-2.5 text-sm ${product.labelSource.verified ? "bg-good-bg" : "bg-small-bg"}`}>
          {product.labelSource.verified ? `Checked against the pack${product.labelSource.verifiedAt ? ` on ${formatDate(product.labelSource.verifiedAt)}` : ""}.` : product.labelSource.note}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 font-medium">Nutrient</th>
                <th className="py-1.5 text-right font-medium">Per 100 {product.unit}</th>
                <th className="py-1.5 text-right font-medium">Per serving{product.servingSize ? ` (${product.servingSize} ${product.unit})` : ""}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key} className="border-b border-line/60">
                  <td className="py-1.5">{r.label}</td>
                  <td className="py-1.5 text-right">{fmt(product.nutritionPer100[r.key], r.unit)}</td>
                  <td className="py-1.5 text-right">{fmt(perServing(product, r.key), r.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 text-sm">
          <p><strong>Ingredients:</strong> {product.ingredients.length ? product.ingredients.join(", ") : "not captured yet"}</p>
          <p><strong>Allergens:</strong> {allergens.length ? allergens.map((a) => ALLERGEN_LABELS[a]).join(", ") : "none declared"}{product.allergens.mayContain.length ? ` · May contain: ${product.allergens.mayContain.map((a) => ALLERGEN_LABELS[a as Allergen] ?? a).join(", ")}` : ""}</p>
          <p><strong>Diet mark:</strong> {product.vegMark === "veg" ? "Vegetarian (green dot)" : product.vegMark === "non-veg" ? "Non-vegetarian (brown dot)" : "not captured"}</p>
          {product.claims.length > 0 && <p><strong>Front-of-pack claims:</strong> {product.claims.join(" · ")} <span className="text-muted">(Claim Check arrives after the beta)</span></p>}
          <p className="text-xs text-muted">Record {product.id} · version {product.version} · updated {formatDate(product.updatedAt)} · GTIN {product.gtin ?? "pending"}</p>
        </div>
      </section>

      <FlagButton productId={product.id} />
      {unitPrice(product) !== null && <p className="sr-only">Unit price ₹{unitPrice(product)!.toFixed(1)} per 100 {product.unit}</p>}
    </article>
  );
}
