"use client";

type LoadingSkeletonProps = {
  count?: number;
};

export default function LoadingSkeleton({ count = 4 }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex min-h-[220px] flex-col justify-between rounded-2xl border-2 border-ink/20 bg-white/70 p-5 sm:p-6 shadow-comic animate-pulse"
        >
          <div>
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <div className="shimmer h-5 w-28 rounded-full" />
              <div className="shimmer h-4 w-8 rounded-full" />
            </div>

            <div className="mt-3.5 space-y-2">
              <div className="shimmer h-3 w-16 rounded" />
              <div className="shimmer h-4 w-full rounded" />
              <div className="shimmer h-4 w-4/5 rounded" />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-black/5 bg-slate-50/70 p-4 space-y-2">
            <div className="shimmer h-3 w-14 rounded" />
            <div className="shimmer h-3.5 w-full rounded" />
            <div className="shimmer h-3.5 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}
