const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthsBetween(fromIso: string, to: Date): number {
  const d = new Date(fromIso);
  return (to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "undated";
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Today" for the app. SAHI_AS_OF pins it for demos and tests. */
export function asOfDate(): Date {
  const pinned = process.env.SAHI_AS_OF;
  return pinned ? new Date(pinned) : new Date();
}
