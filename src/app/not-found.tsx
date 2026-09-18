import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-clay-50 text-clay-700">
          <Compass className="size-6" />
        </span>
        <h1 className="font-display text-3xl font-semibold">Nothing here</h1>
        <p className="text-sm text-ink-muted">
          That page or place does not exist in your list. It may have been deleted.
        </p>
        <Button asChild>
          <Link href="/places">Back to your places</Link>
        </Button>
      </div>
    </div>
  );
}
