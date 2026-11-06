"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { STATUS_LABELS, type PlaceStatus, type PlaceWithStats } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { deletePlaceAction, refreshPlaceAction, setPlaceStatusAction } from "@/app/actions/places";

export function PlaceActions({ place, canDelete = true }: { place: PlaceWithStats; canDelete?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function changeStatus(status: PlaceStatus) {
    setPending(status);
    await setPlaceStatusAction(place.id, status);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RefreshButton placeId={place.id} provider={place.provider} />
        {canDelete ? <DeletePlaceButton placeId={place.id} /> : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">List</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as PlaceStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              disabled={pending !== null}
              onClick={() => changeStatus(status)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                place.status === status
                  ? "border-clay-600 bg-clay-50 text-clay-800"
                  : "border-line-strong bg-surface text-ink-soft hover:bg-surface-muted",
              )}
            >
              {pending === status ? <Loader2 className="size-3 animate-spin" /> : null}
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RefreshButton({
  placeId,
  provider,
  variant = "outline",
}: {
  placeId: string;
  provider: string;
  variant?: "outline" | "ghost";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  if (provider === "manual") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-xs text-ink-muted">
        Manual entry
      </span>
    );
  }

  return (
    <div className="contents">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setResult(null);
          const outcome = await refreshPlaceAction(placeId);
          setPending(false);
          setResult({ ok: outcome.ok, message: outcome.message });
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        Refresh details
      </Button>
      {result ? (
        <span className="w-full">
          <Alert variant={result.ok ? "success" : "error"}>{result.message}</Alert>
        </span>
      ) : null}
    </div>
  );
}

export function DeletePlaceButton({ placeId }: { placeId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50">
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">Delete this place?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-ink-soft">
            This removes the place and every visit and dish recorded against it. Archiving keeps the
            history but hides it from your lists.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await deletePlaceAction(placeId);
              setPending(false);
              setOpen(false);
              router.push("/places");
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
