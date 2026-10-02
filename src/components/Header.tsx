import Link from "next/link";
import { currentAccount } from "@/lib/server/auth";
import { signOutAction } from "@/app/actions/auth";

export async function Header() {
  const account = await currentAccount();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-800" aria-label="SahiSehat home">
          <Logo />
          <span className="text-lg tracking-tight">SahiSehat</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
          <Link className="rounded-lg px-2.5 py-2 hover:bg-brand-50" href="/search">Search</Link>
          <Link className="hidden rounded-lg px-2.5 py-2 hover:bg-brand-50 sm:inline" href="/cart">Cart check</Link>
          <Link className="hidden rounded-lg px-2.5 py-2 hover:bg-brand-50 sm:inline" href="/ask">Ask</Link>
          {account ? (
            <>
              <Link className="rounded-lg bg-brand-50 px-2.5 py-2 text-brand-800 hover:bg-brand-100" href="/me">
                {account.isDemo ? "Demo" : "Me"}
              </Link>
              <form action={signOutAction}>
                <button className="rounded-lg px-2.5 py-2 text-muted hover:bg-brand-50" type="submit">
                  {account.isDemo ? "End demo" : "Sign out"}
                </button>
              </form>
            </>
          ) : (
            <Link className="rounded-lg bg-brand-700 px-3 py-2 text-white hover:bg-brand-800" href="/login">Sign in</Link>
          )}
        </nav>
      </div>
      <nav aria-label="Quick" className="flex justify-around border-t border-line text-sm font-medium sm:hidden">
        <Link className="flex-1 py-2 text-center" href="/search">Search</Link>
        <Link className="flex-1 py-2 text-center" href="/cart">Cart check</Link>
        <Link className="flex-1 py-2 text-center" href="/ask">Ask</Link>
        <Link className="flex-1 py-2 text-center" href="/me/limits">My limits</Link>
      </nav>
    </header>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0b6249" />
      <path d="M18 34l9 9 19-21" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
