import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-5 text-sm text-muted">
        <p className="font-semibold text-ink">
          SahiSehat gives nutrition information, not medical advice. It does not diagnose or treat any condition. Talk to your doctor about medicines and treatment.
        </p>
        <p>
          Independent: no brand pays for placement, commission never affects a verdict, and your health data is never sold or shared.{" "}
          <Link className="underline" href="/method">How verdicts and scores work</Link> ·{" "}
          <Link className="underline" href="/me/privacy">Privacy and your data</Link>
        </p>
        <p className="text-xs">Invite-only beta preview. Product data as of 2 October 2026.</p>
      </div>
    </footer>
  );
}
