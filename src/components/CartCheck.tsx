"use client";
import { useState } from "react";
import Link from "next/link";
import { imageToText } from "@/lib/client/read-file";
import type { CartResult } from "@/lib/server/cart";
import type { FitVerdict } from "@/lib/types";
import { VerdictBadge } from "./Badges";

const SAMPLE = `Amul Taaza Toned Fresh Milk Pouch 500 ml  ₹30
Parle-G Gold Biscuits 1 kg  ₹130
Kellogg's Original Corn Flakes 475 g  ₹166
Maggi 2-Minute Masala Noodles 70 g x 4  ₹56
Haldiram's Aloo Bhujia 400 g  ₹110
Fresh Tomatoes 500 g  ₹24
Pintola All Natural Peanut Butter Crunchy 350 g  ₹156`;

export function CartCheck() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(CartResult & { personalised: boolean }) | null>(null);

  async function check(t: string) {
    setBusy("Checking…");
    setError(null);
    const res = await fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return setError(data.error);
    setResult(data);
  }

  async function onFile(file: File) {
    setError(null);
    setBusy("Reading the screenshot on your device…");
    try {
      const t = await imageToText(file, (p) => setBusy(`Reading the screenshot on your device… ${Math.round(p * 100)}%`));
      setText(t);
      await check(t);
    } catch {
      setBusy(null);
      setError("We couldn't read that image. Paste the item names instead.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <label className="label" htmlFor="cart-file">Cart screenshot</label>
        <input id="cart-file" type="file" accept="image/*" className="input" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} disabled={Boolean(busy)} />
        <label className="label" htmlFor="cart-text">Or paste item names, one per line</label>
        <textarea id="cart-text" className="input min-h-32" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={!text.trim() || Boolean(busy)} onClick={() => check(text)}>Check these items</button>
          <button className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => { setText(SAMPLE); check(SAMPLE); }}>Try a sample cart</button>
        </div>
        {busy && <p role="status" className="text-sm text-muted">{busy}</p>}
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4" aria-live="polite">
          {!result.personalised && <p className="rounded-lg bg-small-bg p-3 text-sm">Showing Quality Scores only. <Link className="underline" href="/start">Add your numbers</Link> or try the Riya demo to see personal verdicts.</p>}
          {result.swaps.length > 0 && (
            <section className="card space-y-2 p-4">
              <h2 className="text-lg font-bold">Your three biggest swaps</h2>
              <ol className="space-y-2">
                {result.swaps.map((s) => (
                  <li key={s.fromId} className="rounded-lg bg-brand-50 p-3 text-sm">
                    Swap <Link className="font-semibold underline" href={`/p/${s.fromId}`}>{s.fromName}</Link> for{" "}
                    <Link className="font-semibold underline" href={`/p/${s.toId}?from=${s.fromId}`}>{s.toName}</Link>
                    <span className="block text-brand-800">{[...s.differences, s.why].join(" · ")}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="space-y-2">
            <h2 className="text-lg font-bold">Items ({result.matched.length} matched)</h2>
            {result.matched.map((m) => (
              <Link key={m.productId} href={`/p/${m.productId}`} className="card block p-3.5 hover:border-brand-600/40">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-sm text-muted">{m.score !== null ? `Score ${m.score}` : "No score"}</span>
                </div>
                {m.verdict && m.verdict !== "no-verdict" && <div className="mt-1.5"><VerdictBadge verdict={m.verdict as FitVerdict} size="sm" /></div>}
                {m.reason && <p className="mt-1 text-sm text-muted">{m.reason}</p>}
                <p className="mt-1 text-xs text-muted">From your cart: “{m.line}”</p>
              </Link>
            ))}
          </section>
          {result.unmatched.length > 0 && (
            <section className="card space-y-1 p-4 text-sm">
              <h2 className="font-bold">Not matched</h2>
              <p className="text-muted">We didn&apos;t find a confident match, so these have no badge.</p>
              <ul className="list-disc pl-5">{result.unmatched.map((u) => <li key={u}>{u}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
