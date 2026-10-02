import { appDb } from "@/lib/server/db";
import { canGoLive, type RuleTable } from "@/lib/fit/rules";
import { runGolden } from "@/lib/fit/golden";
import { approveRuleVersionAction, activateRuleVersionAction } from "@/app/actions/admin";
import { RuleVersionForm } from "@/components/AdminForms";

export default async function AdminRules({ searchParams }: PageProps<"/admin/rules">) {
  const sp = await searchParams;
  const rows = appDb().prepare("SELECT version, data, active, created_at, created_by FROM rule_tables ORDER BY created_at DESC").all() as { version: string; data: string; active: number; created_at: string; created_by: string }[];
  const active = rows.find((r) => r.active === 1);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rule table versions</h1>
      <p className="text-sm text-muted">A version goes live only with an advisor approval record and all golden cases passing. Old verdicts stay reproducible: each verdict stores its rule version and inputs hash.</p>
      {sp.error && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{String(sp.error)}</p>}
      {rows.map((r) => {
        const t = JSON.parse(r.data) as RuleTable;
        const golden = runGolden(t);
        const live = canGoLive(t);
        return (
          <div key={r.version} className="card space-y-2 p-3.5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>v{r.version} {r.active ? "· ACTIVE" : ""}</strong>
              <span className="text-muted">{t.status} · created {r.created_at.slice(0, 10)} by {r.created_by}</span>
            </div>
            <p>Approval: {t.approval.approver ? `${t.approval.approver}, ${t.approval.approvedAt?.slice(0, 10)}` : "none"}. {t.approval.note}</p>
            <p className={golden.failed.length ? "text-bad" : "text-good"}>Golden cases: {golden.passed} passed, {golden.failed.length} failed{golden.failed.length ? `: ${golden.failed.map((f) => `${f.name} (expected ${f.expected}, got ${f.got})`).join("; ")}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {t.status !== "approved" && (
                <form action={approveRuleVersionAction} className="flex gap-2">
                  <input type="hidden" name="version" value={r.version} />
                  <input name="advisor" className="input" placeholder="Advisor's name and credential" />
                  <button className="btn btn-secondary">Record approval</button>
                </form>
              )}
              {!r.active && (
                <form action={activateRuleVersionAction}>
                  <input type="hidden" name="version" value={r.version} />
                  {!live.ok && <input type="hidden" name="preview" value="1" />}
                  <button className="btn btn-primary">{live.ok ? "Activate" : "Activate for preview only"}</button>
                </form>
              )}
            </div>
          </div>
        );
      })}
      <div className="card p-4">
        <h2 className="mb-2 text-lg font-bold">New version</h2>
        <RuleVersionForm initial={active ? JSON.stringify({ ...JSON.parse(active.data), version: bump(active.version) }, null, 2) : ""} />
      </div>
    </div>
  );
}

function bump(v: string) {
  const [a, b, c] = v.split(".").map(Number);
  return `${a}.${b}.${(c || 0) + 1}`;
}
