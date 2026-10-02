// Rule-based assistant engine (PRD D4): answers only from the catalogue and the
// person's Fit, with sources. Pure; the server may put Claude in front of it.
import type { FitResult } from "../types";
import { VERDICT_WORDS } from "../fit/words";
import { verdictRank } from "../fit/engine";
import type { ProductView } from "../catalogue-core";
import type { Evaluator } from "../personal";

export type AssistantItem = { productId: string; name: string; verdict: string | null; score: number | null; note: string };
export type AssistantAnswer = {
  text: string;
  items: AssistantItem[];
  sources: { label: string; href: string }[];
  declined: boolean;
  engine: "rules" | "claude";
};

export function label(v: ProductView) {
  return `${v.product.brand} ${v.product.name}`;
}

export function item(v: ProductView, fit: FitResult | null, note?: string): AssistantItem {
  return {
    productId: v.product.id,
    name: label(v),
    verdict: fit && fit.verdict !== "no-verdict" ? VERDICT_WORDS[fit.verdict].plain : null,
    score: v.quality.score,
    note: note ?? fit?.reasons[0]?.text ?? (v.quality.score !== null ? `Quality Score ${v.quality.score} (${v.quality.band}).` : "Insufficient data."),
  };
}

export function sourcesFor(views: ProductView[], fits: (FitResult | null)[]): AssistantAnswer["sources"] {
  const out: AssistantAnswer["sources"] = views.map((v) => ({ label: label(v), href: `/p/${v.product.id}` }));
  const rules = new Set(fits.flatMap((f) => f?.reasons.map((r) => r.ruleId) ?? []));
  if (rules.size) out.push({ label: `Fit rules ${[...rules].join(", ")} (rule table ${fits.find(Boolean)?.ruleVersion})`, href: "/method#fit" });
  out.push({ label: "Quality Score method", href: "/method#quality" });
  return out;
}

// ---- Tools shared by both engines ----------------------------------------------

export function rankForPerson(ev: Evaluator, views: ProductView[]) {
  const withFit = views.map((v) => ({ v, fit: ev.fit(v) }));
  return withFit
    .filter((x) => !x.v.swapBlock)
    .sort((a, b) => {
      const fa = a.fit ? verdictRank(a.fit.verdict) : 0;
      const fb = b.fit ? verdictRank(b.fit.verdict) : 0;
      return fa - fb || (b.v.quality.score ?? -1) - (a.v.quality.score ?? -1);
    });
}

/** Products in the same use group as the best search match. */
export function groupFor(ev: Evaluator, query: string): ProductView[] {
  const top = ev.cat.search(query, { limit: 5 });
  if (!top.length) return [];
  const counts = new Map<string, number>();
  for (const v of top) counts.set(v.product.useGroup, (counts.get(v.product.useGroup) ?? 0) + 1);
  const group = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return ev.cat.list.filter((v) => v.product.useGroup === group);
}

// ---- Rule-based engine -------------------------------------------------------------

const STRIP = /\b(which|what|are|is|the|best|good|for|me|my|suit|suits|suited|right|should|i|buy|eat|why|red|amber|green|not|a|an|of|to|instead|swap|alternative|alternatives|better|than|show|find|fit|fits|low|sugar|salt|sodium|fat|options?|can|have|healthy|healthier|it|this|in|with|please)\b/gi;

function topic(q: string): string {
  return q.replace(/[?.!,]/g, " ").replace(STRIP, " ").replace(/\s+/g, " ").trim();
}

export function rulesAnswer(question: string, ev: Evaluator): AssistantAnswer {
  const q = question.toLowerCase();
  const subject = topic(question) || question;
  const asksWhy = /\bwhy\b|\bis\b.*\b(good|ok|okay|fine|sahi|safe)\b|\bverdict\b/.test(q);
  const asksSwap = /\b(instead|swap|alternative|replace|better than)\b/.test(q);
  const asksWhich = /\b(which|what|best|suggest|recommend|options?)\b/.test(q);

  if ((asksWhy || asksSwap) && !asksWhich) {
    const v = ev.cat.search(subject, { limit: 1 })[0];
    if (!v) return { text: `I couldn't find "${subject}" in our catalogue. Try the product's brand and name, or request it from the search page.`, items: [], sources: [], declined: false, engine: "rules" };
    const fit = ev.fit(v);
    if (asksSwap) {
      const s = ev.swaps(v);
      if (!s.swaps.length) return { text: `${label(v)}: ${s.reason}`, items: [item(v, fit)], sources: sourcesFor([v], [fit]), declined: false, engine: "rules" };
      const views = s.swaps.map((x) => ev.cat.getView(x.product.id)!);
      return {
        text: `Instead of ${label(v)}, here ${s.swaps.length === 1 ? "is one option" : `are ${s.swaps.length} options`} for the same use, ranked by your Fit, then Quality Score, then price.`,
        items: s.swaps.map((x) => item(ev.cat.getView(x.product.id)!, x.fit, x.differences.join("; ") || undefined)),
        sources: sourcesFor([v, ...views], [fit, ...s.swaps.map((x) => x.fit)]),
        declined: false,
        engine: "rules",
      };
    }
    if (!fit) {
      return { text: `${label(v)} has a Quality Score of ${v.quality.score ?? "n/a"}. Add your numbers or conditions to see whether it suits you.`, items: [item(v, null)], sources: sourcesFor([v], []), declined: false, engine: "rules" };
    }
    const words = VERDICT_WORDS[fit.verdict];
    const reasons = fit.reasons.map((r) => `• ${r.text}${r.trigger ? ` ${r.trigger}` : ""}`).join("\n");
    return {
      text: `${label(v)}: ${words.sahi} (${words.plain}).\n${reasons || fit.note || ""}`.trim(),
      items: [item(v, fit)],
      sources: sourcesFor([v], [fit]),
      declined: false,
      engine: "rules",
    };
  }

  const group = groupFor(ev, subject);
  if (!group.length) {
    return { text: `I couldn't find products matching "${subject}". Try a category such as biscuits, oats, namkeen, milk or peanut butter.`, items: [], sources: [], declined: false, engine: "rules" };
  }
  const ranked = rankForPerson(ev, group).slice(0, 5);
  const intro = ev.personalised
    ? `Here are the ${group[0].product.category.toLowerCase()} in our catalogue that suit your numbers best, ranked by Fit and then Quality Score.`
    : `Here are the best-scoring ${group[0].product.category.toLowerCase()} in our catalogue. Add your numbers to rank them for you.`;
  return {
    text: intro,
    items: ranked.map((x) => item(x.v, x.fit)),
    sources: sourcesFor(
      ranked.map((x) => x.v),
      ranked.map((x) => x.fit),
    ),
    declined: false,
    engine: "rules",
  };
}

