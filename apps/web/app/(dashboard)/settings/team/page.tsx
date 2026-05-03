'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useOrgStore } from '@/store/org.store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, UserMinus, UserCog } from 'lucide-react'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgMember {
  id: string
  user_id: string
  org_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'pending'
  email: string | null
  invited_by: string | null
  joined_at: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callEdgeFunction(name: string, method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'request_failed' }))
    throw new Error(err.error ?? 'request_failed')
  }
  return resp.json()
}

async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('org_members')
    .select('id, user_id, org_id, role, status, email, invited_by, joined_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgMember[]
}

function getRoleBadge(role: string) {
  const map: Record<string, string> = {
    owner: 'bg-purple-500/15 text-purple-400',
    admin: 'bg-indigo-500/15 text-indigo-400',
    member: 'bg-slate-700 text-slate-300',
  }
  return map[role] ?? 'bg-slate-700 text-slate-300'
}

function getStatusBadge(status: string) {
  return status === 'active'
    ? 'bg-emerald-500/15 text-emerald-400'
    : 'bg-amber-500/15 text-amber-400'
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsTeamPage() {
  const { userRole, userId, org } = useOrgStore()
  const queryClient = useQueryClient()
  const isOwner = userRole === 'owner'
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')

  // Remove dialog state
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)

  const { data: members = [], isLoading, isError, refetch } = useQuery<OrgMember[]>({
    queryKey: ['org-members', org?.id],
    queryFn: () => fetchMembers(org!.id),
    enabled: !!org?.id,
  })

  const activeCount = members.filter(m => m.status === 'active').length

  const inviteMutation = useMutation({
    mutationFn: () => callEdgeFunction('invite-user', 'POST', {
      email: inviteEmail,
      role: inviteRole,
    }),
    onSuccess: (result) => {
      toast.success(`Invite sent to ${result.email}`)
      setInviteEmail('')
      setInviteRole('member')
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: (err: Error) => {
      if (err.message === 'seat_limit_reached') {
        toast.error('Seat limit reached. Upgrade your plan to invite more members.')
      } else {
        toast.error(err.message)
      }
    },
  })

  const removeMutation = useMutation({
    mutationFn: (target: OrgMember) => callEdgeFunction('remove-member', 'POST', {
      user_id: target.user_id,
      action: 'remove',
    }),
    onSuccess: () => {
      toast.success('Member removed')
      setRemoveTarget(null)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: (err: Error) => {
      toast.error(err.message === 'cannot_remove_last_owner' ? 'Cannot remove the last owner.' : err.message)
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId: targetId, newRole }: { userId: string; newRole: 'admin' | 'member' }) =>
      callEdgeFunction('remove-member', 'POST', {
        user_id: targetId,
        action: 'change_role',
        new_role: newRole,
      }),
    onSuccess: () => {
      toast.success('Role updated')
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <TeamLoading />

  if (isError) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12 space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Team</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">Failed to load team members.</p>
          <Button variant="outline" className="border-slate-700 text-slate-100" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Team</h1>
        <p className="text-slate-400 text-sm mt-1">Manage team members and invitations.</p>
      </div>

      {/* Seat counter */}
      <div className="text-sm text-slate-400">
        <span className="text-slate-100 font-medium">{activeCount}</span> of{' '}
        <span className="text-slate-100 font-medium">{org?.seat_limit ?? 2}</span> seats used
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Email</TableHead>
              <TableHead className="text-slate-400">Role</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Joined</TableHead>
              {isAdminOrOwner && <TableHead className="text-slate-400">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(member => {
              const isSelf = member.user_id === userId
              const isTargetOwner = member.role === 'owner'
              const canRemove = isAdminOrOwner && !isSelf && !(isTargetOwner && userRole === 'admin')
              const canChangeRole = isOwner && !isSelf

              return (
                <TableRow key={member.id} className="border-slate-800 hover:bg-slate-900">
                  <TableCell className="text-slate-300 text-sm">
                    {member.email ?? `user_${member.user_id.slice(0, 8)}`}
                    {isSelf && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getRoleBadge(member.role)}`}>
                      {member.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusBadge(member.status)}`}>
                      {member.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {member.joined_at
                      ? format(new Date(member.joined_at), 'MMM d, yyyy')
                      : member.status === 'pending' ? 'Pending' : '—'}
                  </TableCell>
                  {isAdminOrOwner && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canRemove && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setRemoveTarget(member)}
                          >
                            <UserMinus className="w-3.5 h-3.5 mr-1" />
                            Remove
                          </Button>
                        )}
                        {canChangeRole && !isTargetOwner && (
                          <Select
                            value={member.role}
                            onValueChange={newRole =>
                              changeRoleMutation.mutate({ userId: member.user_id, newRole: newRole as 'admin' | 'member' })
                            }
                          >
                            <SelectTrigger className="h-7 w-28 bg-slate-800 border-slate-700 text-slate-100 text-xs">
                              <UserCog className="w-3 h-3 mr-1" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a2e] border-slate-700">
                              <SelectItem value="admin" className="text-slate-100 text-xs">Admin</SelectItem>
                              <SelectItem value="member" className="text-slate-100 text-xs">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Invite form */}
      {isAdminOrOwner && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">Invite member</h2>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 h-9"
            />
            <Select
              value={inviteRole}
              onValueChange={v => setInviteRole(v as 'admin' | 'member')}
            >
              <SelectTrigger className="w-28 bg-slate-800 border-slate-700 text-slate-100 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-slate-700">
                <SelectItem value="admin" className="text-slate-100">Admin</SelectItem>
                <SelectItem value="member" className="text-slate-100">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="bg-indigo-600 hover:bg-indigo-500 text-slate-100 h-9"
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Sending…' : 'Invite'}
            </Button>
          </div>
        </div>
      )}

      {/* Remove confirmation dialog */}
      <Dialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <DialogContent className="bg-[#12121e] border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription className="text-slate-400">
              {removeTarget?.email ?? 'This member'} will lose access to your organization immediately.
              They can be re-invited later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TeamLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-24 bg-slate-800" />
      <Skeleton className="h-48 w-full bg-slate-800 rounded-xl" />
      <Skeleton className="h-24 w-full bg-slate-800 rounded-xl" />
    </div>
  )
}

