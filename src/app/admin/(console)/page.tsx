import { metrics } from "@/lib/server/admin";
import { appDb } from "@/lib/server/db";
import { catalogue } from "@/lib/server/catalogue";

export default function AdminHome() {
  const m = metrics(7);
  const c = catalogue();
  const db = appDb();
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const withReport = c.list.filter((v) => v.reports.some((r) => r.status !== "external-rating")).length;
  const tiles: [string, string | number, string][] = [
    ["Weekly Personalised Decisions", m.weeklyPersonalisedDecisions, "North star. Beta target 40"],
    ["Verdict views (7 days)", m.verdictViews, ""],
    ["Swap opens / saves", `${m.swapOpens} / ${m.swapSaves}`, ""],
    ["Outbound click rate", `${(m.outboundClickRate * 100).toFixed(1)}%`, "Target 5%"],
    ["Searches · cart checks · questions", `${m.searches} · ${m.cartChecks} · ${m.assistantQuestions}`, ""],
    ["Beta accounts", m.accounts, "Invite 100"],
    ["Products live (preview)", c.list.length, `${c.list.filter((v) => v.product.status === "published").length} published · target 150`],
    ["With a public lab report", withReport, "Target 60"],
    ["Label checked against pack", c.list.filter((v) => v.product.labelSource.verified).length, ""],
    ["Open flags · requests", `${n("SELECT COUNT(*) n FROM flags WHERE status='open'")} · ${n("SELECT COUNT(*) n FROM product_requests WHERE status='open'")}`, ""],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="card p-3">
            <div className="text-sm text-muted">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
            {hint && <div className="text-xs text-muted">{hint}</div>}
          </div>
        ))}
      </div>
      <p className="hint">Events hold a hashed actor id, a kind and a product id only; no health values.</p>
    </div>
  );
}
