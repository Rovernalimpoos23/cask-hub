'use client'
// src/components/sidebar/Sidebar.tsx

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { ThemeToggle } from '@/components/theme-toggle'
import type { User } from '@supabase/supabase-js'

const NAV_SECTIONS = [
  {
    label: 'CASK Operating System',
    items: [
      { href: '/command-center', icon: '🏛', label: 'Command Center', locked: false },
    ],
  },
  {
    label: 'General Meetings',
    items: [
      { href: '/sessions', icon: '◈', label: 'All Sessions', locked: false },
      { href: '/generate', icon: '✦', label: 'Generate Agenda', locked: false },
      { href: '/actions', icon: '◎', label: 'Action Items', locked: false },
    ],
  },
  {
    label: "President's Workflow",
    items: [
      { href: '/presidents-workflow/big-vision', icon: '🔭', label: 'CASK Big Vision', locked: false },
      { href: '/president/overview', icon: '▤', label: "President's Meeting Agendas", locked: false },
      { href: '/president/calendar', icon: '📅', label: "President's Calendar", locked: false },
      { href: '/president/inbox', icon: '📥', label: "President's Inbox", locked: false },
      { href: '/daily-meetings', icon: '🗓', label: 'Daily Meetings Recap', locked: false },
    ],
  },
  // MY WORKSPACE — the signed-in user's own tools. Placed between President's
  // Workflow and Customer Journey for admins. Restricted roles don't see
  // President's Workflow, so (via RESTRICTED_VISIBLE_SECTIONS below) this falls
  // between General Meetings and Customer Journey for them.
  {
    label: 'My Workspace',
    items: [
      { href: '/my-workspace/calendar', icon: '📅', label: 'My Calendar', locked: false },
      { href: '/my-workspace/email', icon: '✉️', label: 'My Emails', locked: false },
    ],
  },
  {
    label: 'Customer Journey',
    items: [
      { href: '/customers/new', icon: '➕', label: 'New Client Setup', locked: false },
      { href: '/customers', icon: '👥', label: 'Active Clients', locked: false },
      { href: '/customers/okr-dashboard', icon: '🎯', label: 'OKR Dashboard', locked: false },
    ],
  },
  {
    label: 'Design Center',
    items: [
      { href: '/design-center', icon: '🏛', label: 'Design Center', locked: false },
    ],
  },
  {
    label: 'Meeting Intelligence',
    locked: true,
    items: [
      { href: '#', icon: '🎙', label: 'AI Notetaker', locked: true },
      { href: '#', icon: '📋', label: 'Transcripts', locked: true },
    ],
  },
  {
    label: 'Estimates',
    locked: true,
    items: [
      { href: '#', icon: '📐', label: 'Upload Drawing', locked: true },
      { href: '#', icon: '💰', label: 'ACE Budget Format', locked: true },
      { href: '#', icon: '📁', label: 'Past Estimates', locked: true },
    ],
  },
  {
    label: 'KPI Dashboard',
    locked: true,
    items: [
      { href: '#', icon: '📊', label: 'Revenue Tracker', locked: true },
      { href: '#', icon: '🎯', label: '$20M Goal', locked: true },
      { href: '#', icon: '👥', label: 'Team Performance', locked: true },
    ],
  },
]

// ── Role-based access ────────────────────────────────────────────────
// Restricted roles see the standalone Dashboard link plus two sections:
//   • General Meetings  — All Sessions, Generate Agenda, Action Items
//   • Customer Journey  — Active Clients, OKR Dashboard, New Client Setup
// They are NO LONGER redirected away from /dashboard (they have dashboard access).
// Admin roles (Calin/president, Kai/ea, Rovern/ai_specialist) see everything
// exactly as before. Roles are read from the `users.role` column.
const RESTRICTED_ROLES = ['vp_sales', 'ops_manager', 'vp_ops', 'vp_finance', 'member']
const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']
// Sections a restricted role is allowed to see, matched by NAV_SECTIONS label.
// The General Meetings section already contains exactly the three allowed items
// (All Sessions, Generate Agenda, Action Items), so the whole section is shown.
const RESTRICTED_VISIBLE_SECTIONS = ['General Meetings', 'My Workspace', 'Customer Journey']

// Input style for the Change Password modal — mirrors the app's form inputs
// (see src/app/(app)/customers/new/page.tsx inputStyle).
const CHANGE_PW_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

