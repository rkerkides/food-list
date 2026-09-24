"use client";

import { addCircleMemberAction, createSharedCircleAction } from "@/app/actions/circles";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SharedCircleSummary } from "@/lib/services/circles";
import { Loader2, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function SharedCircles({
  circles,
  currentUserId,
}: {
  circles: SharedCircleSummary[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    startTransition(async () => {
      const result = await createSharedCircleAction(name);
      setMessage(result.ok ? "Circle created. Add people below when they have an account." : result.error);
      if (result.ok) {
        event.currentTarget.reset();
        router.refresh();
      }
    });
  }

  function addMember(event: React.FormEvent<HTMLFormElement>, circleId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    startTransition(async () => {
      const result = await addCircleMemberAction(circleId, email);
      setMessage(result.ok ? "Member added — their saved places and ratings now contribute to shared recommendations." : result.error);
      if (result.ok) {
        event.currentTarget.reset();
        router.refresh();
      }
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink-soft uppercase">
          <UsersRound className="size-4 text-clay-600" /> Shared circles
        </h2>
        <p className="text-sm text-ink-muted">
          A circle is opt-in: members can see one another’s saved places, visits and dish notes. Shared recommendation signals combine every member’s ratings.
        </p>
      </div>

      {message ? <Alert variant="info">{message}</Alert> : null}

      {circles.length > 0 ? (
        <div className="space-y-3">
          {circles.map((circle) => (
            <div key={circle.id} className="rounded-2xl border border-line bg-surface-muted/50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{circle.name}</p>
                <p className="text-xs text-ink-muted">
                  {circle.memberCount} {circle.memberCount === 1 ? "member" : "members"} · owned by {circle.ownerName}
                </p>
              </div>
              {circle.ownerUserId === currentUserId ? (
                <form className="mt-3 flex gap-2" onSubmit={(event) => addMember(event, circle.id)}>
                  <Input name="email" type="email" placeholder="Member email" required aria-label={`Email for ${circle.name}`} />
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Add
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <form className="flex gap-2 border-t border-line pt-4" onSubmit={create}>
        <Input name="name" placeholder="e.g. Renos & friends" required minLength={2} maxLength={60} aria-label="Circle name" />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Create circle
        </Button>
      </form>
    </Card>
  );
}
