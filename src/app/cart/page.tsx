import type { Metadata } from "next";
import { CartCheck } from "@/components/CartCheck";

export const metadata: Metadata = { title: "Check my cart" };

export default function CartPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Check my cart</h1>
        <p className="text-muted">Upload a screenshot of your Blinkit, Zepto, Instamart or BigBasket cart. It&apos;s read on your phone. Each item gets a badge and we list the three biggest swaps. Items we can&apos;t match are listed, never guessed.</p>
      </div>
      <CartCheck />
    </div>
  );
}
