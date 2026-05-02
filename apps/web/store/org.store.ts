import { create } from 'zustand'
import { type Tables } from '@/lib/supabase/types'

type Org = Tables<'orgs'>

interface OrgStore {
  org: Org | null
  userId: string | null
  userRole: 'owner' | 'admin' | 'member' | null
  setOrg: (org: Org) => void
  setUserId: (id: string) => void
  setUserRole: (role: 'owner' | 'admin' | 'member') => void
  clear: () => void
}

export const useOrgStore = create<OrgStore>((set) => ({
  org: null,
  userId: null,
  userRole: null,
  setOrg: (org) => set({ org }),
  setUserId: (userId) => set({ userId }),
  setUserRole: (userRole) => set({ userRole }),
  clear: () => set({ org: null, userId: null, userRole: null }),
}))
