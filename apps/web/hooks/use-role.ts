'use client'

import { useOrgStore } from '@/store/org.store'

export type Role = 'owner' | 'admin' | 'member' | 'viewer'

export function useRole() {
  const userRole = useOrgStore((s) => s.userRole)
  const canEdit = userRole !== 'viewer'
  const canChat = userRole !== 'viewer'
  const isViewer = userRole === 'viewer'
  return { userRole, canEdit, canChat, isViewer }
}