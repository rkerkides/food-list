import Link from "next/link";
import { BottomNav, TopNav } from "./nav";
import { AddPlaceDialog } from "./add-place-dialog";
import type { ProviderInfo } from "@/lib/places";
import { DemoBadge } from "./demo-badge";

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
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-clay-600 font-display text-sm font-semibold text-white">
              T
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Trapezi</span>
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pt-8 md:pb-16">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-6 pb-24 text-xs text-ink-muted sm:px-6 md:pb-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
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
