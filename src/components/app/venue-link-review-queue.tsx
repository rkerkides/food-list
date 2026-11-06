"use client";

import { completeVenueLinkReviewAction, enqueueLinkedVenueForReviewAction, reviewVenueLinkAction } from "@/app/actions/places";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  VENUE_LINK_SUBMISSION_STATUSES,
  PLACE_CATEGORIES,
  CATEGORY_LABELS,
  type PlaceCategory,
  type VenueLinkSubmission,
  type VenueLinkSubmissionStatus,
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/format";
import { CheckCircle2, ClipboardList, ExternalLink, Loader2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { LinkedVenueReviewCandidate } from "@/lib/services/venue-link-submissions";

const STATUS_LABELS: Record<VenueLinkSubmissionStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  completed: "Completed",
  declined: "Declined",
};

const STATUS_STYLES: Record<VenueLinkSubmissionStatus, "default" | "clay" | "olive" | "outline"> = {
  pending: "clay",
  in_review: "default",
  completed: "olive",
  declined: "outline",
};

export function VenueLinkReviewQueue({
  initialSubmissions,
  linkedVenues,
}: {
  initialSubmissions: VenueLinkSubmission[];
  linkedVenues: LinkedVenueReviewCandidate[];
}) {
  if (initialSubmissions.length === 0 && linkedVenues.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="The queue is clear"
        description="New Google Maps venue suggestions will appear here for review."
      />
    );
  }

  const openCount = initialSubmissions.filter(
    (submission) => submission.status === "pending" || submission.status === "in_review",
  ).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {openCount === 0 ? "Everything has been reviewed." : `${openCount} waiting for a decision.`}
        </p>
        <p className="text-xs text-ink-muted">Open suggestions appear first.</p>
      </div>
      <div className="space-y-3">
        {linkedVenues.map((venue) => <LinkedVenueCard key={venue.placeId} venue={venue} />)}
        {initialSubmissions.map((submission) => (
          <SubmissionCard key={submission.id} submission={submission} />
        ))}
      </div>
    </section>
  );
}

function LinkedVenueCard({ venue }: { venue: LinkedVenueReviewCandidate }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-clay-100 p-4 sm:p-5">
      <div>
        <p className="font-medium">{venue.name} <span className="text-sm font-normal text-ink-muted">· saved by {venue.ownerName}</span></p>
        <p className="mt-1 text-sm text-ink-muted">Google Maps link is saved, but it still needs {venue.missing.join(", ")}.</p>
      </div>
      <div className="flex items-center gap-2">
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
        <Button size="sm" disabled={pending} onClick={async () => {
          setPending(true); setError(null);
          const result = await enqueueLinkedVenueForReviewAction(venue.placeId);
          setPending(false);
          if (result.ok) router.refresh(); else setError(result.error);
        }}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Add to queue
        </Button>
      </div>
    </Card>
  );
}

function SubmissionCard({ submission }: { submission: VenueLinkSubmission }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<VenueLinkSubmissionStatus>(submission.status);
  const [reviewNote, setReviewNote] = React.useState(submission.reviewNote ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(() => suggestedVenueName(submission.googleMapsUrl));
  const [category, setCategory] = React.useState<PlaceCategory | "">("");
  const [cuisines, setCuisines] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [area, setArea] = React.useState("");
  const [budgetMin, setBudgetMin] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState("");
  const isOpen = status === "pending" || status === "in_review";

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const outcome = status === "completed"
      ? await completeVenueLinkReviewAction(submission.id, {
          name,
          category: category || null,
          cuisines: cuisines.split(",").map((value) => value.trim()).filter(Boolean),
          address: address.trim() || null,
          area: area.trim() || null,
          expectedSpendMin: numberOrNull(budgetMin),
          expectedSpendMax: numberOrNull(budgetMax),
        }, reviewNote.trim().length ? reviewNote.trim() : null)
      : await reviewVenueLinkAction(submission.id, status, reviewNote.trim().length ? reviewNote.trim() : null);
    setPending(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_STYLES[submission.status]} size="sm">
              {STATUS_LABELS[submission.status]}
            </Badge>
            <span className="text-xs text-ink-muted">
              Submitted by {submission.submitterName} · {formatDate(submission.createdAt)}
            </span>
          </div>
          <a
            href={submission.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex max-w-2xl items-center gap-2 break-all text-sm font-medium text-clay-800 underline decoration-clay-300 underline-offset-4 hover:text-clay-900"
          >
            <ExternalLink className="size-4 shrink-0" />
            {submission.googleMapsUrl}
          </a>
          {submission.latitude != null && submission.longitude != null ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="size-3.5" />
              Coordinates retained: {submission.latitude.toFixed(5)}, {submission.longitude.toFixed(5)}
            </p>
          ) : null}
          {submission.note ? (
            <p className="max-w-2xl rounded-xl bg-surface-muted px-3 py-2 text-sm text-ink-soft text-pretty">
              {submission.note}
            </p>
          ) : null}
          {submission.reviewNote && !isOpen ? (
            <p className="text-sm text-ink-muted">
              <span className="font-medium text-ink-soft">Review note:</span> {submission.reviewNote}
            </p>
          ) : null}
        </div>

        <form onSubmit={submitReview} className="w-full shrink-0 space-y-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5 lg:max-w-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-olive-700" />
            Review decision
          </div>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Field label="Status">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as VenueLinkSubmissionStatus)}
              disabled={pending}
            >
              {VENUE_LINK_SUBMISSION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Review note" hint="Optional — record what was added or why it was declined.">
            <Textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={2}
              maxLength={1000}
              disabled={pending}
              placeholder="Added as a restaurant in Nicosia"
            />
          </Field>
          {status === "completed" ? (
            <div className="space-y-3 rounded-xl border border-olive-100 bg-olive-50/40 p-3">
              <p className="text-xs text-olive-900">Complete the venue now. Existing details are only filled when blank; conflicts are kept as references on the venue.</p>
              <Field label="Venue name">
                <Input value={name} onChange={(event) => setName(event.target.value)} required disabled={pending} />
              </Field>
              <Field label="Venue type" hint="Optional for an existing venue.">
                <Select value={category} onChange={(event) => setCategory(event.target.value as PlaceCategory | "")} disabled={pending}>
                  <option value="">Do not change</option>
                  {PLACE_CATEGORIES.filter((value) => value !== "other").map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}
                </Select>
              </Field>
              <Field label="Cuisines" hint="Comma-separated; optional.">
                <Input value={cuisines} onChange={(event) => setCuisines(event.target.value)} placeholder="e.g. Italian, Pizza" disabled={pending} />
              </Field>
              <Field label="Address" hint="Optional.">
                <Input value={address} onChange={(event) => setAddress(event.target.value)} disabled={pending} />
              </Field>
              <Field label="Area" hint="Optional.">
                <Input value={area} onChange={(event) => setArea(event.target.value)} disabled={pending} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Budget from (€)">
                  <Input value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} inputMode="decimal" disabled={pending} />
                </Field>
                <Field label="Budget to (€)">
                  <Input value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} inputMode="decimal" disabled={pending} />
                </Field>
              </div>
            </div>
          ) : null}
          <Button type="submit" variant={status === "completed" ? "olive" : "outline"} className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {status === "completed" ? "Add venue & complete" : "Save review"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

function suggestedVenueName(url: string) {
  try {
    const match = new URL(url).pathname.match(/\/place\/([^/]+)/);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  } catch { return ""; }
}

function numberOrNull(value: string) {
  const parsed = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}
