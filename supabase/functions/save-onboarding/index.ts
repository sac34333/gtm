import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getRegionalSources } from '../_shared/sources/regional.ts'

const ALLOWED_ORIGINS = [
  'https://gtmengine.qubitlyventures.com',
  'http://localhost:3000',
]

// Default embedding model — resolved from org preferences at runtime, fallback here
const DEFAULT_EMBEDDING_MODEL = 'perplexity/pplx-embed-v1-0.6b'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/embeddings'

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? ''

  if (req.method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, { status: 403 })
    }
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey, x-supabase-api-version',
      },
    })
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': origin, 'Content-Type': 'application/json' }

  try {
    // 1. Auth — get user from JWT
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // 2. Get org_id from JWT claims only
    const org_id = user.app_metadata?.org_id as string | undefined
    if (!org_id) {
      return new Response(JSON.stringify({ error: 'no_org' }), { status: 401, headers: corsHeaders })
    }

    // 3. Validate request body size (max 1 MB)
    const contentLength = parseInt(req.headers.get('content-length') ?? '0')
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers: corsHeaders })
    }

    const body = await req.json()
    const { complete, ...brandPayload } = body

    // 4. Validate required fields exist in brand payload
    if (typeof brandPayload !== 'object' || brandPayload === null) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400, headers: corsHeaders })
    }

    // 5. Upsert brand_contexts row for this org
    const upsertData: Record<string, unknown> = {
      org_id,
      ...brandPayload,
      updated_at: new Date().toISOString(),
    }

    const { data: brandCtx, error: upsertError } = await serviceClient
      .from('brand_contexts')
      .upsert(upsertData, { onConflict: 'org_id' })
      .select('id')
      .single()

    if (upsertError || !brandCtx) {
      console.error('brand_contexts upsert error:', upsertError?.code)
      return new Response(JSON.stringify({ error: 'save_failed' }), { status: 500, headers: corsHeaders })
    }

    // 6a. If brand_guidelines_url was cleared, also clear the extracted text
    if (Object.prototype.hasOwnProperty.call(brandPayload, 'brand_guidelines_url') && !brandPayload.brand_guidelines_url) {
      await serviceClient
        .from('brand_contexts')
        .update({ brand_guidelines_text: null })
        .eq('org_id', org_id)
    }

    // 6b. If a PDF was uploaded (in any save, not just onboarding completion), extract its text
    if (brandPayload.brand_guidelines_url) {
      try {
        const guidelinesPath = brandPayload.brand_guidelines_url as string
        const { data: fileData } = await serviceClient
          .storage
          .from('brands')
          .download(guidelinesPath)

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer()
          const pdfjsLib = await import('npm:pdfjs-dist/legacy/build/pdf.js')
          pdfjsLib.GlobalWorkerOptions.workerSrc = ''

          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
          const textParts: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            const pageText = content.items
              .filter((item: any) => 'str' in item)
              .map((item: any) => item.str)
              .join(' ')
            textParts.push(pageText)
          }
          const extractedText = textParts.join('\n').trim()

          if (extractedText.length > 0) {
            await serviceClient
              .from('brand_contexts')
              .update({ brand_guidelines_text: extractedText })
              .eq('org_id', org_id)
          }
        }
      } catch (_pdfErr) {
        console.error('pdf extraction failed silently')
      }
    }

    // 7. If complete=true: mark org complete + activate regional feeds + generate embedding
    let onboarding_complete = false

    if (complete === true) {
      // Mark org as onboarding complete
      await serviceClient
        .from('orgs')
        .update({ onboarding_complete: true })
        .eq('id', org_id)

      onboarding_complete = true

      // Activate regional feed sources based on country_code (silent on failure)
      try {
        const countryCode = (brandPayload.country_code as string | undefined) ?? ''
        if (countryCode) {
          const regionalSources = getRegionalSources(countryCode)
          if (regionalSources.length > 0) {
            // Only insert sources that don't already exist for this org
            const { data: existing } = await serviceClient
              .from('feed_configs')
              .select('source_url, source_type')
              .eq('org_id', org_id)
              .eq('auto_activated', true)

            const existingKeys = new Set(
              (existing ?? []).map((fc) => `${fc.source_type}::${fc.source_url}`)
            )

            const toInsert = regionalSources
              .filter((s) => !existingKeys.has(`${s.source_type}::${s.source_url}`))
              .map((s) => ({
                org_id,
                source_type: s.source_type,
                source_url: s.source_url,
                source_label: s.source_label,
                keywords: s.keywords,
                requires_api_key: s.requires_api_key,
                auto_activated: s.auto_activated,
                cron_expression: s.cron_expression,
                is_active: true,
              }))

            if (toInsert.length > 0) {
              await serviceClient.from('feed_configs').insert(toInsert)
            }
          }
        }
      } catch (_regionalErr) {
        // Silent failure — never block the save
        console.error('regional feed activation failed silently')
      }

      // Extract PDF text — handled above (runs on every save, not just onboarding completion)

      // Generate brand context embedding (silent on failure)
      try {
        // Build embedding text from brand context fields
        const embeddingParts = [
          brandPayload.company_name,
          brandPayload.one_sentence_pitch,
          brandPayload.extended_description,
          ...(Array.isArray(brandPayload.products_services)
            ? brandPayload.products_services.map((p: any) => typeof p === 'string' ? p : p?.name)
            : []),
          ...(Array.isArray(brandPayload.active_themes) ? brandPayload.active_themes : []),
          ...(Array.isArray(brandPayload.decision_maker_titles) ? brandPayload.decision_maker_titles : []),
        ].filter(Boolean)

        const embeddingText = embeddingParts.join(' ').trim()

        if (embeddingText.length > 0) {
          const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
          if (openRouterKey) {
            const embeddingRes = await fetch(OPENROUTER_API_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: DEFAULT_EMBEDDING_MODEL,
                input: embeddingText.substring(0, 8000), // cap input length
              }),
            })

            if (embeddingRes.ok) {
              const embeddingData = await embeddingRes.json()
              const embedding = embeddingData?.data?.[0]?.embedding

              if (Array.isArray(embedding) && embedding.length > 0) {
                await serviceClient
                  .from('brand_contexts')
                  .update({ brand_context_embedding: JSON.stringify(embedding) })
                  .eq('org_id', org_id)
              }
            }
          }
        }
      } catch (_embeddingErr) {
        // Silent failure — never block the save
        console.error('embedding generation failed silently')
      }
    }

    return new Response(
      JSON.stringify({ saved: true, onboarding_complete }),
      { status: 200, headers: corsHeaders },
    )
  } catch (err) {
    console.error('save-onboarding unhandled error')
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})
