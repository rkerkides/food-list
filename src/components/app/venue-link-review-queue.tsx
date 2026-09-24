"use client";

import { reviewVenueLinkAction } from "@/app/actions/places";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select, Textarea } from "@/components/ui/input";
import {
  VENUE_LINK_SUBMISSION_STATUSES,
  type VenueLinkSubmission,
  type VenueLinkSubmissionStatus,
} from "@/lib/domain/types";
import { formatDate } from "@/lib/utils/format";
import { CheckCircle2, ClipboardList, ExternalLink, Loader2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

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
}: {
  initialSubmissions: VenueLinkSubmission[];
}) {
  if (initialSubmissions.length === 0) {
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
        {initialSubmissions.map((submission) => (
          <SubmissionCard key={submission.id} submission={submission} />
        ))}
      </div>
    </section>
  );
}

function SubmissionCard({ submission }: { submission: VenueLinkSubmission }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<VenueLinkSubmissionStatus>(submission.status);
  const [reviewNote, setReviewNote] = React.useState(submission.reviewNote ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isOpen = status === "pending" || status === "in_review";

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const outcome = await reviewVenueLinkAction(
      submission.id,
      status,
      reviewNote.trim().length ? reviewNote.trim() : null,
    );
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
          <Button type="submit" variant={status === "completed" ? "olive" : "outline"} className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save review
          </Button>
        </form>
      </div>
    </Card>
  );
}
