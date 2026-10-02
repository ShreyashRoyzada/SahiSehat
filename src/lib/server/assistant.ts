import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { medicalBoundary } from "../assistant/guard";
import { VERDICT_WORDS } from "../fit/words";
import { verdictRank } from "../fit/engine";
import { catalogue, getView, searchViews, type ProductView } from "./catalogue";
import { fitFor, swapsFor, type PersonContext } from "./person";
import type { FitResult } from "../types";

// The assistant answers from our catalogue and the person's Fit only, and
// shows its sources (PRD D4). Rules decide; the model (when configured) only
// chooses which tools to call and words the answer.

export type AssistantItem = { productId: string; name: string; verdict: string | null; score: number | null; note: string };
export type AssistantAnswer = {
  text: string;
  items: AssistantItem[];
  sources: { label: string; href: string }[];
  declined: boolean;
  engine: "rules" | "claude";
};

const MODEL = "claude-opus-5-5";

function label(v: ProductView) {
  return `${v.product.brand} ${v.product.name}`;
}

function item(v: ProductView, fit: FitResult | null, note?: string): AssistantItem {
  return {
    productId: v.product.id,
    name: label(v),
    verdict: fit && fit.verdict !== "no-verdict" ? VERDICT_WORDS[fit.verdict].plain : null,
    score: v.quality.score,
    note: note ?? fit?.reasons[0]?.text ?? (v.quality.score !== null ? `Quality Score ${v.quality.score} (${v.quality.band}).` : "Insufficient data."),
  };
}

function sourcesFor(views: ProductView[], fits: (FitResult | null)[]): AssistantAnswer["sources"] {
  const out: AssistantAnswer["sources"] = views.map((v) => ({ label: label(v), href: `/p/${v.product.id}` }));
  const rules = new Set(fits.flatMap((f) => f?.reasons.map((r) => r.ruleId) ?? []));
  if (rules.size) out.push({ label: `Fit rules ${[...rules].join(", ")} (rule table ${fits.find(Boolean)?.ruleVersion})`, href: "/method#fit" });
  out.push({ label: "Quality Score method", href: "/method#quality" });
  return out;
}

// ---- Tools shared by both engines ----------------------------------------------

export function rankForPerson(ctx: PersonContext | null, views: ProductView[]) {
  const withFit = views.map((v) => ({ v, fit: ctx ? fitFor(ctx, v) : null }));
  return withFit
    .filter((x) => !x.v.swapBlock)
    .sort((a, b) => {
      const fa = a.fit ? verdictRank(a.fit.verdict) : 0;
      const fb = b.fit ? verdictRank(b.fit.verdict) : 0;
      return fa - fb || (b.v.quality.score ?? -1) - (a.v.quality.score ?? -1);
    });
}

/** Products in the same use group as the best search match. */
function groupFor(query: string): ProductView[] {
  const top = searchViews(query, { limit: 5 });
  if (!top.length) return [];
  const counts = new Map<string, number>();
  for (const v of top) counts.set(v.product.useGroup, (counts.get(v.product.useGroup) ?? 0) + 1);
  const group = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return catalogue().list.filter((v) => v.product.useGroup === group);
}

// ---- Rule-based engine -------------------------------------------------------------

const STRIP = /\b(which|what|are|is|the|best|good|for|me|my|suit|suits|suited|right|should|i|buy|eat|why|red|amber|green|not|a|an|of|to|instead|swap|alternative|alternatives|better|than|show|find|fit|fits|low|sugar|salt|sodium|fat|options?|can|have|healthy|healthier|it|this|in|with|please)\b/gi;

function topic(q: string): string {
  return q.replace(/[?.!,]/g, " ").replace(STRIP, " ").replace(/\s+/g, " ").trim();
}

