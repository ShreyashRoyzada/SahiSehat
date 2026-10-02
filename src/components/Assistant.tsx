"use client";
import { useState } from "react";
import Link from "next/link";
import type { AssistantAnswer } from "@/lib/server/assistant";

const EXAMPLES = ["Which biscuits suit me?", "Why is Parle-G not sahi for me?", "What can I buy instead of Kellogg's Chocos?", "Best peanut butter", "Which namkeen is okay?"];

type Turn = { q: string; a?: AssistantAnswer; error?: string };

export function Assistant({ personalised, engine }: { personalised: boolean; engine: "claude" | "rules" }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setQ("");
    setTurns((t) => [...t, { q: question }]);
    const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
    const data = await res.json();
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? (res.ok ? { q: question, a: data } : { q: question, error: data.error }) : x)));
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {!personalised && <p className="rounded-lg bg-small-bg p-3 text-sm">You&apos;ll get Quality Scores, not personal verdicts, until you add your numbers or try the Riya demo.</p>}
      <div className="space-y-3" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-700 px-3.5 py-2 text-white">{t.q}</p>
            {!t.a && !t.error && <p className="text-sm text-muted">Looking it up…</p>}
            {t.error && <p className="text-sm text-bad">{t.error}</p>}
            {t.a && (
              <div className={`card max-w-[95%] space-y-2 p-3.5 ${t.a.declined ? "border-small/40 bg-small-bg" : ""}`}>
                <p className="whitespace-pre-line">{t.a.text}</p>
                {t.a.items.length > 0 && (
                  <ul className="space-y-1.5">
                    {t.a.items.map((it) => (
                      <li key={it.productId} className="rounded-lg bg-paper p-2.5 text-sm">
                        <Link className="font-semibold underline" href={`/p/${it.productId}`}>{it.name}</Link>
                        {it.verdict && <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-xs font-semibold">{it.verdict}</span>}
                        {it.score !== null && <span className="ml-1 text-xs text-muted">Score {it.score}</span>}
                        <span className="block text-muted">{it.note}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {t.a.sources.length > 0 && (
                  <p className="text-xs text-muted">
                    Sources:{" "}
                    {t.a.sources.map((s, j) => (
                      <span key={j}>{j > 0 && " · "}<Link className="underline" href={s.href}>{s.label}</Link></span>
                    ))}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => <button key={e} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-brand-600/40" onClick={() => ask(e)}>{e}</button>)}
        </div>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <label htmlFor="ask" className="sr-only">Your question</label>
        <input id="ask" className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which breakfast cereal suits me?" maxLength={500} />
        <button className="btn btn-primary" disabled={busy || !q.trim()}>Ask</button>
      </form>
      <p className="hint">Engine: {engine === "claude" ? "Claude, using our catalogue tools (verdicts still come from our rules)" : "rule-based answers from our catalogue"}. Don&apos;t type personal details; we only log that a question was asked.</p>
    </div>
  );
}
