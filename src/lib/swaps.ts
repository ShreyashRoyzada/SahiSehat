// Swaps (PRD E1): same-use alternatives ranked by Fit, then Quality Score,
// then unit price, with the difference in numbers. Commission data never
// reaches this ranking (business-model firewall).

import type { FitResult, NutrientKey, Product } from "./types";
import type { QualityResult } from "./quality";
import { perServing, verdictRank } from "./fit/engine";

export type Candidate = {
  product: Product;
  quality: QualityResult;
  swapBlock: string | null;
  fit: FitResult | null;
};

export type Swap = {
  product: Product;
  quality: QualityResult;
  fit: FitResult | null;
  unitPrice: number | null; // rupees per 100 g or 100 ml
  differences: string[];
};

export type SwapResult = { swaps: Swap[]; reason: string | null };

export function unitPrice(p: Product): number | null {
  if (!p.price || !p.price.packQty) return null;
  return (p.price.amount / p.price.packQty) * 100;
}

const DIFF_NUTRIENTS: { key: NutrientKey; word: string; unit: "g" | "mg" }[] = [
  { key: "addedSugar", word: "added sugar", unit: "g" },
  { key: "totalSugar", word: "sugar", unit: "g" },
  { key: "saturatedFat", word: "saturated fat", unit: "g" },
  { key: "sodiumMg", word: "sodium", unit: "mg" },
];

/** "13.5 g less sugar per serving" for the nutrients that drive the verdict. */
export function differences(from: Product, to: Product, focus: NutrientKey[]): string[] {
  const keys = focus.length ? DIFF_NUTRIENTS.filter((d) => focus.includes(d.key)) : DIFF_NUTRIENTS;
  const out: string[] = [];
  const seenWords = new Set<string>();
  for (const d of keys) {
    const a = perServing(from, d.key);
    const b = perServing(to, d.key);
    if (a === null || b === null) continue;
    const diff = a - b;
    const threshold = d.unit === "mg" ? 20 : 0.5;
    if (Math.abs(diff) < threshold) continue;
    if (d.key === "totalSugar" && seenWords.has("added sugar")) continue;
    seenWords.add(d.word);
    const amount = d.unit === "mg" ? Math.round(Math.abs(diff)).toLocaleString("en-IN") : (Math.round(Math.abs(diff) * 10) / 10).toString();
    out.push(`${amount} ${d.unit} ${diff > 0 ? "less" : "more"} ${d.word} per serving`);
  }
  return out.slice(0, 2);
}

function focusNutrients(fit: FitResult | null): NutrientKey[] {
  if (!fit) return [];
  return fit.reasons.map((r) => r.nutrient).filter((n): n is NutrientKey => Boolean(n));
}

export function findSwaps(current: Candidate, pool: Candidate[], max = 3): SwapResult {
  const eligible = pool.filter(
    (c) => c.product.id !== current.product.id && c.product.useGroup === current.product.useGroup && !c.swapBlock && c.quality.score !== null,
  );
  if (!eligible.length) return { swaps: [], reason: "We don't have another product for the same use in the catalogue yet." };

  // With rule sets on, rank by Fit first; otherwise by Quality Score only.
  const personal = Boolean(current.fit && current.fit.ruleSets.length > 0 && current.fit.verdict !== "no-verdict");
  const currentBlocked = current.fit?.verdict === "blocked";
  const curRank = current.fit ? verdictRank(current.fit.verdict) : 3;
  const curQuality = current.quality.score ?? 0;

  let ranked = eligible.filter((c) => {
    if (c.fit?.verdict === "blocked") return false;
    if (personal) {
      if (!c.fit || !["good", "small", "not-good"].includes(c.fit.verdict)) return false;
      const r = verdictRank(c.fit.verdict);
      return r < curRank || (r === curRank && (c.quality.score ?? 0) > curQuality);
    }
    return currentBlocked || (c.quality.score ?? 0) > curQuality;
  });

  ranked = ranked.sort((a, b) => {
    if (personal) {
      const fr = verdictRank(a.fit!.verdict) - verdictRank(b.fit!.verdict);
      if (fr) return fr;
    }
    const q = (b.quality.score ?? 0) - (a.quality.score ?? 0);
    if (q) return q;
    const pa = unitPrice(a.product) ?? Infinity;
    const pb = unitPrice(b.product) ?? Infinity;
    return pa - pb;
  });

  if (!ranked.length) {
    return {
      swaps: [],
      reason: personal
        ? "Nothing for the same use fits you better in our catalogue yet."
        : "This product already scores at least as well as the others we have for the same use.",
    };
  }

  const focus = focusNutrients(current.fit);
  return {
    reason: null,
    swaps: ranked.slice(0, max).map((c) => ({
      product: c.product,
      quality: c.quality,
      fit: c.fit,
      unitPrice: unitPrice(c.product),
      differences: differences(current.product, c.product, focus),
    })),
  };
}
