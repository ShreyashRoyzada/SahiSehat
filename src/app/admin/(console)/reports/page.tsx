import { appDb } from "@/lib/server/db";
import { gateComplete, internalStatus } from "@/lib/trust";
import { formatDate } from "@/lib/dates";
import { saveGateAction } from "@/app/actions/admin";
import type { GateRecord, LabReport } from "@/lib/types";

export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const db = appDb();
  const reports = (db.prepare("SELECT data FROM lab_reports WHERE product_id IS NOT NULL ORDER BY id").all() as { data: string }[]).map((r) => JSON.parse(r.data) as LabReport);
  const gates = new Map((db.prepare("SELECT report_id, data FROM gates").all() as { report_id: string; data: string }[]).map((g) => [g.report_id, JSON.parse(g.data) as GateRecord]));
  const shown = showAll ? reports : reports.filter((r) => internalStatus(r) === "failed");
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Lab reports and the publication gate</h1>
      <p className="text-sm text-muted">A negative finding about a named brand shows only when every item is ticked, the brand has had 7 days to reply, and a named person approves. Licences per source are on the Sources page. {showAll ? <a className="underline" href="/admin/reports">Show failed only</a> : <a className="underline" href="/admin/reports?all=1">Show all {reports.length} mapped reports</a>}</p>
      {sp.error && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{String(sp.error)}</p>}
      {shown.map((r) => {
        const g = gates.get(r.id);
        const status = gateComplete(g, new Date());
        return (
          <form key={r.id} id={r.id} action={saveGateAction} className="card space-y-2 p-3.5 text-sm">
            <input type="hidden" name="reportId" value={r.id} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>{r.id} · {r.brand} {r.product}</strong>
              <span className={status.ok ? "text-good" : "text-muted"}>{status.ok ? `Approved by ${g?.approvedBy}` : "Not published"}</span>
            </div>
            <p className="text-muted">{r.verdict} · {r.source} · {r.lab ?? "lab n/a"} · batch {r.batch ?? "n/a"} · {formatDate(r.reportDate)} · <a className="underline" href={r.url} target="_blank" rel="noopener noreferrer">report ↗</a></p>
            <div className="grid gap-1 sm:grid-cols-2">
              {([["reportLinked", "Lab report linked"], ["batchLabDateShown", "Batch, lab and date on the page"], ["templateWording", "Wording from the approved template"], ["brandNotified", "Brand told in writing"], ["correctionPath", "Correction path on the page"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" name={k} defaultChecked={g?.checklist[k]} className="h-4 w-4" /> {l}</label>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label>Brand notified on <input type="date" name="brandNotifiedAt" className="input" defaultValue={g?.brandNotifiedAt?.slice(0, 10) ?? ""} /></label>
              <label>Brand reply (published beside the finding) <input name="brandReply" className="input" defaultValue={g?.brandReply ?? ""} /></label>
            </div>
            {!status.ok && <p className="text-xs text-muted">Missing: {status.missing.join(", ")}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary">Save checklist</button>
              <button className="btn btn-primary" name="approve" value="1">Approve publication</button>
              {g?.approvedBy && <button className="btn btn-danger" name="revoke" value="1">Revoke</button>}
            </div>
          </form>
        );
      })}
    </div>
  );
}
