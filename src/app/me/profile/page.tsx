import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { getProfile } from "@/lib/server/person";
import { ProfileEditForm } from "@/components/ProfileEditForm";

export const metadata: Metadata = { title: "Edit profile" };

export default async function ProfileEditPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/me/profile");
  const profile = getProfile(account.id);
  if (!profile) redirect("/start");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit profile</h1>
      <ProfileEditForm profile={profile} />
    </div>
  );
}
