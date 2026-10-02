import { activeRules } from "@/lib/server/catalogue";
import { canGoLive } from "@/lib/fit/rules";

/** Honest preview labelling: placeholder rules and unverified label data are called out. */
export function PreviewNotice({ compact = false }: { compact?: boolean }) {
  const rules = activeRules();
  const live = canGoLive(rules).ok;
  if (live && compact) return null;
  return (
    <div role="note" className="rounded-xl border border-small/30 bg-small-bg px-3.5 py-2.5 text-sm text-ink">
      <strong>Beta preview.</strong>{" "}
      {live ? null : <>Fit rules (v{rules.version}) are the PRD placeholders and have not been signed by a clinician yet. </>}
      {!compact && <>Label nutrition values are seed estimates until checked against the pack.</>}
    </div>
  );
}
