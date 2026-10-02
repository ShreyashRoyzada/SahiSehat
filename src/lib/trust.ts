// Lab evidence: staleness (A5), display rules (MVP scope + A3) and the
// publication gate for negative findings (G2).
//
// Display rules from the PRD:
//  - Until a source licence is granted, a report shows "Lab report on file"
//    with a link to the original and no verdict.
//  - Passed shows once the licence question is settled.
//  - Failed shows only after the publication gate is approved and recorded.
//  - A result older than 12 months shows as Stale and stops counting.

import type { GateRecord, LabReport, SourceLicence } from "./types";
import { monthsBetween } from "./dates";

export type InternalStatus = "passed" | "failed" | "published" | "expired" | "external-rating" | "no-status";

export function internalStatus(r: LabReport): InternalStatus {
  if (r.source === "Unbox Health") return "external-rating";
  switch (r.verdict) {
    case "Passed":
      return "passed";
    case "Failed":
    case "Not recommended":
      return "failed";
    case "Expired":
      return "expired";
    case "Report published":
      return "published";
    default:
      return "no-status";
  }
}

export const STALE_MONTHS = 12;

export function isStale(r: LabReport, asOf: Date): boolean {
  if (!r.reportDate) return false;
  return monthsBetween(r.reportDate, asOf) > STALE_MONTHS;
}

export function gateComplete(gate: GateRecord | null | undefined, asOf: Date): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!gate) return { ok: false, missing: ["No gate record"] };
  const c = gate.checklist;
  if (!c.reportLinked) missing.push("Lab report linked");
  if (!c.batchLabDateShown) missing.push("Batch, lab and test date on the page");
  if (!c.templateWording) missing.push("Wording from the approved template");
  if (!c.brandNotified || !gate.brandNotifiedAt) missing.push("Brand told in writing");
  else if ((asOf.getTime() - new Date(gate.brandNotifiedAt).getTime()) / 86400000 < 7) missing.push("7-day reply window still open");
  if (!c.correctionPath) missing.push("Correction path on the page");
  if (!gate.approvedBy || !gate.approvedAt) missing.push("Approval recorded");
  return { ok: missing.length === 0, missing };
}

export type ReportDisplay = {
  report: LabReport;
  status: InternalStatus;
  stale: boolean;
  /** What the public card may say. */
  label: string;
  tone: "pass" | "fail" | "neutral" | "stale";
  showDetails: boolean; // lab, batch and date may be shown
  countsTowardScore: boolean;
  lValue: number | null; // lab pillar contribution when it counts
  criticalFail: boolean; // displayable failed result (caps the score)
};

export function displayReport(r: LabReport, licence: SourceLicence, gate: GateRecord | null | undefined, asOf: Date): ReportDisplay {
  const status = internalStatus(r);
  const stale = isStale(r, asOf);
  const base = { report: r, status, stale, countsTowardScore: false, lValue: null, criticalFail: false };

  if (status === "external-rating") {
    return { ...base, label: "Rated on Unbox Health (link out)", tone: "neutral", showDetails: false };
  }
  if (status === "expired") {
    return { ...base, label: "Expired report (link out)", tone: "stale", showDetails: false };
  }
  if (licence !== "granted") {
    return { ...base, label: "Lab report on file", tone: "neutral", showDetails: false };
  }
  if (stale) {
    return { ...base, label: "Stale: older than 12 months", tone: "stale", showDetails: true };
  }
  if (status === "passed") {
    return { ...base, label: "Passed", tone: "pass", showDetails: true, countsTowardScore: true, lValue: 100 };
  }
  if (status === "failed") {
    if (gateComplete(gate, asOf).ok) {
      return { ...base, label: "Failed lab test", tone: "fail", showDetails: true, countsTowardScore: true, lValue: 0, criticalFail: true };
    }
    return { ...base, label: "Lab report on file", tone: "neutral", showDetails: false };
  }
  return { ...base, label: "Lab report published (no verdict)", tone: "neutral", showDetails: true };
}

/** Most recent dated report first; undated last. */
export function sortReports<T extends { reportDate: string | null }>(reports: T[]): T[] {
  return [...reports].sort((a, b) => (b.reportDate ?? "").localeCompare(a.reportDate ?? ""));
}

/**
 * C5 quality gate for swaps. Uses the internal status even when the public
 * card can't show it yet, because a product with a failed test must never be
 * recommended. The public reason stays neutral until the gate is approved.
 */
export function swapBlock(displays: ReportDisplay[]): string | null {
  const own = displays.filter((d) => d.status !== "external-rating");
  const latest = sortReports(own.map((d) => ({ ...d, reportDate: d.report.reportDate })))[0];
  if (!latest || latest.status !== "failed") return null;
  if (latest.criticalFail) {
    return `Failed lab test (batch ${latest.report.batch ?? "n/a"}, ${latest.report.reportDate}). Never suggested as a swap.`;
  }
  return "Held back from swaps while a lab report on file goes through our publication review.";
}
