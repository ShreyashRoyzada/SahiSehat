import { appDb } from "@/lib/server/db";
import { setLicenceAction } from "@/app/actions/admin";

export default function AdminSources() {
  const sources = appDb().prepare("SELECT name, licence, note, updated_at FROM sources ORDER BY name").all() as { name: string; licence: string; note: string; updated_at: string }[];
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Sources and licences</h1>
      <p className="text-sm text-muted">Until a source&apos;s licence is granted, its reports show “Lab report on file” with a link and no verdict (PRD critical path).</p>
      {sources.map((s) => (
        <form key={s.name} action={setLicenceAction} className="card space-y-2 p-3.5 text-sm">
          <input type="hidden" name="name" value={s.name} />
          <strong>{s.name}</strong>
          <select name="licence" defaultValue={s.licence} className="input">
            <option value="pending">Licence requested: link out only</option>
            <option value="granted">Licence granted: display results</option>
            <option value="link-only">Link out only (no licence sought)</option>
          </select>
          <input name="note" className="input" defaultValue={s.note} />
          <div className="flex items-center justify-between"><span className="text-xs text-muted">Updated {s.updated_at.slice(0, 10)}</span><button className="btn btn-secondary">Save</button></div>
        </form>
      ))}
    </div>
  );
}
