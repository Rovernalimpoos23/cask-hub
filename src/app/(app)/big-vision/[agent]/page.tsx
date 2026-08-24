'use client'

// src/app/(app)/big-vision/[agent]/page.tsx
// Individual Big Vision agent page.
//
// VISUAL REBUILD ONLY (jeff-agent-premium.html mockup). Every hook, state
// variable, effect and handler is unchanged: the draggable divider, the
// expand/collapse mode, the @mention system, chat-history persistence, Clear,
// upload, delete-with-confirm, the file "+N more" toggle, clickable meeting
// links, real meeting dates, quick-action pills and markdown rendering all
// behave exactly as before — only their presentation was rewritten.
//
// Additive per the spec: a client-side title search over the already-fetched
// `files` array, a "fed X ago" header segment, and the composer footer line.
// Both derive from data already in state — no new fetch, no new endpoint.
//
// Also additive: the DISC quick-action buttons above the composer (leader pages
// only). They call the existing sendMessage() with a preset prompt — no new
// endpoint, no new retrieval path. See DiscQuickActions below.
//
// Scoping note: the mockup's CSS variable names (--bg, --card, --line, --ink…)
// collide with the Hub's own tokens in globals.css, so every rule below is
// prefixed with `.bva-root` and the variables are redefined on that div.
// Nothing leaks out of this page's subtree. Same pattern as the precon page and
// the Big Vision main page.
//
// Theme follows the Hub's global setting via useTheme() rather than hardcoding
// dark. The mockup is dark-only, so its exact palette lives under
// [data-theme="dark"] and light mode maps to the Hub's own light tokens.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/lib/theme-context'

