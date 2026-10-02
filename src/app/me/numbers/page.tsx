import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { getMarkers, hasConsent } from "@/lib/server/person";
import { MARKERS, round } from "@/lib/units";
import { formatDate } from "@/lib/dates";
import { NumbersForm } from "@/components/NumbersForm";
import { deleteMarkerAction } from "@/app/actions/profile";

export const metadata: Metadata = { title: "My numbers" };

export default async function NumbersPage({ searchParams }: PageProps<"/me/numbers">) {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/me/numbers");
  if (!hasConsent(account.id, "store-health-data")) redirect("/start");
  const sp = await searchParams;
  const markers = getMarkers(account.id);
  const units = Object.fromEntries(Object.entries(MARKERS).map(([k, v]) => [k, { label: v.label, units: Object.keys(v.units), step: v.step }]));
  return (
    <div className="space-y-5">
      {sp.welcome && <div role="status" className="rounded-xl border border-good/30 bg-good-bg p-3.5 text-sm">Saved. Now add the numbers from your latest check-up, or <Link className="underline" href="/me/report">upload the report</Link> and confirm what we read.</div>}
      <div>
        <h1 className="text-2xl font-bold">My numbers</h1>
        <p className="text-muted">Type what your report says. Leave anything you don&apos;t have blank. We only ask for numbers our rules use.</p>
      </div>
      <NumbersForm markers={units} today={new Date().toISOString().slice(0, 10)} />
      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-bold">History</h2>
        {markers.length === 0 && <p className="text-sm text-muted">Nothing saved yet.</p>}
        <ul className="divide-y divide-line text-sm">
          {markers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <strong>{MARKERS[m.name].label}</strong> {round(m.value, 1)} {m.unit}
                <span className="text-muted"> · {formatDate(m.sampleDate)} · {m.source === "report" ? "from report" : "typed"}{m.labFlag ? ` · lab flag: ${m.labFlag}` : ""}</span>
              </span>
              <form action={deleteMarkerAction}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-muted underline" aria-label={`Delete ${MARKERS[m.name].label} from ${formatDate(m.sampleDate)}`}>Delete</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
