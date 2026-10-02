import Link from "next/link";
import type { FitResult, Product } from "@/lib/types";
import type { QualityResult } from "@/lib/quality";
import { Pill, ScoreBadge, VerdictBadge } from "./Badges";

export function ProductCard({ product, quality, fit, hasLab, note }: { product: Product; quality: QualityResult; fit?: FitResult | null; hasLab?: boolean; note?: string }) {
  return (
    <Link href={`/p/${product.id}`} className="card block p-3.5 transition hover:border-brand-600/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{product.brand}</div>
          <div className="font-semibold leading-snug">{product.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill>{product.category}</Pill>
            {hasLab && <Pill tone="brand">Lab report on file</Pill>}
            {product.labelSource.kind === "missing" && <Pill tone="warn">Label not captured</Pill>}
          </div>
        </div>
        <ScoreBadge quality={quality} size="sm" />
      </div>
      {fit && fit.verdict !== "no-verdict" && (
        <div className="mt-2.5 space-y-1">
          <VerdictBadge verdict={fit.verdict} size="sm" />
          {fit.reasons[0] && <p className="text-sm text-muted">{fit.reasons[0].text}</p>}
        </div>
      )}
      {note && <p className="mt-2 text-sm text-brand-800">{note}</p>}
    </Link>
  );
}
