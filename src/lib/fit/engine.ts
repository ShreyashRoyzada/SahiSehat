// The Fit engine (PRD section "Fit engine", requirements C3–C7).
// A pure, deterministic function: person + product + rule table -> verdict.
// No network calls and no language model. The same inputs always return the
// same verdict, and every reason quotes the numbers it was built from.

import { sha256Hex } from "../hash";
import type { Allergen, FitReason, FitResult, FitVerdict, Marker, MarkerName, NutrientKey, Product, Profile } from "../types";
import { ALLERGEN_LABELS, allergenHits, checkDiet, firstIngredient } from "../ingredients";
import type { BandName, LimitKey, RuleSet, RuleTable } from "./rules";

export type FitInput = {
  profile: Profile;
  markers: Marker[];
  product: Product;
  rules: RuleTable;
  asOf: Date;
};

export { VERDICT_WORDS } from "./words";

const BAND_RANK: Record<BandName, number> = { good: 1, small: 2, "not-good": 3 };

const NUTRIENT_WORDS: Partial<Record<NutrientKey, string>> = {
  addedSugar: "added sugar",
  totalSugar: "sugar",
  saturatedFat: "saturated fat",
  transFat: "trans fat",
  sodiumMg: "sodium",
};

export { monthYear, monthsBetween } from "../dates";
import { monthYear, monthsBetween } from "../dates";

export function perServing(product: Product, key: NutrientKey): number | null {
  const v = product.nutritionPer100[key];
  if (v === null || v === undefined || product.servingSize === null) return null;
  return (v * product.servingSize) / 100;
}

function fmt(n: number, unit: string): string {
  const abs = Math.abs(n);
  const dp = unit === "mg" ? 0 : abs < 1 ? 1 : abs < 10 ? 1 : 0;
  const s = n.toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: 0 });
  return unit === "mg" ? `${s} mg` : `${s} g`;
}

function band(share: number, rules: RuleTable): BandName {
  if (share <= rules.bands.good) return "good";
  if (share <= rules.bands.small) return "small";
  return "not-good";
}

// ---- Rule-set activation ------------------------------------------------

export type Trigger = { ruleSet: RuleSet; text: string; markers: MarkerName[] };

export type Activation = {
  triggers: Trigger[];
  staleMarkers: MarkerName[];
  redFlags: string[];
  usedDefaultThresholds: boolean;
};

/** Latest marker of each name. */
export function latestMarkers(markers: Marker[]): Partial<Record<MarkerName, Marker>> {
  const out: Partial<Record<MarkerName, Marker>> = {};
  for (const m of markers) {
    const cur = out[m.name];
    if (!cur || m.sampleDate > cur.sampleDate) out[m.name] = m;
  }
  return out;
}

export function activateRuleSets(profile: Profile, markers: Marker[], rules: RuleTable, asOf: Date): Activation {
  const latest = latestMarkers(markers);
  const triggers: Trigger[] = [];
  const staleMarkers: MarkerName[] = [];
  const redFlags: string[] = [];
  let usedDefaultThresholds = false;

  for (const [name, m] of Object.entries(latest) as [MarkerName, Marker][]) {
    const th = rules.markerThresholds[name];
    if (!th) continue;
    const fresh = monthsBetween(m.sampleDate, asOf) <= rules.markerMaxAgeMonths;
    if (!fresh) continue;
    if (m.labFlag === "critical" || m.value >= th.critical) {
      redFlags.push(`${th.label} (${monthYear(m.sampleDate)})`);
    }
  }

  for (const rs of rules.ruleSets) {
    const parts: string[] = [];
    const used: MarkerName[] = [];
    for (const name of rs.triggerMarkers) {
      const m = latest[name];
      const th = rules.markerThresholds[name];
      if (!m || !th) continue;
      if (monthsBetween(m.sampleDate, asOf) > rules.markerMaxAgeMonths) {
        staleMarkers.push(name);
        continue;
      }
      // A lab-printed flag always wins over our default threshold.
      if (m.labFlag === "high" || m.labFlag === "critical") {
        parts.push(`Your report flags ${th.label} as high (${monthYear(m.sampleDate)}).`);
        used.push(name);
      } else if (m.labFlag === null && m.value >= th.high) {
        usedDefaultThresholds = true;
        parts.push(`Your ${th.label} (${monthYear(m.sampleDate)}) is at or above the default threshold of ${th.high} ${th.unit}; no lab range was printed.`);
        used.push(name);
      }
    }
    const declared = rs.triggerConditions.some((c) => profile.conditions.includes(c));
    if (declared && !parts.length) parts.push(`You told us you're managing ${rs.plainName}.`);
    if (parts.length) triggers.push({ ruleSet: rs, text: parts[0], markers: used });
  }
  return { triggers, staleMarkers: [...new Set(staleMarkers)], redFlags, usedDefaultThresholds };
}

