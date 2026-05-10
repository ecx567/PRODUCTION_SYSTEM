/**
 * Reusable loading skeleton components for dashboard.
 */

interface SkeletonProps {
  className?: string;
}

export function CardSkeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-leaf-100 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="space-y-3">
        <div className="h-4 w-1/2 animate-pulse rounded bg-leaf-100" />
        <div className="h-8 w-1/3 animate-pulse rounded bg-leaf-50" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-leaf-50" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ className = "" }: SkeletonProps) {
  return (
    <div className="dashboard-card">
      <div className="h-4 w-1/3 animate-pulse rounded bg-leaf-100" />
      <div
        className={`mt-4 animate-pulse rounded-lg bg-leaf-50 ${className || "h-48"}`}
      />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg bg-leaf-50"
        />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-48 animate-pulse rounded bg-leaf-100" />
      <div className="h-3 w-64 animate-pulse rounded bg-leaf-50" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <ChartSkeleton className="h-64" />
    </div>
  );
}
