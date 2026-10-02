import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { activationFor, personContext } from "@/lib/server/person";
import { activeRules } from "@/lib/server/catalogue";
import { myLimits } from "@/lib/limits";
import { PreviewNotice } from "@/components/PreviewNotice";

export const metadata: Metadata = { title: "My limits" };

export default async function LimitsPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/me/limits");
  const ctx = personContext(account.id);
  if (!ctx) redirect("/start");
  const rules = activeRules();
  const activation = activationFor(ctx);
  const limits = myLimits(rules, activation);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My limits</h1>
      <PreviewNotice compact />
      <p className="text-muted">Daily budgets on a 2,000 kcal reference day. One serving of a product is compared with these: up to {rules.bands.good * 100}% of a limit is a good fit, up to {rules.bands.small * 100}% means small portions, and above that is not a good fit.</p>
      {limits.length === 0 && <p className="card p-4 text-sm">No rule set is switched on yet. <Link className="underline" href="/me/numbers">Add your numbers</Link> or tell us what you&apos;re managing.</p>}
      {limits.map((l) => (
        <section key={l.ruleId} className="card space-y-1.5 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{l.title}</h2>
            <span className="text-xl font-bold text-brand-800">{l.amount}</span>
          </div>
          <p>{l.plain}</p>
          {l.why.map((w) => <p key={w} className="text-sm text-muted">{w}</p>)}
          <p className="text-xs text-muted">Rule {l.ruleId} · rule table v{rules.version} · Source: {l.source}</p>
        </section>
      ))}
      <p className="hint">We don&apos;t set calorie targets or medicine advice. A lab-printed reference range always wins over our defaults.</p>
    </div>
  );
}
