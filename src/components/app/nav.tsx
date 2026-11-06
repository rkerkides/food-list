"use client";

import { cn } from "@/lib/utils/cn";
import { Compass, Home, Map, User, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/places", label: "Places", icon: UtensilsCrossed },
  { href: "/decide", label: "Decide", icon: Compass, featured: true },
  { href: "/map", label: "Map", icon: Map },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition",
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line/70" : "text-ink-soft hover:bg-surface/70 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" strokeWidth={active ? 2.2 : 1.8} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-xl md:hidden"
      style={{ boxShadow: "var(--shadow-nav)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          if (link.featured) {
            return (
              <li key={link.href} className="flex-1">
                <Link
                  href={link.href}
                  className="flex flex-col items-center gap-1 py-1 text-[10px] font-semibold text-clay-700"
                >
                  <span
                    className={cn(
                      "-mt-3 grid size-12 place-items-center rounded-full text-white shadow-[0_12px_24px_-12px_var(--color-clay-800)] transition",
                      active ? "bg-clay-700" : "bg-clay-600",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  {link.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition active:scale-[0.97]",
                  active ? "text-ink" : "text-ink-muted",
                )}
              >
                <Icon className={cn("size-5", active && "text-clay-700")} strokeWidth={active ? 2.2 : 1.7} />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
