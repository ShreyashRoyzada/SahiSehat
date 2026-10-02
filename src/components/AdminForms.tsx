"use client";
import { useActionState } from "react";
import { adminSignInAction, createRuleVersionAction, saveProductAction } from "@/app/actions/admin";

export function AdminSignIn({ twoFactor, devDefault }: { twoFactor: boolean; devDefault: boolean }) {
  const [state, action, pending] = useActionState(adminSignInAction, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <div><label className="label" htmlFor="actor">Your name or email</label><input id="actor" name="actor" className="input" required /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required /></div>
      {twoFactor && <div><label className="label" htmlFor="code">Authenticator code</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" className="input" required /></div>}
      {devDefault && <p className="rounded bg-small-bg p-2 text-xs">Development mode: ADMIN_PASSWORD isn&apos;t set, so the password is <code>sahisehat-admin</code>{twoFactor ? "" : " and two-factor is off"}. Production requires ADMIN_PASSWORD and ADMIN_TOTP_SECRET.</p>}
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>Sign in</button>
    </form>
  );
}

export function ProductEditor({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState(saveProductAction, undefined);
  return (
    <form action={action} className="space-y-3">
      {children}
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-good">{state.ok}</p>}
      <button className="btn btn-primary" disabled={pending}>Save as new version</button>
    </form>
  );
}

export function RuleVersionForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState(createRuleVersionAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <label className="label" htmlFor="json">Rule table JSON (bump &quot;version&quot;)</label>
      <textarea id="json" name="json" className="input min-h-80 font-mono text-xs" defaultValue={initial} />
      <input name="note" className="input" placeholder="What changed and why (recorded with the version)" />
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-good">{state.ok}</p>}
      <button className="btn btn-primary" disabled={pending}>Save as draft version</button>
    </form>
  );
}
