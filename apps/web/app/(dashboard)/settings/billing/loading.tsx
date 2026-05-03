import { Skeleton } from '@/components/ui/skeleton'

export default function BillingLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-32 bg-slate-800" />
      <Skeleton className="h-4 w-64 bg-slate-800" />
      <Skeleton className="h-48 w-full bg-slate-800 rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 bg-slate-800 rounded-xl" />)}
      </div>
    </div>
  )
}
