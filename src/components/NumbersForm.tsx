"use client";
import { useActionState } from "react";
import { addNumbersAction } from "@/app/actions/profile";

type Spec = Record<string, { label: string; units: string[]; step: number }>;
const GROUPS: { title: string; names: string[] }[] = [
  { title: "Blood sugar", names: ["hba1c", "fasting-glucose"] },
  { title: "Cholesterol", names: ["total-cholesterol", "ldl", "hdl", "triglycerides"] },
  { title: "Blood pressure", names: ["systolic-bp", "diastolic-bp"] },
  { title: "Body", names: ["height", "weight"] },
];

export function NumbersForm({ markers, today }: { markers: Spec; today: string }) {
  const [state, action, pending] = useActionState(addNumbersAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="date">Date of the test</label>
        <input id="date" name="date" type="date" max={today} defaultValue={today} required className="input" />
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="space-y-2">
          <legend className="font-semibold">{g.title}</legend>
          {g.names.map((n) => (
            <div key={n} className="grid grid-cols-[1fr_6.5rem] gap-2 sm:grid-cols-[1fr_7rem_6.5rem_7rem] sm:items-end">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm" htmlFor={`${n}-v`}>{markers[n].label}</label>
              </div>
              <input id={`${n}-v`} name={`${n}.value`} inputMode="decimal" step={markers[n].step} type="number" className="input" aria-label={`${markers[n].label} value`} />
              <select name={`${n}.unit`} className="input" aria-label={`${markers[n].label} unit`} defaultValue={markers[n].units[0]}>
                {markers[n].units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {!["height", "weight", "systolic-bp", "diastolic-bp"].includes(n) ? (
                <select name={`${n}.flag`} className="input col-span-2 sm:col-span-1" aria-label={`${markers[n].label}: flag printed by the lab`} defaultValue="">
                  <option value="">Lab flag: none</option>
                  <option value="high">Lab says high</option>
                  <option value="normal">Lab says normal</option>
                  <option value="low">Lab says low</option>
                  <option value="critical">Lab says critical</option>
                </select>
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>
          ))}
        </fieldset>
      ))}
      <p className="hint">A flag printed by your lab always wins over our default thresholds. HbA1c can be typed in % or mmol/mol; glucose and cholesterol in mg/dL or mmol/L.</p>
      {state?.error && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-good-bg p-3 text-sm text-good">{state.ok} <a className="underline" href="/me">See what changed</a></p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save numbers"}</button>
    </form>
  );
}
