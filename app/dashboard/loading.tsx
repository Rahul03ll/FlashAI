export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="h-9 w-40 animate-pulse rounded-xl bg-black/8" />
      <div className="mt-3 h-5 w-80 animate-pulse rounded-xl bg-black/5" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-black/5 bg-white/70"
          />
        ))}
      </div>
      <div className="mt-8 h-56 animate-pulse rounded-2xl border border-black/5 bg-white/70" />
    </main>
  );
}