// ── Scoped stylesheet (port of the mockup's <style>) ─────────────────
//
// Fraunces and Inter are already self-hosted by next/font in src/app/layout.tsx
// (--font-fraunces / --font-inter), so they are referenced rather than re-fetched
// from Google. IBM Plex Mono and the Tabler icon webfont are not in the project,
// so they come from CDN exactly as the mockup does.
const AGENT_CSS = `
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap");
@import url("https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.11.0/dist/tabler-icons.min.css");

.bva-root{
  /* Light mode — mapped to the Hub's own light tokens (globals.css :root). The
     mockup only specified a dark palette. */
  --bg:#FAFAFA; --card:#FFFFFF; --card-hi:#F5F5F5; --chip:#F0EFEE; --sunk:#FCFCFB;
  --line:#EAEAEA; --line-strong:#D8D7D5;
  --ink:#111111; --ink-2:#666666; --ink-3:#8A8A8A; --ink-4:#A9A8A5;
  --coral:#c8311a; --live:#166534; --live-bg:rgba(22,101,52,.1);
  --av:#F2F1F0; --send-ink:#FFFFFF;
  --r:10px;
  --fs:var(--font-fraunces),Georgia,serif;
  --fb:var(--font-inter),system-ui,sans-serif;
  --fm:"IBM Plex Mono",ui-monospace,monospace;
}
.bva-root[data-theme="dark"]{
  /* Exact palette from the approved mockup */
  --bg:#121110; --card:#1A1918; --card-hi:#1F1E1D; --chip:#242322; --sunk:#151413;
  --line:#2A2928; --line-strong:#3A3937;
  --ink:#ECEBE8; --ink-2:#A8A7A3; --ink-3:#7B7A77; --ink-4:#5A5957;
  --coral:#F0565E; --live:#59B87E; --live-bg:rgba(89,184,126,.1);
  --av:#282625; --send-ink:#1A0A0C;
}

.bva-root *{box-sizing:border-box;margin:0;padding:0}
.bva-root{
  flex:1;min-width:0;min-height:0;overflow:hidden;
  background:var(--bg);color:var(--ink);
  font:450 14px/1.5 var(--fb);letter-spacing:-.005em;
  -webkit-font-smoothing:antialiased;
}
.bva-root :focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* The mockup is a standalone scrolling page; here the Hub shell gives this page a
   fixed height, so .page is a flex column and .split fills what is left. That is
   what keeps the two panels scrolling internally instead of growing the page. */
.bva-root .page{height:100%;display:flex;flex-direction:column;min-height:0;
  max-width:1180px;width:100%;margin:0 auto;padding:30px 40px 28px}
.bva-root .page.wide{max-width:100%;padding:18px 20px}

/* ---------- header ---------- */
.bva-root .back{display:inline-flex;align-items:center;gap:6px;color:var(--ink-3);text-decoration:none;
  font-size:13px;padding:5px 8px;margin:0 0 18px -8px;border-radius:7px;align-self:flex-start;
  transition:color .12s,background .12s;flex:0 0 auto}
.bva-root .back i{font-size:15px}
.bva-root .back:hover{color:var(--ink);background:var(--card)}
.bva-root .head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:22px;flex:0 0 auto}
.bva-root .who{display:flex;align-items:flex-start;gap:14px;min-width:0}
.bva-root .who .av{width:44px;height:44px;border-radius:50%;background:var(--av);border:1px solid var(--line-strong);
  display:grid;place-items:center;font:400 13px/1 var(--fm);color:var(--ink-2);flex:0 0 auto;margin-top:2px}
.bva-root .who .av i{font-size:19px;color:var(--ink-2)}
.bva-root h1{font:400 32px/1.05 var(--fs);letter-spacing:-.02em;color:var(--ink)}
.bva-root .who .role{display:flex;align-items:center;gap:9px;margin-top:7px;flex-wrap:wrap}
.bva-root .who .role span{font:400 10px/1 var(--fm);letter-spacing:.1em;color:var(--ink-4);text-transform:uppercase}
.bva-root .who .role .sep{width:1px;height:10px;background:var(--line-strong);padding:0}
.bva-root .who .sub{font-size:13px;color:var(--ink-3);margin-top:8px;line-height:1.5}
.bva-root .hact{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.bva-root .pill{display:inline-flex;align-items:center;gap:5px;font:400 9.5px/1 var(--fm);letter-spacing:.09em;
  padding:5px 8px;border-radius:5px;text-transform:uppercase;color:var(--live);background:var(--live-bg);white-space:nowrap}
.bva-root .pill .dot{width:5px;height:5px;border-radius:50%;background:var(--live)}
.bva-root .icon-btn{width:30px;height:30px;border:0;background:transparent;border-radius:7px;color:var(--ink-4);
  display:grid;place-items:center;cursor:pointer;font-size:16px;transition:background .12s,color .12s;flex:0 0 auto}
.bva-root .icon-btn:hover{background:var(--card-hi);color:var(--ink-2)}
.bva-root .icon-btn.danger:hover{color:var(--coral)}

/* ---------- shell ---------- */
/* The mockup used a fixed 376px grid column; the existing draggable divider needs
   a flex row with a % width, so .split is flex here and the drag logic is intact. */
.bva-root .split{display:flex;align-items:stretch;flex:1;min-height:0;width:100%}
.bva-root .panel{background:var(--card);border:1px solid var(--line);border-radius:12px;
  display:flex;flex-direction:column;min-height:0;overflow:hidden}
.bva-root .p-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);flex:0 0 auto}
.bva-root .p-head h2{flex:1;min-width:0;font:500 13.5px/1 var(--fb);letter-spacing:-.01em;color:var(--ink)}
.bva-root .p-head .count{font:400 11px/1 var(--fm);color:var(--ink-4)}
.bva-root .ghost{border:1px solid var(--line-strong);background:transparent;color:var(--ink-2);
  font:450 12px/1 var(--fb);padding:6px 10px;border-radius:7px;cursor:pointer;
  display:inline-flex;align-items:center;gap:6px;transition:background .12s,color .12s,border-color .12s;flex:0 0 auto}
.bva-root .ghost i{font-size:14px}
.bva-root .ghost:hover:not(:disabled){background:var(--card-hi);color:var(--ink);border-color:var(--ink-4)}
.bva-root .ghost:disabled{cursor:default;opacity:.6}

/* ---------- divider (drag to resize · double-click to reset) ---------- */
.bva-root .divider{position:relative;width:10px;flex:0 0 auto;cursor:col-resize;background:transparent}
.bva-root .divider::before{content:"";position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:1px;background:var(--line);transition:background .12s,width .12s}
.bva-root .divider:hover::before,.bva-root .divider.on::before{width:2px;background:var(--coral)}
.bva-root .divider .grip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  display:flex;flex-direction:column;gap:3px}
.bva-root .divider .grip i{width:2px;height:2px;border-radius:50%;background:var(--ink-4);display:block}

/* ---------- search ---------- */
.bva-root .tools{display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);flex:0 0 auto}
.bva-root .field{flex:1;min-width:0;display:flex;align-items:center;gap:8px;background:var(--sunk);
  border:1px solid var(--line);border-radius:8px;padding:0 10px;height:32px}
.bva-root .field i{font-size:15px;color:var(--ink-4);flex:0 0 auto}
.bva-root .field input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);
  font:450 13px/1 var(--fb);outline:0}
.bva-root .field input::placeholder{color:var(--ink-4)}
.bva-root .field:focus-within{border-color:var(--line-strong)}

/* ---------- file rows ---------- */
.bva-root .list{overflow-y:auto;flex:1;min-height:0;padding:4px 0}
.bva-root .list::-webkit-scrollbar{width:8px}
.bva-root .list::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:4px;border:2px solid var(--card)}
.bva-root .row{display:block;width:100%;text-align:left;border:0;background:transparent;
  border-bottom:1px solid var(--line);padding:12px 16px;transition:background .12s}
.bva-root .row:last-child{border-bottom:0}
.bva-root .row:hover{background:var(--card-hi)}
.bva-root .row .t{display:flex;align-items:flex-start;gap:9px}
.bva-root .row .t>i{font-size:14px;color:var(--ink-4);margin-top:2px;flex:0 0 auto}
.bva-root .row .t b{flex:1;min-width:0;font:450 13px/1.4 var(--fb);color:var(--ink);letter-spacing:-.005em}
.bva-root .row .t b a{color:var(--ink);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px}
.bva-root .row .t b a:hover{color:var(--coral)}
.bva-root .row .m{display:flex;align-items:center;gap:7px;margin:8px 0 0 23px;flex-wrap:wrap}
.bva-root .tag{font:400 10px/1 var(--fm);color:var(--ink-3);background:var(--chip);padding:4px 6px;
  border-radius:4px;letter-spacing:.01em;white-space:nowrap}
.bva-root .tag.more{color:var(--ink-4);background:transparent;padding:4px 2px}
.bva-root .row .d{font:400 10.5px/1 var(--fm);color:var(--ink-4);margin-left:auto;white-space:nowrap}
.bva-root .row .trash{opacity:0;transition:opacity .12s,color .12s}
.bva-root .row:hover .trash{opacity:1}
.bva-root .row .trash:hover{color:var(--coral)}
.bva-root .p-foot{padding:10px 16px;border-top:1px solid var(--line);flex:0 0 auto}
.bva-root .p-foot .ghost{width:100%;justify-content:center}
.bva-root .note{padding:14px 16px;font-size:13px;color:var(--ink-3);line-height:1.5}
.bva-root .note.err{color:var(--coral)}
.bva-root .note.ok{color:var(--live)}

/* delete confirmation (replaces a row while confirming) */
.bva-root .confirm{margin:0 16px 12px;padding:12px;border-radius:9px;background:var(--card-hi);
  border:1px solid var(--coral)}
.bva-root .confirm b{display:block;font:500 13px/1.4 var(--fb);color:var(--ink)}
.bva-root .confirm span{display:block;font-size:12px;color:var(--ink-3);margin-top:3px}
.bva-root .confirm .acts{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px}
.bva-root .confirm .cancel{border:0;background:transparent;color:var(--ink-2);font:450 12px/1 var(--fb);
  cursor:pointer;padding:6px 4px}
.bva-root .confirm .cancel:hover{color:var(--ink)}
.bva-root .confirm .del{border:0;background:var(--coral);color:var(--send-ink);font:500 12px/1 var(--fb);
  padding:7px 10px;border-radius:6px;cursor:pointer}
.bva-root .confirm .del:disabled{opacity:.6;cursor:default}

/* skeletons */
.bva-root .sk{background:var(--chip);border-radius:4px}
@keyframes bva-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.bva-root .pulse{animation:bva-pulse 1.5s ease-in-out infinite}

/* ---------- chat ---------- */
.bva-root .chat .body{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;padding:22px 22px 0}
.bva-root .chat .body::-webkit-scrollbar{width:8px}
.bva-root .chat .body::-webkit-scrollbar-thumb{background:var(--line-strong);border-radius:4px;border:2px solid var(--card)}
/* Empty state sits against the composer, as in the mockup. */
.bva-root .chat .body.empty{justify-content:flex-end;padding-bottom:4px}
.bva-root .chat h3{font:400 19px/1.3 var(--fs);letter-spacing:-.01em;color:var(--ink)}
.bva-root .chat .lede{font-size:13px;color:var(--ink-3);margin-top:7px;max-width:46ch;line-height:1.55}
.bva-root .starters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:20px}
.bva-root .starter{border:1px solid var(--line);background:transparent;color:var(--ink-2);
  font:450 12.5px/1.35 var(--fb);text-align:left;padding:10px 12px;border-radius:8px;cursor:pointer;
  transition:background .12s,color .12s,border-color .12s}
.bva-root .starter:hover:not(:disabled){background:var(--card-hi);color:var(--ink);border-color:var(--line-strong)}
.bva-root .starter:disabled{cursor:default;opacity:.6}

/* messages */
.bva-root .thread{display:flex;flex-direction:column;gap:16px;padding-bottom:4px}
.bva-root .msg{max-width:88%}
.bva-root .msg.me{margin-left:auto}
.bva-root .msg .who-line{font:400 10px/1 var(--fm);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-4);margin-bottom:6px}
.bva-root .msg.me .who-line{text-align:right}
.bva-root .msg.me .bubble{background:var(--chip);border:1px solid var(--line);border-radius:11px;
  padding:11px 14px;font-size:13.5px;line-height:1.55;color:var(--ink)}
.bva-root .msg.ai .bubble{font-size:13.5px;line-height:1.6;color:var(--ink)}
.bva-root .msg.ai .bubble p{margin:0}
.bva-root .msg.ai .bubble p+p{margin-top:9px}
.bva-root .msg.ai .bubble strong{font-weight:600;color:var(--ink)}
.bva-root .msg.ai .bubble li{list-style:none;margin-left:2px}
/* Emitted by renderMarkdown() for ## and ### headings */
.bva-root .msg.ai .bubble .md-h{font:500 13.5px/1.4 var(--fb);color:var(--ink);margin:12px 0 4px}
.bva-root .msg.ai .bubble .md-sub{font:500 12.5px/1.4 var(--fb);color:var(--ink-2);margin:9px 0 3px}
.bva-root .cite{display:inline-flex;align-items:center;gap:6px;font:400 10.5px/1 var(--fm);
  letter-spacing:.05em;text-transform:uppercase;color:var(--ink-4);margin-top:10px}
.bva-root .cite i{font-size:13px}
.bva-root .typing{display:inline-flex;align-items:center;gap:9px;font-size:13px;color:var(--ink-3)}
.bva-root .typing span{width:5px;height:5px;border-radius:50%;background:var(--ink-4);display:block}

/* composer */
.bva-root .composer{flex:0 0 auto;padding:16px 22px 16px;position:relative}
.bva-root .box{display:flex;align-items:center;gap:10px;background:var(--sunk);border:1px solid var(--line);
  border-radius:11px;padding:8px 8px 8px 14px;transition:border-color .12s}
.bva-root .box:focus-within{border-color:var(--line-strong)}
.bva-root .box input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);
  font:450 13.5px/1.5 var(--fb);outline:0;padding:4px 0}
.bva-root .box input::placeholder{color:var(--ink-4)}
.bva-root .send{width:30px;height:30px;border:0;border-radius:8px;background:var(--coral);color:var(--send-ink);
  display:grid;place-items:center;cursor:pointer;font-size:16px;flex:0 0 auto;
  transition:filter .12s,transform .08s}
.bva-root .send:hover:not(:disabled){filter:brightness(1.07)}
.bva-root .send:active:not(:disabled){transform:scale(.96)}
.bva-root .send:disabled{opacity:.5;cursor:default}
@keyframes bva-spin{to{transform:rotate(360deg)}}
.bva-root .send .ti-loader-2{animation:bva-spin .9s linear infinite}
.bva-root .fine{font:400 10.5px/1 var(--fm);letter-spacing:.06em;color:var(--ink-4);margin-top:11px;
  display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.bva-root .fine .sep{width:1px;height:10px;background:var(--line)}
.bva-root .fine.err{color:var(--coral)}

/* @mention dropdown + pills */
.bva-root .mentions{position:absolute;bottom:100%;left:22px;right:22px;margin-bottom:8px;z-index:50;
  background:var(--card);border:1px solid var(--line-strong);border-radius:10px;overflow:hidden;
  max-height:240px;overflow-y:auto;box-shadow:0 18px 40px rgba(0,0,0,.4)}
.bva-root .mentions .cap{font:400 10px/1 var(--fm);letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-4);padding:10px 12px;border-bottom:1px solid var(--line)}
.bva-root .mentions .opt{display:flex;align-items:center;gap:9px;padding:9px 12px;cursor:pointer}
.bva-root .mentions .opt.on{background:var(--card-hi)}
.bva-root .mentions .opt i{font-size:14px;color:var(--ink-4);flex:0 0 auto}
.bva-root .mentions .opt b{display:block;font:450 13px/1.35 var(--fb);color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bva-root .mentions .opt em{display:block;font:400 10.5px/1 var(--fm);color:var(--ink-4);
  font-style:normal;margin-top:4px}
.bva-root .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.bva-root .chips .att{display:inline-flex;align-items:center;gap:5px;font:400 11px/1 var(--fm);
  color:var(--coral);background:transparent;border:1px solid var(--line-strong);
  padding:5px 7px;border-radius:6px;max-width:100%}
.bva-root .chips .att i{font-size:13px;flex:0 0 auto}
.bva-root .chips .att b{font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.bva-root .chips .att button{border:0;background:transparent;color:var(--coral);cursor:pointer;
  font-size:13px;line-height:1;padding:0 0 0 2px}

/* DISC quick-action row — LAYOUT ONLY (same shape as .chips above). The buttons
   inside reuse the existing .ghost pattern, so this rule introduces no new colour,
   border or type treatment. Sits directly above the composer box. */
.bva-root .disc-acts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}

/* "Open in Compose" row under an AI reply — LAYOUT ONLY, same precedent as
   .disc-acts above: no new colour, border or type treatment. The link inside reuses
   the existing .ghost pattern; text-decoration:none is needed only because .ghost
   was written for <button> and this is an <a>. Margin matches .cite. */
.bva-root .draft-open{margin-top:10px}
.bva-root .draft-open .ghost{text-decoration:none}

@media (max-width:980px){
  .bva-root .page{padding:22px 18px 18px}
  .bva-root .starters{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){.bva-root *{transition:none!important;animation:none!important}}
`

