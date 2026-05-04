'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { AlertCircle, UserMinus, Crown, ShieldCheck, User as UserIcon, Info, Mail, ChevronDown, Send } from 'lucide-react'
import { format } from 'date-fns'

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

interface AccessContext {
  userId: string
  userEmail: string
  role: 'owner' | 'admin' | 'member'
  orgId: string
  orgName: string
  planTier: string
  seatLimit: number
}

async function callEdgeFunction(name: string, method: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'request_failed' }))
    throw new Error(err.error ?? 'request_failed')
  }
  return resp.json()
}

async function fetchAccess(): Promise<AccessContext> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authenticated')
  const orgId = (user.app_metadata as { org_id?: string })?.org_id
  if (!orgId) throw new Error('no_org')
  const [{ data: member }, { data: org }] = await Promise.all([
    supabase.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).single(),
    supabase.from('orgs').select('name, plan_tier, seat_limit').eq('id', orgId).single(),
  ])
  return {
    userId: user.id,
    userEmail: user.email ?? '',
    role: (member?.role ?? 'member') as 'owner' | 'admin' | 'member',
    orgId,
    orgName: org?.name ?? '',
    planTier: org?.plan_tier ?? 'starter',
    seatLimit: org?.seat_limit ?? 2,
  }
}

async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('org_members')
    .select('id, user_id, org_id, role, status, email, invited_by, joined_at, created_at')
    .eq('org_id', orgId)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgMember[]
}

