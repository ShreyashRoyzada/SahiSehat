import "server-only";
import { catalogue } from "./catalogue";
import { fitFor, swapsFor, type PersonContext } from "./person";
import { checkCart as checkCartCore } from "../cart-core";

export type { CartItem, CartSwap, CartResult } from "../cart-core";

export function checkCart(text: string, ctx: PersonContext | null) {
  return checkCartCore(text, {
    cat: catalogue(),
    personalised: Boolean(ctx),
    fit: (v) => (ctx ? fitFor(ctx, v) : null),
    swaps: (v) => swapsFor(ctx, v),
  });
}
