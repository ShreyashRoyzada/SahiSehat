import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { consentState, getProfile, CONSENT_TEXT, NOTICE_VERSION } from "@/lib/server/person";
import { OnboardingForm } from "@/components/OnboardingForm";

export const metadata: Metadata = { title: "Set up" };

export default async function StartPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/start");
  const profile = getProfile(account.id);
  const consents = consentState(account.id);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-brand-700">Set up · about 3 minutes</p>
        <h1 className="text-2xl font-bold">Tell us what you&apos;re managing</h1>
        <p className="text-muted">Your answers switch on the right rules. You can change or delete them any time.</p>
      </div>
      <OnboardingForm profile={profile} consents={consents} consentText={CONSENT_TEXT} noticeVersion={NOTICE_VERSION} />
    </div>
  );
}
