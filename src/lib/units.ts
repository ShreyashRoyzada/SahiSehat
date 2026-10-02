// Marker units, conversions and plausible-range checks (PRD B2).
// Values are stored in one canonical unit per marker.

import type { MarkerName } from "./types";

type MarkerSpec = {
  label: string;
  canonical: string;
  units: Record<string, { toCanonical: (v: number) => number; fromCanonical: (v: number) => number }>;
  plausible: [number, number]; // canonical unit
  step: number;
};

const identity = { toCanonical: (v: number) => v, fromCanonical: (v: number) => v };

// mg/dL <-> mmol/L factors
export const GLUCOSE_FACTOR = 18.0;
export const CHOLESTEROL_FACTOR = 38.67;
export const TRIGLYCERIDE_FACTOR = 88.57;

const mmol = (factor: number) => ({
  toCanonical: (v: number) => v * factor,
  fromCanonical: (v: number) => v / factor,
});

// HbA1c: IFCC mmol/mol -> NGSP %: % = 0.09148 * mmol/mol + 2.152
export const hba1cMmolMolToPercent = (v: number) => 0.09148 * v + 2.152;
export const hba1cPercentToMmolMol = (v: number) => (v - 2.152) / 0.09148;

export const MARKERS: Record<MarkerName, MarkerSpec> = {
  hba1c: {
    label: "HbA1c",
    canonical: "%",
    units: { "%": identity, "mmol/mol": { toCanonical: hba1cMmolMolToPercent, fromCanonical: hba1cPercentToMmolMol } },
    plausible: [3, 20],
    step: 0.1,
  },
  "fasting-glucose": {
    label: "Fasting glucose",
    canonical: "mg/dL",
    units: { "mg/dL": identity, "mmol/L": mmol(GLUCOSE_FACTOR) },
    plausible: [20, 700],
    step: 1,
  },
  "total-cholesterol": {
    label: "Total cholesterol",
    canonical: "mg/dL",
    units: { "mg/dL": identity, "mmol/L": mmol(CHOLESTEROL_FACTOR) },
    plausible: [50, 700],
    step: 1,
  },
  ldl: {
    label: "LDL cholesterol",
    canonical: "mg/dL",
    units: { "mg/dL": identity, "mmol/L": mmol(CHOLESTEROL_FACTOR) },
    plausible: [10, 500],
    step: 1,
  },
  hdl: {
    label: "HDL cholesterol",
    canonical: "mg/dL",
    units: { "mg/dL": identity, "mmol/L": mmol(CHOLESTEROL_FACTOR) },
    plausible: [5, 150],
    step: 1,
  },
  triglycerides: {
    label: "Triglycerides",
    canonical: "mg/dL",
    units: { "mg/dL": identity, "mmol/L": mmol(TRIGLYCERIDE_FACTOR) },
    plausible: [20, 4000],
    step: 1,
  },
  "systolic-bp": { label: "Blood pressure (systolic)", canonical: "mmHg", units: { mmHg: identity }, plausible: [60, 260], step: 1 },
  "diastolic-bp": { label: "Blood pressure (diastolic)", canonical: "mmHg", units: { mmHg: identity }, plausible: [30, 160], step: 1 },
  height: { label: "Height", canonical: "cm", units: { cm: identity, m: { toCanonical: (v) => v * 100, fromCanonical: (v) => v / 100 } }, plausible: [100, 230], step: 1 },
  weight: { label: "Weight", canonical: "kg", units: { kg: identity }, plausible: [25, 300], step: 0.1 },
};

export const MARKER_NAMES = Object.keys(MARKERS) as MarkerName[];

export function toCanonical(name: MarkerName, value: number, unit: string): number {
  const spec = MARKERS[name];
  const conv = spec.units[unit];
  if (!conv) throw new Error(`Unknown unit ${unit} for ${spec.label}`);
  return conv.toCanonical(value);
}

export function fromCanonical(name: MarkerName, value: number, unit: string): number {
  const conv = MARKERS[name].units[unit];
  if (!conv) throw new Error(`Unknown unit ${unit}`);
  return conv.fromCanonical(value);
}

export type PlausibilityResult = { ok: true; canonical: number } | { ok: false; error: string };

export function checkPlausible(name: MarkerName, value: number, unit: string): PlausibilityResult {
  const spec = MARKERS[name];
  if (!Number.isFinite(value)) return { ok: false, error: `${spec.label}: enter a number.` };
  if (!spec.units[unit]) return { ok: false, error: `${spec.label}: unit ${unit} is not supported.` };
  const canonical = round(toCanonical(name, value, unit), 2);
  const [lo, hi] = spec.plausible;
  if (canonical < lo || canonical > hi) {
    return { ok: false, error: `${spec.label} of ${value} ${unit} is outside the plausible range (${lo}–${hi} ${spec.canonical}). Please check the number.` };
  }
  return { ok: true, canonical };
}

export function round(v: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/** Map free-text test names (from typed forms or lab reports) to our marker names. */
export function matchMarkerName(raw: string): MarkerName | null {
  const s = raw.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(hba1c|hb a1c|a1c|glycated|glycosylated)\b/.test(s)) return "hba1c";
  if (/(fasting|fbs|fbg|glucose f\b|plasma glucose f|blood sugar f)/.test(s) && /(glucose|sugar|fbs|fbg)/.test(s)) return "fasting-glucose";
  if (/\bldl\b|low density/.test(s) && !/vldl|ratio/.test(s)) return "ldl";
  if (/\bhdl\b|high density/.test(s) && !/ratio|non hdl/.test(s)) return "hdl";
  if (/triglycerides?|\btg\b/.test(s)) return "triglycerides";
  if (/(total cholesterol|cholesterol total|serum cholesterol|^cholesterol$|s cholesterol)/.test(s) && !/ratio/.test(s)) return "total-cholesterol";
  if (/systolic/.test(s)) return "systolic-bp";
  if (/diastolic/.test(s)) return "diastolic-bp";
  return null;
}
