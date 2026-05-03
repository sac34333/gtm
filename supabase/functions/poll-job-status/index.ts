import { createServiceClient } from '../_shared/db.ts'
import { decrypt } from '../_shared/encryption.ts'

// Image jobs: timeout at 60 polls (60 min). Video jobs: 600 polls (10 hrs).
const IMAGE_POLL_TIMEOUT = 60
const VIDEO_POLL_TIMEOUT = 600

async function sendVideoCompletionEmail(
  db: any,
  job: any,
): Promise<void> {
  try {
    // Get user email via service role client (has access to auth.users)
    const { data: users } = await db
      .from('auth.users')
      .select('email')
      .eq('id', job.created_by)
      .limit(1)
    const userEmail = users?.[0]?.email
    if (!userEmail) return

    // Generate signed URL for the video
    const { data: signedData } = await db.storage
      .from('assets')
      .createSignedUrl(job.output_url, 3600)
    const signedUrl = signedData?.signedUrl ?? ''

    const appUrl = Deno.env.get('APP_URL') ?? 'https://gtmengine.qubitlyventures.com'
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GTM Engine <noreply@gtmengine.qubitlyventures.com>',
        to: [userEmail],
        subject: 'Your video is ready! ??',
        html: `<h2>Your AI video is ready</h2>
<p>Your <strong>${job.model_id}</strong> video has been generated successfully.</p>
<p><a href="${appUrl}/create/${job.id}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">View your video</a></p>
<p style="margin-top:16px;color:#6B7280;font-size:14px;">This link expires in 1 hour. <a href="${signedUrl}">Direct download link</a></p>`,
      }),
    })
  } catch {
    // Email failure must never affect job status update
  }
}

