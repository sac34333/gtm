import { Skeleton } from '@/components/ui/skeleton'

export default function TeamLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-24 bg-slate-800" />
      <Skeleton className="h-4 w-72 bg-slate-800" />
      <Skeleton className="h-5 w-32 bg-slate-800" />
      <Skeleton className="h-48 w-full bg-slate-800 rounded-xl" />
      <Skeleton className="h-28 w-full bg-slate-800 rounded-xl" />
    </div>
  )
}
