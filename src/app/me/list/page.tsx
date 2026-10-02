import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/auth";
import { savedProducts } from "@/lib/server/person";
import { getView } from "@/lib/server/catalogue";
import { removeSavedAction } from "@/app/actions/profile";
import { ScoreBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "My saved swaps" };

export default async function ListPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=/me/list");
  const views = savedProducts(account.id).map(getView).filter((v) => v !== null);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My saved swaps</h1>
      <p className="text-muted">A shopping list from the swaps you saved. It contains no health data.</p>
      {views.length === 0 && <p className="card p-4 text-sm">Nothing saved yet. Open a product and tap “Save to my list” on a swap.</p>}
      <ul className="space-y-2">
        {views.map((v) => (
          <li key={v.product.id} className="card flex items-center justify-between gap-3 p-3.5">
            <Link href={`/p/${v.product.id}`} className="min-w-0 hover:underline">
              <div className="text-xs uppercase tracking-wide text-muted">{v.product.brand}</div>
              <div className="font-semibold">{v.product.name}</div>
            </Link>
            <div className="flex items-center gap-3">
              <ScoreBadge quality={v.quality} size="sm" />
              <form action={removeSavedAction}>
                <input type="hidden" name="productId" value={v.product.id} />
                <button className="text-sm text-muted underline">Remove</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {views.length > 0 && (
        <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent("My shopping list:\n" + views.map((v) => `• ${v.product.brand} ${v.product.name}`).join("\n"))}`} target="_blank" rel="noopener noreferrer">
          Share list on WhatsApp
        </a>
      )}
    </div>
  );
}
