import { Skeleton } from '@/components/ui/skeleton'

export default function UsageLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-36 bg-white/5" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-24 bg-white/5 rounded-md" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 bg-white/5 rounded-xl" />
        <Skeleton className="h-20 bg-white/5 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full bg-white/5 rounded-xl" />
    </div>
  )
}
