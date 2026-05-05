import { Skeleton } from '@/components/ui/skeleton'

export default function BrandLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-6 md:py-8 space-y-6">
      <Skeleton className="h-8 w-40 bg-slate-800" />
      <Skeleton className="h-4 w-80 bg-slate-800" />
      {[1, 2, 3, 4, 5].map(i => (
        <Skeleton key={i} className="h-40 w-full bg-slate-800 rounded-xl" />
      ))}
    </div>
  )
}
