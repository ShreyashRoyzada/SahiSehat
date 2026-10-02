import { NextResponse, type NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/auth";
import { personContext, trackEvent } from "@/lib/server/person";
import { answer } from "@/lib/server/assistant";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const question = body?.question?.trim();
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  const account = await currentAccount();
  const ctx = account ? personContext(account.id) : null;
  trackEvent(account?.id ?? null, "assistant");
  const result = await answer(question, ctx);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