Deno.serve(async (req: Request) => {
  // Cron-triggered: verify service role key in Authorization header
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronOk = cronSecret.length > 0 && cronSecretHeader === cronSecret
  const srOk = serviceRoleKey.length > 0 && authHeader.includes(serviceRoleKey)
  if (!cronOk && !srOk) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  const db = createServiceClient()
  let polled = 0, completed = 0, failed = 0

  try {
    // Fetch both image and video pending jobs with their respective timeouts
    const { data: jobs } = await db
      .from('generation_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])

    for (const job of jobs ?? []) {
      const isVideo = job.asset_type === 'video'
      const pollTimeout = isVideo ? VIDEO_POLL_TIMEOUT : IMAGE_POLL_TIMEOUT
      const pollCount = job.poll_count ?? 0

      // Skip if already timed out
      if (pollCount >= pollTimeout) continue

      polled++
      try {
        const newPollCount = pollCount + 1
        await db.from('generation_jobs')
          .update({ poll_count: newPollCount, status: 'processing' })
          .eq('id', job.id)

        // Timeout check
        if (newPollCount >= pollTimeout) {
          await db.from('generation_jobs').update({
            status: 'failed',
            error_message: 'Generation timed out',
          }).eq('id', job.id)
          failed++
          continue
        }

        if (!job.openrouter_job_id) continue

        // Resolve API key
        let apiKey = ''
        try {
          const { data: keyRow } = await db
            .from('org_provider_api_keys')
            .select('encrypted_key')
            .eq('org_id', job.org_id)
            .eq('provider_key', job.provider_key)
            .maybeSingle()
          if (keyRow?.encrypted_key) {
            apiKey = await decrypt(keyRow.encrypted_key)
          }
        } catch { /* ignore */ }

        if (!apiKey) {
          const platformKeys: Record<string, string> = {
            openrouter: 'OPENROUTER_DEFAULT_API_KEY',
            fal: 'FAL_API_KEY',
            google_ai_studio: 'GOOGLE_AI_STUDIO_API_KEY',
          }
          apiKey = Deno.env.get(platformKeys[job.provider_key] ?? '') ?? ''
        }

        if (!apiKey) {
          await db.from('generation_jobs').update({ status: 'failed', error_message: 'no_api_key' }).eq('id', job.id)
          failed++
          continue
        }

        // Poll by provider + asset type
        let result: { status: string; outputUrl?: string; videoUrl?: string; error?: string } = { status: 'pending' }

        try {
          if (isVideo) {
            switch (job.provider_key) {
              case 'fal': {
                const { pollFalVideoJob } = await import('../_shared/providers/fal.ts')
                result = await pollFalVideoJob(job.model_id, job.openrouter_job_id, apiKey)
                break
              }
              case 'google_ai_studio': {
                const { pollGoogleVideoJob } = await import('../_shared/providers/google_ai_studio.ts')
                result = await pollGoogleVideoJob(job.openrouter_job_id, apiKey)
                break
              }
              case 'openrouter': {
                const { pollOpenRouterJob } = await import('../_shared/providers/openrouter.ts')
                result = await pollOpenRouterJob(job.openrouter_job_id, apiKey)
                break
              }
              default:
                result = { status: 'failed', error: 'unsupported_video_provider' }
            }
          } else {
            switch (job.provider_key) {
              case 'fal': {
                const { pollFalJob } = await import('../_shared/providers/fal.ts')
                const falResult = await pollFalJob(job.openrouter_job_id, apiKey)
                const imageUrl = falResult?.data?.images?.[0]?.url
                result = { status: imageUrl ? 'completed' : 'pending', outputUrl: imageUrl }
                break
              }
              case 'openrouter': {
                const { pollOpenRouterJob } = await import('../_shared/providers/openrouter.ts')
                result = await pollOpenRouterJob(job.openrouter_job_id, apiKey)
                break
              }
              case 'google_ai_studio': {
                const { pollGoogleVideoJob } = await import('../_shared/providers/google_ai_studio.ts')
                result = await pollGoogleVideoJob(job.openrouter_job_id, apiKey)
                break
              }
              default:
                result = { status: 'failed', error: 'unsupported_provider' }
            }
          }
        } catch (pollErr: any) {
          result = { status: 'failed', error: pollErr.message ?? 'poll_error' }
        }

        const resolvedUrl = result.outputUrl ?? result.videoUrl

        if (result.status === 'completed' && resolvedUrl) {
          const startedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now()
          const generationTimeMs = Date.now() - startedAt

          // Download asset bytes
          const assetRes = await fetch(resolvedUrl)
          const bytes = new Uint8Array(await assetRes.arrayBuffer())

          // Upload to storage
          const ext = isVideo ? 'mp4' : 'png'
          const storagePath = `assets/${job.org_id}/${job.id}.${ext}`
          const contentType = isVideo ? 'video/mp4' : 'image/png'

          await db.storage.from('assets').upload(storagePath, bytes, { contentType, upsert: true })

          await db.from('generation_jobs').update({
            status: 'completed',
            output_url: storagePath,
            completed_at: new Date().toISOString(),
            generation_time_ms: generationTimeMs,
          }).eq('id', job.id)

          // Broadcast via Realtime
          try {
            await db.channel(`job:${job.id}`).send({
              type: 'broadcast',
              event: 'job_complete',
              payload: { job_id: job.id, status: 'completed', output_url: storagePath },
            })
          } catch { /* ignore broadcast errors */ }

          // Send completion email for video jobs only
          if (isVideo) {
            await sendVideoCompletionEmail(db, { ...job, output_url: storagePath })
          }

          completed++
        } else if (result.status === 'failed') {
          await db.from('generation_jobs').update({
            status: 'failed',
            error_message: result.error ?? 'generation_failed',
          }).eq('id', job.id)
          failed++
        }
      } catch (jobErr) {
        console.error(`poll-job-status error job ${job.id}:`, (jobErr as Error).message)
      }
    }
  } catch (err) {
    console.error('poll-job-status fatal error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ polled, completed, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
