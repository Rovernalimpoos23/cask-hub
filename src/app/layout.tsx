// src/app/layout.tsx
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Instrument_Serif, Fraunces, Inter } from 'next/font/google'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'CASK Hub — Leadership Intelligence Platform',
  description: 'ActionCOACH Intelligence for CASK Construction',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable} ${fraunces.variable} ${inter.variable} font-sans antialiased`}>
        {/* Theme flash guard — MUST stay the first child of <body>.
            <html> ships with className="dark" so a fresh session paints dark with
            no flash. This runs synchronously while the browser parses the very top
            of the document — before any content below it renders — so if the user
            picked light earlier in this tab, the class is gone before first paint.
            It only ever REMOVES the class; dark needs no action, which keeps this
            in sync with the sessionStorage contract in src/lib/theme-context.tsx
            (key 'cask-theme-session'). Not placed in <head>: the App Router builds
            <head> from the metadata export above, and hand-adding one there can
            conflict with it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = sessionStorage.getItem('cask-theme-session');
                if (saved === 'light') {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        {children}
      </body>
    </html>
  )
}
