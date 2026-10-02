"use client";
import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import type { Profile } from "@/lib/types";
import { AGE_OPTIONS, ALLERGEN_OPTIONS, CONDITION_LABELS } from "@/lib/profile-options";
import { Check } from "./OnboardingForm";

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="ageBand">Age band</label>
        <select id="ageBand" name="ageBand" className="input" defaultValue={profile.ageBand ?? ""}>
          {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a === "under-18" ? "Under 18" : a}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="label">Safety screening</legend>
        <Check name="screen" value="pregnancy" label="I'm pregnant" defaultChecked={profile.screen.includes("pregnancy")} />
        <Check name="screen" value="kidney-disease" label="I have kidney disease or am on dialysis" defaultChecked={profile.screen.includes("kidney-disease")} />
        <Check name="screen" value="eating-disorder" label="I'm being treated for an eating disorder" defaultChecked={profile.screen.includes("eating-disorder")} />
      </fieldset>
      <fieldset>
        <legend className="label">Managing</legend>
        {CONDITION_LABELS.map((c) => <Check key={c.value} name="conditions" value={c.value} label={c.label} defaultChecked={profile.conditions.includes(c.value)} />)}
      </fieldset>
      <div>
        <label className="label" htmlFor="diet">Diet</label>
        <select id="diet" name="diet" className="input" defaultValue={profile.diet}>
          <option value="none">No restriction</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
          <option value="jain">Jain</option>
        </select>
      </div>
      <fieldset>
        <legend className="label">Allergies</legend>
        <div className="grid grid-cols-2 gap-x-3">
          {ALLERGEN_OPTIONS.map(([v, l]) => <Check key={v} name="allergens" value={v} label={l} defaultChecked={profile.allergens.includes(v)} />)}
        </div>
      </fieldset>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-good">{state.ok}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>Save</button>
    </form>
  );
}
