import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { matchByUrl, matchText, searchViews } from "@/lib/server/catalogue";
import { RequestProduct } from "@/components/RequestProduct";
import { ProductCard } from "@/components/ProductCard";

export const metadata: Metadata = { title: "Shared product" };

// Share target (PRD D2): the installed app appears in the Android share sheet.
// Quick-commerce apps share a title, some text and/or a link.
export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const title = str("title");
  const text = str("text");
  const urlInText = text.match(/https?:\/\/\S+/)?.[0] ?? "";
  const url = str("url") || urlInText;
  const words = [title, text.replace(urlInText, "")].join(" ").trim();

  const byUrl = url ? matchByUrl(url) : null;
  if (byUrl) redirect(`/p/${byUrl.product.id}?via=share`);
  const byText = words ? matchText(words) : null;
  if (byText) redirect(`/p/${byText.product.id}?via=share`);

  const close = words ? searchViews(words, { limit: 3 }) : [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">We couldn&apos;t match that product</h1>
      {(words || url) && <p className="card p-3 text-sm text-muted">Shared: {words || url}</p>}
      {close.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Is it one of these?</h2>
          {close.map((v) => <ProductCard key={v.product.id} product={v.product} quality={v.quality} />)}
        </section>
      )}
      <div className="card p-4">
        <RequestProduct defaultText={words} defaultUrl={url} />
      </div>
      <p className="hint">On iPhone, paste the product link into <Link className="underline" href="/search">search</Link> or use cart check, because sharing into web apps is limited there.</p>
    </div>
  );
}
