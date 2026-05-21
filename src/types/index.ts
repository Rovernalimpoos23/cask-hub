// src/types/index.ts

export type MeetingType = 'leadership' | 'planning' | 'coaching' | 'education'

export type OwnerName = 'calin' | 'chad' | 'kai' | 'rovern' | 'lamont' | 'jeff' | 'kait' | 'matteo'

export interface ActionItem {
  id: string
  meeting_id?: string
  task: string
  owner: string
  due_date: string
  done: boolean
  created_at?: string
}

export interface Meeting {
  id: string
  title: string
  date: string
  time_start: string
  time_end: string
  attendees: string[]
  summary: string[]
  action_items: ActionItem[]
  key_decisions: string[]
  full_transcript: string
  meeting_type: MeetingType
  owner: string
  module: string
  created_at?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  avatar_initials: string
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}
