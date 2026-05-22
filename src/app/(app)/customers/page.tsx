'use client'
// src/app/(app)/customers/page.tsx

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Happiness = 'green' | 'yellow' | 'red'

interface Client {
  id: string
  name: string
  project_type: string
  project_value: number
  location: string
  happiness: Happiness
  meetings_completed: number
  total_meetings: number
  owner: string
}

const SAMPLE_CLIENTS: Client[] = [
  {
    id: 'sample-1',
    name: 'John Smith',
    project_type: 'Custom Home',
    project_value: 485000,
    location: 'St. Petersburg, FL',
    happiness: 'green',
    meetings_completed: 3,
    total_meetings: 40,
    owner: 'Jeff',
  },
  {
    id: 'sample-2',
    name: 'Jennifer Lee',
    project_type: 'ADU',
    project_value: 120000,
    location: 'Tampa, FL',
    happiness: 'yellow',
    meetings_completed: 8,
    total_meetings: 40,
    owner: 'Jeff',
  },
  {
    id: 'sample-3',
    name: 'Robert Davis',
    project_type: 'Detached Garage',
    project_value: 65000,
    location: 'Clearwater, FL',
    happiness: 'red',
    meetings_completed: 12,
    total_meetings: 40,
    owner: 'Chad',
  },
]

const HAPPINESS_CONFIG = {
  green: {
    pill: { background: '#F0FDF4', color: '#166534' },
    label: 'Happy',
    accent: '#16a34a',
  },
  yellow: {
    pill: { background: '#FFFBEB', color: '#92400E' },
    label: 'At Risk',
    accent: '#d97706',
  },
  red: {
    pill: { background: '#FDF2F0', color: '#9B1C0E' },
    label: 'Needs Attention',
    accent: '#dc2626',
  },
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US')
}

function ClientCard({ client }: { client: Client }) {
  const [hovered, setHovered] = useState(false)
  const config = HAPPINESS_CONFIG[client.happiness]
  const pct = Math.round((client.meetings_completed / client.total_meetings) * 100)

  return (
    <Link
      href={`/customers/${client.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="no-underline block"
      style={{
        background: hovered ? 'var(--card-hover, rgba(0,0,0,0.02))' : 'var(--card, #fff)',
        border: '1px solid var(--border, #e5e7eb)',
        borderLeft: `3px solid ${config.accent}`,
        borderRadius: '10px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        transition: 'background 160ms ease, box-shadow 160ms ease',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.07)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'pointer',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#2d2d2d',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}
      >
        {getInitials(client.name)}
      </div>

      {/* Name + project */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--foreground, #111)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {client.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted, #6b7280)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {client.project_type} · {client.location}
        </div>
      </div>

      {/* Happiness pill */}
      <div
        style={{
          ...config.pill,
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 9px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {config.label}
      </div>

      {/* Progress */}
      <div style={{ width: 120, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted, #6b7280)', marginBottom: 5 }}>
          {client.meetings_completed} of {client.total_meetings} meetings
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 4,
            background: 'var(--border, #e5e7eb)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 4,
              background: config.accent,
              transition: 'width 400ms ease',
            }}
          />
        </div>
      </div>

      {/* Project value */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--foreground, #111)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minWidth: 80,
          textAlign: 'right',
        }}
      >
        {formatCurrency(client.project_value)}
      </div>

      {/* Arrow */}
      <div
        style={{
          color: 'var(--muted, #9ca3af)',
          flexShrink: 0,
          fontSize: 16,
          marginLeft: 2,
          transition: 'transform 160ms ease',
          transform: hovered ? 'translateX(2px)' : 'none',
        }}
      >
        →
      </div>
    </Link>
  )
}

export default function ActiveClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('name')

        if (error || !data || data.length === 0) {
          setClients(SAMPLE_CLIENTS)
        } else {
          setClients(data as Client[])
        }
      } catch {
        setClients(SAMPLE_CLIENTS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '40px 32px 60px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 32,
          gap: 16,
        }}
      >
        <div>
          <h1
            className="font-serif"
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: 'var(--foreground, #111)',
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            Active Clients
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--muted, #6b7280)',
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            All active CASK Construction client projects
          </p>
        </div>

        <Link
          href="/customers/new"
          className="no-underline"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            background: 'var(--red, #c8311a)',
            padding: '9px 16px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginTop: 4,
          }}
        >
          + New Client
        </Link>
      </div>

      {/* Client list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 76,
                borderRadius: 10,
                background: 'var(--border, #e5e7eb)',
                opacity: 0.5,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  )
}