// ── Tag pill styles ──────────────────────────────────────────────────
// RETAINED but no longer applied: the mockup renders every tag as one uniform
// muted mono chip (.tag), so TagPill below ignores this map. Kept in place so the
// per-tag colour scheme can be restored without rebuilding the data.
const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  // Category tags
  pit: { bg: 'var(--red)', color: '#fff' },
  alignment: { bg: 'var(--purple)', color: '#fff' },
  ai_hub: { bg: '#3B82F6', color: '#fff' },
  design: { bg: '#F59E0B', color: '#fff' },
  construction: { bg: '#0EA5E9', color: '#fff' },
  // Leader (person) tags — match each leader's avatar color
  jeff: { bg: 'var(--red)', color: '#fff' },
  lamont: { bg: '#2563eb', color: '#fff' },
  chad: { bg: '#059669', color: '#fff' },
  matteo: { bg: '#7c3aed', color: '#fff' },
  kaitlyn: { bg: '#d97706', color: '#fff' },
  // Department tags — muted
  sales: { bg: 'var(--surface2)', color: 'var(--text2)' },
  finance: { bg: 'var(--surface2)', color: 'var(--text2)' },
  operations: { bg: 'var(--surface2)', color: 'var(--text2)' },
  hr: { bg: 'var(--surface2)', color: 'var(--text2)' },
}
void TAG_STYLES // referenced so the retained map is not flagged as dead code

// ── Data model ───────────────────────────────────────────────────────
type Source = 'seed doc' | 'fireflies' | 'manual'

interface FileItem {
  name: string
  source: Source
  layer: number
  tags: string[]
}

// A segment of the AI response — plain text or a highlighted "link".
type Segment = { text: string; link?: boolean }

interface AgentData {
  slug: string
  icon: string
  name: string
  subtitle: string
  shortName: string
  files: FileItem[]
  moreCount: number
  instructions: string
  sampleQuestion: string
  answer: Segment[]
  drawnFrom: number
  // Leader-only fields — when set, the header renders an initials avatar +
  // role badge instead of the category emoji icon.
  isLeader?: boolean
  initials?: string
  initialsBg?: string
  role?: string
}

// ── Agents (hardcoded) ───────────────────────────────────────────────
const AGENTS: Record<string, AgentData> = {
  pit: {
    slug: 'pit',
    icon: '⚙️',
    name: 'Process Improvement (PIT)',
    subtitle: 'Every department has a clear PIT direction, reviewed quarterly',
    shortName: 'PIT',
    files: [
      { name: 'Process-Improvement-PIT.docx', source: 'seed doc', layer: 2, tags: ['pit'] },
      { name: 'Mateo 1:1 — 2026-07-15', source: 'fireflies', layer: 4, tags: ['pit', 'alignment'] },
      { name: 'Q2 PIT Review Notes', source: 'manual', layer: 3, tags: ['pit'] },
      { name: 'Pre-Con Standup — 2026-07-11', source: 'fireflies', layer: 4, tags: ['pit', 'ai_hub'] },
    ],
    moreCount: 4,
    instructions:
      'You are the PIT agent. Answer only from the files in this memory. Focus on each department’s PIT direction, its last-reviewed date, and how it compares to the company-level PIT focus (the AI Hub rollout). Flag anything not reviewed this quarter.',
    sampleQuestion: "What's Pre-construction's PIT focus right now, and when was it last reviewed?",
    answer: [
      { text: "Pre-construction's current PIT focus is " },
      { text: 'whole-team adoption of the pre-con hub', link: true },
      { text: ' — the company-level PIT direction for 2026–2028. It was last reviewed in ' },
      { text: "Mateo's 1:1 on July 15", link: true },
      { text: ', tracking toward the end-of-Q3 target.' },
    ],
    drawnFrom: 3,
  },
  'ai-hub': {
    slug: 'ai-hub',
    icon: '🤖',
    name: 'AI Hub Rollout',
    subtitle: 'Pre-con in progress · construction rollout next',
    shortName: 'AI Hub',
    files: [
      { name: 'AI-Hub-Rollout-Plan.docx', source: 'seed doc', layer: 2, tags: ['ai_hub'] },
      { name: 'Pre-Con Standup — 2026-07-11', source: 'fireflies', layer: 4, tags: ['ai_hub', 'pit'] },
      { name: 'Rollout Milestones — Q3', source: 'manual', layer: 3, tags: ['ai_hub'] },
      { name: 'Construction Kickoff — 2026-07-08', source: 'fireflies', layer: 4, tags: ['ai_hub', 'construction'] },
    ],
    moreCount: 7,
    instructions:
      'You are the AI Hub Rollout agent. Answer only from the files in this memory. Track rollout status by phase (pre-construction, then construction), the owners of each phase, and the next milestone dates. Flag any phase without a recent update.',
    sampleQuestion: "Where is the AI Hub rollout right now, and what's the next milestone?",
    answer: [
      { text: 'The AI Hub rollout is in the ' },
      { text: 'pre-construction adoption phase', link: true },
      { text: ', with the full pre-con team onboarded. The next milestone is the ' },
      { text: 'construction-team kickoff', link: true },
      { text: ', targeted for early Q4 once pre-con adoption is confirmed.' },
    ],
    drawnFrom: 3,
  },
  'design-center': {
    slug: 'design-center',
    icon: '🎨',
    name: 'Design Center',
    subtitle: 'Launch start of 2027 · timeline tracked',
    shortName: 'Design Center',
    files: [
      { name: 'Design-Center-Charter.docx', source: 'seed doc', layer: 2, tags: ['design'] },
      { name: 'DC Timeline Review — 2026-07-14', source: 'fireflies', layer: 4, tags: ['design', 'alignment'] },
      { name: 'Launch Readiness Notes', source: 'manual', layer: 3, tags: ['design'] },
      { name: 'Design Center Sync — 2026-07-09', source: 'fireflies', layer: 4, tags: ['design'] },
    ],
    moreCount: 5,
    instructions:
      'You are the Design Center agent. Answer only from the files in this memory. Track the launch timeline toward the start of 2027, key readiness milestones, and any dependencies. Flag anything slipping against the launch date.',
    sampleQuestion: "When does the Design Center launch, and is the timeline on track?",
    answer: [
      { text: 'The Design Center is targeted to launch at the ' },
      { text: 'start of 2027', link: true },
      { text: '. Current readiness is on track, with milestones reviewed in the ' },
      { text: 'DC timeline review on July 14', link: true },
      { text: '. No dependencies are flagged as slipping this quarter.' },
    ],
    drawnFrom: 3,
  },
  'dept-alignment': {
    slug: 'dept-alignment',
    icon: '👥',
    name: 'Dept Alignment',
    subtitle: 'Mateo draft sent · others rolling out',
    shortName: 'Dept Alignment',
    files: [
      { name: 'Dept-Alignment-Framework.docx', source: 'seed doc', layer: 2, tags: ['alignment'] },
      { name: 'Mateo 1:1 — 2026-07-15', source: 'fireflies', layer: 4, tags: ['alignment', 'pit'] },
      { name: 'Alignment Draft — Operations', source: 'manual', layer: 3, tags: ['alignment'] },
      { name: 'Leadership Sync — 2026-07-10', source: 'fireflies', layer: 4, tags: ['alignment', 'hr'] },
    ],
    moreCount: 10,
    instructions:
      'You are the Dept Alignment agent. Answer only from the files in this memory. Track which department alignment drafts have been sent, which are still rolling out, and how each maps back to the company direction. Flag any department without a draft in progress.',
    sampleQuestion: "Which department alignment drafts are done, and which are still pending?",
    answer: [
      { text: "Mateo's Operations alignment draft has been " },
      { text: 'sent and is under review', link: true },
      { text: '. The remaining departments are ' },
      { text: 'still rolling out', link: true },
      { text: ', with drafts in progress and reviewed in the July 10 leadership sync.' },
    ],
    drawnFrom: 3,
  },
}

