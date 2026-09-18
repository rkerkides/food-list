"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { signOutAction } from "@/app/actions/auth";
import { resetDemoDataAction } from "@/app/actions/demo";
import { Loader2, LogOut, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="sm">
        <LogOut className="size-3.5" />
        Sign out
      </Button>
    </form>
  );
}

export function DemoResetButton({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  if (!isDemo) return null;

  return (
    <div className="contents">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage(null);
          const result = await resetDemoDataAction();
          setPending(false);
          setMessage(
            result.ok
              ? `Demo data reset — ${result.places} places and ${result.visits} visits reseeded.`
              : result.error,
          );
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        Reset demo data
      </Button>
      {message ? (
        <span className="w-full">
          <Alert variant="success">{message}</Alert>
        </span>
      ) : null}
    </div>
  );
}

/** Keeps the profile page honest about what is user data vs inferred data. */
export function AuthenticatedOnly() {
  return (
    <p className="w-full text-xs text-ink-muted">
      Your visits, ratings and notes are yours: external refreshes never overwrite fields you have
      edited, and inferred preferences are recomputed from scratch each time.
    </p>
  );
}
