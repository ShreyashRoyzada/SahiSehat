"use client";
import { useActionState } from "react";
import { signInAction, signUpAction } from "@/app/actions/auth";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <input type="hidden" name="next" value={next ?? "/me"} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <div>
        <label className="label" htmlFor="invite">Invite code</label>
        <input id="invite" name="invite" required className="input uppercase" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" />
        <p className="hint mt-1">At least 10 characters.</p>
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Create my account"}</button>
      <p className="hint">You&apos;ll choose what to share on the next screen. Nothing about your health is stored until you consent.</p>
    </form>
  );
}
