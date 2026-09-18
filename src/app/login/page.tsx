import { redirect } from "next/navigation";
import { AuthForm } from "@/components/app/auth-form";
import { getSessionUser } from "@/lib/auth/session";
import { Star, UtensilsCrossed } from "lucide-react";

const HIGHLIGHTS = [
  "Search real Cyprus venues and save them in seconds",
  "Remember the dishes you loved, not just the venue",
  "Get explained recommendations for tonight",
];

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-clay-700 via-clay-800 to-olive-900 p-10 text-canvas lg:flex">
        <div className="absolute -right-24 top-10 size-72 rounded-full bg-clay-500/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 size-80 rounded-full bg-olive-600/30 blur-3xl" />

        <div className="relative flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-canvas/15 font-display text-lg font-semibold backdrop-blur">
            T
          </span>
          <span className="font-display text-xl font-semibold">Trapezi</span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="font-display text-4xl leading-tight font-semibold text-balance">
            Everywhere you want to eat, and everything you actually liked.
          </h1>
          <ul className="space-y-3 text-sm text-canvas/85">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-canvas/15">
                  <UtensilsCrossed className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-canvas/15 bg-canvas/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-1 text-star">
              {[1, 2, 3, 4, 5].map((step) => (
                <Star key={step} className="size-3.5 fill-current" />
              ))}
            </div>
            <p className="mt-2 text-sm text-canvas/90">
              “Tocayo — 91% match. 3.2 km away, about €25–35/person, and you rated similar Asian
              places 4.7 on average.”
            </p>
            <p className="mt-2 text-xs text-canvas/60">How recommendations explain themselves</p>
          </div>
        </div>

        <p className="relative text-xs text-canvas/60">
          Built for Cyprus · Nicosia · Limassol · Larnaca · Paphos
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-clay-600 font-display text-sm font-semibold text-white">
                T
              </span>
              <span className="font-display text-lg font-semibold">Trapezi</span>
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="text-sm text-ink-muted">
              Your personal list of places to eat in Cyprus, and what you thought of them.
            </p>
          </div>
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