// Show/Hide toggle button for the Change Password inputs.
const CHANGE_PW_TOGGLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--text3)',
  fontSize: 11,
  fontFamily: 'inherit',
  padding: 0,
}

const RECENT_SESSIONS = [
  { label: 'Apr 30 · Leadership', href: '/sessions/a1b2c3d4-0006-0006-0006-000000000006' },
  { label: 'Mar 27 · Q2 Planning', href: '/sessions/a1b2c3d4-0003-0003-0003-000000000003' },
  { label: 'Feb 27 · Leadership', href: '/sessions/a1b2c3d4-0001-0001-0001-000000000001' },
]

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

function getDisplayName(user: User | null): string {
  if (!user) return 'Loading…'
  const meta = user.user_metadata as Record<string, string> | undefined
  return meta?.full_name ?? meta?.name ?? user.email ?? 'CASK User'
}

function getSubtitle(user: User | null): string {
  if (!user) return ''
  const meta = user.user_metadata as Record<string, string> | undefined
  return meta?.role ?? meta?.title ?? user.email ?? ''
}

function SideNavLink({ href, icon, label, isActive, standalone }: { href: string; icon: string; label: string; isActive: boolean; standalone?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-[9px] rounded-[6px] font-sans font-medium tracking-[-0.1px] no-underline ${standalone ? 'text-[14px]' : 'text-[13px]'}`}
      style={{
        paddingTop: standalone ? '9px' : '8px',
        paddingBottom: standalone ? '9px' : '8px',
        paddingRight: '10px',
        paddingLeft: isActive ? '10px' : hovered ? '14px' : '10px',
        background: isActive ? 'rgba(255,255,255,0.08)' : hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: isActive ? 'rgba(255,255,255,0.95)' : hovered ? 'rgba(255,255,255,0.92)' : standalone ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.75)',
        transition: 'padding-left 180ms ease, background 180ms ease, color 180ms ease',
      }}
    >
      <span
        className={`${standalone ? 'text-[14px]' : 'text-[13px]'} w-4 text-center shrink-0`}
        style={{ opacity: isActive ? 0.9 : standalone ? 0.65 : 0.5 }}
      >
        {icon}
      </span>
      {label}
    </Link>
  )
}

function SideRecentLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-[9px] rounded-[6px] font-sans text-[12px] font-normal tracking-[-0.1px] no-underline"
      style={{
        paddingTop: '7px',
        paddingBottom: '7px',
        paddingRight: '10px',
        paddingLeft: hovered ? '14px' : '10px',
        background: hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: 'rgba(255,255,255,0.45)',
        transition: 'padding-left 180ms ease, background 180ms ease',
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.25)' }}>›</span>
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  // Gates the role-dependent nav so restricted users never flash the full admin
  // section list before their role resolves. False until the role fetch settles.
  const [roleLoaded, setRoleLoaded] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // ── Change Password (additive) ─────────────────────────────────────────────
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwToast, setPwToast] = useState('')
  // Per-input show/hide toggles for the Change Password modal.
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Look up the current user's role from the `users` table to drive access.
  // The role-dependent nav is hidden until this settles (roleLoaded), so no
  // version of the sidebar renders before the role is confirmed. Auth is
  // guaranteed by middleware, so a user.email always resolves here.
  useEffect(() => {
    if (!user?.email) { setRole(null); return }
    const supabase = createClient()
    supabase
      .from('users')
      .select('role')
      .eq('email', user.email)
      .maybeSingle()
      .then(
        ({ data }) => { setRole((data?.role as string | undefined) ?? null); setRoleLoaded(true) },
        () => { setRole(null); setRoleLoaded(true) }, // mark loaded on failure too
      )
  }, [user?.email])

  // A role is restricted only when it's in RESTRICTED_ROLES and not an admin role
  // (defensive: an admin role always wins). Null role = treat as unrestricted.
  const isRestricted = role !== null && RESTRICTED_ROLES.includes(role) && !ADMIN_ROLES.includes(role)

  // NOTE: restricted users now HAVE dashboard access, so the previous
  // redirect-to-/customers behavior on /dashboard has been removed intentionally.

  // Calin (c.noonan) and Kai (k.mapoy) don't get the MY WORKSPACE section — their
  // calendar lives on the Make.com feed elsewhere. Restricted roles (vp_sales,
  // ops_manager, vp_ops, vp_finance, member) are also excluded. Keyed off the
  // signed-in email (this file uses `user?.email`, not `userEmail`) plus the
  // existing `isRestricted` flag above — the file's own equivalent of
  // isRestrictedRole(userRole), so no extra import from role-filter is needed.
  const hideMyWorkspace =
    user?.email === 'c.noonan@caskconstruction.com' ||
    isRestricted

  // Restricted roles see only the Customer Journey section; admins see all.
  // MY WORKSPACE is then dropped for Calin/Kai when hideMyWorkspace is true.
  const visibleSections = (isRestricted
    ? NAV_SECTIONS.filter((s) => RESTRICTED_VISIBLE_SECTIONS.includes(s.label))
    : NAV_SECTIONS
  ).filter((s) => !(hideMyWorkspace && s.label === 'My Workspace'))

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  // Auto-dismiss the success toast after a few seconds.
  useEffect(() => {
    if (!pwToast) return
    const t = setTimeout(() => setPwToast(''), 3000)
    return () => clearTimeout(t)
  }, [pwToast])

  function closePwModal() {
    setPwModalOpen(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwError('')
  }

  async function handleUpdatePassword() {
    if (pwSubmitting) return
    setPwError('')
    // Validation
    if (!currentPassword) { setPwError('Please enter your current password.'); return }
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPwError('New password and confirmation do not match.'); return }

    setPwSubmitting(true)
    const supabase = createClient()
    // NOTE: supabase.auth.updateUser updates the signed-in user's password
    // directly and does not re-verify the current password (there's no
    // client-side reauth API). The Current Password field is collected for
    // UX parity but is not separately validated against the server here.
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSubmitting(false)
    if (error) { setPwError(error.message); return }
    closePwModal()
    setPwToast('Password updated successfully')
  }

  const displayName = getDisplayName(user)
  const subtitle = getSubtitle(user)
  const initials = user ? getInitials(
    (user.user_metadata as Record<string, string> | undefined)?.full_name ??
    (user.user_metadata as Record<string, string> | undefined)?.name,
    user.email
  ) : '…'

  return (
    <aside
      className="flex flex-col overflow-hidden relative"
      style={{ background: 'var(--sidebar)' }}
    >
      {/* Right border gradient */}
      <div
        className="absolute top-0 right-0 w-px h-full"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.06) 80%, transparent)',
        }}
      />

      {/* Header */}
      <div
        className="px-4 pt-[18px] pb-[14px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center">
            <Image
              src="/cask-logo-white.svg"
              alt="CASK"
              width={72}
              height={22}
              className="h-[22px] w-auto object-contain"
              priority
            />
          </div>
          <div
            className="w-px h-[18px] mx-1.5"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          />
          <div>
            <div
              className="font-sans text-[15px] font-medium tracking-[0.2px]"
              style={{ color: 'rgba(255,255,255,0.88)' }}
            >
              Hub
            </div>
            <div
              className="text-[9px] font-sans font-medium tracking-[1.5px] uppercase"
              style={{ color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}
            >
              Leadership
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2.5 overflow-y-auto flex flex-col gap-px">
        {/* Standalone Dashboard — visible for ALL roles (restricted users now
            have dashboard access). */}
        <SideNavLink
          href="/dashboard"
          icon="▣"
          label="Dashboard"
          isActive={pathname === '/dashboard'}
          standalone
        />
        <div className="h-px my-1.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Role-dependent sections — only render once the role has resolved, so
            restricted users never flash the full admin section list. */}
        {roleLoaded && visibleSections.map((section) => (
          <div key={section.label}>
            <div
              className="text-[10px] font-medium tracking-[1.5px] uppercase px-2 pt-3 pb-1"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              {section.label}
              {section.locked && (
                <span
                  className="ml-2 text-[9px] font-semibold tracking-[0.8px] uppercase py-[2px] px-1.5 rounded-[3px]"
                  style={{
                    color: 'rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  SOON
                </span>
              )}
            </div>
            {section.items.map((item) => {
              // Hide President's Inbox from Rovern's account only. Every other
              // admin (Calin, Kai, future admins) still sees it.
              if (
                item.href === '/president/inbox' &&
                user?.email === 'r.alimpoos@caskconstruction.com'
              ) {
                return null
              }
              const isActive = !item.locked && pathname === item.href
              if (item.locked) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-[9px] px-2.5 py-2 rounded-[6px] opacity-40 cursor-not-allowed"
                    style={{ color: 'rgba(255,255,255,0.75)' }}
                  >
                    <span className="text-[13px] w-4 text-center opacity-50 shrink-0">{item.icon}</span>
                    <span className="font-sans text-[13px] font-medium tracking-[-0.1px]">{item.label}</span>
                    <span
                      className="ml-auto text-[9px] font-semibold tracking-[0.8px] uppercase py-[2px] px-1.5 rounded-[3px] shrink-0"
                      style={{
                        color: 'rgba(255,255,255,0.3)',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      SOON
                    </span>
                  </div>
                )
              }
              return (
                <SideNavLink
                  key={item.label}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={isActive}
                />
              )
            })}
          </div>
        ))}

        {/* Separator + Recent Sessions + Upcoming — hidden for restricted roles,
            and withheld entirely until the role resolves (no admin flash). */}
        {roleLoaded && !isRestricted && (
          <>
        {/* Separator */}
        <div className="h-px my-1.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Recent Sessions */}
        <div
          className="text-[10px] font-medium tracking-[1.5px] uppercase px-2 pt-3 pb-1"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Recent Sessions
        </div>
        {RECENT_SESSIONS.map((s) => (
          <SideRecentLink key={s.href} href={s.href} label={s.label} />
        ))}

        {/* Upcoming */}
        <div
          className="mx-0.5 mt-2.5 rounded-lg p-3.5 relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, var(--red), #e8754a)' }}
          />
          <div
            className="text-[9px] font-semibold tracking-[1.5px] uppercase mb-1.5"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Upcoming
          </div>
          <div
            className="text-[12px] font-semibold mb-[3px] leading-tight"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            Leadership Meeting
          </div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            May 28, 2026 · 11am–3pm
          </div>
          <Link
            href="/generate"
            className="block w-full mt-2.5 text-center text-[11px] font-semibold text-white py-2 rounded-[5px] transition-colors no-underline"
            style={{ background: 'rgba(200,49,26,0.8)' }}
          >
            Prepare Agenda →
          </Link>
        </div>
          </>
        )}
      </nav>

      {/* Footer / User */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5 p-2 rounded-[6px]">
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 tracking-[0.5px]"
            style={{ background: 'linear-gradient(135deg, var(--red), #e8754a)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12px] font-medium truncate"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              {displayName}
            </div>
            {subtitle && (
              <div
                className="text-[10px] mt-[1px] truncate"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sign out"
            className="shrink-0 rounded-[5px] p-1.5 transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* Change Password — small text link below the user row */}
        <button
          onClick={() => setPwModalOpen(true)}
          className="px-2 mt-0.5 text-left bg-transparent border-0"
          style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Change Password
        </button>
      </div>

      {/* Change Password modal */}
      {pwModalOpen && (
        <div
          onClick={() => { if (!pwSubmitting) closePwModal() }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 28,
              maxWidth: 420,
              width: '100%',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
              Change Password
            </div>

            {/* Current Password */}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
              Current Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrentPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ ...CHANGE_PW_INPUT_STYLE, paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw((v) => !v)}
                style={CHANGE_PW_TOGGLE_STYLE}
              >
                {showCurrentPw ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* New Password */}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '16px 0 6px' }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={{ ...CHANGE_PW_INPUT_STYLE, paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw((v) => !v)}
                style={CHANGE_PW_TOGGLE_STYLE}
              >
                {showNewPw ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Confirm New Password */}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '16px 0 6px' }}>
              Confirm New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ ...CHANGE_PW_INPUT_STYLE, paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((v) => !v)}
                style={CHANGE_PW_TOGGLE_STYLE}
              >
                {showConfirmPw ? 'Hide' : 'Show'}
              </button>
            </div>

            {pwError && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{pwError}</div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={closePwModal}
                disabled={pwSubmitting}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text2)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '9px 16px',
                  cursor: pwSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                disabled={pwSubmitting}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  background: '#1a1917',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 16px',
                  cursor: pwSubmitting ? 'not-allowed' : 'pointer',
                  opacity: pwSubmitting ? 0.7 : 1,
                }}
              >
                {pwSubmitting ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {pwToast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            background: 'var(--charcoal)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 24px -6px rgba(0,0,0,0.4)',
          }}
        >
          {pwToast}
        </div>
      )}
    </aside>
  )
}
