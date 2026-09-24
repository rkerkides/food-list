import Link from "next/link";
import { BottomNav, TopNav } from "./nav";
import { AddPlaceDialog } from "./add-place-dialog";
import type { ProviderInfo } from "@/lib/places";
import { DemoBadge } from "./demo-badge";
import { SkipForward } from "lucide-react";

export function AppShell({
  children,
  provider,
  user,
}: {
  children: React.ReactNode;
  provider: ProviderInfo;
  user: { name: string; isDemo: boolean };
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-3 z-[60] rounded-full bg-ink px-4 py-2 text-sm font-semibold text-canvas focus:not-sr-only"
      >
        <SkipForward className="mr-1 inline size-4" />
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-xl py-1 pr-1 transition hover:opacity-80">
            <span className="grid size-9 place-items-center rounded-[0.85rem] bg-gradient-to-br from-clay-500 to-clay-700 font-display text-base font-semibold text-white shadow-[0_8px_20px_-10px_var(--color-clay-800)]">
              T
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Trapezi</span>
          </Link>
          <div className="hidden flex-1 justify-center md:flex">
            <TopNav />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DemoBadge provider={provider} />
            <AddPlaceDialog provider={provider} />
          </div>
        </div>
      </header>

      <main id="main-content" className="page-enter mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 md:pb-16">
        {children}
      </main>

      <footer className="border-t border-line/80 bg-surface/45 px-4 py-6 pb-24 text-xs text-ink-muted sm:px-6 lg:px-8 md:pb-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <span className="hidden md:inline">
            Signed in as {user.name}
            {user.isDemo ? " (demo account)" : ""}.
          </span>
          <span>
            Trapezi — your personal Cyprus food map.
            {" · "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              © OpenStreetMap contributors
            </a>
          </span>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
