import Link from "next/link";
import { appDb } from "@/lib/server/db";
import { resolveQueueAction } from "@/app/actions/admin";

export default function AdminQueue() {
  const db = appDb();
  const flags = db.prepare("SELECT id, at, product_id, kind, message FROM flags WHERE status = 'open' ORDER BY id DESC").all() as { id: number; at: string; product_id: string; kind: string; message: string }[];
  const requests = db.prepare("SELECT id, at, text, url, votes FROM product_requests WHERE status = 'open' ORDER BY votes DESC, id DESC").all() as { id: number; at: string; text: string; url: string | null; votes: number }[];
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">“This looks wrong” reports ({flags.length})</h1>
        {flags.map((f) => (
          <div key={f.id} className="card flex items-start justify-between gap-3 p-3 text-sm">
            <div><Link className="font-semibold underline" href={`/admin/products/${f.product_id}`}>{f.product_id}</Link> · {f.kind} · {f.at.slice(0, 16).replace("T", " ")}<p>{f.message}</p></div>
            <form action={resolveQueueAction}><input type="hidden" name="table" value="flags" /><input type="hidden" name="id" value={f.id} /><button className="btn btn-secondary">Close</button></form>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Product requests ({requests.length})</h2>
        {requests.map((r) => (
          <div key={r.id} className="card flex items-start justify-between gap-3 p-3 text-sm">
            <div><strong>{r.text}</strong> · {r.votes} vote{r.votes === 1 ? "" : "s"}{r.url && <> · <a className="underline" href={r.url} target="_blank" rel="noopener noreferrer">link</a></>}</div>
            <form action={resolveQueueAction}><input type="hidden" name="table" value="requests" /><input type="hidden" name="id" value={r.id} /><button className="btn btn-secondary">Close</button></form>
          </div>
        ))}
      </section>
    </div>
  );
}
