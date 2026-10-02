// Rule-based lab-report reader. Reads test rows from report text (PDF text
// layer, OCR output or pasted text) into a fixed schema, then validates units,
// plausible ranges and whether the printed flag agrees with the printed range.
// When ANTHROPIC_API_KEY is set the server also asks Claude to extract rows
// from the redacted text; both feed the same validators and the same confirm
// step, and nothing is saved until the person confirms.

import type { LabFlag, MarkerName } from "../types";
import { MARKERS, checkPlausible, matchMarkerName, round } from "../units";

export const EXTRACTION_VERSION = "rules-0.1.0";

export type ExtractedRow = {
  testName: string;
  marker: MarkerName | null;
  value: number | null;
  unit: string | null;
  range: string | null;
  flag: LabFlag;
  sampleDate: string | null;
  issues: string[];
};

const UNIT_RE = /(mg\s*\/\s*dl|mmol\s*\/\s*mol|mmol\s*\/\s*l|%|mm\s*hg)/i;

export function normaliseUnit(u: string | null | undefined): string | null {
  if (!u) return null;
  const s = u.toLowerCase().replace(/\s+/g, "");
  if (s === "mg/dl") return "mg/dL";
  if (s === "mmol/l") return "mmol/L";
  if (s === "mmol/mol") return "mmol/mol";
  if (s === "%") return "%";
  if (s === "mmhg") return "mmHg";
  return u;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export function parseDate(s: string): string | null {
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/); // Indian labs print day first
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/\b(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{4})\b/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)] ?? MONTHS[m[2].toLowerCase().slice(0, 4)];
    if (mon) return iso(+m[3], mon, +m[1]);
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function findSampleDate(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const pref = /(sample\s*(collected|collection|date|drawn)|collected\s*(on|at|date)?|collection\s*date|date\s*of\s*collection|specimen\s*date)/i;
  for (const l of lines) if (pref.test(l)) {
    const d = parseDate(l);
    if (d) return d;
  }
  for (const l of lines) if (/(report(ed)?\s*(date|on)|date)/i.test(l)) {
    const d = parseDate(l);
    if (d) return d;
  }
  return null;
}

function parseFlag(s: string): LabFlag {
  if (/\b(critical|panic|crit)\b/i.test(s)) return "critical";
  if (/\b(high|h|abnormal high|↑)\b|↑|\*h\b/i.test(s)) return "high";
  if (/\b(low|l|↓)\b|↓/i.test(s)) return "low";
  if (/\b(normal|n)\b/i.test(s)) return "normal";
  return null;
}

function parseRange(s: string): string | null {
  const m = s.match(/(<|>|≤|≥|up\s*to|upto)\s*=?\s*\d+(\.\d+)?|\d+(\.\d+)?\s*(-|–|to)\s*\d+(\.\d+)?/i);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
}

/** Upper bound of a printed range, used to check that the flag agrees. */
export function rangeBounds(range: string | null): { lo: number | null; hi: number | null } {
  if (!range) return { lo: null, hi: null };
  let m = range.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/);
  if (m) return { lo: +m[1], hi: +m[2] };
  m = range.match(/(?:<|≤|up\s*to|upto)\s*=?\s*(\d+(?:\.\d+)?)/i);
  if (m) return { lo: null, hi: +m[1] };
  m = range.match(/(?:>|≥)\s*=?\s*(\d+(?:\.\d+)?)/);
  if (m) return { lo: +m[1], hi: null };
  return { lo: null, hi: null };
}

export function validateRow(row: ExtractedRow): ExtractedRow {
  const issues: string[] = [];
  if (!row.marker) issues.push("Not a marker SahiSehat uses; it won't be saved.");
  if (row.value === null) issues.push("No value found.");
  if (row.marker && row.value !== null) {
    const spec = MARKERS[row.marker];
    const unit = row.unit ?? spec.canonical;
    if (!row.unit) issues.push(`No unit printed; assumed ${spec.canonical}.`);
    if (!spec.units[unit]) issues.push(`Unit ${unit} isn't supported for ${spec.label}.`);
    else {
      const p = checkPlausible(row.marker, row.value, unit);
      if (!p.ok) issues.push(p.error);
    }
    const { lo, hi } = rangeBounds(row.range);
    if (row.flag === "high" && hi !== null && row.value <= hi) issues.push("The flag says high but the value is inside the printed range. Please check.");
    if ((row.flag === "normal" || row.flag === null) && hi !== null && row.value > hi && row.range) issues.push("The value is above the printed range but no high flag was read. Please check.");
    if (row.flag === "low" && lo !== null && row.value >= lo) issues.push("The flag says low but the value is inside the printed range. Please check.");
  }
  if (row.marker && !row.sampleDate) issues.push("No sample date found. Add the date the sample was taken.");
  return { ...row, issues };
}

export function parseReportText(text: string): ExtractedRow[] {
  const sampleDate = findSampleDate(text);
  const rows: ExtractedRow[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, " ").replace(/\s{2,}/g, "  ").trim();
    if (!line || line.length > 200) continue;

    // Blood pressure: "Blood Pressure 142/92 mmHg"
    const bp = line.match(/\b(blood\s*pressure|b\.?p\.?)\b[^0-9]*(\d{2,3})\s*\/\s*(\d{2,3})/i);
    if (bp) {
      const flag = parseFlag(line.slice(bp.index! + bp[0].length));
      rows.push(validateRow({ testName: "Blood pressure (systolic)", marker: "systolic-bp", value: +bp[2], unit: "mmHg", range: null, flag, sampleDate, issues: [] }));
      rows.push(validateRow({ testName: "Blood pressure (diastolic)", marker: "diastolic-bp", value: +bp[3], unit: "mmHg", range: null, flag, sampleDate, issues: [] }));
      continue;
    }

    // First standalone number after some letters is the value.
    const num = line.match(/^(.*?[A-Za-z)\]].*?)[\s:]+(-?\d+(?:\.\d+)?)(?=\s|$|[A-Za-z%])/);
    if (!num) continue;
    const name = num[1].replace(/[:\-–]+$/, "").trim();
    const marker = matchMarkerName(name);
    if (!marker) continue;
    if (seen.has(marker)) continue; // first occurrence wins; the person can edit
    const rest = line.slice(num[0].length);
    const unitMatch = rest.match(UNIT_RE);
    const range = parseRange(rest.replace(UNIT_RE, " "));
    const flag = parseFlag(rest.replace(/mmol|mg|dl/gi, " "));
    seen.add(marker);
    rows.push(
      validateRow({
        testName: name,
        marker,
        value: +num[2],
        unit: normaliseUnit(unitMatch?.[1]),
        range,
        flag,
        sampleDate,
        issues: [],
      }),
    );
  }
  return rows;
}

/** Rounded display value in the row's own unit. */
export function displayValue(v: number | null): string {
  return v === null ? "" : String(round(v, 2));
}
