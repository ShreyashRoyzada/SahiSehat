import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { activationFor, consentState, getProfile, personContext } from "@/lib/server/person";
import { activeRules } from "@/lib/server/catalogue";
import { MARKERS, round } from "@/lib/units";
import { formatDate, monthYear } from "@/lib/dates";
import { outOfScope, latestMarkers } from "@/lib/fit/engine";
import { myLimits } from "@/lib/limits";
import { PreviewNotice } from "@/components/PreviewNotice";
import { CONDITION_LABELS } from "@/lib/profile-options";

export const metadata: Metadata = { title: "My profile" };

export default async function MePage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/me");
  const consents = consentState(account.id);
  const profile = getProfile(account.id);
  if (!consents["store-health-data"].granted || !profile) redirect("/start");
  const ctx = personContext(account.id)!;
  const activation = activationFor(ctx);
  const limits = myLimits(activeRules(), activation);
  const latest = Object.values(latestMarkers(ctx.markers));
  const scope = outOfScope(profile);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{account.isDemo ? "Riya's profile (demo)" : "My profile"}</h1>
        {account.isDemo && <p className="text-sm text-muted">A fictional profile. It and everything you do in it is deleted after 24 hours or when you end the demo.</p>}
      </div>
      <PreviewNotice compact />

      {scope && <div role="alert" className="rounded-xl border border-neutral/20 bg-neutral-bg p-3.5 text-sm">{scope} You&apos;ll see Quality Scores and lab evidence, not personal verdicts. Please talk to your doctor about food choices.</div>}
      {activation.redFlags.length > 0 && (
        <div role="alert" className="rounded-xl border border-bad/30 bg-bad-bg p-3.5 text-sm">
          <strong>Please see your doctor.</strong> Your numbers include a value that needs medical attention ({activation.redFlags.join(", ")}). We don&apos;t give food verdicts while this is the case.
        </div>
      )}

      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">What switches your rules on</h2>
          <Link className="text-sm text-brand-700 underline" href="/me/profile">Edit</Link>
        </div>
        {activation.triggers.length ? (
          <ul className="space-y-1.5 text-sm">
            {activation.triggers.map((t) => (
              <li key={t.ruleSet.id} className="rounded-lg bg-paper p-2.5"><strong>{t.ruleSet.name}</strong> rules: {t.text}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing yet. Add your numbers or tell us what you&apos;re managing.</p>
        )}
        {activation.staleMarkers.length > 0 && <p className="text-sm text-small">Some numbers are more than 12 months old and no longer switch rules on. Upload a newer report.</p>}
        <p className="text-sm text-muted">
          Managing: {profile.conditions.length ? profile.conditions.map((c) => CONDITION_LABELS.find((x) => x.value === c)?.label).join(", ") : "nothing declared"} · Diet: {profile.diet === "none" ? "no restriction" : profile.diet} · Allergies: {profile.allergens.length ? profile.allergens.join(", ") : "none"}
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">My numbers</h2>
          <div className="flex gap-3 text-sm">
            <Link className="text-brand-700 underline" href="/me/numbers">Type numbers</Link>
            <Link className="text-brand-700 underline" href="/me/report">Upload report</Link>
          </div>
        </div>
        {latest.length ? (
          <table className="w-full text-sm">
            <tbody>
              {latest.map((m) => (
                <tr key={m.name} className="border-b border-line/60">
                  <td className="py-1.5">{MARKERS[m.name].label}</td>
                  <td className="py-1.5 font-semibold">{round(m.value, 1)} {m.unit}</td>
                  <td className="py-1.5">{m.labFlag ? <span className={m.labFlag === "high" || m.labFlag === "critical" ? "text-bad" : ""}>{m.labFlag === "high" ? "Lab: high" : m.labFlag === "critical" ? "Lab: critical" : m.labFlag === "low" ? "Lab: low" : "Lab: normal"}</span> : <span className="text-muted">{m.source === "typed" ? "typed" : "no flag"}</span>}</td>
                  <td className="py-1.5 text-right text-muted">{monthYear(m.sampleDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">No numbers yet.</p>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">My limits</h2>
          <Link className="text-sm text-brand-700 underline" href="/me/limits">Details</Link>
        </div>
        {limits.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {limits.map((l) => (
              <li key={l.ruleId} className="rounded-lg bg-paper p-3">
                <div className="text-sm text-muted">{l.title}</div>
                <div className="text-lg font-bold">{l.amount}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Your limits appear once a rule set is switched on.</p>
        )}
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        <Link href="/search" className="btn btn-primary">Check a product</Link>
        <Link href="/cart" className="btn btn-secondary">Check my cart</Link>
        <Link href="/me/list" className="btn btn-secondary">My saved swaps</Link>
      </section>

      <p className="text-sm text-muted">
        Consent to store health data given {formatDate(consents["store-health-data"].at)}. <Link className="underline" href="/me/privacy">Privacy, export and delete</Link>
      </p>
    </div>
  );
}
