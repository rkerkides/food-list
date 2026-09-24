import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";

export const metadata = { title: "You’re offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <section className="surface-highlight w-full max-w-md rounded-[calc(var(--radius-card)+8px)] border border-line p-7 text-center shadow-[var(--shadow-float)]">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-clay-50 text-clay-700">
          <CloudOff className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold">You’re offline</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Trapezi needs a connection to safely load your private places and recommendations. Reconnect, then try again.
        </p>
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-clay-600 px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition hover:bg-clay-700">
          <RefreshCw className="size-4" />
          Try again
        </Link>
      </section>
    </main>
  );
}
