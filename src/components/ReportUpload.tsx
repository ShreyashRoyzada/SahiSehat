"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fileToText } from "@/lib/client/read-file";
import { confirmReportAction, type ConfirmRow } from "@/app/actions/profile";
import type { ExtractedRow } from "@/lib/extraction/parse";
import type { MarkerName } from "@/lib/types";

type Spec = Record<string, { label: string; units: string[] }>;
type Extraction = { uploadId: string; rows: ExtractedRow[]; engine: "rules" | "claude"; redactions: number; redactedPreview: string };

// A fictional sample report so the flow can be tried without real data.
const SAMPLE = `CITY DIAGNOSTICS LABORATORY
Patient Name : Ms. Riya Kapoor
UHID: CD2026081400417   Mobile: +91 98765 43210
Ref. By: Dr. A. Mehta
Sample Collected: 14/08/2026 08:10
Test                         Result   Unit     Bio. Ref. Interval
HbA1c (Glycosylated Haemoglobin)  6.1   %   4.0 - 5.6   H
Glucose Fasting (FBS)        104      mg/dL    70 - 100   H
Cholesterol Total            214      mg/dL    < 200      H
LDL Cholesterol - Direct     138      mg/dL    < 100      H
HDL Cholesterol              46       mg/dL    > 40
Triglycerides                141      mg/dL    < 150
`;

export function ReportUpload({ markers }: { markers: Spec }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "reading" | "review" | "saved">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "pdf" | "text" | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [rows, setRows] = useState<ConfirmRow[]>([]);
  const [paste, setPaste] = useState("");
  const [saved, setSaved] = useState(0);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function extract(text: string) {
    setError(null);
    setStage("reading");
    const res = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong reading the report.");
      setStage("idle");
      return;
    }
    const ex = data as Extraction;
    setExtraction(ex);
    setRows(
      ex.rows.map((r) => ({
        include: r.issues.every((i) => !/plausible|isn't supported/.test(i)),
        marker: r.marker as MarkerName,
        value: r.value === null ? "" : String(r.value),
        unit: r.unit && markers[r.marker!]?.units.includes(r.unit) ? r.unit : markers[r.marker!]?.units[0] ?? "",
        date: r.sampleDate ?? "",
        flag: r.flag ?? "",
        range: r.range,
      })),
    );
    setStage("review");
  }

  async function onFile(file: File) {
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewKind(file.type === "application/pdf" ? "pdf" : file.type.startsWith("image/") ? "image" : "text");
    setStage("reading");
    setProgress(0);
    try {
      const text = await fileToText(file, setProgress);
      setSourceText(text);
      await extract(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that file.");
      setStage("idle");
    }
  }

  async function onConfirm() {
    if (!extraction) return;
    setError(null);
    const res = await confirmReportAction(extraction.uploadId, rows);
    if (res.error) return setError(res.error);
    setSaved(res.saved ?? 0);
    setStage("saved");
    // Discard everything from the file in this tab too.
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSourceText("");
    router.refresh();
  }

  function cancel() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSourceText("");
    setExtraction(null);
    setRows([]);
    setStage("idle");
  }

  const update = (i: number, patch: Partial<ConfirmRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (stage === "saved") {
    return (
      <div role="status" className="card space-y-2 p-4">
        <p className="font-semibold text-good">Saved {saved} confirmed value{saved === 1 ? "" : "s"}. Nothing else from the report was kept.</p>
        <div className="flex gap-2">
          <a className="btn btn-primary" href="/me">See my profile</a>
          <button className="btn btn-secondary" onClick={cancel}>Upload another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stage !== "review" && (
        <div className="card space-y-3 p-4">
          <label className="label" htmlFor="report-file">Choose a PDF, photo or screenshot</label>
          <input id="report-file" type="file" accept="application/pdf,image/*" capture="environment" className="input" disabled={stage === "reading"} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">Or paste the report text</summary>
            <textarea className="input mt-2 min-h-32 font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the results section of your report" />
            <button className="btn btn-secondary mt-2" disabled={!paste.trim() || stage === "reading"} onClick={() => { setPreviewKind("text"); setSourceText(paste); extract(paste); }}>Read pasted text</button>
          </details>
          <button className="text-sm font-medium text-brand-700 underline" disabled={stage === "reading"} onClick={() => { setPreviewKind("text"); setSourceText(SAMPLE); extract(SAMPLE); }}>
            Try a fictional sample report
          </button>
          {stage === "reading" && (
            <p role="status" className="text-sm text-muted">
              Reading on your device{progress > 0 && progress < 1 ? ` (${Math.round(progress * 100)}%)` : ""}…
            </p>
          )}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{error}</p>}

      {stage === "review" && extraction && (
        <div className="space-y-3">
          <div className="card space-y-1 p-3.5 text-sm">
            <p><strong>Check each value against your report.</strong> Edit anything that&apos;s wrong, untick anything you don&apos;t want saved, then confirm. Only ticked, confirmed rows are saved.</p>
            <p className="text-muted">
              Read with {extraction.engine === "claude" ? "Claude (on redacted text)" : "our rule-based reader"} · {extraction.redactions} personal detail{extraction.redactions === 1 ? "" : "s"} removed before processing.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <p className="border-b border-line px-3 py-2 text-sm font-semibold">Your report (stays on this device)</p>
              {/* A local object URL of the person's own file: nothing to optimise or upload. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previewKind === "image" && previewUrl && <img src={previewUrl} alt="Your uploaded report" className="max-h-[480px] w-full object-contain" />}
              {previewKind === "pdf" && previewUrl && <iframe src={previewUrl} title="Your uploaded report" className="h-[480px] w-full" />}
              {previewKind === "text" && <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap p-3 text-xs">{sourceText}</pre>}
            </div>
            <div className="card p-3">
              <p className="mb-2 text-sm font-semibold">What we read</p>
              {rows.length === 0 && <p className="text-sm text-muted">We didn&apos;t find HbA1c, glucose, cholesterol, triglyceride or blood-pressure rows. You can <a className="underline" href="/me/numbers">type them instead</a>.</p>}
              <ul className="space-y-3">
                {rows.map((r, i) => (
                  <li key={i} className="rounded-lg border border-line p-2.5">
                    <label className="flex items-center gap-2 font-semibold">
                      <input type="checkbox" className="h-5 w-5 accent-[#0b6249]" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                      {markers[r.marker]?.label ?? r.marker}
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <input className="input" inputMode="decimal" aria-label="Value" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
                      <select className="input" aria-label="Unit" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })}>
                        {markers[r.marker]?.units.map((u) => <option key={u}>{u}</option>)}
                      </select>
                      <select className="input" aria-label="Lab flag" value={r.flag} onChange={(e) => update(i, { flag: e.target.value })}>
                        <option value="">No flag</option>
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                        <option value="critical">Critical</option>
                      </select>
                      <input className="input" type="date" aria-label="Sample date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} />
                    </div>
                    {r.range && <p className="mt-1 text-xs text-muted">Printed range: {r.range}</p>}
                    {extraction.rows[i]?.issues.map((iss) => <p key={iss} className="mt-1 text-xs text-small">⚠ {iss}</p>)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={onConfirm} disabled={!rows.some((r) => r.include)}>Confirm and save ticked values</button>
            <button className="btn btn-secondary" onClick={cancel}>Cancel and discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