function rulesAnswer(question: string, ctx: PersonContext | null): AssistantAnswer {
  const q = question.toLowerCase();
  const subject = topic(question) || question;
  const asksWhy = /\bwhy\b|\bis\b.*\b(good|ok|okay|fine|sahi|safe)\b|\bverdict\b/.test(q);
  const asksSwap = /\b(instead|swap|alternative|replace|better than)\b/.test(q);
  const asksWhich = /\b(which|what|best|suggest|recommend|options?)\b/.test(q);

  if ((asksWhy || asksSwap) && !asksWhich) {
    const v = searchViews(subject, { limit: 1 })[0];
    if (!v) return { text: `I couldn't find "${subject}" in our catalogue. Try the product's brand and name, or request it from the search page.`, items: [], sources: [], declined: false, engine: "rules" };
    const fit = ctx ? fitFor(ctx, v) : null;
    if (asksSwap) {
      const s = swapsFor(ctx, v);
      if (!s.swaps.length) return { text: `${label(v)}: ${s.reason}`, items: [item(v, fit)], sources: sourcesFor([v], [fit]), declined: false, engine: "rules" };
      const views = s.swaps.map((x) => getView(x.product.id)!);
      return {
        text: `Instead of ${label(v)}, here ${s.swaps.length === 1 ? "is one option" : `are ${s.swaps.length} options`} for the same use, ranked by your Fit, then Quality Score, then price.`,
        items: s.swaps.map((x) => item(getView(x.product.id)!, x.fit, x.differences.join("; ") || undefined)),
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

  const group = groupFor(subject);
  if (!group.length) {
    return { text: `I couldn't find products matching "${subject}". Try a category such as biscuits, oats, namkeen, milk or peanut butter.`, items: [], sources: [], declined: false, engine: "rules" };
  }
  const ranked = rankForPerson(ctx, group).slice(0, 5);
  const intro = ctx
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

// ---- Claude engine (optional) ----------------------------------------------------------

const SYSTEM = `You are the SahiSehat assistant. SahiSehat helps adults in India who manage blood sugar, cholesterol or blood pressure choose packaged food.

Rules you must follow:
- Answer only from the tools. Every product fact, score or verdict in your answer must come from a tool result in this conversation. If the tools don't have it, say so.
- Verdicts come from SahiSehat's rule engine via the check_fit tool. Never invent, change or soften a verdict.
- This is nutrition information, not medical advice. Never diagnose, never name a disease the person may have, never discuss medicines, doses or supplements amounts, and never use "cure" or "reverse".
- Keep answers short: two to five sentences, plain English, numbers from the tools.
- Refer to products by brand and name.`;

async function claudeAnswer(question: string, ctx: PersonContext | null): Promise<AssistantAnswer> {
  const client = new Anthropic();
  const touched = new Map<string, FitResult | null>();
  const touch = (v: ProductView, fit: FitResult | null = null) => {
    if (!touched.has(v.product.id) || fit) touched.set(v.product.id, fit);
  };

  const searchTool = betaZodTool({
    name: "search_products",
    description: "Search the SahiSehat catalogue by name, brand, category or Hinglish term. Returns product ids, names, categories and Quality Scores.",
    inputSchema: z.object({ query: z.string() }),
    run: async ({ query }) => {
      const res = searchViews(query, { limit: 8 });
      res.forEach((v) => touch(v));
      return JSON.stringify(res.map((v) => ({ id: v.product.id, name: label(v), category: v.product.category, qualityScore: v.quality.score, evidence: v.quality.evidence })));
    },
  });
  const productTool = betaZodTool({
    name: "get_product",
    description: "Get one product's label nutrition per serving, ingredients, Quality Score and lab-evidence status.",
    inputSchema: z.object({ id: z.string() }),
    run: async ({ id }) => {
      const v = getView(id);
      if (!v) return "No product with that id.";
      touch(v);
      return JSON.stringify({ id, name: label(v), servingSize: `${v.product.servingSize} ${v.product.unit}`, per100: v.product.nutritionPer100, ingredients: v.product.ingredients, quality: v.quality, lab: v.reports.map((r) => r.label), labelData: v.product.labelSource.note });
    },
  });
  const fitTool = betaZodTool({
    name: "check_fit",
    description: "Get this person's Fit verdict for one product, with the reasons and rule ids. Requires a product id.",
    inputSchema: z.object({ id: z.string() }),
    run: async ({ id }) => {
      const v = getView(id);
      if (!v) return "No product with that id.";
      if (!ctx) return "The person has not added health numbers, so there is no personal verdict. Share the Quality Score instead.";
      const fit = fitFor(ctx, v);
      touch(v, fit);
      return JSON.stringify({ verdict: VERDICT_WORDS[fit.verdict].plain, reasons: fit.reasons.map((r) => ({ rule: r.ruleId, text: r.text, trigger: r.trigger })), note: fit.note, ruleVersion: fit.ruleVersion });
    },
  });
  const rankTool = betaZodTool({
    name: "rank_category_for_me",
    description: "Rank the products that share a use with the best match for a query (e.g. 'biscuits', 'peanut butter') by this person's Fit, then Quality Score. Returns the top five.",
    inputSchema: z.object({ query: z.string() }),
    run: async ({ query }) => {
      const ranked = rankForPerson(ctx, groupFor(query)).slice(0, 5);
      ranked.forEach((x) => touch(x.v, x.fit));
      return JSON.stringify(ranked.map((x) => ({ id: x.v.product.id, name: label(x.v), verdict: x.fit ? VERDICT_WORDS[x.fit.verdict].plain : null, topReason: x.fit?.reasons[0]?.text ?? null, qualityScore: x.v.quality.score })));
    },
  });
  const swapTool = betaZodTool({
    name: "find_swaps",
    description: "Find up to three better same-use swaps for a product, ranked by Fit, Quality Score and unit price, with the nutrient differences.",
    inputSchema: z.object({ id: z.string() }),
    run: async ({ id }) => {
      const v = getView(id);
      if (!v) return "No product with that id.";
      touch(v);
      const s = swapsFor(ctx, v);
      s.swaps.forEach((x) => touch(getView(x.product.id)!, x.fit));
      return JSON.stringify({ reason: s.reason, swaps: s.swaps.map((x) => ({ id: x.product.id, name: `${x.product.brand} ${x.product.name}`, verdict: x.fit ? VERDICT_WORDS[x.fit.verdict].plain : null, qualityScore: x.quality.score, differences: x.differences })) });
    },
  });

  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    tools: [searchTool, productTool, fitTool, rankTool, swapTool],
    max_iterations: 8,
    messages: [{ role: "user", content: question }],
  });

  if (final.stop_reason === "refusal") return { ...rulesAnswer(question, ctx), engine: "rules" };
  const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  const views = [...touched.keys()].map((id) => getView(id)!).filter(Boolean).slice(0, 6);
  return {
    text: text || "I couldn't find an answer in our catalogue.",
    items: views.filter((v) => touched.get(v.product.id)).map((v) => item(v, touched.get(v.product.id) ?? null)),
    sources: sourcesFor(views, views.map((v) => touched.get(v.product.id) ?? null)),
    declined: false,
    engine: "claude",
  };
}

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function answer(question: string, ctx: PersonContext | null): Promise<AssistantAnswer> {
  const q = question.trim().slice(0, 500);
  const boundary = medicalBoundary(q);
  if (boundary) return { text: boundary.text, items: [], sources: [], declined: true, engine: "rules" };
  if (claudeConfigured()) {
    try {
      return await claudeAnswer(q, ctx);
    } catch (err) {
      console.error("assistant: Claude call failed, falling back to rules", err instanceof Anthropic.APIError ? err.status : err);
    }
  }
  return rulesAnswer(q, ctx);
}