// ---- Scope ------------------------------------------------------------------

export function outOfScope(profile: Profile): string | null {
  if (profile.ageBand === "under-18") return "SahiSehat gives personal verdicts to adults only.";
  if (profile.screen.includes("pregnancy")) return "Personal verdicts are not available during pregnancy.";
  if (profile.screen.includes("kidney-disease")) return "Personal verdicts are not available with kidney disease or dialysis.";
  if (profile.screen.includes("eating-disorder")) return "Personal verdicts are switched off for this profile.";
  return null;
}

// ---- Main ---------------------------------------------------------------------

export function inputsHash(input: FitInput, activation: Activation): string {
  const { product, profile, rules } = input;
  const payload = JSON.stringify({
    rules: rules.version,
    product: [product.id, product.version],
    ruleSets: activation.triggers.map((t) => t.ruleSet.id).sort(),
    triggerMarkers: activation.triggers.flatMap((t) => t.markers).sort(),
    redFlags: activation.redFlags.length,
    allergens: [...profile.allergens].sort(),
    diet: profile.diet,
    scope: outOfScope(profile) ? "out" : "in",
  });
  return sha256Hex(payload).slice(0, 32);
}

export function computeFit(input: FitInput): FitResult {
  const { profile, markers, product, rules, asOf } = input;
  const activation = activateRuleSets(profile, markers, rules, asOf);
  const base = {
    ruleVersion: rules.version,
    ruleSets: activation.triggers.map((t) => t.ruleSet.id),
    inputsHash: inputsHash(input, activation),
  };

  // C7: out-of-scope and red flags get no personalised verdict.
  const scope = outOfScope(profile);
  if (scope) {
    return { ...base, verdict: "no-verdict", reasons: [], missing: [], note: `${scope} You'll see the Quality Score and lab evidence only. Please talk to your doctor about food choices.` };
  }
  if (activation.redFlags.length) {
    return {
      ...base,
      verdict: "no-verdict",
      reasons: [],
      missing: [],
      note: `Your numbers include a value that needs a doctor's attention: ${activation.redFlags.join(", ")}. We don't give food verdicts in this case. Please see your doctor.`,
    };
  }

  // C4: hard filters for allergens and diets.
  const blocked: FitReason[] = [];
  const missing: string[] = [];
  const needsIngredients = profile.allergens.length > 0 || profile.diet !== "none";
  if (needsIngredients && product.ingredients.length === 0) missing.push("ingredients list");
  if (product.ingredients.length || profile.allergens.length === 0) {
    for (const hit of allergenHits(product, profile.allergens as Allergen[])) {
      const label = ALLERGEN_LABELS[hit.allergen];
      const how = hit.kind === "may-contain" ? `may contain ${label.toLowerCase()} (label warning)` : `contains ${label.toLowerCase()}`;
      blocked.push({ ruleId: "AL-1", text: `This product ${how}, which you listed as an allergy.`, band: "blocked" });
    }
  }
  if (product.ingredients.length) {
    const diet = checkDiet(product, profile.diet);
    if (!diet.ok) blocked.push({ ruleId: "DI-1", text: diet.reason, band: "blocked" });
  }
  if (blocked.length) return { ...base, verdict: "blocked", reasons: blocked.slice(0, 3), missing: [] };

  if (!activation.triggers.length) {
    const note = activation.staleMarkers.length
      ? "Your numbers are more than 12 months old, so they no longer switch rules on. Upload a newer report to get a personal verdict."
      : "No rule set is switched on yet. Add your numbers, upload a report or tell us what you're managing to get a personal verdict.";
    return { ...base, verdict: "cant-tell", reasons: [], missing, note };
  }

  if (product.servingSize === null) missing.push("serving size");

  const reasons: (FitReason & { severity: number })[] = [];
  const onIds = new Set(activation.triggers.map((t) => t.ruleSet.id));

  for (const trig of activation.triggers) {
    for (const check of trig.ruleSet.checks) {
      if (check.type === "share") {
        if (check.skipIfRuleSet && onIds.has(check.skipIfRuleSet)) continue;
        if (check.onlyIfMarker && !trig.markers.includes(check.onlyIfMarker)) continue;
        if (product.servingSize === null) continue;
        let key: NutrientKey = check.nutrient;
        let amount = perServing(product, key);
        let fallbackNote = "";
        if (amount === null && check.fallback) {
          const fb = perServing(product, check.fallback);
          if (fb !== null) {
            amount = fb;
            key = check.fallback;
            fallbackNote = " The label doesn't declare added sugar, so total sugar is used.";
          }
        }
        if (amount === null) {
          missing.push(NUTRIENT_WORDS[check.nutrient] ?? check.nutrient);
          continue;
        }
        const limit = rules.dailyLimits[check.limit as LimitKey];
        const share = amount / limit.amount;
        const b = band(share, rules);
        const unit = limit.unit;
        const pct = Math.round(share * 100);
        reasons.push({
          ruleId: check.id,
          nutrient: key,
          perServing: amount,
          unit,
          dailyLimit: limit.amount,
          share,
          band: b,
          severity: BAND_RANK[b] * 1000 + pct,
          trigger: trig.text,
          text: `${fmt(amount, unit)} of ${NUTRIENT_WORDS[key] ?? key} in one serving (${product.servingSize} ${product.unit}) is ${pct}% of your ${fmt(limit.amount, unit)} daily limit.${fallbackNote}`,
        });
      } else if (check.type === "first-ingredient") {
        if (!product.ingredients.length) {
          missing.push("ingredients list");
          continue;
        }
        const first = firstIngredient(product.ingredients)!;
        const lower = first.toLowerCase();
        const hit = check.patterns.find((p) => lower.startsWith(p) || lower.includes(p));
        if (hit) {
          reasons.push({ ruleId: check.id, band: check.minBand, severity: BAND_RANK[check.minBand] * 1000 + 1, trigger: trig.text, text: check.text.replace("{first}", capitalise(first)) });
        }
      } else if (check.type === "ingredient-flag") {
        if (!product.ingredients.length) {
          missing.push("ingredients list");
          continue;
        }
        const text = product.ingredients.join("; ").toLowerCase();
        if (check.patterns.some((p) => text.includes(p))) {
          reasons.push({ ruleId: check.id, band: check.minBand, severity: BAND_RANK[check.minBand] * 1000 + 99, trigger: trig.text, text: check.text });
        }
      } else if (check.type === "max-per-serving") {
        const amount = perServing(product, check.nutrient);
        if (amount === null) {
          // Trans fat is often undeclared on older labels; the ingredient flag still runs.
          if (check.nutrient !== "transFat") missing.push(NUTRIENT_WORDS[check.nutrient] ?? check.nutrient);
          continue;
        }
        if (amount > check.max) {
          reasons.push({ ruleId: check.id, nutrient: check.nutrient, perServing: amount, unit: "g", band: check.minBand, severity: BAND_RANK[check.minBand] * 1000 + 50, trigger: trig.text, text: check.text.replace("{amount}", amount.toFixed(1)) });
        }
      } else if (check.type === "use-group-flag") {
        if (check.useGroups.includes(product.useGroup)) {
          reasons.push({ ruleId: check.id, band: check.minBand, severity: BAND_RANK[check.minBand] * 1000 + 2, trigger: trig.text, text: check.text });
        }
      }
    }
  }

  reasons.sort((a, b) => b.severity - a.severity);
  const shown: FitReason[] = reasons.slice(0, 3).map((r) => {
    const { severity, ...rest } = r;
    void severity;
    return rest;
  });

  if (missing.length) {
    return {
      ...base,
      verdict: "cant-tell",
      reasons: shown,
      missing: [...new Set(missing)],
      note: `We can't tell yet because the label data is missing: ${[...new Set(missing)].join(", ")}. We never estimate silently.`,
    };
  }

  const worst = reasons.reduce<BandName>((acc, r) => (r.band && BAND_RANK[r.band as BandName] > BAND_RANK[acc] ? (r.band as BandName) : acc), "good");
  return {
    ...base,
    verdict: worst,
    reasons: shown,
    missing: [],
    note: activation.usedDefaultThresholds ? "Your report printed no reference range for at least one marker, so our default threshold was used." : undefined,
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function verdictRank(v: FitVerdict): number {
  return v === "good" ? 0 : v === "small" ? 1 : v === "not-good" ? 2 : 3;
}
