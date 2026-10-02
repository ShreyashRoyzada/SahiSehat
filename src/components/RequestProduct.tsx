"use client";
import { useActionState } from "react";
import { requestProductAction } from "@/app/actions/profile";

export function RequestProduct({ defaultText = "", defaultUrl = "" }: { defaultText?: string; defaultUrl?: string }) {
  const [state, action, pending] = useActionState(requestProductAction, undefined);
  if (state?.ok) return <p role="status" className="text-sm text-good">{state.ok}</p>;
  return (
    <form action={action} className="space-y-2">
      <label className="label" htmlFor="req-text">Request this product</label>
      <input id="req-text" name="text" className="input" defaultValue={defaultText} placeholder="Brand and product name" />
      <input name="url" type="hidden" value={defaultUrl} />
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-secondary" disabled={pending}>{pending ? "Sending…" : "Request this product"}</button>
    </form>
  );
}
