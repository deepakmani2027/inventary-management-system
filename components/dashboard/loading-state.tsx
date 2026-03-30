export function DashboardLoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="rounded-[2rem] border border-border/60 bg-gradient-to-br from-background via-background to-cyan-50/40 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] md:p-8">
        <div className="h-5 w-24 rounded-full bg-slate-200/80 animate-pulse" />
        <div className="mt-5 h-10 w-64 rounded-2xl bg-slate-200/80 animate-pulse" />
        <div className="mt-4 h-4 w-full max-w-xl rounded-full bg-slate-200/70 animate-pulse" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-border/60 bg-background/80 p-5 shadow-sm">
            <div className="h-4 w-20 rounded-full bg-slate-200/80 animate-pulse" />
            <div className="mt-4 h-8 w-28 rounded-xl bg-slate-200/80 animate-pulse" />
            <div className="mt-3 h-3 w-36 rounded-full bg-slate-200/70 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="rounded-[1.75rem] border border-border/60 bg-background/80 p-4 shadow-sm md:p-6">
        <div className="h-5 w-40 rounded-full bg-slate-200/80 animate-pulse" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid grid-cols-5 gap-3 rounded-2xl border border-border/40 p-4">
              <div className="h-4 rounded-full bg-slate-200/80 animate-pulse" />
              <div className="h-4 rounded-full bg-slate-200/70 animate-pulse" />
              <div className="h-4 rounded-full bg-slate-200/70 animate-pulse" />
              <div className="h-4 rounded-full bg-slate-200/70 animate-pulse" />
              <div className="h-4 rounded-full bg-slate-200/70 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}