import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function JobStatusPage({ params }: { params: { job_id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: job } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', params.job_id)
    .single()

  if (!job) notFound()

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Job Status</h1>
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Job ID: {job.id}</p>
        <p className="mt-1 font-medium capitalize">{job.status}</p>
        {job.result_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.result_url} alt="Result" className="mt-4 rounded-lg max-w-sm" />
        )}
      </div>
    </div>
  )
}
