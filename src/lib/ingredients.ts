// Ingredient analysis: allergen keywords, diet checks and additive flags.
// These are a safety net on top of the declared allergen statement: the
// union of both is used, so a label that forgets a "contains" line is still caught.

import type { Allergen, Diet, Product } from "./types";

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: "Milk",
  gluten: "Gluten (wheat, barley, oats)",
  peanut: "Peanut",
  treenut: "Tree nuts",
  soy: "Soy",
  sesame: "Sesame",
  mustard: "Mustard",
  egg: "Egg",
  fish: "Fish",
  crustacean: "Crustaceans",
  sulphite: "Sulphite",
};

const ALLERGEN_KEYWORDS: Record<Allergen, RegExp> = {
  milk: /\b(milk|butter|ghee|whey|cheese|curd|dahi|paneer|cream|lactose|casein|khoa|yoghurt|yogurt|buttermilk)\b/i,
  gluten: /\b(wheat|maida|atta|barley|rye|malt|semolina|suji|sooji|gluten|spelt)\b/i,
  peanut: /\b(peanuts?|groundnuts?|moongphali|mungfali)\b/i,
  treenut: /\b(almonds?|cashews?|walnuts?|hazelnuts?|pistachios?|pista|badaam|badam|pecans?|macadamia|brazil nuts?)\b/i,
  soy: /\b(soy|soya|soybean|soyabean)\b/i,
  sesame: /\b(sesame|til)\b/i,
  mustard: /\bmustard\b/i,
  egg: /\b(eggs?|albumin)\b/i,
  fish: /\b(fish|anchovy|tuna|salmon)\b/i,
  crustacean: /\b(prawns?|shrimps?|crabs?|lobsters?)\b/i,
  sulphite: /\b(sulphites?|sulfites?|ins 22[0-8])\b/i,
};

/** Butter/ghee/cream also appear in "cocoa butter", "peanut butter" — not dairy. */
function stripFalseDairy(text: string): string {
  return text.replace(/cocoa butter|peanut butter|nut butter|shea butter|coconut milk|almond milk|oat milk/gi, " ");
}

export function detectedAllergens(ingredients: string[]): Allergen[] {
  const text = stripFalseDairy(ingredients.join("; "));
  return (Object.keys(ALLERGEN_KEYWORDS) as Allergen[]).filter((a) => ALLERGEN_KEYWORDS[a].test(text));
}

export type AllergenHit = { allergen: Allergen; kind: "contains" | "may-contain" | "ingredient" };

export function allergenHits(product: Product, personAllergens: Allergen[]): AllergenHit[] {
  const hits: AllergenHit[] = [];
  const detected = detectedAllergens(product.ingredients);
  for (const a of personAllergens) {
    if (product.allergens.contains.includes(a)) hits.push({ allergen: a, kind: "contains" });
    else if (detected.includes(a)) hits.push({ allergen: a, kind: "ingredient" });
    else if (product.allergens.mayContain.includes(a)) hits.push({ allergen: a, kind: "may-contain" });
  }
  return hits;
}

const NON_VEG = /\b(chicken|mutton|meat|fish|egg|eggs|gelatin|gelatine|prawn|shrimp|beef|pork|lard|tallow|anchovy)\b/i;
const ANIMAL = /\b(milk|butter|ghee|whey|cheese|curd|dahi|paneer|cream|lactose|casein|khoa|yoghurt|yogurt|honey|buttermilk)\b/i;
const JAIN_EXCLUDED = /\b(onion|garlic|potato|potatoes|carrot|beetroot|beet|radish|ginger|yam|mushroom|honey|arbi|shakarkandi|sweet potato)\b/i;
// Blends that can hide onion or garlic without naming them.
const VAGUE_SEASONING = /\b(spices and condiments|seasoning|tastemaker|masala \(|natural flavours?|flavours?)\b/i;

export type DietCheck = { ok: true } | { ok: false; reason: string; certain: boolean };

export function checkDiet(product: Product, diet: Diet): DietCheck {
  if (diet === "none") return { ok: true };
  const text = product.ingredients.join("; ");
  const nonVeg = product.vegMark === "non-veg" || NON_VEG.test(text);
  if (nonVeg) return { ok: false, reason: "Not vegetarian (non-veg mark or ingredient).", certain: true };
  if (diet === "vegetarian") return { ok: true };
  if (diet === "vegan") {
    const dairyLike = ANIMAL.test(stripFalseDairy(text)) || product.allergens.contains.includes("milk");
    if (dairyLike) return { ok: false, reason: "Contains milk, honey or another animal ingredient.", certain: true };
    return { ok: true };
  }
  // jain
  const hit = text.match(JAIN_EXCLUDED);
  if (hit) return { ok: false, reason: `Contains ${hit[0].toLowerCase()}, which a Jain diet excludes.`, certain: true };
  if (VAGUE_SEASONING.test(text)) {
    return { ok: false, reason: "The seasoning blend is not itemised, so we can't confirm it has no onion or garlic.", certain: false };
  }
  return { ok: true };
}

const ADDITIVE = /\b(ins\s*\d{3,4}[a-z]?|e\d{3,4}|flavour enhancer|artificial (colour|color|flavour|sweetener)|sweeteners?|emulsifiers?|stabilisers?|preservatives?|colour \(|thickener)\b/gi;

export function additiveCount(ingredients: string[]): number {
  const text = ingredients.join("; ");
  const codes = new Set((text.match(/ins\s*\d{3,4}[a-z]?/gi) ?? []).map((s) => s.replace(/\s+/g, "").toLowerCase()));
  const words = (text.match(ADDITIVE) ?? []).filter((m) => !/^ins/i.test(m)).length;
  return Math.max(codes.size, 0) + (codes.size ? 0 : words);
}

export function hasPartiallyHydrogenatedOil(ingredients: string[]): boolean {
  return /partially hydrogenated|hydrogenated vegetable|vanaspati/i.test(ingredients.join("; "));
}

export function firstIngredient(ingredients: string[]): string | null {
  return ingredients[0]?.trim() || null;
}
