// "My limits" (PRD C2): daily budgets from the active rule table, in plain words.
import type { RuleTable } from "./fit/rules";
import type { Activation } from "./fit/engine";

export type LimitLine = { ruleId: string; title: string; amount: string; plain: string; source: string; why: string[] };

export function myLimits(rules: RuleTable, activation: Activation): LimitLine[] {
  const on = new Set(activation.triggers.map((t) => t.ruleSet.id));
  const why = (id: string) => activation.triggers.filter((t) => t.ruleSet.id === id).map((t) => t.text);
  const out: LimitLine[] = [];
  const L = rules.dailyLimits;
  const triglyceridesOn = activation.triggers.some((t) => t.markers.includes("triglycerides"));
  if (on.has("BS") || triglyceridesOn) {
    out.push({ ruleId: L.addedSugar.ruleId, title: "Sugar", amount: `${L.addedSugar.amount} g a day`, plain: `About ${Math.round(L.addedSugar.amount / 4)} teaspoons of added sugar, honey, jaggery or syrup across the whole day.`, source: L.addedSugar.source, why: [...why("BS"), ...(triglyceridesOn ? why("CH") : [])] });
  }
  if (on.has("CH")) {
    out.push({ ruleId: L.saturatedFat.ruleId, title: "Saturated fat", amount: `${L.saturatedFat.amount} g a day`, plain: "Ghee, butter, palm oil, cheese and coconut oil are the big sources. A teaspoon of ghee is about 3 g.", source: L.saturatedFat.source, why: why("CH") });
    out.push({ ruleId: L.transFat.ruleId, title: "Trans fat", amount: "As low as possible", plain: "Avoid anything listing partially hydrogenated oil or vanaspati.", source: L.transFat.source, why: why("CH") });
  }
  if (on.has("BP")) {
    out.push({ ruleId: L.sodiumMg.ruleId, title: "Sodium", amount: `${L.sodiumMg.amount.toLocaleString("en-IN")} mg a day`, plain: "That's 5 g of salt, about one level teaspoon, including the salt already in packaged food.", source: L.sodiumMg.source, why: why("BP") });
  }
  return out;
}
