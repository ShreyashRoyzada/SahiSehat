import type { FitVerdict } from "@/lib/types";
import { VERDICT_WORDS } from "@/lib/fit/words";
import { EVIDENCE_LABEL, type EvidenceLevel, type QualityResult } from "@/lib/quality";

const VERDICT_STYLE: Record<FitVerdict, { cls: string; icon: string }> = {
  good: { cls: "bg-good-bg text-good border-good/30", icon: "✓" },
  small: { cls: "bg-small-bg text-small border-small/30", icon: "◐" },
  "not-good": { cls: "bg-bad-bg text-bad border-bad/30", icon: "✕" },
  blocked: { cls: "bg-bad-bg text-bad border-bad/30", icon: "⊘" },
  "cant-tell": { cls: "bg-neutral-bg text-neutral border-neutral/20", icon: "?" },
  "no-verdict": { cls: "bg-neutral-bg text-neutral border-neutral/20", icon: "i" },
};

/** A verdict is never colour alone: every badge carries its words (WCAG, PRD NFR). */
export function VerdictBadge({ verdict, size = "md" }: { verdict: FitVerdict; size?: "sm" | "md" | "lg" }) {
  const s = VERDICT_STYLE[verdict];
  const w = VERDICT_WORDS[verdict];
  const pad = size === "lg" ? "px-3 py-2 text-base" : size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold ${s.cls} ${pad}`}>
      <span aria-hidden="true">{s.icon}</span>
      <span>{w.sahi}</span>
      {size !== "sm" && <span className="font-normal opacity-80">· {w.plain}</span>}
    </span>
  );
}

export function ScoreBadge({ quality, size = "md" }: { quality: QualityResult; size?: "sm" | "md" }) {
  if (quality.score === null) {
    return <span className="inline-flex items-center rounded-lg border border-line bg-neutral-bg px-2 py-0.5 text-xs font-semibold text-neutral">No score · Insufficient data</span>;
  }
  const tone = quality.score >= 60 ? "text-good" : quality.score >= 41 ? "text-small" : "text-bad";
  if (size === "sm") {
    return (
      <span className="inline-flex items-baseline gap-1 rounded-lg border border-line bg-white px-2 py-0.5 text-xs">
        <span className={`text-sm font-bold ${tone}`}>{quality.score}</span>
        <span className="text-muted">/100 {quality.band}</span>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 ${quality.score >= 60 ? "border-good" : quality.score >= 41 ? "border-small" : "border-bad"} bg-white`}>
        <span className={`text-lg font-bold leading-none ${tone}`}>{quality.score}</span>
        <span className="text-[10px] text-muted">/100</span>
      </div>
      <div>
        <div className="font-semibold">Quality Score: {quality.band}</div>
        <EvidenceChip level={quality.evidence} />
      </div>
    </div>
  );
}

export function EvidenceChip({ level }: { level: EvidenceLevel }) {
  const cls = level === "lab-verified" ? "bg-brand-50 text-brand-800 border-brand-600/30" : level === "label-analysed" ? "bg-neutral-bg text-neutral border-line" : "bg-small-bg text-small border-small/30";
  return <span className={`inline-block rounded-md border px-1.5 py-0.5 text-xs font-medium ${cls}`}>{EVIDENCE_LABEL[level]}</span>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "brand" }) {
  const cls = tone === "warn" ? "bg-small-bg text-small" : tone === "brand" ? "bg-brand-50 text-brand-800" : "bg-neutral-bg text-neutral";
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
