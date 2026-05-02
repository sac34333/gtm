import { Skeleton } from '@/components/ui/skeleton'

export default function ModelsLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-40 bg-white/5" />
      <Skeleton className="h-32 w-full bg-white/5 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28 bg-white/5 rounded-xl" />)}
      </div>
    </div>
  )
}
