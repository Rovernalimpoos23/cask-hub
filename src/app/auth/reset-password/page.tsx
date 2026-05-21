'use client'
// src/app/auth/reset-password/page.tsx
export const dynamic = 'force-dynamic'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!password || !confirm) { setError('Please fill in both fields'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.')
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/dashboard'), 2500)
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lp-root">

      {/* ── LEFT — team photo ── */}
      <div className="lp-photo">
        <Image src="/cask-team.webp" alt="CASK Construction team" fill className="lp-photo-img" priority sizes="55vw" />
        <div className="lp-ov lp-ov-base" />
        <div className="lp-ov lp-ov-vignette" />
        <div className="lp-ov lp-ov-right" />
        <div className="lp-ov lp-ov-bottom" />
        <div className="lp-caption">
          <Image src="/cask-logo-white.svg" alt="CASK" width={76} height={22} className="h-[22px] w-auto opacity-80 mb-3" />
          <p className="lp-caption-text">Building toward $20M — together.</p>
        </div>
      </div>

      {/* ── RIGHT — form ── */}
      <div className="lp-panel">
        <div className="lp-orb lp-orb-1" aria-hidden="true" />
        <div className="lp-orb lp-orb-2" aria-hidden="true" />

        <div className="lp-inner">
          <div className="lp-brand">
            <Image src="/cask-logo-white.svg" alt="CASK Construction" width={88} height={26} className="h-[26px] w-auto object-contain" priority />
            <div className="lp-brand-hub">Hub</div>
            <div className="lp-brand-sub">ActionCOACH Leadership Intelligence</div>
          </div>

          <div className="lp-card">
            {success ? (
              <div className="lp-confirm">
                <div className="lp-confirm-icon lp-confirm-icon--green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="lp-confirm-title">Password updated</p>
                <p className="lp-confirm-body">Redirecting you to the dashboard…</p>
              </div>
            ) : !ready ? (
              <div className="lp-confirm">
                <div className="lp-spinner" />
                <p className="lp-confirm-body" style={{ marginTop: '14px' }}>Verifying reset link…</p>
              </div>
            ) : (
              <>
                <h1 className="lp-card-title">Set new password</h1>
                <p className="lp-card-sub">Choose a strong password for your account.</p>

                <form onSubmit={handleSubmit} noValidate className="lp-form">
                  <div className="lp-field">
                    <label htmlFor="password" className="lp-label">New Password</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="lp-input"
                    />
                  </div>
                  <div className="lp-field">
                    <label htmlFor="confirm" className="lp-label">Confirm Password</label>
                    <input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      className="lp-input"
                    />
                  </div>

                  {error && <p className="lp-error">{error}</p>}

                  <button type="submit" disabled={loading} className="lp-btn">
                    {loading ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .lp-root { display: flex; min-height: 100vh; background: #0c0c0b; font-family: var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif); }
        .lp-photo { position: relative; flex: 0 0 55%; overflow: hidden; }
        .lp-photo-img { object-fit: cover; object-position: center 20%; }
        .lp-ov { position: absolute; inset: 0; }
        .lp-ov-base { background: rgba(8,8,7,0.15); }
        .lp-ov-vignette { background: radial-gradient(ellipse 120% 80% at 30% 50%, transparent 55%, rgba(4,4,4,0.30) 100%); }
        .lp-ov-right { background: linear-gradient(to right, transparent 0%, transparent 84%, rgba(8,8,7,0.20) 89%, rgba(8,8,7,0.65) 94%, rgba(8,8,7,0.94) 98%, #0c0c0b 100%); }
        .lp-ov-bottom { background: linear-gradient(to top, rgba(8,8,7,0.80) 0%, rgba(8,8,7,0.30) 22%, transparent 45%); }
        .lp-caption { position: absolute; bottom: 44px; left: 48px; right: 64px; }
        .lp-caption-text { font-size: 14px; font-style: italic; font-weight: 400; color: rgba(255,255,255,0.48); letter-spacing: 0.01em; margin: 0; line-height: 1.6; }
        .lp-panel { position: relative; flex: 0 0 45%; display: flex; align-items: center; justify-content: center; background: #0c0c0b; overflow: hidden; }
        .lp-orb { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }
        .lp-orb-1 { width: 440px; height: 440px; top: -100px; right: -100px; background: radial-gradient(circle, rgba(200,49,26,0.09) 0%, transparent 70%); animation: orb1 50s ease-in-out infinite; }
        .lp-orb-2 { width: 360px; height: 360px; bottom: -80px; left: -80px; background: radial-gradient(circle, rgba(200,49,26,0.06) 0%, transparent 70%); animation: orb2 60s ease-in-out infinite; }
        @keyframes orb1 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-28px,36px) scale(1.05); } }
        @keyframes orb2 { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(24px,-32px) scale(1.04); } }
        .lp-inner { position: relative; z-index: 1; width: 100%; max-width: 376px; padding: 0 36px; }
        .lp-brand { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; }
        .lp-brand-hub { font-size: 38px; font-weight: 800; letter-spacing: -0.035em; color: #ffffff; margin-top: 14px; line-height: 1; }
        .lp-brand-sub { font-size: 9.5px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.28); margin-top: 9px; text-align: center; }
        .lp-card { background: rgba(17,17,16,0.82); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 48px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.35); }
        .lp-card-title { font-size: 17px; font-weight: 600; letter-spacing: -0.025em; color: #ffffff; text-align: center; margin: 0 0 6px 0; }
        .lp-card-sub { font-size: 13px; color: rgba(255,255,255,0.36); text-align: center; margin: 0 0 4px 0; line-height: 1.55; }
        .lp-form { display: flex; flex-direction: column; gap: 13px; margin-top: 22px; }
        .lp-field { display: flex; flex-direction: column; gap: 6px; }
        .lp-label { font-size: 11.5px; font-weight: 500; letter-spacing: 0.02em; color: rgba(255,255,255,0.38); text-transform: uppercase; }
        .lp-input { width: 100%; background: rgba(8,8,8,0.65); border: 1px solid rgba(255,255,255,0.09); border-radius: 9px; padding: 10px 13px; font-size: 14px; font-weight: 400; color: #ffffff; outline: none; transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease; font-family: inherit; -webkit-font-smoothing: antialiased; }
        .lp-input::placeholder { color: rgba(255,255,255,0.18); font-weight: 400; }
        .lp-input:focus { border-color: rgba(255,255,255,0.22); background: rgba(14,14,14,0.75); box-shadow: 0 0 0 3px rgba(255,255,255,0.05); }
        .lp-error { font-size: 12.5px; font-weight: 500; text-align: center; color: #fca5a5; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.18); border-radius: 8px; padding: 9px 12px; margin: 0; letter-spacing: -0.01em; }
        .lp-btn { width: 100%; background: #c8311a; color: #ffffff; font-size: 14px; font-weight: 600; letter-spacing: -0.01em; padding: 11px; border-radius: 9px; border: none; cursor: pointer; transition: background 160ms ease, transform 80ms ease; margin-top: 4px; font-family: inherit; -webkit-font-smoothing: antialiased; }
        .lp-btn:hover:not(:disabled) { background: #b32a15; }
        .lp-btn:active:not(:disabled) { transform: scale(0.99); }
        .lp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .lp-confirm { display: flex; flex-direction: column; align-items: center; padding: 8px 0 4px; text-align: center; }
        .lp-confirm-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(200,49,26,0.1); border: 1px solid rgba(200,49,26,0.2); margin-bottom: 14px; }
        .lp-confirm-icon--green { background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.2); }
        .lp-confirm-title { font-size: 15px; font-weight: 600; letter-spacing: -0.02em; color: #ffffff; margin: 0 0 8px 0; }
        .lp-confirm-body { font-size: 13px; color: rgba(255,255,255,0.36); line-height: 1.6; margin: 0; }
        .lp-spinner { width: 28px; height: 28px; border: 2px solid rgba(255,255,255,0.08); border-top-color: rgba(255,255,255,0.4); border-radius: 50%; animation: spin 0.75s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .lp-photo { display: none; } .lp-panel { flex: 1; } }
      `}</style>
    </div>
  )
}
