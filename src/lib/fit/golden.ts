// Golden Fit cases (PRD C8): fictional profile + product pairs with expected
// verdicts, reviewed by the advisor and run on every rule-table change, both in
// the test suite and in the admin console before a new version can go live.
import type { FitVerdict, Marker, Product, Profile } from "../types";
import { computeFit } from "./engine";
import type { RuleTable } from "./rules";


export const GOLDEN_AS_OF = new Date("2026-10-02T00:00:00Z");

export function product(over: Partial<Product> & { id: string }): Product {
  return {
    gtin: "0000000000000",
    fssaiLicence: null,
    brand: "Test Brand",
    name: over.id,
    category: "Biscuits & cookies",
    useGroup: "biscuit",
    unit: "g",
    servingSize: 30,
    nutritionPer100: {
      energyKcal: 400,
      protein: 8,
      carbohydrate: 60,
      totalSugar: 5,
      addedSugar: 3,
      fat: 10,
      saturatedFat: 3,
      transFat: 0,
      sodiumMg: 200,
      fibre: 5,
    },
    nova: 3,
    vegMark: "veg",
    allergens: { contains: [], mayContain: [] },
    ingredients: ["Whole wheat flour (atta)", "Edible vegetable oil", "Salt"],
    claims: [],
    labelSource: { kind: "pack-photo", verified: true, note: "fixture" },
    reportIds: [],
    qcKey: null,
    qcLine: null,
    price: null,
    sourceLinks: ["https://example.com"],
    version: 1,
    status: "published",
    updatedAt: "2026-10-02",
    ...over,
  };
}

export function nutrition(p: Partial<Product["nutritionPer100"]>): Product["nutritionPer100"] {
  return { ...product({ id: "x" }).nutritionPer100, ...p };
}

export function profile(over: Partial<Profile> = {}): Profile {
  return { ageBand: "30-44", conditions: [], goals: [], diet: "none", allergens: [], screen: [], ...over };
}

export function marker(name: Marker["name"], value: number, sampleDate = "2026-08-10", labFlag: Marker["labFlag"] = null): Marker {
  const unit = name === "hba1c" ? "%" : name.endsWith("bp") ? "mmHg" : "mg/dL";
  return { name, value, unit, sampleDate, labFlag, labRange: null, source: "report" };
}

// PRD worked example (fictional): Crunchy Oats Cookies and Roasted Chana Snack.
export const crunchyOatsCookies = product({
  id: "crunchy-oats-cookies",
  name: "Crunchy Oats Cookies",
  servingSize: 40,
  nutritionPer100: nutrition({ totalSugar: 35, addedSugar: 35, saturatedFat: 10, sodiumMg: 300 }),
  ingredients: ["Refined wheat flour (maida)", "Sugar", "Oats", "Palm oil"],
});

export const roastedChanaSnack = product({
  id: "roasted-chana-snack",
  name: "Roasted Chana Snack",
  category: "Packaged snacks",
  useGroup: "biscuit",
  servingSize: 30,
  nutritionPer100: nutrition({ totalSugar: 1.67, addedSugar: 1.67, saturatedFat: 2.67, sodiumMg: 250, protein: 20, fibre: 15 }),
  ingredients: ["Roasted chana", "Salt", "Turmeric"],
});

// Riya, 34 (fictional persona): HbA1c 6.1% and LDL 138 mg/dL, both flagged high, Aug 2026.
export const riya = { profile: profile({ ageBand: "30-44" }), markers: [marker("hba1c", 6.1, "2026-08-14", "high"), marker("ldl", 138, "2026-08-14", "high")] };

export type GoldenCase = { name: string; profile: Profile; markers: Marker[]; product: Product; expect: FitVerdict; reasonIncludes?: string[] };

