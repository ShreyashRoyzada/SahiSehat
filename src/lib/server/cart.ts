import "server-only";
import { matchText, type ProductView } from "./catalogue";
import { fitFor, swapsFor, type PersonContext } from "./person";
import { VERDICT_WORDS } from "../fit/words";
import type { FitVerdict } from "../types";
import { cleanCartLine } from "../search";

export type CartItem = { line: string; productId: string; name: string; verdict: FitVerdict | null; verdictText: string | null; reason: string | null; score: number | null };
export type CartSwap = { fromId: string; fromName: string; toId: string; toName: string; differences: string[]; why: string };
export type CartResult = { matched: CartItem[]; unmatched: string[]; swaps: CartSwap[] };

const severity = (v: FitVerdict | null, score: number | null) =>
  (v === "not-good" || v === "blocked" ? 300 : v === "small" ? 200 : 0) + (100 - (score ?? 50));

/** PRD D3: badge per item, the three biggest swaps, unmatched items listed, never guessed. */
export function checkCart(text: string, ctx: PersonContext | null): CartResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && cleanCartLine(l).length >= 3)
    .slice(0, 60);
  const matched: (CartItem & { view: ProductView })[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const v = matchText(line);
    if (!v) {
      if (/[a-z]{3,}/i.test(cleanCartLine(line))) unmatched.push(line);
      continue;
    }
    if (seen.has(v.product.id)) continue;
    seen.add(v.product.id);
    const fit = ctx ? fitFor(ctx, v) : null;
    matched.push({
      view: v,
      line,
      productId: v.product.id,
      name: `${v.product.brand} ${v.product.name}`,
      verdict: fit?.verdict ?? null,
      verdictText: fit ? VERDICT_WORDS[fit.verdict].plain : null,
      reason: fit?.reasons[0]?.text ?? fit?.note ?? null,
      score: v.quality.score,
    });
  }
  const swaps: CartSwap[] = [];
  for (const m of [...matched].sort((a, b) => severity(b.verdict, b.score) - severity(a.verdict, a.score))) {
    if (swaps.length >= 3) break;
    if (m.verdict === "good" || m.verdict === "cant-tell" || m.verdict === "no-verdict") continue;
    const s = swapsFor(ctx, m.view).swaps[0];
    if (!s) continue;
    swaps.push({
      fromId: m.productId,
      fromName: m.name,
      toId: s.product.id,
      toName: `${s.product.brand} ${s.product.name}`,
      differences: s.differences,
      why: s.fit ? `${VERDICT_WORDS[s.fit.verdict].plain} for you · Quality Score ${s.quality.score}` : `Quality Score ${s.quality.score} vs ${m.score ?? "n/a"}`,
    });
  }
  return { matched: matched.map((m) => ({ line: m.line, productId: m.productId, name: m.name, verdict: m.verdict, verdictText: m.verdictText, reason: m.reason, score: m.score })), unmatched, swaps };
}
