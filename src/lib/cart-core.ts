// Cart check (PRD D3): a badge per item, the three biggest swaps, and unmatched
// items listed, never guessed. Pure; used by the server API and the demo build.
import type { FitVerdict } from "./types";
import { VERDICT_WORDS } from "./fit/words";
import { cleanCartLine } from "./search";
import type { Evaluator } from "./personal";
import type { ProductView } from "./catalogue-core";

export type CartItem = { line: string; productId: string; name: string; verdict: FitVerdict | null; verdictText: string | null; reason: string | null; score: number | null };
export type CartSwap = { fromId: string; fromName: string; toId: string; toName: string; differences: string[]; why: string };
export type CartResult = { matched: CartItem[]; unmatched: string[]; swaps: CartSwap[] };

const severity = (v: FitVerdict | null, score: number | null) => (v === "not-good" || v === "blocked" ? 300 : v === "small" ? 200 : 0) + (100 - (score ?? 50));

export function checkCart(text: string, ev: Evaluator): CartResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && cleanCartLine(l).length >= 3)
    .slice(0, 60);
  const matched: { item: CartItem; view: ProductView }[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const v = ev.cat.matchText(line);
    if (!v) {
      if (/[a-z]{3,}/i.test(cleanCartLine(line))) unmatched.push(line);
      continue;
    }
    if (seen.has(v.product.id)) continue;
    seen.add(v.product.id);
    const fit = ev.fit(v);
    matched.push({
      view: v,
      item: {
        line,
        productId: v.product.id,
        name: `${v.product.brand} ${v.product.name}`,
        verdict: fit?.verdict ?? null,
        verdictText: fit ? VERDICT_WORDS[fit.verdict].plain : null,
        reason: fit?.reasons[0]?.text ?? fit?.note ?? null,
        score: v.quality.score,
      },
    });
  }
  const swaps: CartSwap[] = [];
  for (const m of [...matched].sort((a, b) => severity(b.item.verdict, b.item.score) - severity(a.item.verdict, a.item.score))) {
    if (swaps.length >= 3) break;
    if (m.item.verdict === "good" || m.item.verdict === "cant-tell" || m.item.verdict === "no-verdict") continue;
    const s = ev.swaps(m.view).swaps[0];
    if (!s) continue;
    swaps.push({
      fromId: m.item.productId,
      fromName: m.item.name,
      toId: s.product.id,
      toName: `${s.product.brand} ${s.product.name}`,
      differences: s.differences,
      why: s.fit ? `${VERDICT_WORDS[s.fit.verdict].plain} for you · Quality Score ${s.quality.score}` : `Quality Score ${s.quality.score} vs ${m.item.score ?? "n/a"}`,
    });
  }
  return { matched: matched.map((m) => m.item), unmatched, swaps };
}
