// Quality Score (PRD section "Quality Score"): S = 0.40 N + 0.25 I + 0.20 H + 0.15 L
// Weights and thresholds are placeholders until an advisor signs them.
//
// N  nutrition, scored with a Nutri-Score-style points system per 100 g/ml
// I  ingredients: processing level (NOVA), additive count, hydrogenated fat
// H  label honesty: needs Claim Check (Phase 2), so it is left out in the beta
// L  lab safety: only from a report that is fresh and allowed to display
// Unknown pillars drop out and the remaining weights rescale.

import type { Nutrition, Product } from "./types";
import { additiveCount, hasPartiallyHydrogenatedOil } from "./ingredients";
import type { ReportDisplay } from "./trust";

export const QUALITY_METHOD_VERSION = "q-0.2.0";
export const WEIGHTS = { N: 0.4, I: 0.25, H: 0.2, L: 0.15 } as const;

export type EvidenceLevel = "lab-verified" | "label-analysed" | "insufficient";

export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  "lab-verified": "Lab-verified",
  "label-analysed": "Label-analysed",
  insufficient: "Insufficient data",
};

export type QualityResult = {
  score: number | null;
  band: "Excellent" | "Good" | "Fair" | "Poor" | null;
  evidence: EvidenceLevel;
  pillars: { N: number | null; I: number | null; H: number | null; L: number | null };
  capped: boolean;
  notes: string[];
  method: string;
};

const NUTRITION_FIELDS: (keyof Nutrition)[] = [
  "energyKcal",
  "protein",
  "carbohydrate",
  "totalSugar",
  "addedSugar",
  "fat",
  "saturatedFat",
  "transFat",
  "sodiumMg",
  "fibre",
];

export function missingNutritionShare(n: Nutrition): number {
  const missing = NUTRITION_FIELDS.filter((k) => n[k] === null || n[k] === undefined).length;
  return missing / NUTRITION_FIELDS.length;
}

function points(value: number, thresholds: number[]): number {
  let p = 0;
  for (const t of thresholds) if (value > t) p++;
  return p;
}

const isBeverage = (p: Product) => p.unit === "ml" && p.useGroup !== "milk";

/** Nutrition pillar 0-100 (higher is better). */
export function nutritionPillar(p: Product): number | null {
  const n = p.nutritionPer100;
  if (missingNutritionShare(n) > 0.2) return null;
  const kj = (n.energyKcal ?? 0) * 4.184;
  const sugar = n.totalSugar ?? 0;
  const sat = n.saturatedFat ?? 0;
  const sodium = n.sodiumMg ?? 0;
  let negative: number;
  if (isBeverage(p)) {
    negative =
      points(kj, [0, 30, 60, 90, 120, 150, 180, 210, 240, 270]) +
      points(sugar, [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5]) +
      points(sat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
      points(sodium, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
  } else {
    negative =
      points(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]) +
      points(sugar, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]) +
      points(sat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
      points(sodium, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
  }
  const fibre = points(n.fibre ?? 0, [0.9, 1.9, 2.8, 3.7, 4.7]);
  const protein = points(n.protein ?? 0, [1.6, 3.2, 4.8, 6.4, 8.0]);
  const raw = negative - fibre - (negative >= 11 ? 0 : protein);
  let score = 100 - ((raw + 10) * 100) / 50; // raw -10 -> 100, raw 40 -> 0
  if ((n.transFat ?? 0) > 1 || hasPartiallyHydrogenatedOil(p.ingredients)) score -= 15;
  return clamp(Math.round(score));
}

/** Ingredients pillar 0-100. */
export function ingredientsPillar(p: Product): number | null {
  if (!p.ingredients.length || p.nova === null) return null;
  const novaBase: Record<number, number> = { 1: 100, 2: 85, 3: 65, 4: 40 };
  let score = novaBase[p.nova] ?? 50;
  score -= Math.min(25, additiveCount(p.ingredients) * 5);
  if (hasPartiallyHydrogenatedOil(p.ingredients)) score -= 20;
  return clamp(Math.round(score));
}

export function computeQuality(p: Product, reports: ReportDisplay[]): QualityResult {
  const notes: string[] = [];
  const N = nutritionPillar(p);
  const I = ingredientsPillar(p);
  const H: number | null = null; // Claim Check arrives in Phase 2
  const counted = reports.filter((r) => r.countsTowardScore);
  const L = counted.length ? Math.min(...counted.map((r) => r.lValue ?? 100)) : null;
  const criticalFail = reports.some((r) => r.criticalFail);

  if (N === null) {
    notes.push("More than 20% of nutrition fields are missing, so no score is shown.");
    return { score: null, band: null, evidence: "insufficient", pillars: { N, I, H, L }, capped: false, notes, method: QUALITY_METHOD_VERSION };
  }

  const parts: [number, number][] = [[N, WEIGHTS.N]];
  if (I !== null) parts.push([I, WEIGHTS.I]);
  if (L !== null) parts.push([L, WEIGHTS.L]);
  const totalWeight = parts.reduce((s, [, w]) => s + w, 0);
  let score = Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / totalWeight);
  notes.push("Label honesty (H) waits for Claim Check, so its weight is shared out across the other pillars.");
  if (I === null) notes.push("Ingredients not captured, so the ingredients pillar is left out.");
  if (L === null) notes.push("No lab result counts toward this score yet (no report, a stale one, or one we can't display).");

  let capped = false;
  if (criticalFail && score > 40) {
    score = 40;
    capped = true;
    notes.push("Capped at 40 because of a failed critical lab test.");
  }

  const evidence: EvidenceLevel = L !== null ? "lab-verified" : "label-analysed";
  return { score, band: scoreBand(score), evidence, pillars: { N, I, H, L }, capped, notes, method: QUALITY_METHOD_VERSION };
}

export function scoreBand(s: number): QualityResult["band"] {
  if (s >= 80) return "Excellent";
  if (s >= 60) return "Good";
  if (s >= 41) return "Fair";
  return "Poor";
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
