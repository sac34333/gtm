import { create } from 'zustand'
import { type Tables } from '@/lib/supabase/types'

type Org = Tables<'orgs'>
type Role = 'owner' | 'admin' | 'member' | 'viewer'

interface OrgStore {
  org: Org | null
  userId: string | null
  userRole: Role | null
  setOrg: (org: Org) => void
  setUserId: (id: string) => void
  setUserRole: (role: Role) => void
  clear: () => void
  canEdit: () => boolean
  canChat: () => boolean
}

export const useOrgStore = create<OrgStore>((set, get) => ({
  org: null,
  userId: null,
  userRole: null,
  setOrg: (org) => set({ org }),
  setUserId: (userId) => set({ userId }),
  setUserRole: (userRole) => set({ userRole }),
  clear: () => set({ org: null, userId: null, userRole: null }),
  canEdit: () => { const r = get().userRole; return r === 'owner' || r === 'admin' || r === 'member' },
  canChat: () => { const r = get().userRole; return r === 'owner' || r === 'admin' || r === 'member' },
}))