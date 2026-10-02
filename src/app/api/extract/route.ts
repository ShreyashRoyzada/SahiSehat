import { NextResponse, type NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/auth";
import { hasConsent } from "@/lib/server/person";
import { extractReport } from "@/lib/server/extract";

export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasConsent(account.id, "process-reports") || !hasConsent(account.id, "store-health-data")) {
    return NextResponse.json({ error: "Turn on both consents in Privacy to upload a report." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "We couldn't read any text from that file. Try a clearer photo, or type the numbers instead." }, { status: 400 });
  const result = await extractReport(account.id, text);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
