"use server";
import { redirect } from "next/navigation";
import { signIn, signOut, signUp, startDemoAccount, currentAccount, deleteAccountData } from "@/lib/server/auth";
import { addMarkers, saveProfile, setConsent } from "@/lib/server/person";
import { RIYA } from "@/lib/demo";

export type FormState = { error?: string; ok?: string } | undefined;

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const ok = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return { error: "That email and password don't match an account." };
  redirect(String(form.get("next") || "/me"));
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  const res = await signUp(String(form.get("email") ?? ""), String(form.get("password") ?? ""), String(form.get("invite") ?? ""));
  if (!res.ok) return { error: res.error };
  redirect("/start");
}

export async function signOutAction() {
  const account = await currentAccount();
  if (account?.isDemo) deleteAccountData(account.id);
  await signOut();
  redirect("/");
}

/** Start the fictional Riya demo (no real data). */
export async function startDemoAction() {
  const existing = await currentAccount();
  if (existing && !existing.isDemo) redirect("/me");
  if (existing?.isDemo) deleteAccountData(existing.id);
  const id = await startDemoAccount();
  setConsent(id, "store-health-data", true);
  setConsent(id, "process-reports", true);
  saveProfile(id, RIYA.profile);
  addMarkers(id, RIYA.markers);
  redirect("/me");
}
