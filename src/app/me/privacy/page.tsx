import type { Metadata } from "next";
import Link from "next/link";
import { currentAccount } from "@/lib/server/auth";
import { consentState, CONSENT_TEXT, NOTICE_VERSION, type ConsentPurpose } from "@/lib/server/person";
import { formatDate } from "@/lib/dates";
import { deleteEverythingAction, setConsentAction } from "@/app/actions/profile";

export const metadata: Metadata = { title: "Privacy and your data" };

export default async function PrivacyPage({ searchParams }: PageProps<"/me/privacy">) {
  const account = await currentAccount();
  const sp = await searchParams;
  if (!account) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Privacy and your data</h1>
        <PrivacyRules />
        <p><Link className="underline" href="/login?next=/me/privacy">Sign in</Link> to manage your consents, export or delete your data.</p>
      </div>
    );
  }
  const consents = consentState(account.id);
  const confirming = Boolean(sp.confirm);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Privacy and your data</h1>
      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Your consents</h2>
        {(Object.keys(CONSENT_TEXT) as ConsentPurpose[]).map((p) => (
          <div key={p} className="rounded-lg border border-line p-3">
            <p className="font-semibold">{CONSENT_TEXT[p].title}</p>
            <p className="text-sm text-muted">{CONSENT_TEXT[p].body}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`text-sm font-medium ${consents[p].granted ? "text-good" : "text-muted"}`}>
                {consents[p].granted ? `On since ${formatDate(consents[p].at)}` : consents[p].at ? `Withdrawn ${formatDate(consents[p].at)}` : "Off"}
              </span>
              <form action={setConsentAction}>
                <input type="hidden" name="purpose" value={p} />
                <input type="hidden" name="granted" value={consents[p].granted ? "0" : "1"} />
                <button className="btn btn-secondary">{consents[p].granted ? "Withdraw" : "Turn on"}</button>
              </form>
            </div>
            {p === "store-health-data" && consents[p].granted && <p className="hint mt-1">Withdrawing deletes your stored conditions, numbers and verdict history straight away.</p>}
          </div>
        ))}
        <p className="text-xs text-muted">Notice version {NOTICE_VERSION}.</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Export my data</h2>
        <p className="text-sm">Download everything we hold about you as a JSON file: profile, numbers, consents, upload records, verdict history and saved swaps.</p>
        <a className="btn btn-secondary" href="/api/me/export" download>Download my data</a>
      </section>

      <section className="card space-y-3 border-bad/40 p-4">
        <h2 className="text-lg font-bold">Delete everything</h2>
        <p className="text-sm">Deletes your account, profile, numbers, consents, upload records, verdicts and saved list at once. Backups are purged within 30 days. This can&apos;t be undone.</p>
        {confirming ? (
          <form action={deleteEverythingAction} className="space-y-2">
            <input type="hidden" name="confirm" value="DELETE" />
            <p className="font-semibold text-bad">Tap again to delete everything now.</p>
            <div className="flex gap-2">
              <button className="btn btn-danger">Yes, delete everything</button>
              <Link className="btn btn-secondary" href="/me/privacy">Cancel</Link>
            </div>
          </form>
        ) : (
          <form action={deleteEverythingAction}>
            <button className="btn btn-danger">Delete everything</button>
          </form>
        )}
      </section>
      <PrivacyRules />
    </div>
  );
}

function PrivacyRules() {
  return (
    <section className="card space-y-2 p-4 text-sm">
      <h2 className="text-lg font-bold">Our rules for health data</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>We ask for a number only if a Fit rule uses it.</li>
        <li>Report files are read on your device. Only the text reaches us, and names, phone numbers, addresses and IDs are removed before any processing.</li>
        <li>You confirm every value before it&apos;s saved. Nothing from the file is kept.</li>
        <li>Health data is encrypted in a separate store and never used for advertising, sold, or shared with brands or shops.</li>
        <li>Logs and analytics never contain your health values.</li>
        <li>Demos and tests use fictional people only.</li>
      </ul>
    </section>
  );
}
