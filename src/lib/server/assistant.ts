import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { medicalBoundary } from "../assistant/guard";
import { VERDICT_WORDS } from "../fit/words";
import { catalogue, getView, searchViews, type ProductView } from "./catalogue";
import { groupFor, item, label, rankForPerson, rulesAnswer, sourcesFor, type AssistantAnswer } from "../assistant/rules";
import type { Evaluator } from "../personal";
import { fitFor, swapsFor, type PersonContext } from "./person";
import type { FitResult } from "../types";

// The assistant answers from our catalogue and the person's Fit only, and
// shows its sources (PRD D4). Rules decide; the model (when configured) only
// chooses which tools to call and words the answer.

export type { AssistantAnswer, AssistantItem } from "../assistant/rules";

const MODEL = "claude-opus-5-5";

function evaluatorFor(ctx: PersonContext | null): Evaluator {
  return { cat: catalogue(), personalised: Boolean(ctx), fit: (v) => (ctx ? fitFor(ctx, v) : null), swaps: (v) => swapsFor(ctx, v) };
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
      const ev = evaluatorFor(ctx);
      const ranked = rankForPerson(ev, groupFor(ev, query)).slice(0, 5);
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

  if (final.stop_reason === "refusal") return { ...rulesAnswer(question, evaluatorFor(ctx)), engine: "rules" };
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
  return rulesAnswer(q, evaluatorFor(ctx));
}
