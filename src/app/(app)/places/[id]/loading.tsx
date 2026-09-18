import { Skeleton } from "@/components/ui/skeleton";

export default function PlaceDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="aspect-[16/10] w-full rounded-[calc(var(--radius-card)+4px)] sm:aspect-[21/9]" />
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-11 w-40 rounded-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        </div>
        <div className="w-full space-y-4 lg:w-80">
          <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
        </div>
      </div>
    </div>
  );
}
