// Catalogue search (PRD A2): name, brand and category, with typo tolerance
// and Hinglish spellings. The catalogue is small (~150 products), so an
// in-memory index is faster and simpler than a database full-text index.

import type { Product } from "./types";

// Hinglish and common alternative spellings -> canonical search terms.
const SYNONYMS: Record<string, string[]> = {
  dahi: ["curd", "yoghurt"],
  doodh: ["milk"],
  dudh: ["milk"],
  atta: ["atta", "flour", "wheat"],
  aata: ["atta", "flour"],
  chawal: ["rice"],
  chaval: ["rice"],
  namak: ["salt"],
  tel: ["oil"],
  sarson: ["mustard"],
  sarso: ["mustard"],
  chai: ["tea"],
  cha: ["tea"],
  kaapi: ["coffee"],
  biskut: ["biscuit"],
  biscut: ["biscuit"],
  biscuits: ["biscuit"],
  cookie: ["cookies", "biscuit"],
  namkeen: ["snacks", "bhujia", "namkeen"],
  makhane: ["makhana"],
  phool: ["makhana"],
  haldi: ["haldi", "turmeric"],
  mirch: ["mirch", "chilli"],
  mirchi: ["mirch", "chilli"],
  shahad: ["honey"],
  shehad: ["honey"],
  madhu: ["honey"],
  makhan: ["butter"],
  makkhan: ["butter"],
  moongphali: ["peanut"],
  mungfali: ["peanut"],
  groundnut: ["peanut"],
  chocolate: ["chocolate"],
  choclate: ["chocolate"],
  chocolat: ["chocolate"],
  ghee: ["ghee"],
  ghi: ["ghee"],
  desi: ["desi"],
  paneer: ["paneer"],
  panir: ["paneer"],
  cheez: ["cheese"],
  oats: ["oats"],
  noodle: ["noodles"],
  maggie: ["maggi"],
  cornflakes: ["corn", "flakes"],
  kelloggs: ["kellogg's"],
  haldirams: ["haldiram's"],
  haldiram: ["haldiram's"],
  soyabean: ["soya"],
  soy: ["soya"],
  bread: ["bread"],
  double: ["double"],
  roti: ["atta"],
  juice: ["juice"],
  cold: ["drink"],
  colddrink: ["drink"],
  thandai: ["drink"],
  chaach: ["buttermilk"],
  chhaas: ["buttermilk"],
  lassi: ["buttermilk"],
  peanutbutter: ["peanut", "butter"],
  pb: ["peanut", "butter"],
  whey: ["whey"],
  protien: ["protein"],
  sugarfree: ["sugar", "free"],
};

const STOP = new Set(["the", "a", "an", "of", "and", "with", "for", "in", "g", "ml", "kg", "pack", "pouch", "best", "low", "which", "me", "suit", "suits", "good"]);

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9%' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalise(s)
    .split(" ")
    .map((t) => t.replace(/'s$/, "").replace(/'/g, ""))
    .filter((t) => t && !STOP.has(t));
}

