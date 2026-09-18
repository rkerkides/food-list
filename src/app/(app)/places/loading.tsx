import { Skeleton } from "@/components/ui/skeleton";

export default function PlacesLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-40" />
      <div className="flex flex-col gap-5 lg:flex-row">
        <Skeleton className="hidden h-96 w-64 rounded-[var(--radius-card)] lg:block" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
                <Skeleton className="aspect-[4/3] w-full" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
