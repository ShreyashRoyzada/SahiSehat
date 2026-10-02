"use client";
import { useActionState, useState } from "react";
import { flagProductAction } from "@/app/actions/profile";

/** "This looks wrong" on every verdict (PRD G6), routed to the admin queue. */
export function FlagButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(flagProductAction, undefined);
  if (state?.ok) return <p role="status" className="text-sm text-good">{state.ok}</p>;
  if (!open)
    return (
      <button className="text-sm font-medium text-muted underline" onClick={() => setOpen(true)}>
        This looks wrong
      </button>
    );
  return (
    <form action={action} className="card space-y-2 p-3.5">
      <input type="hidden" name="productId" value={productId} />
      <label className="label" htmlFor="flag-msg">What looks wrong?</label>
      <select name="kind" className="input" defaultValue="looks-wrong" aria-label="Kind of problem">
        <option value="looks-wrong">The verdict or score looks wrong</option>
        <option value="label-data">Label values or ingredients are wrong</option>
        <option value="link">A buy link is broken</option>
      </select>
      <textarea id="flag-msg" name="message" className="input min-h-20" placeholder="Tell us what you saw. Please don't include your health numbers." />
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>Send</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
