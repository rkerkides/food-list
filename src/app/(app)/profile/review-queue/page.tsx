import { VenueLinkReviewQueue } from "@/components/app/venue-link-review-queue";
import { requireUser } from "@/lib/auth/session";
import { listLinkedVenueReviewCandidates, listVenueLinkSubmissions } from "@/lib/services/venue-link-submissions";

export const metadata = { title: "Venue review queue" };

export default async function VenueReviewQueuePage() {
  const user = await requireUser();
  const [submissions, linkedVenues] = await Promise.all([listVenueLinkSubmissions(user.id), listLinkedVenueReviewCandidates(user.id)]);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold">Venue review queue</h1>
        <p className="max-w-2xl text-sm text-ink-muted text-pretty">
          Google Maps venue suggestions from you and your shared circles. Review decisions are shared
          with the group, while each person’s saved venue details remain protected.
        </p>
      </header>
      <VenueLinkReviewQueue initialSubmissions={submissions} linkedVenues={linkedVenues} />
    </div>
  );
}
