// SahiSehat browser build: the same Fit engine, Quality Score, trust rules,
// search, swaps, cart and assistant code as the server app, with a profile
// kept only in this browser. Accounts, the encrypted vault, on-device OCR and
// the admin console need the server app.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { AS_OF, CATALOGUE } from "./data";
import { clear, load, save, type Saved } from "./store";
import type { ProductView } from "../src/lib/catalogue-core";
import { evaluator, type Evaluator, type Person } from "../src/lib/personal";
import { activateRuleSets, outOfScope, latestMarkers, perServing, verdictRank } from "../src/lib/fit/engine";
import { canGoLive, describeCheck } from "../src/lib/fit/rules";
import { myLimits } from "../src/lib/limits";
import { RIYA } from "../src/lib/demo";
import { checkCart, type CartResult } from "../src/lib/cart-core";
import { rulesAnswer, type AssistantAnswer } from "../src/lib/assistant/rules";
import { medicalBoundary } from "../src/lib/assistant/guard";
import { redact } from "../src/lib/extraction/redact";
import { parseReportText, type ExtractedRow } from "../src/lib/extraction/parse";
import { MARKERS, checkPlausible, round } from "../src/lib/units";
import { ALLERGEN_LABELS, detectedAllergens } from "../src/lib/ingredients";
import { formatDate, monthYear } from "../src/lib/dates";
import { AGE_OPTIONS, ALLERGEN_OPTIONS, CONDITION_LABELS } from "../src/lib/profile-options";
import { WEIGHTS } from "../src/lib/quality";
import { unitPrice } from "../src/lib/swaps";
import { EvidenceChip, Pill, ScoreBadge, VerdictBadge } from "../src/components/Badges";
import type { Allergen, AgeBand, Condition, Diet, FitResult, LabFlag, Marker, MarkerName, NutrientKey, Profile } from "../src/lib/types";

const { useState, useMemo, useEffect } = React;

type Route = { name: "home" } | { name: "search"; q?: string; category?: string } | { name: "product"; id: string; from?: string } | { name: "me" } | { name: "limits" } | { name: "cart" } | { name: "ask" } | { name: "method" };
type Nav = (r: Route) => void;

const SAMPLE_REPORT = `CITY DIAGNOSTICS LABORATORY
Patient Name : Ms. Riya Kapoor
UHID: CD2026081400417   Mobile: +91 98765 43210
Ref. By: Dr. A. Mehta
Sample Collected: 14/08/2026 08:10
HbA1c (Glycosylated Haemoglobin)  6.1   %   4.0 - 5.6   H
Glucose Fasting (FBS)        104      mg/dL    70 - 100   H
Cholesterol Total            214      mg/dL    < 200      H
LDL Cholesterol - Direct     138      mg/dL    < 100      H
HDL Cholesterol              46       mg/dL    > 40
Triglycerides                141      mg/dL    < 150`;

const SAMPLE_CART = `Amul Gold Full Cream Fresh Milk Pouch 500 ml  ₹36
Parle-G Gold Biscuits 1 kg  ₹130
Kellogg's Chocos Whole Grain 375 g  ₹199
Maggi 2-Minute Masala Noodles 70 g x 4  ₹56
Haldiram's Aloo Bhujia 400 g  ₹110
Fresh Tomatoes 500 g  ₹24
Pintola All Natural Peanut Butter Crunchy 350 g  ₹156`;

// ---------------------------------------------------------------------------

function App() {
  const [state, setState] = useState<Saved>(() => load() ?? { kind: "demo", profile: RIYA.profile, markers: RIYA.markers, consentAt: null, saved: [] });
  const [route, setRoute] = useState<Route>(() => {
    const h = typeof location !== "undefined" ? location.hash.replace("#", "") : "";
    return (["search", "cart", "ask", "me", "method", "limits"].includes(h) ? { name: h } : { name: "home" }) as Route;
  });
  useEffect(() => save(state), [state]);
  const person: Person | null = state.profile ? { profile: state.profile, markers: state.markers } : null;
  const ev = useMemo(() => evaluator(CATALOGUE, person, AS_OF), [state.profile, state.markers]); // eslint-disable-line react-hooks/exhaustive-deps
  const nav: Nav = (r) => {
    setRoute(r);
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header route={route} nav={nav} state={state} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4">
        {route.name === "home" && <Home nav={nav} ev={ev} state={state} setState={setState} />}
        {route.name === "search" && <Search nav={nav} ev={ev} initialQ={route.q ?? ""} initialCategory={route.category ?? ""} />}
        {route.name === "product" && <ProductPage key={route.id} id={route.id} nav={nav} ev={ev} state={state} setState={setState} />}
        {route.name === "me" && <Me nav={nav} state={state} setState={setState} ev={ev} />}
        {route.name === "limits" && <Limits nav={nav} state={state} />}
        {route.name === "cart" && <Cart nav={nav} ev={ev} />}
        {route.name === "ask" && <Ask nav={nav} ev={ev} />}
        {route.name === "method" && <Method />}
      </main>
      <Footer nav={nav} />
    </div>
  );
}

