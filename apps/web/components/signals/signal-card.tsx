import Link from 'next/link'
import { type Tables } from '@/lib/supabase/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

type Signal = Tables<'signals'>

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            <Link href={`/dashboard/signal/${signal.id}`} className="hover:underline">
              {signal.headline ?? 'Untitled signal'}
            </Link>
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs">
              {signal.source_type}
            </Badge>
            {signal.relevance_score != null && (
              <Badge
                variant={signal.relevance_score >= 0.7 ? 'default' : 'outline'}
                className="text-xs tabular-nums"
              >
                {Math.round(signal.relevance_score * 100)}%
              </Badge>
            )}
          </div>
        </div>
        {signal.published_at && (
          <CardDescription>
            {formatDistanceToNow(new Date(signal.published_at), { addSuffix: true })}
          </CardDescription>
        )}
      </CardHeader>
      {signal.summary && (
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">{signal.summary}</p>
        </CardContent>
      )}
    </Card>
  )
}