/** Optimal string alignment distance (Damerau-Levenshtein with adjacent swaps). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export type SearchHit = { product: Product; score: number; coverage: number; brandMatched: boolean };

type IndexedProduct = { product: Product; brand: string[]; name: string[]; category: string[]; extra: string[] };

export class SearchIndex {
  private items: IndexedProduct[];
  private vocabulary: Set<string>;

  constructor(products: Product[]) {
    this.items = products.map((p) => ({
      product: p,
      brand: tokens(p.brand),
      name: tokens(p.name),
      category: tokens(`${p.category} ${p.useGroup.replace(/-/g, " ")}`),
      extra: tokens(p.claims.join(" ")),
    }));
    this.vocabulary = new Set(this.items.flatMap((i) => [...i.brand, ...i.name, ...i.category]));
  }

  /** Expand one query token into candidate terms (synonyms, then typo corrections). */
  private expand(t: string): { term: string; weight: number }[] {
    const out = new Map<string, number>([[t, 1]]);
    for (const s of SYNONYMS[t] ?? []) for (const tt of tokens(s)) out.set(tt, Math.max(out.get(tt) ?? 0, 0.95));
    if (t.length >= 4) {
      const maxEdits = t.length >= 7 ? 2 : 1;
      for (const v of this.vocabulary) {
        if (out.has(v)) continue;
        const dist = editDistance(t, v, maxEdits);
        if (dist <= maxEdits) out.set(v, dist === 1 ? 0.8 : 0.6);
      }
      // Close misspellings of a Hinglish word, e.g. "dahee" -> "dahi".
      for (const key of Object.keys(SYNONYMS)) {
        if (key !== t && editDistance(t, key, 1) <= 1) for (const s of SYNONYMS[key]) for (const tt of tokens(s)) out.set(tt, Math.max(out.get(tt) ?? 0, 0.75));
      }
    }
    return [...out].map(([term, weight]) => ({ term, weight }));
  }

  private fieldScore(field: string[], term: string): number {
    let best = 0;
    for (const f of field) {
      if (f === term) best = Math.max(best, 1);
      else if (term.length >= 3 && f.startsWith(term)) best = Math.max(best, 0.85);
      else if (term.length >= 4 && f.includes(term)) best = Math.max(best, 0.6);
    }
    return best;
  }

  search(query: string, opts: { category?: string; limit?: number } = {}): SearchHit[] {
    const qTokens = tokens(query);
    let pool = this.items;
    if (opts.category) pool = pool.filter((i) => i.product.category === opts.category);
    if (!qTokens.length) return pool.map((i) => ({ product: i.product, score: 0, coverage: 0, brandMatched: false })).slice(0, opts.limit ?? 50);

    const expanded = qTokens.map((t) => this.expand(t));
    const results: SearchHit[] = [];
    for (const item of pool) {
      let total = 0;
      let matched = 0;
      let brandMatched = false;
      for (const candidates of expanded) {
        let best = 0;
        for (const { term, weight } of candidates) {
          const s = Math.max(
            this.fieldScore(item.name, term) * 1.0,
            this.fieldScore(item.brand, term) * 0.9,
            this.fieldScore(item.category, term) * 0.7,
            this.fieldScore(item.extra, term) * 0.3,
          );
          best = Math.max(best, s * weight);
          if (this.fieldScore(item.brand, term) >= 0.85 && weight >= 0.8) brandMatched = true;
        }
        if (best > 0) matched++;
        total += best;
      }
      if (!matched) continue;
      // Reward products that match every query token.
      const coverage = matched / expanded.length;
      const popularity = item.product.qcLine ? 0.02 * item.product.qcLine.demandTier : 0;
      results.push({ product: item.product, score: total * coverage * coverage + popularity, coverage, brandMatched });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 50);
  }
}

// Words on a quick-commerce cart line that say nothing about the product.
const CART_NOISE = /\b(\d+(\.\d+)?\s*(g|gm|gms|kg|ml|l|ltr|litre|pcs?|pack|x)|mrp|rs\.?|inr|qty|quantity|add|remove|delete|save|off|offer|free|delivery|item|items|total|subtotal|bill|coupon|discount|\d+%?)\b|₹\s*[\d,.]+/gi;

export function cleanCartLine(line: string): string {
  return line.replace(CART_NOISE, " ").replace(/[|•·×*_]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Confident single match for a free-text line (cart rows, shared text), or null. Never guesses. */
export function matchLine(index: SearchIndex, line: string): SearchHit | null {
  const cleaned = cleanCartLine(line);
  if (tokens(cleaned).length < 2) return null;
  const [best, second] = index.search(cleaned, { limit: 2 });
  if (!best) return null;
  // Both directions must agree: the line covers the product, and the product's own name is mostly in the line.
  const q = tokens(cleaned);
  const nameTokens = tokens(best.product.name);
  const nameHits = nameTokens.filter((n) => q.some((t) => t === n || (t.length >= 4 && (n.startsWith(t) || t.startsWith(n) || editDistance(t, n, 1) <= 1)))).length;
  const nameCoverage = nameTokens.length ? nameHits / nameTokens.length : 0;
  const confident = best.brandMatched ? best.coverage >= 0.6 : best.coverage >= 0.75 && nameCoverage >= 0.75;
  if (!confident) return null;
  // Ambiguous between two different products with the same score: don't guess.
  if (second && Math.abs(second.score - best.score) < 0.01 && second.product.useGroup !== best.product.useGroup) return null;
  return best;
}
