// Verdict words (PRD "Name and website"): a Sahi badge with a plain-English line.
import type { FitVerdict } from "../types";

export const VERDICT_WORDS: Record<FitVerdict, { sahi: string; plain: string }> = {
  good: { sahi: "Sahi for you", plain: "Good fit" },
  small: { sahi: "Sahi in small portions", plain: "Small portions" },
  "not-good": { sahi: "Not sahi for you", plain: "Not a good fit" },
  "cant-tell": { sahi: "Can't tell yet", plain: "Can't tell" },
  blocked: { sahi: "Not sahi for you", plain: "Blocked for your diet or allergies" },
  "no-verdict": { sahi: "No personal verdict", plain: "General information only" },
};
