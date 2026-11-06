"use client";

import {
  addCircleMemberAction,
  createSharedCircleAction,
  deleteSharedCircleAction,
  removeCircleMemberAction,
  setSharedContentEditingAction,
} from "@/app/actions/circles";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SharedCircleSummary } from "@/lib/services/circles";
import { Loader2, Trash2, UserMinus, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function SharedCircles({
  circles,
  currentUserId,
  sharedContentEditableByGroup,
}: {
  circles: SharedCircleSummary[];
  currentUserId: string;
  sharedContentEditableByGroup: boolean;
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

  function setSharedEditing(enabled: boolean) {
    startTransition(async () => {
      const result = await setSharedContentEditingAction(enabled);
      setMessage(result.ok ? (enabled ? "Group editing is on for everything you share." : "Your shared entries are now owner-only.") : result.error);
      if (result.ok) router.refresh();
    });
  }

  function removeMember(circleId: string, memberUserId: string, memberName: string) {
    startTransition(async () => {
      const result = await removeCircleMemberAction(circleId, memberUserId);
      setMessage(result.ok ? `${memberName} was removed from the circle.` : result.error);
      if (result.ok) router.refresh();
    });
  }

  function deleteCircle(circleId: string, name: string) {
    if (!window.confirm(`Delete “${name}”? Members will no longer share content through this circle.`)) return;
    startTransition(async () => {
      const result = await deleteSharedCircleAction(circleId);
      setMessage(result.ok ? `“${name}” was deleted.` : result.error);
      if (result.ok) router.refresh();
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

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-muted/50 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Let group members edit your shared entries</p>
          <p className="text-xs text-ink-muted">
            Applies everywhere you share: places, visits and dish notes. Only you can permanently delete them.
          </p>
        </div>
        <Switch
          checked={sharedContentEditableByGroup}
          disabled={pending}
          onCheckedChange={setSharedEditing}
          aria-label="Let group members edit your shared entries"
        />
      </div>

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
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-ink-muted">Members</p>
                <ul className="flex flex-wrap gap-1.5">
                  {circle.members.map((member) => (
                    <li
                      key={member.userId}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-soft"
                    >
                      <span>{member.name}</span>
                      {member.isOwner ? <span className="text-ink-muted">(owner)</span> : null}
                      {circle.ownerUserId === currentUserId && !member.isOwner ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => removeMember(circle.id, member.userId, member.name)}
                          className="ml-0.5 rounded-full text-ink-muted transition hover:text-red-700 disabled:opacity-50"
                          aria-label={`Remove ${member.name} from ${circle.name}`}
                          title={`Remove ${member.name}`}
                        >
                          <UserMinus className="size-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              {circle.ownerUserId === currentUserId ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => addMember(event, circle.id)}>
                    <Input name="email" type="email" placeholder="Member email" required aria-label={`Email for ${circle.name}`} />
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Add
                    </Button>
                  </form>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => deleteCircle(circle.id, circle.name)}
                    className="text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                    Delete circle
                  </Button>
                </div>
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
