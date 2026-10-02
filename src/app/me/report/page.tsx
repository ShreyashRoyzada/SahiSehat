import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { consentState } from "@/lib/server/person";
import { ReportUpload } from "@/components/ReportUpload";
import { MARKERS } from "@/lib/units";

export const metadata: Metadata = { title: "Upload a report" };

export default async function ReportPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/me/report");
  const c = consentState(account.id);
  if (!c["store-health-data"].granted) redirect("/start");
  const units = Object.fromEntries(Object.entries(MARKERS).map(([k, v]) => [k, { label: v.label, units: Object.keys(v.units) }]));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Upload a blood report</h1>
        <p className="text-muted">PDF, photo or screenshot. It&apos;s read on your phone; only the text comes to us, with your name, phone, address and IDs removed. You check every value before anything is saved.</p>
      </div>
      {c["process-reports"].granted ? (
        <ReportUpload markers={units} />
      ) : (
        <div className="card space-y-2 p-4 text-sm">
          <p>Report processing is off. Turn it on in <Link className="underline" href="/me/privacy">Privacy</Link>, or <Link className="underline" href="/me/numbers">type your numbers</Link> instead.</p>
        </div>
      )}
    </div>
  );
}
