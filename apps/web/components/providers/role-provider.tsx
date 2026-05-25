'use client'

import { useEffect } from 'react'
import { useOrgStore } from '@/store/org.store'
import { supabase } from '@/lib/supabase/client'

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const setUserRole = useOrgStore((s) => s.setUserRole)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const orgId = user.app_metadata?.org_id
      if (!orgId) return
      const { data: member } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()
      if (!cancelled) {
        setUserRole(member?.role ?? 'member')
      }
    })()
    return () => { cancelled = true }
  }, [setUserRole])

  return <>{children}</>
}