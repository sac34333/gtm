---
description: "Week 4 — Video generation: extend generate-asset and poll-job-status for video models (Veo 3.1, Kling via OpenRouter/fal.ai/Google AI Studio), Resend email notification, HTML5 video player."
agent: agent
tools: [supabase]
---

# Week 4 — Video Generation

Read the master spec at [gtm.md](../../gtm.md) Sections 5, 7.2, 11.4, 11.5. Weeks 1–3 must be complete before starting.

## STOP CHECK
Run the Week 3 end-of-week test: select trend → generate image → appears < 3 min → rate → regenerate → download. All must pass before proceeding.

---

## PART 1 — Video Provider Implementations

### _shared/providers/fal.ts — extend for video

Veo 3 via fal.ai (`fal-ai/veo3`), Kling via fal.ai (`fal-ai/kling-video/v2.5-turbo/pro/text-to-video`), WAN (`fal-ai/wan-25-preview/text-to-video`), Ovi (`fal-ai/ovi`). These are async queue jobs — always return `request_id` immediately.

```typescript
export async function callFalVideo(modelId: string, payload: {prompt: string, negative_prompt?: string, aspect_ratio?: string, duration_seconds?: number}, apiKey: string) {
  fal.config({credentials: apiKey})
  const { request_id } = await fal.queue.submit(modelId, {input: payload})
  return {request_id, status: 'pending'}
}

export async function pollFalVideoJob(modelId: string, requestId: string, apiKey: string) {
  fal.config({credentials: apiKey})
  const status = await fal.queue.status(modelId, {requestId, logs: false})
  if (status.status === 'COMPLETED') {
    const result = await fal.queue.result(modelId, {requestId})
    // fal.ai video result has result.video.url or result.videos[0].url
    const videoUrl = result.video?.url ?? result.videos?.[0]?.url
    return {status: 'completed', videoUrl}
  }
  if (status.status === 'FAILED') return {status: 'failed', error: status.error ?? 'Generation failed'}
  return {status: 'processing'}
}
```

### _shared/providers/google_ai_studio.ts — extend for Veo video

`veo-3.1-generate-preview` via Google AI Studio:
```typescript
export async function callGoogleAIStudioVideo(modelId: string, prompt: string, negativePrompt: string, apiKey: string) {
  // Google AI Studio Veo: POST to generate operation (long-running operation)
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${apiKey}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({instances: [{prompt, negativePrompt}], parameters: {aspectRatio: '16:9', durationSeconds: 8}})
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Google AI Studio Veo error: ${response.status} ${JSON.stringify(err)}`)
  }
  const operation = await response.json()
  return {operationName: operation.name, status: 'pending'}
}

