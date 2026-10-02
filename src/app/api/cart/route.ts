import { NextResponse, type NextRequest } from "next/server";
import { currentAccount } from "@/lib/server/auth";
import { personContext, trackEvent } from "@/lib/server/person";
import { checkCart } from "@/lib/server/cart";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.slice(0, 20_000) ?? "";
  if (!text.trim()) return NextResponse.json({ error: "We couldn't read any items. Try a clearer screenshot or paste the item names." }, { status: 400 });
  const account = await currentAccount();
  const ctx = account ? personContext(account.id) : null;
  trackEvent(account?.id ?? null, "cart_check");
  return NextResponse.json({ ...checkCart(text, ctx), personalised: Boolean(ctx) }, { headers: { "cache-control": "no-store" } });
}
