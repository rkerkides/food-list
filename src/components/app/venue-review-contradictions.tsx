"use client";

import { dismissVenueReviewContradictionAction } from "@/app/actions/places";
import { Button } from "@/components/ui/button";
import type { VenueReviewContradiction } from "@/lib/services/venue-review";
import { AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function VenueReviewContradictions({
  placeId,
  contradictions,
}: {
  placeId: string;
  contradictions: VenueReviewContradiction[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  if (contradictions.length === 0) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex gap-2 text-sm text-amber-950">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Review references that differ from saved details</p>
          <p className="mt-0.5 text-xs text-amber-900">Your saved values were kept. Dismiss any reference once it is no longer useful.</p>
        </div>
      </div>
      <ul className="space-y-1.5 pl-6 text-xs text-amber-950">
        {contradictions.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1"><span className="font-medium capitalize">{item.field}</span>: saved {item.current} · review suggested {item.suggested}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending !== null}
              className="shrink-0 text-amber-950 hover:bg-amber-100"
              aria-label={`Dismiss ${item.field} reference`}
              onClick={async () => {
                setPending(item.id);
                const result = await dismissVenueReviewContradictionAction(placeId, item.id);
                setPending(null);
                if (result.ok) router.refresh();
              }}
            >
              <X className="size-3.5" /> Dismiss
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
