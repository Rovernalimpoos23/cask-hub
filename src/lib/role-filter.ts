// src/lib/role-filter.ts
// Shared role-based meeting visibility helpers.
//
// Admin roles (president/Calin, ea/Kai, ai_specialist/Rovern) see EVERY meeting,
// exactly as before. Restricted roles (vp_sales/Jeff, ops_manager/Matteo,
// vp_ops/Chad, vp_finance/Lamont, member) only see meetings where their own first
// name appears in the meeting's `attendees` array (case-insensitive).
//
// This is purely additive filtering used by the Dashboard and All Sessions pages.
// It never mutates data and never changes behavior for admin roles.

import type { Meeting } from '@/types'

// NOTE: membership in RESTRICTED_ROLES no longer implies every restricted role
// reaches the SAME set of pages. Two of them — 'vp_ops' (Chad Holman) and
// 'ops_manager' (Matteo Carpani), each the sole holder of their role — are
// narrowed further at the route level to Dashboard, Action Items and Customer
// Journey only (no All Sessions, no Generate Agenda, no My Workspace).
//
// The gate for that narrowing is NARROWED_ROLES, which is duplicated in BOTH
// src/middleware.ts (actual route access) and src/components/sidebar/Sidebar.tsx
// (visible nav) — keep those two in sync. NARROWED_VISIBLE_HREFS in Sidebar.tsx
// is NOT the gate: it is the role-agnostic href allowlist that whichever roles
// are listed in NARROWED_ROLES get filtered against. Middleware does not use
// that list at all; it evaluates its own route predicates. To narrow another
// role, add it to NARROWED_ROLES in both files — the href list needs no edit.
//
// All of the above is route/nav access only. It does NOT affect the
// meeting-visibility filtering in this file, which still treats every
// restricted role identically (own-attendance only).
export const RESTRICTED_ROLES = ['vp_sales', 'ops_manager', 'vp_ops', 'vp_finance', 'vp_hr', 'member']
export const ADMIN_ROLES = ['president', 'ea', 'ai_specialist']

// True only when the role is restricted and NOT an admin role (admin always wins).
// Null/empty/unknown role → not restricted (treated as unrestricted, like before).
export function isRestrictedRole(role: string | null | undefined): boolean {
  if (!role) return false
  const r = role.toLowerCase().trim()
  return RESTRICTED_ROLES.includes(r) && !ADMIN_ROLES.includes(r)
}

// Case-insensitive: does this meeting's attendees array include the given first
// name? Mirrors the "My Items" matching used for Action Items — substring match
// per attendee entry so values like "Matteo Carpani" still match "Matteo".
export function meetingHasAttendee(meeting: Pick<Meeting, 'attendees'>, firstName: string): boolean {
  const fn = firstName.toLowerCase().trim()
  if (!fn) return false
  return (meeting.attendees ?? []).some(a => (a ?? '').toLowerCase().includes(fn))
}

// Filter a list of meetings for the current user. Admin (and unknown) roles get
// the full list unchanged; restricted roles get only meetings they attended.
export function filterMeetingsForRole<T extends Pick<Meeting, 'attendees'>>(
  meetings: T[],
  role: string | null | undefined,
  firstName: string,
): T[] {
  if (!isRestrictedRole(role)) return meetings
  return meetings.filter(m => meetingHasAttendee(m, firstName))
}
