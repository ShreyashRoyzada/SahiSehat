import Link from "next/link";
import { catalogue, categories } from "@/lib/server/catalogue";
import { currentAccount } from "@/lib/server/auth";
import { startDemoAction } from "@/app/actions/auth";
import { SearchBox } from "@/components/SearchBox";
import { ProductCard } from "@/components/ProductCard";
import { personContext, fitFor } from "@/lib/server/person";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const account = await currentAccount();
  const ctx = account ? personContext(account.id) : null;
  const c = catalogue();
  const topLines = c.list.filter((v) => v.product.qcLine).sort((a, b) => a.product.qcLine!.rank - b.product.qcLine!.rank).slice(0, 6);
  const withLab = c.list.filter((v) => v.reports.some((r) => r.status !== "external-rating")).length;

  return (
    <div className="space-y-8">
      {sp.deleted && (
        <div role="status" className="rounded-xl border border-good/30 bg-good-bg px-4 py-3 text-sm">
          Your profile, numbers, consents and derived results have been deleted.
        </div>
      )}
      <section className="space-y-4 pt-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Sahi hai?</p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Lab-tested food, matched to your body.</h1>
        <p className="text-lg text-muted">
          Every packaged food gets two answers: is it what it claims, and is it right for <em>your</em> blood sugar, cholesterol and blood pressure numbers. Then we name a better swap and where to buy it.
        </p>
        <SearchBox autoFocus={false} />
        <div className="flex flex-wrap gap-2">
          {!account && (
            <form action={startDemoAction}>
              <button className="btn btn-primary" type="submit">Try it as Riya (demo)</button>
            </form>
          )}
          {account ? (
            <Link className="btn btn-primary" href="/me">Open my profile</Link>
          ) : (
            <Link className="btn btn-secondary" href="/signup">I have an invite code</Link>
          )}
          <Link className="btn btn-secondary" href="/cart">Check my cart</Link>
        </div>
        {!account && (
          <p className="hint">
            Riya is a fictional 34-year-old whose August report flags HbA1c and LDL as high. Try her profile before sharing your own numbers.
          </p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        <Stat value={String(c.list.length)} label="products" />
        <Stat value={String(withLab)} label="with a public lab report on file" />
        <Stat value="39" label="quick-commerce lines checked" />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Most ordered on quick commerce</h2>
          <Link className="text-sm font-medium text-brand-700 underline" href="/search">See all</Link>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {topLines.map((v) => (
            <ProductCard key={v.product.id} product={v.product} quality={v.quality} fit={ctx ? fitFor(ctx, v) : null} hasLab={v.reports.some((r) => r.status !== "external-rating")} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Browse by category</h2>
        <div className="flex flex-wrap gap-2">
          {categories().map((cat) => (
            <Link key={cat.name} href={`/search?category=${encodeURIComponent(cat.name)}`} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-brand-600/40">
              {cat.name} <span className="text-muted">{cat.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-bold">How it works</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li><strong>Product truth.</strong> A Quality Score from the label, and lab evidence where a public report exists.</li>
          <li><strong>Your numbers.</strong> Type them or upload a report; you confirm every value before it&apos;s saved.</li>
          <li><strong>Rules decide.</strong> Fixed, versioned rules compare one serving with your daily limits. AI never decides a verdict.</li>
          <li><strong>Swap and buy.</strong> Same-use alternatives ranked by your Fit, then quality, then price.</li>
        </ol>
        <Link className="text-sm font-medium text-brand-700 underline" href="/method">Read the method</Link>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card px-2 py-3">
      <div className="text-2xl font-bold text-brand-800">{value}</div>
      <div className="text-xs leading-tight text-muted">{label}</div>
    </div>
  );
}