function Header({ route, nav, state }: { route: Route; nav: Nav; state: Saved }) {
  const tabs: [Route["name"], string][] = [["search", "Search"], ["cart", "Cart check"], ["ask", "Ask"], ["me", state.kind === "demo" ? "Riya (demo)" : state.profile ? "My numbers" : "Set up"]];
  return (
    <header className="sticky z-30 border-b border-line bg-card/95 backdrop-blur" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
        <button onClick={() => nav({ name: "home" })} className="flex items-center gap-2 font-display text-lg font-bold text-brand-800" aria-label="SahiSehat home">
          <Logo /> SahiSehat
        </button>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-0.5 text-sm font-semibold">
          {tabs.map(([name, label]) => (
            <button key={name} onClick={() => nav({ name } as Route)} aria-current={route.name === name ? "page" : undefined} className={`rounded-lg px-2.5 py-2 ${route.name === name ? "bg-brand-50 text-brand-800" : "text-ink hover:bg-brand-50"}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--brand-700)" />
      <path d="M18 34l9 9 19-21" stroke="var(--on-brand)" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Footer({ nav }: { nav: Nav }) {
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-5 text-sm text-muted">
        <p className="font-semibold text-ink">SahiSehat gives nutrition information, not medical advice. It does not diagnose or treat any condition. Talk to your doctor about medicines and treatment.</p>
        <p>
          Independent: no brand pays for placement, and commission never affects a verdict.{" "}
          <button className="underline" onClick={() => nav({ name: "method" })}>How verdicts and scores work</button>
        </p>
        <p className="text-xs">Beta preview build. Your profile stays in this browser only. Product data as of 2 October 2026.</p>
      </div>
    </footer>
  );
}

function PreviewNote() {
  const live = canGoLive(CATALOGUE.rules).ok;
  return (
    <div role="note" className="rounded-xl border border-small/30 bg-small-bg px-3.5 py-2.5 text-sm">
      <strong>Beta preview.</strong> {live ? "" : `Fit rules v${CATALOGUE.rules.version} are the PRD placeholders, not yet signed by a clinician. `}Label values are seed estimates until checked against the pack.
    </div>
  );
}

// ---- Home ---------------------------------------------------------------------

function Home({ nav, ev, state, setState }: { nav: Nav; ev: Evaluator; state: Saved; setState: (s: Saved) => void }) {
  const [q, setQ] = useState("");
  const top = CATALOGUE.list.filter((v) => v.product.qcLine).sort((a, b) => a.product.qcLine!.rank - b.product.qcLine!.rank).slice(0, 6);
  const withLab = CATALOGUE.list.filter((v) => v.reports.some((r) => r.status !== "external-rating")).length;
  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-2">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-700">Sahi hai?</p>
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight [text-wrap:balance] sm:text-5xl">Lab-tested food, matched to your body.</h1>
        <p className="max-w-[60ch] text-lg text-muted">Every packaged food gets two answers: is it what it claims, and is it right for your own blood sugar, cholesterol and blood pressure numbers. Then a better swap and where to buy it.</p>
        <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); nav({ name: "search", q }); }}>
          <label htmlFor="home-q" className="sr-only">Search products</label>
          <input id="home-q" className="input flex-1" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: dahi, atta, Parle-G, peanut butter…" />
          <button className="btn btn-primary">Search</button>
        </form>
        <ProfileBanner nav={nav} state={state} setState={setState} />
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        {[[String(CATALOGUE.list.length), "products"], [String(withLab), "with a public lab report on file"], ["39", "quick-commerce lines checked"]].map(([v, l]) => (
          <div key={l} className="rounded-xl border border-line bg-card px-2 py-3">
            <div className="font-display text-2xl font-bold tabular-nums text-brand-800">{v}</div>
            <div className="text-xs leading-tight text-muted">{l}</div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Most ordered on quick commerce</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {top.map((v) => <Card key={v.product.id} v={v} fit={ev.fit(v)} nav={nav} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Browse by category</h2>
        <div className="flex flex-wrap gap-2">
          {CATALOGUE.categories().map((c) => (
            <button key={c.name} onClick={() => nav({ name: "search", category: c.name })} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:border-brand-600">
              {c.name} <span className="text-muted">{c.count}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileBanner({ nav, state, setState }: { nav: Nav; state: Saved; setState: (s: Saved) => void }) {
  if (state.kind === "demo") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-600/30 bg-brand-50 p-3 text-sm">
        <span>You&apos;re seeing verdicts for <strong>Riya</strong>, a fictional 34-year-old whose August report flags HbA1c and LDL as high.</span>
        <span className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => nav({ name: "me" })}>See Riya&apos;s numbers</button>
          <button className="btn btn-secondary" onClick={() => { setState({ kind: "none", profile: null, markers: [], consentAt: null, saved: state.saved }); nav({ name: "me" }); }}>Use my own</button>
        </span>
      </div>
    );
  }
  if (!state.profile) {
    return (
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => setState({ ...state, kind: "demo", profile: RIYA.profile, markers: RIYA.markers })}>Try it as Riya (demo)</button>
        <button className="btn btn-secondary" onClick={() => nav({ name: "me" })}>Add my numbers</button>
      </div>
    );
  }
  return <p className="text-sm text-muted">Verdicts use the numbers you added. <button className="underline" onClick={() => nav({ name: "me" })}>Review them</button></p>;
}

function Card({ v, fit, nav, note }: { v: ProductView; fit: FitResult | null; nav: Nav; note?: string }) {
  return (
    <button onClick={() => nav({ name: "product", id: v.product.id })} className="block w-full rounded-xl border border-line bg-card p-3.5 text-left transition hover:border-brand-600">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{v.product.brand}</div>
          <div className="font-semibold leading-snug">{v.product.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Pill>{v.product.category}</Pill>
            {v.reports.some((r) => r.status !== "external-rating") && <Pill tone="brand">Lab report on file</Pill>}
            {v.product.labelSource.kind === "missing" && <Pill tone="warn">Label not captured</Pill>}
          </div>
        </div>
        <ScoreBadge quality={v.quality} size="sm" />
      </div>
      {fit && fit.verdict !== "no-verdict" && (
        <div className="mt-2.5 space-y-1">
          <VerdictBadge verdict={fit.verdict} size="sm" />
          {fit.reasons[0] && <p className="text-sm text-muted">{fit.reasons[0].text}</p>}
        </div>
      )}
      {note && <p className="mt-2 text-sm font-medium text-brand-800">{note}</p>}
    </button>
  );
}

// ---- Search ----------------------------------------------------------------------

function Search({ nav, ev, initialQ, initialCategory }: { nav: Nav; ev: Evaluator; initialQ: string; initialCategory: string }) {
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [onlyGood, setOnlyGood] = useState(false);
  const results = useMemo(() => {
    const byUrl = /^https?:\/\//.test(q.trim()) ? CATALOGUE.matchByUrl(q.trim()) : null;
    let r = (byUrl ? [byUrl] : CATALOGUE.search(q, { category: category || undefined })).map((v) => ({ v, fit: ev.fit(v) }));
    if (onlyGood && ev.personalised) r = r.filter((x) => x.fit && ["good", "small"].includes(x.fit.verdict));
    if (!q && ev.personalised) r.sort((a, b) => verdictRank(a.fit!.verdict) - verdictRank(b.fit!.verdict) || (b.v.quality.score ?? -1) - (a.v.quality.score ?? -1));
    return r;
  }, [q, category, onlyGood, ev]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">{category && !q ? category : "Search"}</h1>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="s-q" className="sr-only">Search</label>
        <input id="s-q" className="input min-w-0 flex-[2]" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, brand, Hinglish or a Blinkit/Zepto link" />
        <label htmlFor="s-cat" className="sr-only">Category</label>
        <select id="s-cat" className="input min-w-0 flex-1" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATALOGUE.categories().map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
      </div>
      {ev.personalised && (
        <label className="flex items-center gap-2 text-sm">
          <input id="s-good" type="checkbox" className="h-5 w-5 accent-[var(--brand-700)]" checked={onlyGood} onChange={(e) => setOnlyGood(e.target.checked)} /> Only good fit or small portions
        </label>
      )}
      <p className="text-sm text-muted" aria-live="polite">{results.length} product{results.length === 1 ? "" : "s"}{ev.personalised ? " · ranked for your numbers" : ""}</p>
      <div className="grid gap-2.5">{results.map(({ v, fit }) => <Card key={v.product.id} v={v} fit={fit} nav={nav} />)}</div>
      {results.length === 0 && <p className="rounded-xl border border-line bg-card p-4">We don&apos;t have that product yet. In the full app you can request it and we add the most-requested first.</p>}
    </div>
  );
}

// ---- Product -------------------------------------------------------------------------

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
  const v = unit === "mg" || unit === "kcal" ? Math.round(n).toLocaleString("en-IN") : String(Math.round(n * 10) / 10);
  return `${v} ${unit}`;
}

/** The serving-share meter: one serving against the daily limit, with the band thresholds marked. */
function ShareMeter({ share }: { share: number }) {
  const rules = CATALOGUE.rules;
  const pct = Math.min(share, 1) * 100;
  const tone = share <= rules.bands.good ? "var(--good)" : share <= rules.bands.small ? "var(--small)" : "var(--bad)";
  return (
    <div className="mt-1.5" aria-hidden="true">
      <div className="relative h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1.5)}%`, background: tone }} />
        <div className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${rules.bands.good * 100}%` }} />
        <div className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${rules.bands.small * 100}%` }} />
      </div>
      <div className="relative mt-0.5 h-3 text-[10px] text-muted">
        <span className="absolute -translate-x-1/2" style={{ left: `${rules.bands.good * 100}%` }}>{rules.bands.good * 100}%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${rules.bands.small * 100}%` }}>{rules.bands.small * 100}%</span>
      </div>
    </div>
  );
}

function ProductPage({ id, nav, ev, state, setState }: { id: string; nav: Nav; ev: Evaluator; state: Saved; setState: (s: Saved) => void }) {
  const v = CATALOGUE.getView(id);
  if (!v) return <p>Product not found.</p>;
  const { product, quality } = v;
  const fit = ev.fit(v);
  const swaps = ev.swaps(v);
  const rules = CATALOGUE.rules;
  const allergens = [...new Set([...product.allergens.contains, ...detectedAllergens(product.ingredients)])] as Allergen[];
  const own = v.reports.filter((r) => r.status !== "external-rating");
  const external = v.reports.filter((r) => r.status === "external-rating");
  const toggleSave = (pid: string) => setState({ ...state, saved: state.saved.includes(pid) ? state.saved.filter((x) => x !== pid) : [...state.saved, pid] });

  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <button className="text-sm text-brand-700 underline" onClick={() => nav({ name: "search", category: product.category })}>{product.category}</button>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">{product.brand}</p>
        <h1 className="font-display text-3xl font-bold leading-tight [text-wrap:balance]">{product.name}</h1>
        <p className="text-sm text-muted">
          Serving on the label: {product.servingSize ? `${product.servingSize} ${product.unit}` : "not captured"}
          {product.price && ` · ₹${product.price.amount} on ${product.price.platform} (seen ${formatDate(product.price.capturedAt)})`}
        </p>
      </header>
      <PreviewNote />

      <section aria-labelledby="fit-h" className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 id="fit-h" className="font-display text-lg font-bold">Is it sahi for me?</h2>
        {!fit ? (
          <div className="space-y-2 text-sm">
            <p>Add your numbers to see whether one serving fits your own daily limits for sugar, saturated fat and sodium.</p>
            <button className="btn btn-primary" onClick={() => setState({ ...state, kind: "demo", profile: RIYA.profile, markers: RIYA.markers })}>See it as Riya (demo)</button>
          </div>
        ) : fit.verdict === "no-verdict" ? (
          <div className="space-y-2"><VerdictBadge verdict="no-verdict" size="lg" /><p className="text-sm">{fit.note}</p></div>
        ) : (
          <>
            <VerdictBadge verdict={fit.verdict} size="lg" />
            {fit.reasons.length > 0 && (
              <ul className="space-y-2">
                {fit.reasons.map((r, i) => (
                  <li key={i} className="rounded-lg bg-paper p-2.5 text-sm">
                    <p className="font-semibold">{r.text}</p>
                    {r.share !== undefined && <ShareMeter share={r.share} />}
                    {r.trigger && <p className="text-muted">{r.trigger}</p>}
                  </li>
                ))}
              </ul>
            )}
            {fit.note && <p className="text-sm text-muted">{fit.note}</p>}
            <details className="rounded-lg border border-line p-2.5 text-sm">
              <summary className="cursor-pointer font-semibold">Why? Rules, numbers and sources</summary>
              <div className="mt-2 space-y-1.5">
                <p>Rule table v{fit.ruleVersion} ({rules.status === "approved" ? `signed by ${rules.approval.approver}` : "placeholder, not yet clinically signed"}). Rule sets on: {fit.ruleSets.join(", ") || "none"}.</p>
                {fit.reasons.map((r, i) => (
                  <p key={i}>
                    <code className="rounded bg-paper px-1">{r.ruleId}</code>{" "}
                    {r.perServing !== undefined && r.dailyLimit !== undefined ? `${fmt(r.perServing, r.unit ?? "g")} per serving ÷ ${fmt(r.dailyLimit, r.unit ?? "g")} daily limit = ${Math.round((r.share ?? 0) * 100)}%.` : r.text}
                  </p>
                ))}
                <p className="text-xs text-muted">Verdict record {fit.inputsHash.slice(0, 12)} · product v{product.version}</p>
              </div>
            </details>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="sr-only">Quality Score</h2>
        <ScoreBadge quality={quality} />
        {quality.score !== null && (
          <dl className="grid grid-cols-4 gap-2 text-center text-xs">
            {(["N", "I", "H", "L"] as const).map((k) => (
              <div key={k} className="rounded-lg bg-paper p-2">
                <dt className="text-muted">{{ N: "Nutrition", I: "Ingredients", H: "Label honesty", L: "Lab safety" }[k]}</dt>
                <dd className="text-base font-bold tabular-nums">{quality.pillars[k] ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{quality.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <h3 className="font-semibold">Lab evidence</h3>
        {own.length === 0 && external.length === 0 && <p className="text-sm text-muted">No public lab report found for this product yet.</p>}
        {own.map((d) => (
          <div key={d.report.id} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-xs font-semibold text-neutral">{d.label}</span>
              <span className="text-muted">{d.report.source}</span>
            </div>
            <p className="mt-1.5 text-muted">{d.status === "expired" ? "The source marks this report as expired." : "We show the verdict, batch and date once our licence to display this source and, for any negative finding, our publication review are complete."}</p>
            <a className="mt-1.5 inline-block font-semibold text-brand-700 underline" href={d.report.url} target="_blank" rel="noopener noreferrer">Open the original report ↗</a>
          </div>
        ))}
        {external.map((d) => <p key={d.report.id} className="text-sm">Also rated by a third party: <a className="text-brand-700 underline" href={d.report.url} target="_blank" rel="noopener noreferrer">Unbox Health ↗</a> (link out only)</p>)}
        {v.swapBlock && <p className="rounded-lg bg-small-bg p-2.5 text-sm">{v.swapBlock}</p>}
      </section>

      <section className="space-y-2.5">
        <h2 className="font-display text-lg font-bold">Better swaps</h2>
        {swaps.swaps.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-3.5 text-sm text-muted">{swaps.reason}</p>
        ) : (
          swaps.swaps.map((s) => (
            <div key={s.product.id} className="rounded-xl border border-line bg-card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <button className="min-w-0 text-left hover:underline" onClick={() => nav({ name: "product", id: s.product.id, from: product.id })}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">{s.product.brand}</div>
                  <div className="font-semibold">{s.product.name}</div>
                </button>
                <ScoreBadge quality={s.quality} size="sm" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.fit && s.fit.verdict !== "cant-tell" && <VerdictBadge verdict={s.fit.verdict} size="sm" />}
                <EvidenceChip level={s.quality.evidence} />
                {s.unitPrice !== null && <Pill>₹{s.unitPrice.toFixed(0)} per 100 {s.product.unit}</Pill>}
              </div>
              {s.differences.length > 0 && <p className="mt-1.5 text-sm font-semibold text-brand-800">{s.differences.join(" · ")}</p>}
              <button className="mt-2 text-sm font-semibold text-brand-700 underline" onClick={() => toggleSave(s.product.id)}>{state.saved.includes(s.product.id) ? "Saved ✓ (remove)" : "Save to my list"}</button>
            </div>
          ))
        )}
        <p className="text-sm text-muted">Ranked by your Fit, then Quality Score, then price per 100 g. Commission never affects this order.</p>
      </section>

      <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-lg font-bold">Where to buy</h2>
        {v.listings.length === 0 ? (
          <p className="text-sm text-muted">We haven&apos;t captured a quick-commerce listing for this product yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {v.listings.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <span className="min-w-0"><strong>{l.platform}</strong>: {l.seen}{l.ratingsCount ? <span className="text-muted"> · {l.ratingsCount.toLocaleString("en-IN")} ratings</span> : null}</span>
                <a className="shrink-0 font-semibold text-brand-700 underline" href={l.url} target="_blank" rel="noopener noreferrer nofollow">Open ↗</a>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">Listings seen on 2 October 2026 without a delivery pincode; prices and stock change. Plain links: we don&apos;t earn a commission from them.</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-lg font-bold">From the label</h2>
        <p className={`rounded-lg p-2.5 text-sm ${product.labelSource.verified ? "bg-good-bg" : "bg-small-bg"}`}>{product.labelSource.note}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 font-semibold">Nutrient</th>
                <th className="py-1.5 text-right font-semibold">Per 100 {product.unit}</th>
                <th className="py-1.5 text-right font-semibold">Per serving</th>
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
          {product.claims.length > 0 && <p><strong>Front-of-pack claims:</strong> {product.claims.join(" · ")}</p>}
          {unitPrice(product) !== null && <p><strong>Unit price:</strong> ₹{unitPrice(product)!.toFixed(1)} per 100 {product.unit}</p>}
        </div>
      </section>
    </article>
  );
}

// ---- Me (profile, numbers, report) -------------------------------------------------

function Me({ nav, state, setState, ev }: { nav: Nav; state: Saved; setState: (s: Saved) => void; ev: Evaluator }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showExport, setShowExport] = useState(false);
  if (!state.profile) return <Setup state={state} setState={setState} />;
  const profile = state.profile;
  const activation = activateRuleSets(profile, state.markers, CATALOGUE.rules, AS_OF);
  const latest = Object.values(latestMarkers(state.markers));
  const scope = outOfScope(profile);
  const saved = state.saved.map((id) => CATALOGUE.getView(id)).filter((x): x is ProductView => Boolean(x));
  const exportJson = JSON.stringify({ exportedAt: new Date().toISOString(), profile, markers: state.markers, consentAt: state.consentAt, savedProducts: state.saved }, null, 2);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">{state.kind === "demo" ? "Riya's profile (demo)" : "My profile"}</h1>
        <p className="text-sm text-muted">{state.kind === "demo" ? "A fictional person from the PRD. Change anything to see verdicts move." : "Stored only in this browser. Nothing is sent anywhere."}</p>
      </div>
      {scope && <div role="alert" className="rounded-xl border border-line bg-neutral-bg p-3.5 text-sm">{scope} You&apos;ll see Quality Scores and lab evidence, not personal verdicts.</div>}
      {activation.redFlags.length > 0 && <div role="alert" className="rounded-xl border border-bad/30 bg-bad-bg p-3.5 text-sm"><strong>Please see your doctor.</strong> A value needs medical attention ({activation.redFlags.join(", ")}). We don&apos;t give food verdicts while this is the case.</div>}

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-lg font-bold">What switches your rules on</h2>
        {activation.triggers.length ? (
          <ul className="space-y-1.5 text-sm">{activation.triggers.map((t) => <li key={t.ruleSet.id} className="rounded-lg bg-paper p-2.5"><strong>{t.ruleSet.name}</strong> rules: {t.text}</li>)}</ul>
        ) : (
          <p className="text-sm text-muted">Nothing yet. Add numbers below or tick what you&apos;re managing.</p>
        )}
        <button className="btn btn-secondary" onClick={() => nav({ name: "limits" })}>See my daily limits</button>
      </section>

      <ProfileEditor profile={profile} onChange={(p) => setState({ ...state, profile: p })} />

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-lg font-bold">My numbers</h2>
        {latest.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <tbody>
                {state.markers.slice().sort((a, b) => b.sampleDate.localeCompare(a.sampleDate)).map((m, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="py-1.5 pr-2">{MARKERS[m.name].label}</td>
                    <td className="py-1.5 pr-2 font-bold">{round(m.value, 1)} {m.unit}</td>
                    <td className="py-1.5 pr-2">{m.labFlag ? `Lab: ${m.labFlag}` : <span className="text-muted">{m.source}</span>}</td>
                    <td className="py-1.5 pr-2 text-muted">{monthYear(m.sampleDate)}</td>
                    <td className="py-1.5 text-right"><button className="text-muted underline" onClick={() => setState({ ...state, markers: state.markers.filter((x) => x !== m) })}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">No numbers yet.</p>}
        <AddNumber onAdd={(m) => setState({ ...state, markers: [...state.markers, m] })} />
      </section>

      <ReportPaste onSave={(ms) => setState({ ...state, markers: [...state.markers, ...ms] })} />

      {saved.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
          <h2 className="font-display text-lg font-bold">My saved swaps</h2>
          <div className="grid gap-2">{saved.map((v) => <Card key={v.product.id} v={v} fit={ev.fit(v)} nav={nav} />)}</div>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-lg font-bold">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => setShowExport(!showExport)}>{showExport ? "Hide export" : "Export my data"}</button>
          {confirmDelete ? (
            <>
              <button className="btn btn-danger" onClick={() => { clear(); setState({ kind: "none", profile: null, markers: [], consentAt: null, saved: [] }); setConfirmDelete(false); }}>Tap again to delete everything</button>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete everything</button>
          )}
        </div>
        {showExport && <ExportBox json={exportJson} />}
      </section>
    </div>
  );
}

function ExportBox({ json }: { json: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <label htmlFor="export-json" className="label">Your data as JSON</label>
      <textarea id="export-json" readOnly className="input min-h-40 font-mono text-xs" value={json} onFocus={(e) => e.currentTarget.select()} />
      <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(json).then(() => setCopied(true), () => setCopied(false))}>{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

function Setup({ state, setState }: { state: Saved; setState: (s: Saved) => void }) {
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile>({ ageBand: null, conditions: [], goals: [], diet: "none", allergens: [], screen: [] });
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-brand-700">Set up · about 3 minutes</p>
        <h1 className="font-display text-2xl font-bold">Tell us what you&apos;re managing</h1>
        <p className="text-muted">Your answers switch on the right rules. In this preview they stay in this browser only.</p>
      </div>
      <button className="btn btn-secondary" onClick={() => setState({ ...state, kind: "demo", profile: RIYA.profile, markers: RIYA.markers })}>Or try it as Riya (demo)</button>
      <label className="flex gap-3 rounded-xl border border-line bg-card p-3.5">
        <input id="consent" type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand-700)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          <span className="block font-semibold">Store my health numbers in this browser to personalise verdicts</span>
          <span className="block text-sm text-muted">We use them only to work out your daily limits and Fit verdicts. You can delete everything in two taps.</span>
        </span>
      </label>
      <ProfileEditor profile={profile} onChange={setProfile} open />
      {error && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{error}</p>}
      <button
        className="btn btn-primary w-full"
        onClick={() => {
          if (!consent) return setError("Tick the consent box to store your numbers, or browse Quality Scores without a profile.");
          if (!profile.ageBand) return setError("Choose your age band.");
          setState({ kind: "own", profile, markers: [], consentAt: new Date().toISOString(), saved: state.saved });
        }}
      >
        Save and add my numbers
      </button>
    </div>
  );
}

function ProfileEditor({ profile, onChange, open = false }: { profile: Profile; onChange: (p: Profile) => void; open?: boolean }) {
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <details open={open} className="rounded-2xl border border-line bg-card p-4">
      <summary className="cursor-pointer font-display text-lg font-bold">About me, diet and allergies</summary>
      <div className="mt-3 space-y-4">
        <div>
          <label className="label" htmlFor="age">Age band</label>
          <select id="age" className="input" value={profile.ageBand ?? ""} onChange={(e) => onChange({ ...profile, ageBand: (e.target.value || null) as AgeBand | null })}>
            <option value="">Choose…</option>
            {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a === "under-18" ? "Under 18" : a}</option>)}
          </select>
        </div>
        <fieldset className="space-y-1">
          <legend className="label">Do any of these apply?</legend>
          {([["pregnancy", "I'm pregnant"], ["kidney-disease", "I have kidney disease or am on dialysis"], ["eating-disorder", "I'm being treated for an eating disorder"]] as const).map(([v, l]) => (
            <Check key={v} id={`screen-${v}`} label={l} checked={profile.screen.includes(v)} onChange={() => onChange({ ...profile, screen: toggle(profile.screen, v) })} />
          ))}
          <p className="hint">If one applies, or you&apos;re under 18, you get scores and lab evidence but no personal verdicts.</p>
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="label">What are you managing?</legend>
          {CONDITION_LABELS.map((c) => <Check key={c.value} id={`cond-${c.value}`} label={c.label} checked={profile.conditions.includes(c.value)} onChange={() => onChange({ ...profile, conditions: toggle(profile.conditions, c.value as Condition) })} />)}
        </fieldset>
        <div>
          <label className="label" htmlFor="diet">Diet</label>
          <select id="diet" className="input" value={profile.diet} onChange={(e) => onChange({ ...profile, diet: e.target.value as Diet })}>
            <option value="none">No restriction</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="jain">Jain</option>
          </select>
        </div>
        <fieldset>
          <legend className="label">Allergies (contains or may contain = blocked)</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {ALLERGEN_OPTIONS.map(([v, l]) => <Check key={v} id={`al-${v}`} label={l} checked={profile.allergens.includes(v)} onChange={() => onChange({ ...profile, allergens: toggle(profile.allergens, v as Allergen) })} />)}
          </div>
        </fieldset>
      </div>
    </details>
  );
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label htmlFor={id} className="flex min-h-[40px] items-center gap-2.5 text-sm">
      <input id={id} type="checkbox" className="h-5 w-5 accent-[var(--brand-700)]" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

const TYPEABLE: MarkerName[] = ["hba1c", "fasting-glucose", "total-cholesterol", "ldl", "hdl", "triglycerides", "systolic-bp", "diastolic-bp"];

function AddNumber({ onAdd }: { onAdd: (m: Marker) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState<MarkerName>("hba1c");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("%");
  const [date, setDate] = useState(today);
  const [flag, setFlag] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const units = Object.keys(MARKERS[name].units);
  return (
    <form
      className="space-y-2 rounded-xl bg-paper p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const check = checkPlausible(name, Number(value), unit);
        if (!check.ok) return setMsg({ error: check.error });
        if (!date || date > today) return setMsg({ error: "Add the date of the test (not in the future)." });
        onAdd({ name, value: check.canonical, unit: MARKERS[name].canonical, sampleDate: date, labFlag: (flag || null) as LabFlag, labRange: null, source: "typed" });
        setValue("");
        setMsg({ ok: `Saved ${MARKERS[name].label}.` });
      }}
    >
      <p className="font-semibold">Type a number</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select id="add-name" aria-label="Marker" className="input sm:col-span-2" value={name} onChange={(e) => { const n = e.target.value as MarkerName; setName(n); setUnit(Object.keys(MARKERS[n].units)[0]); }}>
          {TYPEABLE.map((n) => <option key={n} value={n}>{MARKERS[n].label}</option>)}
        </select>
        <input id="add-value" aria-label="Value" className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
        <select id="add-unit" aria-label="Unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</select>
        <input id="add-date" aria-label="Test date" type="date" className="input" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        <select id="add-flag" aria-label="Flag printed by the lab" className="input sm:col-span-2" value={flag} onChange={(e) => setFlag(e.target.value)}>
          <option value="">Lab flag: none printed</option>
          <option value="high">Lab says high</option>
          <option value="normal">Lab says normal</option>
          <option value="low">Lab says low</option>
          <option value="critical">Lab says critical</option>
        </select>
        <button className="btn btn-primary sm:col-span-3">Save number</button>
      </div>
      {msg.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
      {msg.ok && <p role="status" className="text-sm text-good">{msg.ok}</p>}
      <p className="hint">HbA1c in % or mmol/mol; glucose and cholesterol in mg/dL or mmol/L. A lab-printed flag always wins over our defaults.</p>
    </form>
  );
}

type Row = { include: boolean; row: ExtractedRow; value: string; unit: string; date: string; flag: string };

function ReportPaste({ onSave }: { onSave: (m: Marker[]) => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [redactions, setRedactions] = useState(0);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const read = (t: string) => {
    const r = redact(t);
    setRedactions(r.removed);
    const extracted = parseReportText(r.text).filter((x) => x.marker);
    setRows(extracted.map((x) => ({ include: x.issues.every((i) => !/plausible|isn't supported/.test(i)), row: x, value: x.value === null ? "" : String(x.value), unit: x.unit ?? MARKERS[x.marker!].canonical, date: x.sampleDate ?? "", flag: x.flag ?? "" })));
    setMsg({});
  };
  const confirm = () => {
    const out: Marker[] = [];
    for (const r of rows!.filter((x) => x.include)) {
      const name = r.row.marker!;
      const check = checkPlausible(name, Number(r.value), r.unit);
      if (!check.ok) return setMsg({ error: check.error });
      if (!r.date) return setMsg({ error: `${MARKERS[name].label}: add the sample date.` });
      out.push({ name, value: check.canonical, unit: MARKERS[name].canonical, sampleDate: r.date, labFlag: (r.flag || null) as LabFlag, labRange: r.row.range, source: "report" });
    }
    if (!out.length) return setMsg({ error: "Tick at least one row." });
    onSave(out);
    setRows(null);
    setText("");
    setMsg({ ok: `Saved ${out.length} confirmed value${out.length === 1 ? "" : "s"}. Nothing else from the report was kept.` });
  };
  const upd = (i: number, p: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-bold">Read a blood report</h2>
      <p className="text-sm text-muted">Paste the results section. Names, phone numbers and IDs are removed first, then you check every value before it&apos;s saved. (The full app also reads PDFs and photos on your phone.)</p>
      {!rows && (
        <>
          <label htmlFor="report-text" className="sr-only">Report text</label>
          <textarea id="report-text" className="input min-h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste report text here" />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={!text.trim()} onClick={() => read(text)}>Read it</button>
            <button className="btn btn-secondary" onClick={() => { setText(SAMPLE_REPORT); read(SAMPLE_REPORT); }}>Try a fictional sample report</button>
          </div>
        </>
      )}
      {rows && (
        <div className="space-y-3">
          <p className="text-sm">{redactions} personal detail{redactions === 1 ? "" : "s"} removed. Check each row against your report, then confirm. Only ticked rows are saved.</p>
          {rows.length === 0 && <p className="text-sm text-muted">No HbA1c, glucose, cholesterol, triglyceride or blood-pressure rows found.</p>}
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-line p-2.5">
              <Check id={`rr-${i}`} label={MARKERS[r.row.marker!].label} checked={r.include} onChange={() => upd(i, { include: !r.include })} />
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input aria-label="Value" className="input" value={r.value} onChange={(e) => upd(i, { value: e.target.value })} />
                <select aria-label="Unit" className="input" value={r.unit} onChange={(e) => upd(i, { unit: e.target.value })}>{Object.keys(MARKERS[r.row.marker!].units).map((u) => <option key={u}>{u}</option>)}</select>
                <select aria-label="Lab flag" className="input" value={r.flag} onChange={(e) => upd(i, { flag: e.target.value })}>
                  <option value="">No flag</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option><option value="critical">Critical</option>
                </select>
                <input aria-label="Sample date" type="date" className="input" value={r.date} onChange={(e) => upd(i, { date: e.target.value })} />
              </div>
              {r.row.range && <p className="mt-1 text-xs text-muted">Printed range: {r.row.range}</p>}
              {r.row.issues.map((iss) => <p key={iss} className="mt-1 text-xs text-small">⚠ {iss}</p>)}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={confirm}>Confirm and save ticked values</button>
            <button className="btn btn-secondary" onClick={() => setRows(null)}>Cancel and discard</button>
          </div>
        </div>
      )}
      {msg.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
      {msg.ok && <p role="status" className="text-sm text-good">{msg.ok}</p>}
    </section>
  );
}

// ---- Limits ----------------------------------------------------------------------

function Limits({ nav, state }: { nav: Nav; state: Saved }) {
  if (!state.profile) return <p className="rounded-xl border border-line bg-card p-4">Add a profile first. <button className="underline" onClick={() => nav({ name: "me" })}>Set up</button></p>;
  const rules = CATALOGUE.rules;
  const limits = myLimits(rules, activateRuleSets(state.profile, state.markers, rules, AS_OF));
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">My limits</h1>
      <PreviewNote />
      <p className="text-muted">Daily budgets on a 2,000 kcal reference day. One serving is compared with these: up to {rules.bands.good * 100}% is a good fit, up to {rules.bands.small * 100}% means small portions, above that is not a good fit.</p>
      {limits.length === 0 && <p className="rounded-xl border border-line bg-card p-4 text-sm">No rule set is switched on yet.</p>}
      {limits.map((l) => (
        <section key={l.ruleId} className="space-y-1.5 rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">{l.title}</h2>
            <span className="font-display text-xl font-bold text-brand-800">{l.amount}</span>
          </div>
          <p>{l.plain}</p>
          {l.why.map((w) => <p key={w} className="text-sm text-muted">{w}</p>)}
          <p className="text-xs text-muted">Rule {l.ruleId} · rule table v{rules.version} · Source: {l.source}</p>
        </section>
      ))}
    </div>
  );
}

// ---- Cart -------------------------------------------------------------------------

function Cart({ nav, ev }: { nav: Nav; ev: Evaluator }) {
  const [text, setText] = useState(SAMPLE_CART);
  const [result, setResult] = useState<CartResult | null>(() => checkCart(SAMPLE_CART, ev));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Check my cart</h1>
        <p className="text-muted">Paste the items from your Blinkit, Zepto, Instamart or BigBasket cart. Each gets a badge, we list the three biggest swaps, and anything we can&apos;t match is listed, never guessed. A sample cart is loaded.</p>
      </div>
      <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
        <label htmlFor="cart-text" className="label">Cart items, one per line</label>
        <textarea id="cart-text" className="input min-h-36" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary" disabled={!text.trim()} onClick={() => setResult(checkCart(text, ev))}>Check these items</button>
      </div>
      {result && (
        <div className="space-y-4" aria-live="polite">
          {!ev.personalised && <p className="rounded-lg bg-small-bg p-3 text-sm">Quality Scores only. Add your numbers or try the Riya demo to see personal verdicts.</p>}
          {result.swaps.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
              <h2 className="font-display text-lg font-bold">Your three biggest swaps</h2>
              <ol className="space-y-2">
                {result.swaps.map((s) => (
                  <li key={s.fromId} className="rounded-lg bg-brand-50 p-3 text-sm">
                    Swap <button className="font-bold underline" onClick={() => nav({ name: "product", id: s.fromId })}>{s.fromName}</button> for <button className="font-bold underline" onClick={() => nav({ name: "product", id: s.toId })}>{s.toName}</button>
                    <span className="block text-brand-800">{[...s.differences, s.why].join(" · ")}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold">Items ({result.matched.length} matched)</h2>
            {result.matched.map((m) => {
              const v = CATALOGUE.getView(m.productId)!;
              return <Card key={m.productId} v={v} fit={ev.fit(v)} nav={nav} note={`From your cart: “${m.line}”`} />;
            })}
          </section>
          {result.unmatched.length > 0 && (
            <section className="space-y-1 rounded-2xl border border-line bg-card p-4 text-sm">
              <h2 className="font-bold">Not matched</h2>
              <p className="text-muted">No confident match, so no badge.</p>
              <ul className="list-disc pl-5">{result.unmatched.map((u) => <li key={u}>{u}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Ask -----------------------------------------------------------------------------

const EXAMPLES = ["Which biscuits suit me?", "Why is Parle-G not sahi for me?", "What can I buy instead of Kellogg's Chocos?", "Best peanut butter", "Should I stop my metformin?"];

function Ask({ nav, ev }: { nav: Nav; ev: Evaluator }) {
  const [turns, setTurns] = useState<{ q: string; a: AssistantAnswer }[]>([]);
  const [q, setQ] = useState("");
  const ask = (question: string) => {
    if (!question.trim()) return;
    const b = medicalBoundary(question);
    const a: AssistantAnswer = b ? { text: b.text, items: [], sources: [], declined: true, engine: "rules" } : rulesAnswer(question, ev);
    setTurns((t) => [...t, { q: question, a }]);
    setQ("");
  };
  const go = (href: string) => {
    const id = href.startsWith("/p/") ? href.slice(3) : null;
    nav(id ? { name: "product", id } : { name: "method" });
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Ask SahiSehat</h1>
        <p className="text-muted">Answers come only from our catalogue and your Fit rules, with sources. No diagnosis, medicines or doses.</p>
      </div>
      <div className="space-y-3" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-700 px-3.5 py-2 text-on-brand">{t.q}</p>
            <div className={`max-w-[95%] space-y-2 rounded-2xl border p-3.5 ${t.a.declined ? "border-small/40 bg-small-bg" : "border-line bg-card"}`}>
              <p className="whitespace-pre-line">{t.a.text}</p>
              {t.a.items.length > 0 && (
                <ul className="space-y-1.5">
                  {t.a.items.map((it) => (
                    <li key={it.productId} className="rounded-lg bg-paper p-2.5 text-sm">
                      <button className="font-bold underline" onClick={() => nav({ name: "product", id: it.productId })}>{it.name}</button>
                      {it.verdict && <span className="ml-2 rounded bg-card px-1.5 py-0.5 text-xs font-bold">{it.verdict}</span>}
                      {it.score !== null && <span className="ml-1 text-xs text-muted">Score {it.score}</span>}
                      <span className="block text-muted">{it.note}</span>
                    </li>
                  ))}
                </ul>
              )}
              {t.a.sources.length > 0 && (
                <p className="text-xs text-muted">Sources: {t.a.sources.map((s, j) => <span key={j}>{j > 0 && " · "}<button className="underline" onClick={() => go(s.href)}>{s.label}</button></span>)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {turns.length === 0 && <div className="flex flex-wrap gap-2">{EXAMPLES.map((e) => <button key={e} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:border-brand-600" onClick={() => ask(e)}>{e}</button>)}</div>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <label htmlFor="ask-q" className="sr-only">Your question</label>
        <input id="ask-q" className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which breakfast cereal suits me?" maxLength={500} />
        <button className="btn btn-primary" disabled={!q.trim()}>Ask</button>
      </form>
      <p className="hint">This preview answers with our rule-based engine. The full app can put Claude in front of the same catalogue tools; verdicts still come from the rules.</p>
    </div>
  );
}

// ---- Method -----------------------------------------------------------------------------

function Method() {
  const rules = CATALOGUE.rules;
  return (
    <article className="space-y-5">
      <h1 className="font-display text-2xl font-bold">How SahiSehat decides</h1>
      <p className="max-w-[65ch]">Two answers for every product: a <strong>Quality Score</strong> that is the same for everyone, and a <strong>Fit verdict</strong> that depends on your own numbers. A product can score 85 and still not be a good fit for someone managing blood sugar.</p>
      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-xl font-bold">Fit: rules decide, AI only explains</h2>
        <p>Rule table v{rules.version}: {canGoLive(rules).ok ? `approved by ${rules.approval.approver}` : rules.approval.note}</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>A rule set turns on when your lab flags a marker as high, when a typed value is at or above our default threshold (used only when no lab range is printed), or when you say you&apos;re managing it. Markers older than {rules.markerMaxAgeMonths} months stop counting.</li>
          <li>Daily limits on a 2,000 kcal day: sugar {rules.dailyLimits.addedSugar.amount} g, sodium {rules.dailyLimits.sodiumMg.amount.toLocaleString("en-IN")} mg, saturated fat {rules.dailyLimits.saturatedFat.amount} g, trans fat as low as possible.</li>
          <li>One label serving ÷ daily limit. Up to {rules.bands.good * 100}%: Sahi for you. Up to {rules.bands.small * 100}%: Sahi in small portions. Above: Not sahi for you. The worst band wins.</li>
          <li>Allergens (contains and may-contain) and vegetarian, vegan and Jain diets block a product outright. Missing label data gives Can&apos;t tell, never a guess.</li>
          <li>Under 18, pregnancy, kidney disease or a value your lab marks critical: no personal verdict, and a see-your-doctor note.</li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-1.5 pr-2">Rule set</th><th className="py-1.5">Checks per serving</th></tr></thead>
            <tbody>{rules.ruleSets.map((rs) => <tr key={rs.id} className="border-b border-line/60 align-top"><td className="py-1.5 pr-2 font-bold">{rs.id} · {rs.name}</td><td className="py-1.5">{rs.checks.map((c) => `${c.id}: ${describeCheck(c)}`).join(" · ")}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-xl font-bold">Quality Score</h2>
        <p className="font-mono text-sm">S = {WEIGHTS.N} N + {WEIGHTS.I} I + {WEIGHTS.H} H + {WEIGHTS.L} L</p>
        <p>Nutrition, ingredients (processing level and additives), label honesty (with Claim Check, after the beta) and lab safety (only from a fresh report we&apos;re licensed to show). Missing pillars drop out and the weights rescale. A failed critical lab test caps the score at 40. Bands: 80+ Excellent, 60–79 Good, 41–59 Fair, 0–40 Poor.</p>
      </section>
      <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-xl font-bold">Lab evidence</h2>
        <p>Until a source licenses us to display its results, a product shows <em>Lab report on file</em> with a link to the original and no verdict. A negative finding about a named brand goes live only after the publication gate: report linked, batch, lab and date shown, approved wording, the brand told in writing with 7 days to reply, and a correction path. A product with a failed test on file is never suggested as a swap.</p>
      </section>
      <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-xl font-bold">About this preview</h2>
        <p>{CATALOGUE.list.length} products seeded from the 2 October 2026 research workbook (245 public lab-report rows and 110 quick-commerce listings for 39 product lines), plus label-only alternatives. Label values are seed estimates until checked against the pack. Your profile stays in this browser. Accounts, the encrypted health vault, reading reports from PDFs and photos, and the admin console run in the full server app.</p>
      </section>
    </article>
  );
}

const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(<App />);
