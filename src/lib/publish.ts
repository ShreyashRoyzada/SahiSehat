import type { Product } from "./types";
import { missingNutritionShare } from "./quality";

/** PRD A1: a record cannot be published without GTIN, ingredients, nutrition per 100 g and per serving, and a source link. */
export function publishBlockers(p: Product): string[] {
  const out: string[] = [];
  if (!p.gtin) out.push("GTIN");
  if (!p.ingredients.length) out.push("ingredients");
  if (missingNutritionShare(p.nutritionPer100) > 0.2) out.push("nutrition per 100 g");
  if (!p.servingSize) out.push("serving size (for per-serving values)");
  if (!p.sourceLinks.length) out.push("a source link");
  if (!p.labelSource.verified) out.push("label checked against the pack");
  return out;
}