// ── Leaders ──────────────────────────────────────────────────────────
// Each leader reuses the category-agent layout. `fileCount` is the total in
// memory (shown on the main page card); the detail page lists up to 4 named
// files and rolls the rest into "+ N more".
interface LeaderDef {
  slug: string
  first: string
  name: string
  initials: string
  bg: string
  role: string
  dept: string
  desc: string
  fileCount: number
  instructions: string
  question: string
  answer: string
}

const LEADER_DEFS: LeaderDef[] = [
  {
    slug: 'jeff',
    first: 'Jeff',
    name: 'Jeff Azcona',
    initials: 'JA',
    bg: 'var(--red)',
    role: 'VP Sales',
    dept: 'sales',
    desc: 'Sales pipeline · revenue targets',
    fileCount: 6,
    instructions:
      "You are Jeff's intelligence agent. Answer from his files. Focus on sales pipeline health, revenue tracking, and how to communicate effectively with Jeff (high D/I). Flag any pipeline risks.",
    question: "What's the current sales pipeline status and are we on track for Q3 target?",
    answer:
      'The sales pipeline currently shows 3 active prospects in final stages. Q3 target is tracking at 78% — slightly behind the 85% milestone set for mid-July. The Smith project close is the key variable this month.',
  },
  {
    slug: 'lamont',
    first: 'Lamont',
    name: 'Lamont Gilyot',
    initials: 'LG',
    bg: '#2563eb',
    role: 'VP Finance',
    dept: 'finance',
    desc: 'Cash position · budget variance',
    fileCount: 5,
    instructions:
      "You are Lamont's intelligence agent. Answer from his files. Focus on financial health, cash position, and how to communicate with Lamont (high D/C). Lead with data. Flag budget variances.",
    question: "What's the current cash position and are there any budget concerns this month?",
    answer:
      'Cash position is stable at approximately $2.1M operating reserve. One budget variance flagged — Design Center soft costs running 12% over estimate. Recommended: review in this week’s Finance alignment.',
  },
  {
    slug: 'chad',
    first: 'Chad',
    name: 'Chad Holman',
    initials: 'CH',
    bg: '#059669',
    role: 'VP Operations',
    dept: 'operations',
    desc: 'WIP status · operational blockers',
    fileCount: 4,
    instructions:
      "You are Chad's intelligence agent. Answer from his files. Focus on operational health, WIP status, and how to communicate with Chad. Flag blockers.",
    question: "What's the WIP status and are there any operational blockers I should know about?",
    answer:
      'WIP shows 4 active builds, all within timeline. One operational blocker flagged — permit delay on the Anderson project pushing completion by 2 weeks. No other critical blockers.',
  },
  {
    slug: 'matteo',
    first: 'Matteo',
    name: 'Matteo Carpani',
    initials: 'MC',
    bg: '#7c3aed',
    role: 'Ops Manager',
    dept: 'operations',
    desc: 'Active projects · client journey',
    fileCount: 7,
    instructions:
      "You are Matteo's intelligence agent. Answer from his files. Focus on active client projects, customer journey completion rates, and how to communicate with Matteo. Flag at-risk clients.",
    question: 'How are active client projects tracking and any at-risk clients?',
    answer:
      '3 active clients in customer journey. Smith at Step 16 is at risk — contract review overdue by 5 days. Anderson and Rahim are on track.',
  },
  {
    slug: 'kaitlyn',
    first: 'Kaitlyn',
    name: 'Kaitlyn Grunenberg',
    initials: 'KG',
    bg: '#d97706',
    role: 'VP HR',
    dept: 'hr',
    desc: 'Team alignment · hiring pipeline',
    fileCount: 3,
    instructions:
      "You are Kaitlyn's intelligence agent. Answer from her files. Focus on team alignment, HR pipeline, and how to communicate with Kaitlyn. Flag people concerns.",
    question: 'Any HR concerns or hiring pipeline updates this week?',
    answer:
      'No critical HR concerns this week. Hiring pipeline has 2 candidates in final interview for the PM role. Team alignment scores from last survey averaged 4.2/5.',
  },
]

function buildLeader(d: LeaderDef): AgentData {
  // The four standard leader files; sliced to fileCount so the card total and
  // the visible list stay consistent (e.g. Kaitlyn has 3 files → show 3).
  const standard: FileItem[] = [
    { name: 'DISC Report', source: 'manual', layer: 2, tags: [d.slug, d.dept] },
    { name: 'Goals 2026', source: 'manual', layer: 3, tags: [d.slug, d.dept] },
    { name: 'Past Meeting Notes', source: 'fireflies', layer: 4, tags: [d.slug, d.dept] },
    { name: 'Communication Style', source: 'manual', layer: 2, tags: [d.slug, d.dept] },
  ]
  const shown = Math.min(standard.length, d.fileCount)
  return {
    slug: d.slug,
    icon: '',
    name: d.name,
    subtitle: d.desc,
    shortName: d.first,
    files: standard.slice(0, shown),
    moreCount: Math.max(0, d.fileCount - shown),
    instructions: d.instructions,
    sampleQuestion: d.question,
    answer: [{ text: d.answer }],
    drawnFrom: Math.min(3, shown),
    isLeader: true,
    initials: d.initials,
    initialsBg: d.bg,
    role: d.role,
  }
}

const LEADER_AGENTS: Record<string, AgentData> = Object.fromEntries(
  LEADER_DEFS.map((d) => [d.slug, buildLeader(d)]),
)

// Category agents + leader agents share the single [agent] dynamic route.
const ALL_AGENTS: Record<string, AgentData> = { ...AGENTS, ...LEADER_AGENTS }

// ── Icons ────────────────────────────────────────────────────────────
// Tabler icon for a real hub_memory source_type ('fireflies' | 'seed_doc' |
// 'manual' | 'meeting_note'). Fireflies transcripts get a mic; everything else a
// document. Replaces the previous emoji version.
function sourceIcon(sourceType: string): string {
  return sourceType === 'fireflies' ? 'ti-microphone' : 'ti-file-text'
}

// Header avatar glyph for the four category agents (leaders use their initials).
// Same icon choices as the Big Vision main page.
const AGENT_ICONS: Record<string, string> = {
  'ai-hub': 'ti-building-community',
  pit: 'ti-settings-2',
  'design-center': 'ti-palette',
  'dept-alignment': 'ti-sitemap',
}

