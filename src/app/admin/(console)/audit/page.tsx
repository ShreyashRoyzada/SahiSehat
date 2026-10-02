import { appDb } from "@/lib/server/db";

export default function AdminAudit() {
  const rows = appDb().prepare("SELECT at, actor, action, target, detail FROM audit_log ORDER BY id DESC LIMIT 300").all() as { at: string; actor: string; action: string; target: string | null; detail: string | null }[];
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-muted">Who approved what and when. No personal or health data is written here.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-1">When</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line/60 align-top"><td className="py-1 pr-2">{r.at.slice(0, 19).replace("T", " ")}</td><td className="pr-2">{r.actor}</td><td className="pr-2">{r.action}</td><td className="pr-2">{r.target}</td><td className="break-all text-muted">{r.detail}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