const salty = product({ id: "salty-noodles", useGroup: "noodles", servingSize: 70, nutritionPer100: nutrition({ sodiumMg: 1200, addedSugar: 1.5 }), ingredients: ["Refined wheat flour (maida)", "Palm oil", "Salt"] });
const vanaspati = product({ id: "vanaspati", useGroup: "cooking-fat", servingSize: 10, nutritionPer100: nutrition({ saturatedFat: 45, transFat: 2, addedSugar: 0, totalSugar: 0, sodiumMg: 0 }), ingredients: ["Partially hydrogenated vegetable oils"] });
const ghee = product({ id: "ghee", useGroup: "cooking-fat", servingSize: 5, nutritionPer100: nutrition({ saturatedFat: 62, transFat: 2, addedSugar: 0, totalSugar: 0, sodiumMg: 0 }), ingredients: ["Cow milk fat"], allergens: { contains: ["milk"], mayContain: [] } });
const honey = product({ id: "honey", useGroup: "honey", servingSize: 15, nutritionPer100: nutrition({ totalSugar: 78, addedSugar: 78, sodiumMg: 5 }), ingredients: ["Honey"] });
const milk = product({ id: "toned-milk", unit: "ml", useGroup: "milk", servingSize: 200, nutritionPer100: nutrition({ totalSugar: 4.7, addedSugar: 0, saturatedFat: 1.9, sodiumMg: 45 }), ingredients: ["Milk (toned)"], allergens: { contains: ["milk"], mayContain: [] } });
const noAdded = product({ id: "no-added-sugar-decl", servingSize: 30, nutritionPer100: nutrition({ totalSugar: 20, addedSugar: null }) });
const noServing = product({ id: "no-serving", servingSize: null });
const noSodium = product({ id: "no-sodium", nutritionPer100: nutrition({ sodiumMg: null }) });
const noIngredients = product({ id: "no-ingredients", ingredients: [] });
const peanutButter = product({ id: "peanut-butter", useGroup: "nut-butter", servingSize: 32, nutritionPer100: nutrition({ addedSugar: 0, totalSugar: 5, saturatedFat: 8.6, sodiumMg: 15 }), ingredients: ["Roasted peanuts"], allergens: { contains: ["peanut"], mayContain: [] } });
const mayNuts = product({ id: "may-contain-nuts", allergens: { contains: [], mayContain: ["treenut"] } });
const hiddenMilk = product({ id: "hidden-milk", ingredients: ["Wheat flour", "Whey powder", "Sugar"], allergens: { contains: ["gluten"], mayContain: [] } });
const chicken = product({ id: "chicken", vegMark: "non-veg", useGroup: "meat", ingredients: ["Chicken"], nutritionPer100: nutrition({ addedSugar: 0, totalSugar: 0, sodiumMg: 70 }) });
const onionChips = product({ id: "onion-chips", useGroup: "salty-snack", ingredients: ["Potato", "Palm oil", "Onion powder", "Salt"] });
const vagueMasala = product({ id: "vague-masala", ingredients: ["Rice flour", "Palm oil", "Spices and condiments", "Salt"] });
const plainSnack = product({ id: "plain-makhana", useGroup: "salty-snack", servingSize: 30, nutritionPer100: nutrition({ sodiumMg: 100, addedSugar: 0 }), ingredients: ["Fox nuts", "Rock salt"] });

const bp = (s: number, d: number, date = "2026-09-01", flag: Marker["labFlag"] = null) => [marker("systolic-bp", s, date, flag), marker("diastolic-bp", d, date, flag)];