// Format an ISO timestamp as "Jul 21, 2026".
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Compact "Jul 21" for the file rows, matching the mockup.
function fmtShort(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "fed 6h ago" / "fed 1 day ago" from the newest file in memory. Only ever called
// with a date that arrived from the client-side files fetch, so it never runs
// against real data during SSR and cannot cause a hydration mismatch.
function fedAgo(iso?: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const h = Math.max(0, (Date.now() - t) / 3_600_000)
  if (h < 1) return 'fed just now'
  if (h < 24) return `fed ${Math.floor(h)}h ago`
  const d = Math.floor(h / 24)
  return `fed ${d} day${d === 1 ? '' : 's'} ago`
}

// A fireflies file links to its source session only when source_ref is a valid UUID.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Agent slug → hub_category (+ optional leader) ─────────────────────
// Mirrors the mapping the /api/big-vision/files + /api/big-vision/upload routes
// expect. Unknown slugs fall back to the slug itself as the category.
const AGENT_META: Record<string, { category: string; leader?: string }> = {
  pit: { category: 'pit' },
  'ai-hub': { category: 'ai_hub' },
  'design-center': { category: 'design_center' },
  'dept-alignment': { category: 'alignment' },
  jeff: { category: 'jeff', leader: 'Jeff' },
  lamont: { category: 'lamont', leader: 'Lamont' },
  chad: { category: 'chad', leader: 'Chad' },
  matteo: { category: 'matteo', leader: 'Matteo' },
  kaitlyn: { category: 'kaitlyn', leader: 'Kaitlyn' },
}

// ── Quick-action chat pills ──────────────────────────────────────────
// Shown above the input only before the first message. Universal prompts apply to
// every agent; the agent-specific set is appended per slug.
const UNIVERSAL_PILLS = [
  "Prepare me for today's meeting",
  "What's the latest status?",
  'What are the open action items?',
  'How should Calin approach this?',
]

const AGENT_PILLS: Record<string, string[]> = {
  pit: ["What's our PIT focus this quarter?", "Who hasn't reviewed PIT yet?"],
  'ai-hub': ['Where are we on the rollout?', "What's blocking construction phase?"],
  'design-center': ['Is the 2027 launch on track?', 'Any timeline risks?'],
  'dept-alignment': ["Who's on a Dev Plan?", 'Who needs follow-up?'],
  jeff: ["What's the sales pipeline status?", 'Are we on track for Q3 target?'],
  lamont: ["What's the cash position?", 'Any budget concerns?'],
  chad: ["What's the WIP status?", 'Any operational blockers?'],
  matteo: ['How are active clients tracking?', 'Any at-risk clients?'],
  kaitlyn: ['Any HR concerns this week?', "What's the hiring pipeline?"],
}

// ── Lightweight markdown → HTML for assistant messages ───────────────
// react-markdown is not a project dependency and packages can't be added here, so
// this handles the small subset Claude emits (bold, italic, ## / ### headers,
// bullet lists, paragraph breaks). Content is HTML-ESCAPED first — the result goes
// through dangerouslySetInnerHTML, so raw `<`/`>`/`&` must never reach the DOM as
// markup (prevents injection from anything the model echoes back).
function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const html = escaped
    // H2 → h3 (block heading)
    .replace(/^## (.*)$/gm, '<h3 class="md-h">$1</h3>')
    // H3 → styled paragraph label
    .replace(/^### (.*)$/gm, '<p class="md-sub">$1</p>')
    // Bullet points
    .replace(/^- (.*)$/gm, '<li>• $1</li>')
    // Bold, then italic (bold consumes ** first so lone * become italic)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Paragraph breaks, then single line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')

  return `<p>${html}</p>`
}

// ── DISC quick actions ───────────────────────────────────────────────
// Two buttons that submit a FIXED, pre-written prompt through the same
// sendMessage() path a typed question uses. Nothing about retrieval changes: the
// chat route still scopes to this agent's category, and the reply renders through
// the same markdown + "Drawn from N files" citation path as any other answer.
// Only the prompt text is preset.
//
// One parameterized component rather than five hand-coded copies — `leaderName` is
// interpolated into both prompts, so every leader page renders identically.
//
// The buttons reuse the page's existing `.ghost` class (already used by the panel
// head/footer actions) so no new visual style is introduced. `.ghost` is the
// closest text-label button on the page; the composer's own send control is
// `.send`, an icon-only coral square that cannot carry a label.
const DISC_ACTIONS: ReadonlyArray<{
  key: string
  label: string
  icon: string
  artifact: string
}> = [
  { key: 'agenda', label: 'Create agenda', icon: 'ti-list-check', artifact: 'an agenda' },
  { key: 'email', label: 'Create email', icon: 'ti-mail', artifact: 'an email' },
]

// The prompt "Create agenda" sends. Unchanged and deliberately free-form: only the
// email reply is machine-read, so only the email prompt carries a format contract.
function discPrompt(artifact: string, leaderName: string): string {
  return `Create ${artifact} based on ${leaderName}'s DISC profile and key motivators.`
}

// Delimiters fencing the sendable email inside the reply. Shared by the prompt that
// asks for them and the parser that reads them back, so the two cannot drift apart.
const EMAIL_DRAFT_START = '---EMAIL DRAFT START---'
const EMAIL_DRAFT_END = '---EMAIL DRAFT END---'

// The "Create email" prompt. Opens with the same sentence discPrompt() produces, so
// retrieval, scope and tone are untouched — all this adds is a format contract that
// fences the sendable draft off from the commentary. The commentary itself is
// unchanged: it still gets written, just outside the block instead of tangled through
// it, which is what makes parseEmailDraft() below reliable.
function discEmailPrompt(leaderName: string): string {
  return [
    `Create an email based on ${leaderName}'s DISC profile and key motivators.`,
    '',
    'Structure your reply in two parts:',
    '',
    '1. Your commentary — any caveats, and why the email is built this way. Keep all',
    '   of that OUTSIDE the block below, written exactly as you normally would.',
    '2. The email itself, wrapped in a block delimited exactly like this:',
    '',
    EMAIL_DRAFT_START,
    'Subject: <the subject line>',
    '<the email body>',
    EMAIL_DRAFT_END,
    '',
    'Rules for that block: include it exactly once; put each delimiter on its own',
    'line; make the first line inside it a single "Subject:" line; everything after',
    'that line up to the end delimiter is the email body, ready to send as-is. Put no',
    'commentary, notes, headings or placeholders inside the block.',
  ].join('\n')
}

// Pull the fenced draft out of an assistant reply, or null when there is no complete
// block — which is every agenda reply and every reply predating this change.
// Returning null is what keeps the "Open in Compose" button hidden for those.
//
// Tolerances, since the reply is model-generated markdown: the Subject label may come
// back bolded (**Subject:** …), and blank lines at the block edges are trimmed. If no
// Subject line is found the whole block becomes the body and the subject is left
// empty rather than dropping the button — the user can type one in Compose.
function parseEmailDraft(text: string): { subject: string; body: string } | null {
  const startAt = text.indexOf(EMAIL_DRAFT_START)
  if (startAt === -1) return null
  const from = startAt + EMAIL_DRAFT_START.length
  const endAt = text.indexOf(EMAIL_DRAFT_END, from)
  if (endAt === -1) return null

  const lines = text.slice(from, endAt).split('\n')
  while (lines.length > 0 && lines[0].trim() === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  if (lines.length === 0) return null

  const subjectMatch = lines[0].match(/^\s*\**\s*subject\s*\**\s*:\s*\**\s*(.*?)\s*$/i)
  let subject = ''
  let bodyLines = lines
  if (subjectMatch) {
    subject = subjectMatch[1].replace(/\*+$/, '').trim()
    bodyLines = lines.slice(1)
  }
  while (bodyLines.length > 0 && bodyLines[0].trim() === '') bodyLines.shift()
  const body = bodyLines.join('\n').trim()

  if (subject === '' && body === '') return null
  return { subject, body }
}

// Which prompt each quick action sends. "Create agenda" keeps discPrompt() exactly as
// it was; only "Create email" gets the delimited variant.
function actionPrompt(action: { key: string; artifact: string }, leaderName: string): string {
  return action.key === 'email'
    ? discEmailPrompt(leaderName)
    : discPrompt(action.artifact, leaderName)
}

function DiscQuickActions({
  leaderName,
  disabled,
  onSend,
}: {
  leaderName: string
  disabled: boolean
  onSend: (prompt: string) => void
}) {
  return (
    <div className="disc-acts">
      {DISC_ACTIONS.map((a) => (
        <button
          key={a.key}
          className="ghost"
          onClick={() => onSend(actionPrompt(a, leaderName))}
          disabled={disabled}
          title={discPrompt(a.artifact, leaderName)}
        >
          <i className={`ti ${a.icon}`} aria-hidden="true" />
          {a.label}
        </button>
      ))}
    </div>
  )
}

export default function AgentPage({ params }: { params: { agent: string } }) {
  const agentSlug = params.agent
  const agent = ALL_AGENTS[agentSlug]

  // Theme follows the Hub's global setting (the `dark` class on <html>) via the
  // shared useTheme hook — same pattern as the Big Vision main page and precon.
  const { theme } = useTheme()

  // Slug → category (+ optional leader) used for uploads. Falls back to the slug.
  const agentCategory = AGENT_META[agentSlug]?.category ?? agentSlug
  const agentLeader = AGENT_META[agentSlug]?.leader

  // Quick-action pills: universal set + this agent's specific prompts.
  const quickPills = [...UNIVERSAL_PILLS, ...(AGENT_PILLS[agentSlug] ?? [])]

  // ── Live hub_memory file list + upload state ───────────────────────
  // One entry per DOCUMENT, not per hub_memory row: /api/big-vision/files groups chunk
  // rows by `source_ref ?? id` before returning them. Each entry carries `chunk_count`
  // (how many rows it was assembled from) and `chunk_ids` (those row ids).
  const [files, setFiles] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [filesLoading, setFilesLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Per-file delete state ──────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // ── File title search (client-side only — additive) ────────────────
  // Filters the already-fetched `files` array by title. No request is made and
  // `files` itself is never mutated, so upload/delete/@mention all still see the
  // full list. With an empty query filteredFiles === files, so the expand/collapse
  // maths below behaves exactly as it did before.
  const [fileSearch, setFileSearch] = useState('')
  const searchTerm = fileSearch.trim().toLowerCase()
  const filteredFiles = searchTerm
    ? files.filter((f) => (f.title ?? '').toLowerCase().includes(searchTerm))
    : files

  // ── File list expand/collapse ──────────────────────────────────────
  const [filesExpanded, setFilesExpanded] = useState(false)
  const VISIBLE_FILES = 4
  const visibleFiles = filesExpanded ? filteredFiles : filteredFiles.slice(0, VISIBLE_FILES)
  const hiddenCount = filteredFiles.length - VISIBLE_FILES

  // ── Agent chat state ───────────────────────────────────────────────
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant'
      content: string
      filesUsed?: number
      userName?: string
      createdAt?: string
    }>
  >([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── @mention file dropdown ─────────────────────────────────────────
  // mentionQuery is null when no @mention is in progress; '' right after the user
  // types "@"; and the partial text as they keep typing. Spec called for an
  // HTMLTextAreaElement ref, but the input below is an <input> — ref typed to match
  // (only .focus() is used, so behavior is identical).
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Files the user has selected as @mentions. Tracked separately from the input
  // text: selecting a file removes the "@query" from the input and adds it here, so
  // mentions render as pills instead of living as literal text in the input.
  const [selectedMentions, setSelectedMentions] = useState<
    Array<{
      id: string
      title: string
      meeting_date: string | null
      created_at: string
    }>
  >([])

  // Files whose title matches the in-progress @mention (max 50). Empty when no
  // mention is being typed. Deliberately searches the FULL `files` array, not the
  // left panel's filtered view — the panel search must not narrow @mentions.
  // One option per DOCUMENT: `files` is grouped by the API and its titles have the
  // "(part N of M)" suffix stripped, so a chunked file no longer appears once per part.
  // The id sent on send is the document's head row; api/big-vision/chat expands it to
  // every sibling chunk, and its title matching is substring-based, so the stripped
  // title still resolves the whole document.
  const mentionResults =
    mentionQuery !== null
      ? files
          .filter((f) => f.title?.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 50)
      : []

  // Files currently @mentioned — now driven by the selectedMentions state (pills)
  // rather than by parsing the input text.
  const activeMentions = selectedMentions

  // ── Resizable divider between the two panels ───────────────────────
  const [leftWidth, setLeftWidth] = useState(38) // percentage of the container width
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)

  // Right-panel full-width toggle: hides the left panel + divider when true.
  const [rightExpanded, setRightExpanded] = useState(false)

  // Fetch this agent's files on mount / when the slug changes.
  useEffect(() => {
    let cancelled = false
    async function loadFiles() {
      setFilesLoading(true)
      try {
        const res = await fetch(`/api/big-vision/files?agent=${agentSlug}`)
        const data = await res.json()
        if (!cancelled && data.files) setFiles(data.files)
      } catch {
        // Network/parse failure — leave files empty; the empty state renders.
      } finally {
        if (!cancelled) setFilesLoading(false)
      }
    }
    loadFiles()
    return () => {
      cancelled = true
    }
  }, [agentSlug])

  // Load this user's saved chat history for the agent on mount / slug change.
  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      setHistoryLoading(true)
      try {
        const res = await fetch(`/api/big-vision/history?agent=${agentSlug}`)
        const data = await res.json()
        if (!cancelled && data.history && data.history.length > 0) {
          setMessages(
            data.history.map((h: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
              role: h.role,
              content: h.content,
              filesUsed: h.files_used,
              userName: h.user_name,
              createdAt: h.created_at,
            })),
          )
        }
      } catch (e) {
        console.error('[history] load error:', e)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    loadHistory()
    return () => {
      cancelled = true
    }
  }, [agentSlug])

  // Keep the chat scrolled to the newest message / typing indicator.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  // Restore the saved panel split on mount.
  useEffect(() => {
    const saved = localStorage.getItem('bv-panel-width')
    if (saved) setLeftWidth(parseFloat(saved))
  }, [])

  // Persist the panel split whenever it changes.
  useEffect(() => {
    localStorage.setItem('bv-panel-width', leftWidth.toString())
  }, [leftWidth])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.[^.]+$/, ''))
      formData.append('categories', agentCategory)
      formData.append('layer', '4')
      formData.append('source_type', 'manual')
      if (agentLeader) {
        formData.append('leader', agentLeader)
      }

      const res = await fetch('/api/big-vision/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setUploadSuccess('File uploaded!')
        // Refresh the file list from the server.
        const filesRes = await fetch(`/api/big-vision/files?agent=${agentSlug}`)
        const data = await filesRes.json()
        if (data.files) setFiles(data.files)
        setTimeout(() => setUploadSuccess(''), 3000)
      } else {
        setUploadError('Upload failed. Try again.')
      }
    } catch {
      setUploadError('Upload failed. Try again.')
    } finally {
      setUploadingFile(false)
      // Reset the input so re-selecting the same file re-triggers onChange.
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Send a chat message to the agent. `overrideText` lets the quick-action pills
  // send their prompt directly — setChatInput is async, so relying on chatInput
  // right after setting it would send a stale (empty) value.
  async function sendMessage(overrideText?: string) {
    const userMessage = (overrideText ?? chatInput).trim()
    if (!userMessage || chatLoading) return

    // Prepend the selected @mentions to the question so the API forces those files
    // into context (the chat route detects "@<title>" in the question).
    const questionWithMentions =
      selectedMentions.length > 0
        ? selectedMentions.map((m) => `@${m.title}`).join(' ') + ' ' + userMessage
        : userMessage
    const mentionedFileIds = selectedMentions.map((m) => m.id)

    setChatInput('')
    setMentionQuery(null) // close the @mention dropdown if it was open
    setSelectedMentions([]) // clear the mention pills after sending
    setChatError('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    // Undo everything the optimistic send above did, for any failure path.
    //
    // The message rollback is the load-bearing part: a failed turn used to leave the user
    // message in `messages` with no assistant reply after it. Since `messages` is what the
    // next send posts as conversationHistory — and the API route then appends the new
    // question as another user turn — one failure could put two consecutive user messages in
    // the request, and each subsequent failure adds another. Removing it keeps the
    // transcript strictly alternating no matter what fails (400, timeout, network drop).
    //
    // Matches on role + content and only ever touches the tail, so it cannot remove an
    // unrelated message; `chatLoading` already blocks a concurrent send from interleaving.
    // The input text and mention pills are restored alongside it so the error's "Try again"
    // is actionable — rolling back the message while leaving the composer empty would
    // discard what the user typed.
    const rollbackOptimisticSend = () => {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'user' && last.content === userMessage) return prev.slice(0, -1)
        return prev
      })
      setChatInput(userMessage)
      // `selectedMentions` here is the pre-clear value captured by this render's closure.
      setSelectedMentions(selectedMentions)
    }

    try {
      const res = await fetch('/api/big-vision/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentSlug,
          question: questionWithMentions,
          mentionedFileIds,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()

      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer, filesUsed: data.filesUsed },
        ])

        // Save the exchange to history (non-blocking — failures are logged only).
        fetch('/api/big-vision/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: agentSlug,
            userMessage: userMessage,
            assistantMessage: data.answer,
            filesUsed: data.filesUsed ?? 0,
          }),
        }).catch((e) => console.error('[history] save error:', e))
      } else {
        rollbackOptimisticSend()
        setChatError('Failed to get response. Try again.')
      }
    } catch {
      rollbackOptimisticSend()
      setChatError('Connection error. Try again.')
    } finally {
      setChatLoading(false)
    }
  }

  // Selecting a file: strip the in-progress "@query" from the input and add the
  // file to selectedMentions (a pill). The mention no longer lives in the input
  // text — it's carried in state and prepended to the question on send.
  function selectMention(file: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Remove the @query from the input.
    const val = chatInput
    const atIndex = val.lastIndexOf('@')
    const cleanInput = atIndex === -1 ? val.trim() : val.slice(0, atIndex).trim()
    setChatInput(cleanInput)

    // Add to selected mentions (avoid duplicates by id).
    setSelectedMentions((prev) => {
      if (prev.find((m) => m.id === file.id)) return prev
      return [
        ...prev,
        {
          id: file.id,
          title: file.title,
          meeting_date: file.meeting_date ?? null,
          created_at: file.created_at,
        },
      ]
    })

    setMentionQuery(null)
    setMentionIndex(0)
    inputRef.current?.focus()
  }

  // Soft-delete a document, then drop the whole group from local state on success.
  // A chunked file is several hub_memory rows; /api/big-vision/delete resolves the
  // document from the single id it is sent and reports every row it deleted in
  // `deletedIds`, so that response — not the id we sent — decides what to remove here.
  async function handleDelete(id: string, _fileTitle: string) {
    setDeletingId(id)
    setConfirmDeleteId(null)

    try {
      const res = await fetch('/api/big-vision/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok) {
        // Fall back to the id we sent if the response shape is unexpected.
        const removed = new Set<string>([
          id,
          ...(Array.isArray(data?.deletedIds)
            ? data.deletedIds.filter((d: unknown): d is string => typeof d === 'string')
            : []),
        ])
        // Match on the card's own id OR any of its chunk row ids — never on title.
        const isRemoved = (f: { id: string; chunk_ids?: string[] }) =>
          removed.has(f.id) || (f.chunk_ids ?? []).some((c) => removed.has(c))

        setFiles((prev) => prev.filter((f) => !isRemoved(f)))
        // Drop any @mention pill pointing at the document that just went away.
        setSelectedMentions((prev) => prev.filter((m) => !removed.has(m.id)))
      } else {
        console.error('Delete failed')
      }
    } catch {
      console.error('Delete error')
    } finally {
      setDeletingId(null)
    }
  }

  // Begin dragging the divider. Tracks the pointer on `document` (not the divider)
  // so the drag continues even when the cursor moves off the handle.
  // Unchanged logic — the only edit is that the drag-end visual reset now toggles
  // the `.on` class instead of writing an inline colour, since the divider's look
  // is driven by CSS in this rebuild.
  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    setIsDragging(true)

    const container = containerRef.current
    if (!container) return

    const startX = e.clientX
    const startWidth = leftWidth
    const containerWidth = container.getBoundingClientRect().width

    function onMouseMove(e: MouseEvent) {
      const delta = e.clientX - startX
      const newWidth = startWidth + (delta / containerWidth) * 100
      setLeftWidth(Math.min(60, Math.max(20, newWidth)))
    }

    function onMouseUp() {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      // Reset divider highlight
      if (dividerRef.current) {
        dividerRef.current.classList.remove('on')
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // ── Derived presentation values (from data already in state) ───────
  // The files route returns rows sorted newest-first by meeting_date||created_at,
  // so files[0] is the freshest. Powers "fed X ago" and "LAST INDEXED".
  const newestIso: string | null = files.length > 0 ? files[0].meeting_date || files[0].created_at : null
  const fedLabel = fedAgo(newestIso)

  // Hooks above run unconditionally; bail out for unknown agents afterwards.
  if (!agent) notFound()

  const avatarIcon = AGENT_ICONS[agentSlug]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: AGENT_CSS }} />

      <div className="bva-root animate-page-in" data-theme={theme}>
        <div className={`page${rightExpanded ? ' wide' : ''}`}>
          {/* ── Back ───────────────────────────────────────────── */}
          <Link href="/big-vision" className="back">
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Big Vision
          </Link>

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="head">
            <div className="who">
              <div className="av">
                {agent.isLeader ? (
                  agent.initials
                ) : (
                  <i className={`ti ${avatarIcon ?? 'ti-circle-dot'}`} aria-hidden="true" />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1>{agent.name}</h1>
                <div className="role">
                  {agent.role && (
                    <>
                      <span>{agent.role}</span>
                      <span className="sep" />
                    </>
                  )}
                  <span>
                    {filesLoading ? '—' : `${files.length} file${files.length === 1 ? '' : 's'}`}
                  </span>
                  {fedLabel && (
                    <>
                      <span className="sep" />
                      <span>{fedLabel}</span>
                    </>
                  )}
                </div>
                {/* Not in the mockup, but the existing page showed this and dropping
                    it would lose content, so it sits under the meta row. */}
                <p className="sub">{agent.subtitle}</p>
              </div>
            </div>
            <div className="hact">
              {/* Unconditional, exactly as before — this pill was static in the
                  previous version and this is a visual-only rebuild. */}
              <span className="pill">
                <span className="dot" />
                Live
              </span>
              {/* Visual only — same as the previous version. */}
              <button className="icon-btn" aria-label="Options">
                <i className="ti ti-dots" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ── Resizable two-panel layout ─────────────────────── */}
          <div
            ref={containerRef}
            className="split"
            style={{ cursor: isDragging ? 'col-resize' : 'default' }}
          >
            {/* ── LEFT PANEL — files in memory ───────────────── */}
            <section
              className="panel"
              style={{
                width: `${leftWidth}%`,
                minWidth: 260,
                maxWidth: '60%',
                display: rightExpanded ? 'none' : 'flex',
              }}
            >
              <div className="p-head">
                <h2>Files in memory</h2>
                {/* Document count — `files` is already grouped by the API, so a chunked
                    file counts once here instead of once per part. */}
                <span className="count">{filesLoading ? '—' : filteredFiles.length}</span>
                <button
                  className="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                >
                  <i className="ti ti-upload" aria-hidden="true" />
                  {uploadingFile ? 'Uploading…' : 'Upload'}
                </button>
              </div>

              {/* Hidden file input — opened by the Upload button */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.docx,.xlsx,.txt"
                onChange={handleFileUpload}
              />

              {/* Search — client-side title filter over the fetched files.
                  The mockup also had a filter button next to this field; it is
                  omitted because no filter behaviour exists to wire it to and a
                  dead control is worse than none. */}
              <div className="tools">
                <label className="field">
                  <i className="ti ti-search" aria-hidden="true" />
                  <input
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder="Search file titles"
                    aria-label="Search file titles"
                  />
                </label>
              </div>

              {/* Upload status */}
              {uploadError && <div className="note err">{uploadError}</div>}
              {uploadSuccess && <div className="note ok">{uploadSuccess}</div>}

              {/* File list — one card per grouped document (not per hub_memory chunk row) */}
              {filesLoading ? (
                <div className="list">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="row pulse">
                      <div className="t">
                        <div className="sk" style={{ width: 14, height: 14, marginTop: 2, flex: '0 0 auto' }} />
                        <div style={{ flex: 1 }}>
                          <div className="sk" style={{ height: 12, width: '65%' }} />
                          <div className="sk" style={{ height: 10, width: '38%', marginTop: 8 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : files.length === 0 ? (
                <div className="list">
                  <div className="note">No files yet. Upload the first file to get started.</div>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="list">
                  <div className="note">No files match &ldquo;{fileSearch.trim()}&rdquo;.</div>
                </div>
              ) : (
                <div className="list">
                  {visibleFiles.map((f) => {
                    const linkable =
                      f.source_type === 'fireflies' && !!f.source_ref && UUID_RE.test(f.source_ref)
                    const dateIso = f.meeting_date || f.created_at
                    // source + categories + leader, capped like the mockup's rows.
                    const allTags: string[] = [
                      f.source_type,
                      ...(f.categories ?? []),
                      ...(f.leader ? [f.leader] : []),
                    ].filter(Boolean)
                    const shownTags = allTags.slice(0, 3)
                    const extraTags = allTags.length - shownTags.length
                    // Chunked documents used to render as one card per part. They are now
                    // one card; this says how many rows back it, counted from the rows the
                    // API actually returned (not the unreliable chunk_total column).
                    const chunkCount = typeof f.chunk_count === 'number' ? f.chunk_count : 1

                    if (confirmDeleteId === f.id) {
                      return (
                        <div key={f.id} className="confirm">
                          <b>Delete &ldquo;{f.title.length > 30 ? `${f.title.slice(0, 30)}…` : f.title}&rdquo;?</b>
                          <span>This cannot be undone.</span>
                          <div className="acts">
                            <button className="cancel" onClick={() => setConfirmDeleteId(null)}>
                              Cancel
                            </button>
                            <button
                              className="del"
                              onClick={() => handleDelete(f.id, f.title)}
                              disabled={deletingId === f.id}
                            >
                              {deletingId === f.id ? 'Deleting…' : 'Yes, delete'}
                            </button>
                          </div>
                        </div>
                      )
                    }

                    return (
                      // Layer is no longer shown as text (the mockup's rows don't
                      // carry it) — it is kept in the row tooltip so nothing is lost.
                      <div key={f.id} className="row" title={`layer ${f.layer}`}>
                        <div className="t">
                          <i className={`ti ${sourceIcon(f.source_type)}`} aria-hidden="true" />
                          <b>
                            {linkable ? <Link href={`/sessions/${f.source_ref}`}>{f.title}</Link> : f.title}
                          </b>
                          <button
                            className="icon-btn trash"
                            onClick={() => setConfirmDeleteId(f.id)}
                            aria-label={`Delete ${f.title}`}
                            style={{ width: 22, height: 22, marginTop: -2 }}
                          >
                            <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: 14 }} />
                          </button>
                        </div>
                        <div className="m">
                          {shownTags.map((t, ti) => (
                            <TagPill key={`${t}-${ti}`} tag={t} />
                          ))}
                          {extraTags > 0 && <span className="tag more">+{extraTags}</span>}
                          {chunkCount > 1 && <span className="tag more">{chunkCount} parts</span>}
                          {dateIso && <span className="d">{fmtShort(dateIso)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Expand / collapse — unchanged logic, restyled as the mockup's foot */}
              {!filesLoading && filteredFiles.length > 0 && (hiddenCount > 0 || filesExpanded) && (
                <div className="p-foot">
                  {hiddenCount > 0 && !filesExpanded && (
                    <button className="ghost" onClick={() => setFilesExpanded(true)}>
                      <i className="ti ti-chevron-down" aria-hidden="true" />
                      Load {hiddenCount} more
                    </button>
                  )}
                  {filesExpanded && (
                    <button className="ghost" onClick={() => setFilesExpanded(false)}>
                      <i className="ti ti-chevron-up" aria-hidden="true" />
                      Show less
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* ── DIVIDER (drag to resize · double-click to reset) ─ */}
            <div
              ref={dividerRef}
              className={`divider${isDragging ? ' on' : ''}`}
              onMouseDown={startDrag}
              onDoubleClick={() => setLeftWidth(38)}
              style={{ display: rightExpanded ? 'none' : 'block' }}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
            >
              <span className="grip">
                <i />
                <i />
                <i />
              </span>
            </div>

            {/* ── RIGHT PANEL — chat ─────────────────────────── */}
            <section
              className="panel chat"
              style={{ flex: 1, minWidth: 300, width: rightExpanded ? '100%' : undefined }}
            >
              <div className="p-head">
                <h2>Ask this memory</h2>
                {/* Clear the chat UI state only — history stays in the DB and
                    reloads on refresh. */}
                <button
                  className="icon-btn danger"
                  onClick={() => {
                    setMessages([])
                    setSelectedMentions([])
                    setChatInput('')
                    setChatError('')
                  }}
                  title="Clear chat"
                  aria-label="Clear chat"
                >
                  <i className="ti ti-eraser" aria-hidden="true" />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setRightExpanded(!rightExpanded)}
                  title={rightExpanded ? 'Collapse chat' : 'Expand chat'}
                  aria-label={rightExpanded ? 'Collapse chat' : 'Expand chat'}
                >
                  <i
                    className={`ti ${rightExpanded ? 'ti-arrows-diagonal-minimize-2' : 'ti-arrows-diagonal'}`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {/* ── Chat body (fills space, scrolls) ────────────── */}
              <div className={`body${messages.length === 0 ? ' empty' : ''}`}>
                {historyLoading && messages.length === 0 ? (
                  // History still loading — skeleton rows instead of the empty state.
                  <div className="thread">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`sk pulse${i % 2 === 0 ? ' msg me' : ' msg'}`}
                        style={{ height: 56, borderRadius: 11 }}
                      />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  // Empty state — Fraunces headline, lede, 2-col starter grid.
                  <div>
                    <h3>
                      Ask anything from {filesLoading ? 'this memory' : `these ${files.length} files`}
                    </h3>
                    <p className="lede">
                      Answers come only from {agent.shortName}&apos;s memory and cite the file they came
                      from. Start with one of these, or write your own.
                    </p>
                    <div className="starters">
                      {quickPills.map((p) => (
                        <button
                          key={p}
                          className="starter"
                          onClick={() => sendMessage(p)}
                          disabled={chatLoading}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Real conversation.
                  <div className="thread">
                    {messages.map((m, i) =>
                      m.role === 'user' ? (
                        <div key={i} className="msg me">
                          <div className="who-line">
                            {m.userName || 'You'}
                            {m.createdAt
                              ? ` · ${new Date(m.createdAt).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}`
                              : ''}
                          </div>
                          <div className="bubble">{m.content}</div>
                        </div>
                      ) : (
                        <div key={i} className="msg ai">
                          <div className="who-line">
                            {agent.shortName} Agent
                            {m.createdAt
                              ? ` · ${new Date(m.createdAt).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}`
                              : ''}
                          </div>
                          <div
                            className="bubble"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                          />
                          {typeof m.filesUsed === 'number' && m.filesUsed > 0 && (
                            <div className="cite">
                              <i className="ti ti-files" aria-hidden="true" />
                              Drawn from {m.filesUsed} files
                            </div>
                          )}
                          {/* Open in Compose — shown only for replies carrying a
                              complete ---EMAIL DRAFT--- block, so agenda replies and
                              every reply predating this change render untouched. This
                              is additive: the markdown bubble above still shows the
                              whole reply, commentary included. Deep-links to My Emails,
                              which opens Compose prefilled; a <Link> is used because
                              that is how this page already navigates. */}
                          {(() => {
                            const draft = parseEmailDraft(m.content)
                            if (!draft) return null
                            const href =
                              '/my-workspace/email?prefillSubject=' +
                              encodeURIComponent(draft.subject) +
                              '&prefillBody=' +
                              encodeURIComponent(draft.body)
                            return (
                              <div className="draft-open">
                                <Link className="ghost" href={href}>
                                  <i className="ti ti-mail" aria-hidden="true" />
                                  Open in Compose
                                </Link>
                              </div>
                            )
                          })()}
                        </div>
                      ),
                    )}

                    {/* Typing indicator */}
                    {chatLoading && (
                      <div className="msg ai">
                        <div className="typing">
                          <span className="pulse" />
                          <span className="pulse" style={{ animationDelay: '150ms' }} />
                          <span className="pulse" style={{ animationDelay: '300ms' }} />
                          Thinking…
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Composer ─────────────────────────────────────── */}
              <div className="composer">
                {/* ── @mention file dropdown (floats above the input) ── */}
                {mentionResults.length > 0 && (
                  <div className="mentions">
                    <div className="cap">Files in memory</div>
                    {mentionResults.map((f, index) => (
                      <div
                        key={f.id}
                        onClick={() => selectMention(f)}
                        onMouseEnter={() => setMentionIndex(index)}
                        className={`opt${index === mentionIndex ? ' on' : ''}`}
                      >
                        <i className={`ti ${sourceIcon(f.source_type)}`} aria-hidden="true" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <b>{f.title}</b>
                          {(f.meeting_date || f.created_at) && (
                            <em>{fmtDate(f.meeting_date || f.created_at)}</em>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Active @mention pills (which files are attached) ── */}
                {activeMentions.length > 0 && (
                  <div className="chips">
                    {activeMentions.map((f) => (
                      <span key={f.id} className="att">
                        <i className="ti ti-paperclip" aria-hidden="true" />
                        <b>{f.title}</b>
                        <button
                          // Remove this file from the selected mentions.
                          onClick={() => setSelectedMentions((prev) => prev.filter((m) => m.id !== f.id))}
                          aria-label={`Remove ${f.title} mention`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* ── DISC quick actions (leader pages only) ──────────
                    Fires a fixed prompt into sendMessage() — identical to the user
                    typing it and hitting send. Gated on isLeader because the four
                    category agents (PIT, AI Hub, Design Center, Dept Alignment) are
                    not people and have no DISC profile. Always rendered on a leader
                    page, unlike the `.starter` pills which disappear after the first
                    message. */}
                {agent.isLeader && (
                  <DiscQuickActions
                    leaderName={agent.name}
                    disabled={chatLoading}
                    onSend={(prompt) => sendMessage(prompt)}
                  />
                )}

                {/* Kept as <input> (not the mockup's <textarea>) so inputRef stays
                    HTMLInputElement and the @mention key handling is unchanged. */}
                <div className="box">
                  <input
                    type="text"
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => {
                      const val = e.target.value
                      setChatInput(val)

                      // Detect an in-progress @mention based on the last "@".
                      const atIndex = val.lastIndexOf('@')
                      if (atIndex !== -1 && atIndex === val.length - 1) {
                        // Just typed "@" — show all files.
                        setMentionQuery('')
                        setMentionIndex(0)
                      } else if (atIndex !== -1) {
                        const afterAt = val.slice(atIndex + 1)
                        // Keep the dropdown open while still typing the mention
                        // (no space yet, or short enough to still be one token).
                        if (!afterAt.includes(' ') || afterAt.length < 30) {
                          setMentionQuery(afterAt)
                          setMentionIndex(0)
                        } else {
                          setMentionQuery(null)
                        }
                      } else {
                        setMentionQuery(null)
                      }
                    }}
                    onKeyDown={(e) => {
                      // When the mention dropdown is open, arrows/Enter/Tab/Escape
                      // drive it instead of sending the message.
                      if (mentionResults.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setMentionIndex((prev) => Math.min(prev + 1, mentionResults.length - 1))
                          return
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setMentionIndex((prev) => Math.max(prev - 1, 0))
                          return
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault()
                          selectMention(mentionResults[mentionIndex])
                          return
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setMentionQuery(null)
                          return
                        }
                      }

                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder={`Ask anything about ${agent.shortName}…`}
                  />
                  <button
                    className="send"
                    aria-label="Send"
                    onClick={() => sendMessage()}
                    disabled={chatLoading || chatInput.trim() === ''}
                  >
                    <i
                      className={`ti ${chatLoading ? 'ti-loader-2' : 'ti-arrow-up'}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {/* Footer — derived from the files already in state, no new fetch.
                    Doubles as the chat error line so errors are never hidden. */}
                <div className={`fine${chatError ? ' err' : ''}`}>
                  {chatError ? (
                    <span>{chatError}</span>
                  ) : (
                    <>
                      <span>
                        {filesLoading ? '—' : files.length} FILE{files.length === 1 ? '' : 'S'} IN CONTEXT
                      </span>
                      {newestIso && (
                        <>
                          <span className="sep" />
                          <span>LAST INDEXED {fmtShort(newestIso).toUpperCase()}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Tag pill ─────────────────────────────────────────────────────────
// Restyled to the mockup's uniform muted mono chip. TAG_STYLES above is retained
// but no longer consulted — the mockup renders every tag identically.
function TagPill({ tag }: { tag: string }) {
  return <span className="tag">{tag}</span>
}
