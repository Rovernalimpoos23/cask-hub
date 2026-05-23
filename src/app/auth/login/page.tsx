'use client'
// src/app/auth/login/page.tsx
export const dynamic = 'force-dynamic'

import { useState, Suspense, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

type View = 'login' | 'forgot' | 'forgot-sent'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const linkExpired = searchParams.get('error') === 'link_expired'

  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(linkExpired ? 'Reset link has expired. Please request a new one.' : '')
  const [loading, setLoading] = useState(false)

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        setError(
          authError.message.toLowerCase().includes('invalid') ||
          authError.message.toLowerCase().includes('credentials')
            ? 'Invalid email or password'
            : 'Connection error. Please try again.'
        )
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    setLoading(true)
    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password` }
      )
      if (resetError) {
        setError('Could not send reset email. Please try again.')
      } else {
        setView('forgot-sent')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function switchView(next: View) {
    setError('')
    setView(next)
  }

  return (
    <div className="lp-root">

      {/* ── LEFT — team photo ── */}
      <div className="lp-photo">
        <Image
          src="/cask-team.webp"
          alt="CASK Construction team"
          fill
          className="lp-photo-img"
          priority
          sizes="55vw"
        />
        {/* Layered gradients — smooth blend, not a wall */}
        <div className="lp-ov lp-ov-base" />
        <div className="lp-ov lp-ov-vignette" />
        <div className="lp-ov lp-ov-right" />
        <div className="lp-ov lp-ov-bottom" />

        {/* Caption */}
        <div className="lp-caption">
          <Image src="/cask-logo-white.svg" alt="CASK" width={76} height={22} className="h-[22px] w-auto opacity-80 mb-3" />
          <p className="lp-caption-text">Building toward $20M — together.</p>
        </div>
      </div>

      {/* ── RIGHT — login form ── */}
      <div className="lp-panel">
        {/* Ambient orbs */}
        <div className="lp-orb lp-orb-1" aria-hidden="true" />
        <div className="lp-orb lp-orb-2" aria-hidden="true" />

        <div className="lp-inner">

          {/* Brand lockup */}
          <div className="lp-brand">
            <Image
              src="/cask-logo-white.svg"
              alt="CASK Construction"
              width={88}
              height={26}
              className="h-[26px] w-auto object-contain"
              priority
            />
            <div className="lp-brand-hub">Hub</div>
            <div className="lp-brand-sub">CASK Construction Command Center</div>
          </div>

          {/* Glass card */}
          <div className="lp-card">

            {/* ── Sign in ── */}
            {view === 'login' && (
              <>
                <h1 className="lp-card-title">Sign in to CASK Hub</h1>

                <form onSubmit={handleSignIn} noValidate className="lp-form">
                  <div className="lp-field">
                    <label htmlFor="email" className="lp-label">Email</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@caskconstruction.com"
                      className="lp-input"
                    />
                  </div>

                  <div className="lp-field">
                    <div className="lp-label-row">
                      <label htmlFor="password" className="lp-label">Password</label>
                      <button type="button" onClick={() => switchView('forgot')} className="lp-forgot">
                        Forgot password?
                      </button>
                    </div>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="lp-input"
                    />
                  </div>

                  {error && <p className="lp-error">{error}</p>}

                  <button type="submit" disabled={loading} className="lp-btn">
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>

                <p className="lp-footer-note">Access restricted to CASK Construction team</p>
              </>
            )}

            {/* ── Forgot password ── */}
            {view === 'forgot' && (
              <>
                <h1 className="lp-card-title">Reset password</h1>
                <p className="lp-card-sub">
                  Enter your email and we&apos;ll send a secure reset link.
                </p>

                <form onSubmit={handleForgot} noValidate className="lp-form">
                  <div className="lp-field">
                    <label htmlFor="reset-email" className="lp-label">Email</label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@caskconstruction.com"
                      className="lp-input"
                    />
                  </div>

                  {error && <p className="lp-error">{error}</p>}

                  <button type="submit" disabled={loading} className="lp-btn">
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>

                <button type="button" onClick={() => switchView('login')} className="lp-back">
                  ← Back to sign in
                </button>
              </>
            )}

            {/* ── Email sent confirmation ── */}
            {view === 'forgot-sent' && (
              <div className="lp-confirm">
                <div className="lp-confirm-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8311a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                </div>
                <p className="lp-confirm-title">Check your inbox</p>
                <p className="lp-confirm-body">
                  A reset link was sent to{' '}
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</span>
                </p>
                <p className="lp-confirm-expiry">The link expires in 1 hour.</p>
                <button type="button" onClick={() => switchView('login')} className="lp-back" style={{ marginTop: '8px' }}>
                  ← Back to sign in
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      <style jsx>{`
        /* ─── Root ─────────────────────────────────────────── */
        .lp-root {
          display: flex;
          min-height: 100vh;
          background: #0c0c0b;
          font-family: var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif);
        }

        /* ─── Photo panel ───────────────────────────────────── */
        .lp-photo {
          position: relative;
          flex: 0 0 55%;
          overflow: hidden;
        }
        .lp-photo-img {
          object-fit: cover;
          object-position: center 20%;
        }
        .lp-ov {
          position: absolute;
          inset: 0;
        }
        /* Minimal base tint — just enough to unify color temperature */
        .lp-ov-base {
          background: rgba(8, 8, 7, 0.15);
        }
        /* Vignette: top/bottom edges only, never touches the right half */
        .lp-ov-vignette {
          background: radial-gradient(ellipse 120% 80% at 30% 50%, transparent 55%, rgba(4,4,4,0.30) 100%);
        }
        /* Right fade: photo fully clear until 84%, compressed ramp at the very edge */
        .lp-ov-right {
          background: linear-gradient(
            to right,
            transparent        0%,
            transparent        84%,
            rgba(8,8,7,0.20)   89%,
            rgba(8,8,7,0.65)   94%,
            rgba(8,8,7,0.94)   98%,
            #0c0c0b           100%
          );
        }
        /* Bottom fade */
        .lp-ov-bottom {
          background: linear-gradient(
            to top,
            rgba(8,8,7,0.80)  0%,
            rgba(8,8,7,0.30)  22%,
            transparent       45%
          );
        }

        /* Caption */
        .lp-caption {
          position: absolute;
          bottom: 44px;
          left: 48px;
          right: 64px;
        }
        .lp-caption-text {
          font-size: 14px;
          font-style: italic;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.48);
          letter-spacing: 0.01em;
          margin: 0;
          line-height: 1.6;
        }

        /* ─── Right panel ───────────────────────────────────── */
        .lp-panel {
          position: relative;
          flex: 0 0 45%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0c0c0b;
          overflow: hidden;
        }
        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .lp-orb-1 {
          width: 440px;
          height: 440px;
          top: -100px;
          right: -100px;
          background: radial-gradient(circle, rgba(200,49,26,0.09) 0%, transparent 70%);
          animation: orb1 50s ease-in-out infinite;
        }
        .lp-orb-2 {
          width: 360px;
          height: 360px;
          bottom: -80px;
          left: -80px;
          background: radial-gradient(circle, rgba(200,49,26,0.06) 0%, transparent 70%);
          animation: orb2 60s ease-in-out infinite;
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-28px, 36px) scale(1.05); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(24px, -32px) scale(1.04); }
        }

        /* ─── Form inner ────────────────────────────────────── */
        .lp-inner {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 376px;
          padding: 0 36px;
        }

        /* Brand lockup */
        .lp-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 28px;
        }
        .lp-brand-hub {
          font-size: 38px;
          font-weight: 800;
          letter-spacing: -0.035em;
          color: #ffffff;
          margin-top: 14px;
          line-height: 1;
        }
        .lp-brand-sub {
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.28);
          margin-top: 9px;
          text-align: center;
        }

        /* ─── Glass card ────────────────────────────────────── */
        .lp-card {
          background: rgba(17, 17, 16, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 32px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 1px 0 rgba(255,255,255,0.06) inset,
            0 24px 48px rgba(0,0,0,0.55),
            0 8px 16px rgba(0,0,0,0.35);
        }
        .lp-card-title {
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.025em;
          color: #ffffff;
          text-align: center;
          margin: 0 0 6px 0;
        }
        .lp-card-sub {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.36);
          text-align: center;
          margin: 0 0 22px 0;
          line-height: 1.55;
        }

        /* ─── Form ──────────────────────────────────────────── */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 13px;
          margin-top: 22px;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .lp-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-label {
          font-size: 11.5px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.38);
          text-transform: uppercase;
        }
        .lp-input {
          width: 100%;
          background: rgba(8, 8, 8, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 9px;
          padding: 10px 13px;
          font-size: 14px;
          font-weight: 400;
          color: #ffffff;
          outline: none;
          transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
          font-family: inherit;
          -webkit-font-smoothing: antialiased;
        }
        .lp-input::placeholder {
          color: rgba(255, 255, 255, 0.18);
          font-weight: 400;
        }
        .lp-input:focus {
          border-color: rgba(255, 255, 255, 0.22);
          background: rgba(14, 14, 14, 0.75);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
        }

        /* Error */
        .lp-error {
          font-size: 12.5px;
          font-weight: 500;
          text-align: center;
          color: #fca5a5;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 8px;
          padding: 9px 12px;
          margin: 0;
          letter-spacing: -0.01em;
        }

        /* Submit button */
        .lp-btn {
          width: 100%;
          background: #c8311a;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          padding: 11px;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          transition: background 160ms ease, opacity 160ms ease, transform 80ms ease;
          margin-top: 4px;
          font-family: inherit;
          -webkit-font-smoothing: antialiased;
        }
        .lp-btn:hover:not(:disabled) {
          background: #b32a15;
        }
        .lp-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
        .lp-btn:disabled {
          background: #c8311a;
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* Forgot link */
        .lp-forgot {
          font-size: 11.5px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.3);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: color 150ms ease;
          font-family: inherit;
        }
        .lp-forgot:hover {
          color: rgba(255, 255, 255, 0.62);
        }

        /* Back link */
        .lp-back {
          display: block;
          margin: 20px auto 0;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.26);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 150ms ease;
          font-family: inherit;
        }
        .lp-back:hover {
          color: rgba(255, 255, 255, 0.58);
        }

        /* Footer note */
        .lp-footer-note {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.16);
          text-align: center;
          margin: 20px 0 0 0;
          letter-spacing: 0.01em;
        }

        /* ─── Confirm state ─────────────────────────────────── */
        .lp-confirm {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          padding: 8px 0 4px;
          text-align: center;
        }
        .lp-confirm-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(200, 49, 26, 0.1);
          border: 1px solid rgba(200, 49, 26, 0.2);
          margin-bottom: 14px;
        }
        .lp-confirm-title {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0 0 8px 0;
        }
        .lp-confirm-body {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.36);
          line-height: 1.6;
          margin: 0;
        }
        .lp-confirm-expiry {
          font-size: 11.5px;
          color: rgba(255, 255, 255, 0.2);
          margin: 10px 0 0 0;
        }

        /* ─── Responsive ────────────────────────────────────── */
        @media (max-width: 768px) {
          .lp-photo { display: none; }
          .lp-panel { flex: 1; }
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
