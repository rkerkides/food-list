import { VenueLinkReviewQueue } from "@/components/app/venue-link-review-queue";
import { requireUser } from "@/lib/auth/session";
import { listVenueLinkSubmissions } from "@/lib/services/venue-link-submissions";

export const metadata = { title: "Venue review queue" };

export default async function VenueReviewQueuePage() {
  await requireUser();
  const submissions = await listVenueLinkSubmissions();

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold">Venue review queue</h1>
        <p className="max-w-2xl text-sm text-ink-muted text-pretty">
          Google Maps venue suggestions waiting to be checked and filled in. Open the original link,
          add the completed venue through the normal flow, then mark this request as completed.
        </p>
      </header>
      <VenueLinkReviewQueue initialSubmissions={submissions} />
    </div>
  );
}
