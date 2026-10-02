import type { Metadata } from "next";
import { activeRules, catalogue } from "@/lib/server/catalogue";
import { canGoLive, describeCheck } from "@/lib/fit/rules";
import { QUALITY_METHOD_VERSION, WEIGHTS } from "@/lib/quality";
import { appDb } from "@/lib/server/db";

export const metadata: Metadata = { title: "How it works" };

export default function MethodPage() {
  const rules = activeRules();
  const live = canGoLive(rules);
  const c = catalogue();
  const sources = appDb().prepare("SELECT name, licence, note FROM sources ORDER BY name").all() as { name: string; licence: string; note: string }[];
  return (
    <article className="prose-sahi space-y-6">
      <h1 className="text-2xl font-bold">How SahiSehat decides</h1>
      <p>Two answers for every product: a <strong>Quality Score</strong> that is the same for everyone, and a <strong>Fit verdict</strong> that depends on your own numbers. They are separate on purpose: a product can score 85 and still not be a good fit for someone managing blood sugar.</p>

      <section id="fit" className="card space-y-3 p-4">
        <h2 className="text-xl font-bold">Fit: rules decide, AI only explains</h2>
        <p>Rule table <strong>v{rules.version}</strong> · {live.ok ? `approved by ${rules.approval.approver}` : <span className="text-small">placeholder: {rules.approval.note}</span>}</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li><strong>Which rules switch on.</strong> A rule set turns on when your lab flags a marker as high, when a typed value is above our default threshold (used only when no lab range is printed), or when you tell us you&apos;re managing it. Markers older than {rules.markerMaxAgeMonths} months stop switching rules on.</li>
          <li><strong>Your daily limits.</strong> On a 2,000 kcal reference day: sugar {rules.dailyLimits.addedSugar.amount} g, sodium {rules.dailyLimits.sodiumMg.amount.toLocaleString("en-IN")} mg, saturated fat {rules.dailyLimits.saturatedFat.amount} g, trans fat as low as possible. We don&apos;t compute calorie needs.</li>
          <li><strong>Serving share.</strong> One label serving divided by the daily limit. Up to {rules.bands.good * 100}%: Sahi for you (good fit). Up to {rules.bands.small * 100}%: Sahi in small portions. Above: Not sahi for you. The worst band across your rules wins and every reason is shown.</li>
          <li><strong>Hard filters.</strong> Allergens (contains and may-contain) and vegetarian, vegan and Jain diets block a product outright.</li>
          <li><strong>Can&apos;t tell.</strong> If the serving size or a needed nutrient is missing, we say so. We never estimate silently.</li>
          <li><strong>No verdict.</strong> Under 18, pregnancy, kidney disease or a value your lab marks critical: Quality Score only and a see-your-doctor note.</li>
        </ol>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-1.5">Rule set</th><th>Switches on</th><th>Checks per serving</th></tr></thead>
            <tbody>
              {rules.ruleSets.map((rs) => (
                <tr key={rs.id} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-2 font-semibold">{rs.id} · {rs.name}</td>
                  <td className="py-1.5 pr-2">{[...rs.triggerMarkers.map((m) => `${rules.markerThresholds[m]?.label} ≥ ${rules.markerThresholds[m]?.high} ${rules.markerThresholds[m]?.unit} or lab-flagged high`), `declared`].join("; ")}</td>
                  <td className="py-1.5">{rs.checks.map((ch) => `${ch.id}: ${describeCheck(ch)}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {Object.values(rules.dailyLimits).map((l) => <li key={l.ruleId}>{l.ruleId}: {l.source}</li>)}
        </ul>
      </section>

      <section id="quality" className="card space-y-3 p-4">
        <h2 className="text-xl font-bold">Quality Score</h2>
        <p className="font-mono text-sm">S = {WEIGHTS.N} N + {WEIGHTS.I} I + {WEIGHTS.H} H + {WEIGHTS.L} L</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>N, nutrition</strong>: energy, sugar, saturated fat and sodium count against; fibre and protein count for, per 100 g or ml (drinks have their own thresholds). Hydrogenated fat costs 15 points.</li>
          <li><strong>I, ingredients</strong>: processing level (NOVA 1–4), minus 5 per additive flag (up to 25), minus 20 for partially hydrogenated oil.</li>
          <li><strong>H, label honesty</strong>: arrives with Claim Check. Until then it&apos;s left out and the other weights rescale.</li>
          <li><strong>L, lab safety</strong>: only from a report under 12 months old that we&apos;re allowed to show. A failed critical test caps the score at 40.</li>
        </ul>
        <p>Bands: 80–100 Excellent, 60–79 Good, 41–59 Fair, 0–40 Poor. More than 20% of nutrition fields missing means no score and <em>Insufficient data</em>.</p>
        <p>Evidence levels: <strong>Lab-verified</strong> (a fresh report we can show), <strong>Label-analysed</strong> (complete label, no usable report), <strong>Insufficient data</strong>.</p>
        <p className="text-sm text-muted">Method {QUALITY_METHOD_VERSION}. Weights and thresholds are placeholders until a clinical nutritionist and a food technologist sign them.</p>
      </section>

      <section id="lab" className="card space-y-3 p-4">
        <h2 className="text-xl font-bold">Lab evidence and the publication gate</h2>
        <p>We start from lab reports others have published. Until a source licenses us to display its results, a product shows <em>Lab report on file</em> with a link to the original and no verdict.</p>
        <p>A negative finding about a named brand goes live only when the report is linked, the batch, lab and date are on the page, the wording follows our template, the brand has been told in writing and had 7 days to reply, and a correction path is on the page. Until then, a product with a failed test on file is still never suggested as a swap.</p>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-1.5">Source</th><th>Status</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.name} className="border-b border-line/60 align-top"><td className="py-1.5 pr-2 font-medium">{s.name}</td><td className="py-1.5">{s.licence === "granted" ? "Licensed to display" : s.licence === "link-only" ? "Link out only" : "Licence requested; link out"} · <span className="text-muted">{s.note}</span></td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-bold">Where the data comes from</h2>
        <p>The catalogue of {c.list.length} products is seeded from our 2 October 2026 research workbook: 245 public lab-report rows (Trustified, The Whole Truth, Unbox Health) and 110 quick-commerce listings for 39 product lines on Blinkit, Zepto, Instamart and BigBasket, plus label-only alternatives so every category has swaps.</p>
        <p>Label values in this preview are seed estimates and each product page says so until a person checks it against the pack. Listings were read without a delivery pincode; prices and stock change daily.</p>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-bold">Independence</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Commission data never reaches the Fit engine or the Quality Score.</li>
          <li>Swaps rank by Fit, then quality, then price per 100 g.</li>
          <li>No sponsored placement and no ads from food brands.</li>
          <li>Every outbound link says whether we earn from it.</li>
          <li>Health data is never sold or shared with any partner.</li>
        </ul>
      </section>
    </article>
  );
}
