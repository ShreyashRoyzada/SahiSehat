// Rule table types. The table itself is data (data/rules/*.json), versioned
// and stored in the catalogue database once an admin creates new versions.

import type { Condition, MarkerName, NutrientKey } from "../types";
import ruleTableV1 from "../../../data/rules/rule-table-v1.json";

export type BandName = "good" | "small" | "not-good";

export type ShareCheck = {
  id: string;
  type: "share";
  nutrient: NutrientKey;
  fallback?: NutrientKey;
  limit: LimitKey;
  onlyIfMarker?: MarkerName;
  skipIfRuleSet?: string;
};
export type FirstIngredientCheck = { id: string; type: "first-ingredient"; minBand: BandName; patterns: string[]; text: string };
export type IngredientFlagCheck = { id: string; type: "ingredient-flag"; minBand: BandName; patterns: string[]; text: string };
export type MaxPerServingCheck = { id: string; type: "max-per-serving"; nutrient: NutrientKey; max: number; minBand: BandName; text: string };
export type UseGroupFlagCheck = { id: string; type: "use-group-flag"; minBand: BandName; useGroups: string[]; text: string };

export type RuleCheck = ShareCheck | FirstIngredientCheck | IngredientFlagCheck | MaxPerServingCheck | UseGroupFlagCheck;

export type LimitKey = "addedSugar" | "sodiumMg" | "saturatedFat" | "transFat";

export type RuleSet = {
  id: string;
  name: string;
  plainName: string;
  triggerMarkers: MarkerName[];
  triggerConditions: Condition[];
  checks: RuleCheck[];
};

export type RuleTable = {
  version: string;
  status: "placeholder" | "draft" | "approved";
  approval: { approver: string | null; approvedAt: string | null; note: string };
  effectiveDate: string;
  markerMaxAgeMonths: number;
  markerThresholds: Partial<Record<MarkerName, { high: number; critical: number; unit: string; label: string }>>;
  dailyLimits: Record<LimitKey, { amount: number; unit: string; label: string; ruleId: string; source: string }>;
  bands: { good: number; small: number };
  ruleSets: RuleSet[];
};

export const DEFAULT_RULE_TABLE = ruleTableV1 as RuleTable;

/** PRD C1: a rule version cannot go live without an advisor approval record. */
export function canGoLive(table: RuleTable): { ok: boolean; reason?: string } {
  if (table.status !== "approved") return { ok: false, reason: `Rule table ${table.version} is ${table.status}, not approved.` };
  if (!table.approval.approver || !table.approval.approvedAt) return { ok: false, reason: "No advisor approval record." };
  return { ok: true };
}

export function validateRuleTable(t: unknown): string[] {
  const errors: string[] = [];
  const table = t as RuleTable;
  if (!table || typeof table !== "object") return ["Rule table must be a JSON object."];
  if (!table.version) errors.push("version is required");
  if (!table.bands || !(table.bands.good < table.bands.small)) errors.push("bands.good must be below bands.small");
  for (const k of ["addedSugar", "sodiumMg", "saturatedFat"] as LimitKey[]) {
    if (!(table.dailyLimits?.[k]?.amount > 0)) errors.push(`dailyLimits.${k}.amount must be positive`);
  }
  if (!Array.isArray(table.ruleSets) || !table.ruleSets.length) errors.push("ruleSets must be a non-empty array");
  for (const rs of table.ruleSets ?? []) {
    if (!rs.id || !Array.isArray(rs.checks)) errors.push(`rule set ${rs.id ?? "?"} is malformed`);
    for (const c of rs.checks ?? []) if (!c.id || !c.type) errors.push(`check in ${rs.id} is missing id or type`);
  }
  return errors;
}

export function describeCheck(c: RuleCheck): string {
  switch (c.type) {
    case "share":
      return `${c.nutrient}${c.fallback ? ` (or ${c.fallback} if not declared)` : ""} as a share of the daily ${c.limit} limit${c.onlyIfMarker ? `, only when ${c.onlyIfMarker} is flagged` : ""}`;
    case "first-ingredient":
      return `first ingredient is ${c.patterns.slice(0, 4).join(", ")}… → at least ${c.minBand}`;
    case "ingredient-flag":
      return `ingredients mention ${c.patterns.join(", ")} → at least ${c.minBand}`;
    case "max-per-serving":
      return `${c.nutrient} above ${c.max} g per serving → at least ${c.minBand}`;
    case "use-group-flag":
      return `${c.useGroups.join(", ")} → at least ${c.minBand}`;
  }
}
