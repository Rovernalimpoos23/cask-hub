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
