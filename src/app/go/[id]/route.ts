import { NextResponse, type NextRequest } from "next/server";
import { getView } from "@/lib/server/catalogue";
import { currentAccount } from "@/lib/server/auth";
import { trackEvent } from "@/lib/server/person";

// Outbound "Where to buy" click: counted for the north-star metric, then redirected.
export async function GET(req: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const v = getView(id);
  const i = Number(req.nextUrl.searchParams.get("i") ?? 0);
  const listing = v?.listings[i];
  if (!v || !listing) return NextResponse.redirect(new URL(`/p/${id}`, req.url));
  const account = await currentAccount();
  trackEvent(account?.id ?? null, "buy_click", id);
  return NextResponse.redirect(listing.url, 302);
}