export async function pollGoogleAIStudioVideo(operationName: string, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/${operationName}?key=${apiKey}`)
  const operation = await response.json()
  if (operation.done) {
    if (operation.error) return {status: 'failed', error: operation.error.message}
    const videoUrl = operation.response?.videos?.[0]?.video?.uri
    return {status: 'completed', videoUrl}
  }
  return {status: 'processing'}
}
```

### _shared/providers/openrouter.ts — extend for OpenRouter video models

OpenRouter video models (google/veo-3.1, google/veo-3.1-fast, kwaivgi/kling-video-o1, etc.) use the chat completions API with image/video generation parameters:
```typescript
export async function callOpenRouterVideo(modelId: string, prompt: string, negativePrompt: string, apiKey: string, orgId: string, orgSlug: string, jobId: string) {
  const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: modelId,
      prompt,
      negative_prompt: negativePrompt,
      user: orgId, session_id: jobId,
      trace: {org_id: orgId, org_slug: orgSlug, step_key: 'video_generation', job_id: jobId}
    })
  })
  if (!response.ok) throw new Error(`OpenRouter video error: ${response.status}`)
  const data = await response.json()
  // OpenRouter may return a job ID for async video, or a URL for fast models
  return {request_id: data.id, videoUrl: data.data?.[0]?.url}
}
```

### Update router.ts for video routing
Add `routeVideoGeneration(providerKey, modelId, payload, apiKey, orgId, orgSlug, jobId)`:
```typescript
export async function routeVideoGeneration(providerKey: string, modelId: string, payload: any, apiKey: string, orgId: string, orgSlug: string, jobId: string) {
  switch (providerKey) {
    case 'fal': return callFalVideo(modelId, payload, apiKey)
    case 'google_ai_studio': return callGoogleAIStudioVideo(modelId, payload.prompt, payload.negative_prompt, apiKey)
    case 'openrouter': return callOpenRouterVideo(modelId, payload.prompt, payload.negative_prompt, apiKey, orgId, orgSlug, jobId)
    default: throw new Error(`Video not supported on provider: ${providerKey}`)
  }
}
```

---

## PART 2 — Update generate-asset for Video

Edit `supabase/functions/generate-asset/index.ts`:

1. Detect asset_type from `content_job.asset_type` — route to `routeVideoGeneration` if 'video'
2. All video models are async (estimated_time_seconds >= 30) — always return `{job_id, status: 'pending'}` immediately
3. For Google AI Studio video: store `openrouter_job_id = operationName` (the operation name used for polling)
4. For fal.ai video: store `openrouter_job_id = request_id`
5. For OpenRouter video: store `openrouter_job_id = request_id`
6. Increment `video_used` (not `image_used`) for video jobs

---

## PART 3 — Update poll-job-status for Video

Edit `supabase/functions/poll-job-status/index.ts`:

Video jobs can take 2–10 minutes. Increase poll tolerance:
- Image jobs: timeout at `poll_count >= 60` (60 minutes at 1-min intervals)
- Video jobs: timeout at `poll_count >= 600` (10 hours — Kling can be very slow)

Add provider-specific polling:
```typescript
async function pollJob(job: GenerationJob, apiKey: string): Promise<PollResult> {
  if (job.asset_type === 'video') {
    switch (job.provider_key) {
      case 'fal': return pollFalVideoJob(job.model_id, job.openrouter_job_id!, apiKey)
      case 'google_ai_studio': return pollGoogleAIStudioVideo(job.openrouter_job_id!, apiKey)
      case 'openrouter': return pollOpenRouterJob(job.openrouter_job_id!, apiKey)
    }
  } else {
    // image polling (from Week 3)
    switch (job.provider_key) {
      case 'fal': return pollFalJob(job.model_id, job.openrouter_job_id!, apiKey)
      case 'openrouter': return pollOpenRouterJob(job.openrouter_job_id!, apiKey)
    }
  }
}
```

When a video job completes:
1. Download video bytes from `result.videoUrl`
2. Upload to Supabase Storage: `assets/{org_id}/{job_id}.mp4` (content-type: `video/mp4`)
3. UPDATE generation_jobs with `status='completed'`, `output_url`, `completed_at`, `generation_time_ms`
4. Fire Realtime broadcast on `job:{job_id}` channel
5. **Send Resend completion email** (video only — see PART 4 below)

---

## PART 4 — Resend Email for Video Completion

When `poll-job-status` completes a video job, send a transactional email via Resend:

```typescript
async function sendVideoCompletionEmail(job: GenerationJob, userEmail: string) {
  const signedUrl = await generateSignedUrl(job.output_url!, 3600)
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'GTM Engine <noreply@gtmengine.qubitlyventures.com>',
      to: [userEmail],
      subject: 'Your video is ready! 🎬',
      html: `
        <h2>Your AI video is ready</h2>
        <p>Your ${job.model_id} video has been generated successfully.</p>
        <a href="${Deno.env.get('APP_URL')}/create/${job.id}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">View your video</a>
        <p style="margin-top:16px;color:#6B7280;font-size:14px;">This link expires in 1 hour.</p>
      `
    })
  })
}
```

To get the user email: `SELECT email FROM auth.users WHERE id = $job.created_by` using service role client.

Wrap in try/catch — email failure must NEVER cause the job status update to fail.

---

## PART 5 — HTML5 Video Player in /create/[job_id]

Edit `apps/web/app/(dashboard)/create/[job_id]/page.tsx`:

**Video result section (when `asset_type === 'video'`):
```tsx
// Get signed URL first (1-hour expiry)
const { data: signedData } = await supabase.storage.from('assets').createSignedUrl(job.output_url!, 3600)

// Video player
<video
  controls
  autoPlay={false}
  className="w-full rounded-lg shadow-lg"
  src={signedData?.signedUrl}
>
  Your browser does not support the video tag.
</video>

// Download button
<Button onClick={() => downloadVideo(signedData?.signedUrl!, `${orgSlug}_${date}_${job.id.slice(0,8)}.mp4`)}>
  Download MP4
</Button>
```

**In-progress video state:** When job is still pending/processing, show:
- Progress card with: job_id (short), model_id, estimated_time_seconds, time elapsed
- Animated pulse indicator
- 'You can leave this page — we'll email you when it's done'
- Realtime subscription still active on this page

**Model selector update for /create:**
- Group models clearly: 'Image Models' section and 'Video Models' section
- Video models show estimated time in minutes (e.g. '~5 min', '~10 min')
- Show a notice below video model selection: 'Video generation is async. You'll be notified by email and real-time update when complete.'

---

## PART 6 — Dashboard Video Job Progress

Extend /dashboard to handle video jobs properly:

**In-progress video jobs section** (above signal feed):
- Query: `SELECT * FROM generation_jobs WHERE org_id = $org_id AND status IN ('pending', 'processing') ORDER BY created_at DESC`
- For each in-progress job:
  ```tsx
  <Card className="border-blue-200 bg-blue-50">
    <CardContent className="flex items-center gap-4 py-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      <div>
        <p className="font-medium">{job.asset_type === 'video' ? '🎬' : '🖼'} Generating {job.asset_type}...</p>
        <p className="text-sm text-muted-foreground">{job.model_id} · Started {timeAgo(job.created_at)}</p>
      </div>
      <Badge variant="outline">Processing</Badge>
    </CardContent>
  </Card>
  ```
- Subscribe to `job:{job_id}` Realtime channel for each active job
- On completion: replace spinner card with thumbnail (image) or 'Video ready!' card with link to /create/[job_id]

---

## PART 7 — Verification

**End-of-week test (spec Section 17 Week 4):**
1. Open /create. Select a Video model (e.g. veo-3.1-generate-preview or kling-v3.0-pro via OpenRouter)
2. Fill form. Click Generate.
3. See 'Job submitted' confirmation. Redirect to /dashboard.
4. On dashboard: in-progress video card appears with spinner and model name
5. Wait for completion (up to 10 min depending on model)
6. Receive completion email with link to view video
7. Realtime card on dashboard updates to 'Video ready!' with link
8. Navigate to /create/[job_id] — HTML5 video player loads the video
9. Click Download — MP4 file downloads correctly named
10. Check `get_logs` on poll-job-status — video completion logged, no errors

> **NOTE:** If testing without a real video model API key, use fal.ai with your own fal key or Google AI Studio with your Google key. Set the key in /settings/models before generating.
