import type { Metadata } from "next";
import { Assistant } from "@/components/Assistant";
import { claudeConfigured } from "@/lib/server/assistant";
import { currentAccount } from "@/lib/server/auth";
import { personContext } from "@/lib/server/person";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage() {
  const account = await currentAccount();
  const ctx = account ? personContext(account.id) : null;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ask SahiSehat</h1>
        <p className="text-muted">Answers come only from our catalogue and your Fit rules, with sources. No diagnosis, medicines or doses.</p>
      </div>
      <Assistant personalised={Boolean(ctx)} engine={claudeConfigured() ? "claude" : "rules"} />
    </div>
  );
}
