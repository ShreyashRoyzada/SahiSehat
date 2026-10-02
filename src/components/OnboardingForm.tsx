"use client";
import { useActionState } from "react";
import { saveOnboardingAction } from "@/app/actions/profile";
import type { Profile } from "@/lib/types";
import { AGE_OPTIONS, ALLERGEN_OPTIONS, CONDITION_LABELS } from "@/lib/profile-options";
import type { ConsentPurpose, ConsentState } from "@/lib/server/person";

export function OnboardingForm({ profile, consents, consentText, noticeVersion }: { profile: Profile | null; consents: ConsentState; consentText: Record<ConsentPurpose, { title: string; body: string }>; noticeVersion: string }) {
  const [state, action, pending] = useActionState(saveOnboardingAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <fieldset className="card space-y-3 p-4">
        <legend className="px-1 text-lg font-bold">1. Your consent</legend>
        <ConsentBox name="consent-health" defaultChecked={consents["store-health-data"].granted} required title={consentText["store-health-data"].title} body={consentText["store-health-data"].body} />
        <ConsentBox name="consent-reports" defaultChecked={consents["process-reports"].granted} title={`${consentText["process-reports"].title} (optional)`} body={consentText["process-reports"].body} />
        <p className="text-xs text-muted">Notice version {noticeVersion}. Each consent is recorded with its time and can be withdrawn from Privacy in one tap. Draft wording pending legal review.</p>
      </fieldset>

      <fieldset className="card space-y-3 p-4">
        <legend className="px-1 text-lg font-bold">2. About you</legend>
        <div>
          <label className="label" htmlFor="ageBand">Age band</label>
          <select id="ageBand" name="ageBand" className="input" defaultValue={profile?.ageBand ?? ""} required>
            <option value="" disabled>Choose…</option>
            {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a === "under-18" ? "Under 18" : a}</option>)}
          </select>
        </div>
        <div>
          <p className="label">Do any of these apply? <span className="font-normal text-muted">(we only use this to keep you safe)</span></p>
          <Check name="screen" value="pregnancy" label="I'm pregnant" defaultChecked={profile?.screen.includes("pregnancy")} />
          <Check name="screen" value="kidney-disease" label="I have kidney disease or am on dialysis" defaultChecked={profile?.screen.includes("kidney-disease")} />
          <Check name="screen" value="eating-disorder" label="I'm being treated for an eating disorder" defaultChecked={profile?.screen.includes("eating-disorder")} />
          <p className="hint mt-1">If one applies, or you&apos;re under 18, you&apos;ll see scores and lab evidence but no personal verdicts. Food choices then need your doctor.</p>
        </div>
      </fieldset>

      <fieldset className="card space-y-2 p-4">
        <legend className="px-1 text-lg font-bold">3. What are you managing?</legend>
        <p className="hint">Tick what your doctor has told you, or skip and let your report numbers decide.</p>
        {CONDITION_LABELS.map((c) => <Check key={c.value} name="conditions" value={c.value} label={c.label} defaultChecked={profile?.conditions.includes(c.value as never)} />)}
      </fieldset>

      <fieldset className="card space-y-3 p-4">
        <legend className="px-1 text-lg font-bold">4. Diet and allergies</legend>
        <div>
          <label className="label" htmlFor="diet">Diet</label>
          <select id="diet" name="diet" className="input" defaultValue={profile?.diet ?? "none"}>
            <option value="none">No restriction</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="jain">Jain</option>
          </select>
        </div>
        <div>
          <p className="label">Allergies (products that contain or may contain these are blocked)</p>
          <div className="grid grid-cols-2 gap-x-3">
            {ALLERGEN_OPTIONS.map(([v, l]) => <Check key={v} name="allergens" value={v} label={l} defaultChecked={profile?.allergens.includes(v as never)} />)}
          </div>
        </div>
        <div>
          <p className="label">Goals (optional)</p>
          {["Eat less sugar", "Lower LDL", "Eat less salt", "Find better snacks"].map((g) => <Check key={g} name="goals" value={g} label={g} defaultChecked={profile?.goals.includes(g)} />)}
          <p className="hint">We don&apos;t do calorie targets or weight-loss plans.</p>
        </div>
      </fieldset>

      {state?.error && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save and add my numbers"}</button>
    </form>
  );
}

function ConsentBox({ name, title, body, defaultChecked, required }: { name: string; title: string; body: string; defaultChecked?: boolean; required?: boolean }) {
  return (
    <label className="flex gap-3 rounded-lg border border-line p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-5 w-5 shrink-0 accent-[#0b6249]" aria-required={required} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
    </label>
  );
}

export function Check({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-[40px] items-center gap-2.5 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-5 w-5 accent-[#0b6249]" />
      {label}
    </label>
  );
}
