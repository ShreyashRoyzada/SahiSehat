export function SearchBox({ defaultValue = "", category, autoFocus }: { defaultValue?: string; category?: string; autoFocus?: boolean }) {
  return (
    <form action="/search" role="search" className="flex gap-2">
      <label htmlFor="q" className="sr-only">Search products</label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Search: dahi, atta, Parle-G, peanut butter…"
        className="input flex-1"
        autoComplete="off"
      />
      {category && <input type="hidden" name="category" value={category} />}
      <button className="btn btn-primary" type="submit">Search</button>
    </form>
  );
}
