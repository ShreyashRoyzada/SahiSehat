// Redaction before any language-model call (PRD B5): name, phone, address,
// email, patient and lab IDs, referring doctor and lab branch are removed
// from the text. Test values, units, ranges and dates are kept.

const LABELLED = new RegExp(
  String.raw`^(\s*(?:patient(?:'s)?\s*name|name|pt\.?\s*name|patient|address|addr|phone|mobile|mob|contact|tel|telephone|e-?mail|uhid|mrn|patient\s*id|pid|reg(?:istration)?\.?\s*(?:no|id|number)?|lab\s*(?:no|id|number)|sample\s*(?:no|id|number)|accession(?:\s*no)?|barcode|visit\s*(?:no|id)|bill\s*(?:no|id)|ref(?:erred)?\.?\s*(?:by|doctor|dr)?|referring\s*(?:doctor|physician)|consultant|branch|centre|center|collection\s*(?:centre|center)|processed\s*at|location|abha(?:\s*(?:no|id|number))?|aadhaar)\s*[:\-–]\s*)(.+)$`,
  "i",
);

const PATTERNS: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]"],
  [/(?:\+?91[\s-]?)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, "[PHONE]"],
  [/\b0\d{2,4}[\s-]\d{6,8}\b/g, "[PHONE]"],
  [/\b(?:Mr|Mrs|Ms|Miss|Master|Baby|Dr|Shri|Smt|Kumari)\.?\s+[A-Z][A-Za-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][A-Za-z]+){0,2}/g, "[NAME]"],
  // Mixed letter+digit tokens of 6+ characters (IDs, barcodes), e.g. SR26DM0012, UH-2026-001234
  [/\b(?=[A-Z0-9/-]*\d)(?=[A-Z0-9/-]*[A-Z])[A-Z0-9][A-Z0-9/-]{5,}\b/g, "[ID]"],
  // Long digit runs (7+ digits) that are not dates or decimals
  [/(?<![\d.])\d{7,}(?![\d.])/g, "[ID]"],
  // Indian PIN codes next to a place or state name
  [/\b(?:pin(?:code)?\s*[:\-]?\s*)?\d{3}\s?\d{3}\b(?=\s*(?:,|$|india))/gim, "[PIN]"],
];

// Words that must never be treated as IDs even though they mix letters and digits.
const KEEP = /^(HBA1C|A1C|25-OH|VITB12|B12|T3|T4|FT3|FT4|LDL|HDL|VLDL|MMOL\/MOL|MG\/DL|MMOL\/L)$/i;

// Report vocabulary: a bare line made only of these is a heading, not a name.
const REPORT_WORDS =
  /\b(report|laboratory|laboratories|lab|labs|diagnostics?|pathology|test|tests|result|results|unit|units|reference|range|interval|biochemistry|haematology|hematology|lipid|profile|panel|diabetes|diabetic|glucose|sugar|cholesterol|page|department|method|specimen|sample|investigation|value|observed|final|summary|thyroid|liver|kidney|renal|function|blood|serum|plasma|urine|complete|count|health|checkup|check|package|end|of|interpretation|comments?|notes?|remarks?|status|normal|high|low|male|female|years?|age|sex|gender|india|accredited|nabl|iso|certified|limited|ltd|pvt|private|hospital|clinic|centre|center|signature|pathologist|technologist|verified|approved|printed|registered)\b/i;

/** A line of 1-4 capitalised words, no digits or punctuation, that isn't report vocabulary: treat as a name. */
function looksLikeBareName(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 48 || /[\d:@/()%<>=]/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  if (!words.every((w) => /^[A-Z][A-Za-z.'-]*$/.test(w))) return false;
  return !REPORT_WORDS.test(t);
}

export function redact(text: string): { text: string; removed: number } {
  let removed = 0;
  const lines = text.split(/\r?\n/).map((line) => {
    const m = line.match(LABELLED);
    if (m) {
      removed++;
      return `${m[1]}[REDACTED]`;
    }
    if (looksLikeBareName(line)) {
      removed++;
      return "[NAME]";
    }
    return line;
  });
  let out = lines.join("\n");
  for (const [re, token] of PATTERNS) {
    out = out.replace(re, (match) => {
      if (token === "[ID]" && KEEP.test(match)) return match;
      if (token === "[ID]" && /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(match)) return match; // a date
      removed++;
      return token;
    });
  }
  return { text: out, removed };
}