function RoleBadge({ role }: { role: string }) {
  const config = {
    owner: { icon: Crown, cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
    admin: { icon: ShieldCheck, cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
    member: { icon: UserIcon, cls: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  }[role] ?? { icon: UserIcon, cls: 'bg-slate-700/60 text-slate-300 border-slate-600' }
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium capitalize ${config.cls}`}>
      <Icon className="w-3 h-3" />
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'active'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

function Avatar({ email }: { email: string | null }) {
  const initial = (email?.[0] ?? '?').toUpperCase()
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
      {initial}
    </div>
  )
}

export default function SettingsTeamPage() {
  const queryClient = useQueryClient()

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ['team-access'],
    queryFn: fetchAccess,
    staleTime: 5 * 60 * 1000,
  })

  const { data: members = [], isLoading: membersLoading, isError, refetch } = useQuery<OrgMember[]>({
    queryKey: ['org-members', access?.orgId],
    queryFn: () => fetchMembers(access!.orgId),
    enabled: !!access?.orgId,
  })

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)

  const isOwner = access?.role === 'owner'
  const isAdminOrOwner = access?.role === 'owner' || access?.role === 'admin'

  const activeCount = members.filter(m => m.status === 'active').length
  const pendingCount = members.filter(m => m.status === 'pending').length
  const totalCount = activeCount + pendingCount
  const seatLimit = access?.seatLimit ?? 2
  const seatsLeft = Math.max(0, seatLimit - totalCount)
  const seatPercent = Math.min(100, (totalCount / Math.max(seatLimit, 1)) * 100)
  const atSeatLimit = totalCount >= seatLimit

  const inviteMutation = useMutation({
    mutationFn: () => callEdgeFunction('invite-user', 'POST', { email: inviteEmail.trim(), role: inviteRole }),
    onSuccess: (result: { email: string; resent?: boolean }) => {
      toast.success(result.resent ? `Invite resent to ${result.email}` : `Invite sent to ${result.email}`)
      setInviteEmail('')
      setInviteRole('member')
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: (err: Error) => {
      const msg = err.message
      if (msg === 'seat_limit_reached') toast.error('Seat limit reached. Upgrade your plan to invite more members.')
      else if (msg === 'forbidden') toast.error('You do not have permission to invite members.')
      else if (msg === 'already_member') toast.error('That user is already a member of your org.')
      else if (msg === 'user_in_other_org') toast.error('That email is already registered with another organization.')
      else if (msg === 'rate_limit') toast.error('Email rate limit reached. Wait an hour before sending another invite.')
      else if (msg === 'email_address_invalid' || msg.includes('invalid')) toast.error('That email address is invalid or blocked. Try a real address.')
      else if (msg === 'email_already_registered') toast.error('That email is already registered. Try a different address.')
      else toast.error(msg || 'Invite failed. Try again.')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (target: OrgMember) => callEdgeFunction('remove-member', 'POST', { user_id: target.user_id, action: 'remove' }),
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
      callEdgeFunction('remove-member', 'POST', { user_id: targetId, action: 'change_role', new_role: newRole }),
    onSuccess: () => {
      toast.success('Role updated')
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resendMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: 'admin' | 'member' }) =>
      callEdgeFunction('invite-user', 'POST', { email, role }),
    onSuccess: (result: { email: string }) => toast.success(`Invite resent to ${result.email}`),
    onError: (err: Error) => {
      const msg = err.message
      if (msg === 'rate_limit') toast.error('Email rate limit reached. Wait an hour before resending.')
      else if (msg === 'seat_limit_reached') toast.error('Seat limit reached.')
      else toast.error(msg || 'Resend failed.')
    },
  })

  if (accessLoading || membersLoading) return <TeamLoading />
  if (isError || !access) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-100">Team</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">Failed to load team data.</p>
          <Button variant="outline" className="border-slate-700 text-slate-100 hover:bg-slate-800" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Team</h1>
          <p className="text-slate-400 text-sm mt-1">Manage members and roles for {access.orgName}.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Your role</p>
          <div className="mt-1"><RoleBadge role={access.role} /></div>
        </div>
      </div>

      {/* Seat usage card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Seat usage</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeCount} active{pendingCount > 0 ? ` + ${pendingCount} pending` : ''} of {seatLimit} seats
            </p>
          </div>
          {atSeatLimit && isOwner && (
            <Link href="/settings/billing" className="text-xs font-medium text-indigo-300 hover:text-indigo-200 underline underline-offset-2 whitespace-nowrap">
              Upgrade for more seats
            </Link>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all ${seatPercent >= 100 ? 'bg-red-500' : seatPercent >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${seatPercent}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500">
          {seatsLeft > 0
            ? `${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} available on the ${access.planTier.replace(/_/g, ' ')} plan.`
            : 'No seats available. Upgrade to invite more.'}
        </p>
      </div>

      {/* Roles legend */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Roles</h3>
        </div>
        <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
          <li>
            <span className="text-purple-300 font-medium">Owner</span> &mdash; full control, including billing, plan changes, and removing members. The first person to create the org is automatically the owner. Only an owner can promote another member.
          </li>
          <li>
            <span className="text-indigo-300 font-medium">Admin</span> &mdash; can invite or remove members, change settings, and run generations. Cannot manage billing or remove an owner.
          </li>
          <li>
            <span className="text-slate-300 font-medium">Member</span> &mdash; can use the product (signals, create, ICP, campaigns) but cannot change settings or invite others.
          </li>
        </ul>
      </div>

      {/* Members table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Members ({members.length})</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-medium">Member</TableHead>
                <TableHead className="text-slate-400 text-xs font-medium">Role</TableHead>
                <TableHead className="text-slate-400 text-xs font-medium">Status</TableHead>
                <TableHead className="text-slate-400 text-xs font-medium">Joined</TableHead>
                {isAdminOrOwner && <TableHead className="text-slate-400 text-xs font-medium text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(member => {
                const isSelf = member.user_id === access.userId
                const isTargetOwner = member.role === 'owner'
                const canRemove = isAdminOrOwner && !isSelf && !(isTargetOwner && access.role === 'admin')
                const canChangeRole = isOwner && !isSelf && !isTargetOwner
                const displayEmail = member.email ?? (isSelf ? access.userEmail : `user_${member.user_id.slice(0, 8)}`)

                return (
                  <TableRow key={member.id} className="border-slate-800 hover:bg-slate-800/30">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar email={displayEmail} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-slate-100 truncate">{displayEmail}</span>
                          {isSelf && <span className="text-[10px] text-slate-500">you</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><RoleBadge role={member.role} /></TableCell>
                    <TableCell><StatusBadge status={member.status} /></TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {member.joined_at
                        ? format(new Date(member.joined_at), 'MMM d, yyyy')
                        : member.status === 'pending' ? 'Pending invite' : '-'}
                    </TableCell>
                    {isAdminOrOwner && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canChangeRole && (
                            <div className="relative">
                              <select
                                value={member.role}
                                onChange={e =>
                                  changeRoleMutation.mutate({ userId: member.user_id, newRole: e.target.value as 'admin' | 'member' })
                                }
                                disabled={changeRoleMutation.isPending}
                                className="h-8 w-28 appearance-none bg-slate-950 border border-slate-700 rounded-md text-slate-100 text-xs pl-2 pr-7 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer disabled:opacity-50"
                              >
                                <option value="admin" className="bg-slate-900 text-slate-100">Admin</option>
                                <option value="member" className="bg-slate-900 text-slate-100">Member</option>
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          )}
                          {canRemove && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => setRemoveTarget(member)}
                              title="Remove member"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {member.status === 'pending' && isAdminOrOwner && member.email && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10"
                              onClick={() => resendMutation.mutate({ email: member.email!, role: member.role as 'admin' | 'member' })}
                              disabled={resendMutation.isPending}
                              title="Resend invite email"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {!canRemove && !canChangeRole && (
                            <span className="text-[11px] text-slate-600">-</span>
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
      </section>

      {/* Invite form */}
      {isAdminOrOwner ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-100">Invite member</h2>
          </div>
          <p className="text-xs text-slate-400">
            They will receive an email with a link to join {access.orgName}.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              disabled={atSeatLimit || inviteMutation.isPending}
              className="flex-1 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 h-9"
            />
            <div className="relative">
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
                disabled={atSeatLimit}
                className="h-9 w-32 appearance-none bg-slate-950 border border-slate-700 rounded-md text-slate-100 text-sm pl-3 pr-8 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer disabled:opacity-50"
              >
                <option value="member" className="bg-slate-900 text-slate-100">Member</option>
                <option value="admin" className="bg-slate-900 text-slate-100">Admin</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <Button
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-9"
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending || atSeatLimit}
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send invite'}
            </Button>
          </div>
          {atSeatLimit && (
            <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Seat limit reached on the {access.planTier.replace(/_/g, ' ')} plan.
              {isOwner && (
                <Link href="/settings/billing" className="underline underline-offset-2 hover:text-amber-200 ml-1">
                  Upgrade
                </Link>
              )}
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-400">Only org owners and admins can invite or remove members.</p>
        </section>
      )}

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription className="text-slate-400">
              {removeTarget?.email ?? 'This member'} will lose access to {access.orgName} immediately. They can be re-invited later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="text-slate-300 hover:text-slate-100 hover:bg-slate-800" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TeamLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <Skeleton className="h-8 w-32 bg-slate-800" />
      <Skeleton className="h-24 w-full bg-slate-800 rounded-xl" />
      <Skeleton className="h-32 w-full bg-slate-800 rounded-xl" />
      <Skeleton className="h-64 w-full bg-slate-800 rounded-xl" />
      <Skeleton className="h-28 w-full bg-slate-800 rounded-xl" />
    </div>
  )
}