export const GOLDEN_CASES: GoldenCase[] = [
  { name: "PRD worked example: cookies are not a good fit for Riya", ...riya, product: crunchyOatsCookies, expect: "not-good", reasonIncludes: ["14 g of added sugar", "56%", "HbA1c as high (Aug 2026)"] },
  { name: "PRD worked example: chana snack is a good fit for Riya", ...riya, product: roastedChanaSnack, expect: "good", reasonIncludes: ["2%"] },
  { name: "Cookie first ingredient is refined flour", ...riya, product: crunchyOatsCookies, expect: "not-good", reasonIncludes: ["Refined wheat flour (maida) is the first ingredient."] },
  { name: "High sodium noodles not a good fit for typed high BP", profile: profile(), markers: bp(142, 92), product: salty, expect: "not-good", reasonIncludes: ["840 mg of sodium", "42%"] },
  { name: "Noodles fine for someone managing only cholesterol (sat fat 4.8%)", profile: profile({ conditions: ["high-cholesterol"] }), markers: [], product: salty, expect: "good" },
  { name: "Declared high BP switches the BP rules on", profile: profile({ conditions: ["high-bp"] }), markers: [], product: salty, expect: "not-good", reasonIncludes: ["You told us you're managing blood pressure."] },
  { name: "Vanaspati is never a good fit for cholesterol (PHO flag)", profile: profile(), markers: [marker("ldl", 165, "2026-07-01", "high")], product: vanaspati, expect: "not-good", reasonIncludes: ["partially hydrogenated"] },
  { name: "A teaspoon of ghee is a good fit on sat-fat share (14%)", profile: profile(), markers: [marker("ldl", 165, "2026-07-01", "high")], product: ghee, expect: "good" },
  { name: "Honey counts as sugar: not a good fit for blood sugar", profile: profile({ conditions: ["diabetes"] }), markers: [], product: honey, expect: "not-good", reasonIncludes: ["Honey is the first ingredient."] },
  { name: "Milk lactose is not added sugar: good fit", profile: profile({ conditions: ["prediabetes"] }), markers: [], product: milk, expect: "good" },
  { name: "No added-sugar declaration falls back to total sugar and says so", profile: profile({ conditions: ["diabetes"] }), markers: [], product: noAdded, expect: "small", reasonIncludes: ["total sugar is used"] },
  { name: "Missing serving size -> can't tell", ...riya, product: noServing, expect: "cant-tell" },
  { name: "Missing sodium with BP on -> can't tell, names sodium", profile: profile({ conditions: ["high-bp"] }), markers: [], product: noSodium, expect: "cant-tell" },
  { name: "Missing sodium is irrelevant when only blood sugar is on", profile: profile({ conditions: ["diabetes"] }), markers: [], product: noSodium, expect: "good" },
  { name: "Peanut allergy blocks peanut butter", profile: profile({ allergens: ["peanut"], conditions: ["diabetes"] }), markers: [], product: peanutButter, expect: "blocked" },
  { name: "May-contain tree nuts blocks for tree-nut allergy", profile: profile({ allergens: ["treenut"] }), markers: [], product: mayNuts, expect: "blocked" },
  { name: "Whey in ingredients blocks milk allergy even without a contains line", profile: profile({ allergens: ["milk"] }), markers: [], product: hiddenMilk, expect: "blocked" },
  { name: "Vegetarian blocks chicken", profile: profile({ diet: "vegetarian", conditions: ["high-bp"] }), markers: [], product: chicken, expect: "blocked" },
  { name: "Vegan blocks milk", profile: profile({ diet: "vegan" }), markers: [], product: milk, expect: "blocked" },
  { name: "Jain blocks onion and potato", profile: profile({ diet: "jain" }), markers: [], product: onionChips, expect: "blocked" },
  { name: "Jain blocks unitemised seasoning", profile: profile({ diet: "jain" }), markers: [], product: vagueMasala, expect: "blocked" },
  { name: "Allergen profile with missing ingredients -> can't tell", profile: profile({ allergens: ["milk"], conditions: ["diabetes"] }), markers: [], product: noIngredients, expect: "cant-tell" },
  { name: "Under-18 gets no personal verdict", profile: profile({ ageBand: "under-18", conditions: ["diabetes"] }), markers: [], product: crunchyOatsCookies, expect: "no-verdict" },
  { name: "Pregnancy gets no personal verdict", profile: profile({ screen: ["pregnancy"] }), ...{ markers: riya.markers }, product: crunchyOatsCookies, expect: "no-verdict" },
  { name: "Kidney disease gets no personal verdict", profile: profile({ screen: ["kidney-disease"] }), markers: [], product: salty, expect: "no-verdict" },
  { name: "Critical HbA1c -> see your doctor, no verdict", profile: profile(), markers: [marker("hba1c", 11.2, "2026-09-01", "high")], product: roastedChanaSnack, expect: "no-verdict" },
  { name: "Lab-printed critical flag -> no verdict", profile: profile(), markers: [marker("triglycerides", 420, "2026-09-01", "critical")], product: milk, expect: "no-verdict" },
  { name: "Lab-printed normal beats our default threshold", profile: profile(), markers: [marker("hba1c", 5.8, "2026-09-01", "normal")], product: crunchyOatsCookies, expect: "cant-tell" },
  { name: "Markers older than 12 months stop switching rules on", profile: profile(), markers: [marker("hba1c", 6.5, "2025-06-01", "high")], product: crunchyOatsCookies, expect: "cant-tell" },
  { name: "Namkeen is small portions for BP even when low in sodium", profile: profile({ conditions: ["high-bp"] }), markers: [], product: plainSnack, expect: "small", reasonIncludes: ["salt-heavy"] },
];


export type GoldenRun = { passed: number; failed: { name: string; expected: FitVerdict; got: FitVerdict; missingText: string[] }[] };

export function runGolden(rules: RuleTable): GoldenRun {
  const failed: GoldenRun["failed"] = [];
  for (const c of GOLDEN_CASES) {
    const r = computeFit({ profile: c.profile, markers: c.markers, product: c.product, rules, asOf: GOLDEN_AS_OF });
    const text = [...r.reasons.map((x) => `${x.text} ${x.trigger ?? ""}`), r.note ?? ""].join(" | ");
    const missingText = (c.reasonIncludes ?? []).filter((s) => !text.includes(s));
    if (r.verdict !== c.expect || missingText.length) failed.push({ name: c.name, expected: c.expect, got: r.verdict, missingText });
  }
  return { passed: GOLDEN_CASES.length - failed.length, failed };
}
