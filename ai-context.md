# Shooting Tracker — AI Context

## What this app is
A basketball shooting tracker for a family (Tim = parent/manager, Dylan + Eliot = players).
Built with Vite + React 18, Tailwind CSS, Supabase (custom schema), React Router v7, Recharts, DND Kit.

## Stack
- Frontend: Vite + React 18 + Tailwind CSS v4
- Backend: Supabase (Postgres) — custom schema: shooting_tracker
- Auth: Supabase auth (email/password)
- Routing: React Router DOM v7
- Charts: Recharts
- Drag and drop: @dnd-kit/core, @dnd-kit/sortable
- Icons: lucide-react
- Hosting: Vercel

## Key files
- src/lib/supabase.js — Supabase client
- src/lib/basketballClient.js — all DB queries for shooting_tracker schema
- src/context/AuthContext.jsx — auth state (user, profile, loading)
- src/App.jsx — all routes
- src/pages/Basketball/Dashboard.jsx — main dashboard with charts
- src/pages/Basketball/QuickEntry.jsx — log a session
- src/pages/Basketball/SessionDetail.jsx — view/edit a session
- src/pages/Basketball/DrillTemplates.jsx — manage drill templates
- src/components/Basketball/CorrelationChart.jsx — sleep/mood vs % scatter
- src/components/Basketball/CalendarHeatmap.jsx — 90-day session calendar
- src/components/Basketball/DrillTrends.jsx — per-drill trendlines
- src/components/Basketball/SwipeToDelete.jsx — swipe to delete sessions

## Database schema (shooting_tracker)
Tables: players, player_managers, drill_templates, sessions, session_drills, file_attachments, user_logins
Views: v_session_summary, v_session_drill_detail, v_latest_session
Functions: duplicate_last_session(player_id, new_date, new_start)

## Players & auth
- Dylan (dylanblackwell2006@gmail.com) — owns his own player record, sees only his data
- Eliot (eliotblackwell8@gmail.com) — owns his own player record, sees only his data
- Tim (timblackwell@gmail.com) — manager for both Dylan and Eliot, sees all data
- tb22@queensu.ca — test account, manager for both + owns Test Player record
- RLS enforced via can_access_player() security definer function

## Drill types
Three types stored in drill_templates.drill_type:
- attempt_count: fixed attempts, user enters makes only (e.g. 78/100)
- make_count: user must reach required_makes, enters total attempts taken (e.g. Lift & Drift)
- free_throw: user enters both makes and attempts freely each session

## Session fields
- session_date, start_time, duration_minutes, notes
- warmup_type: 'full' | 'half' | 'none'
- first_shot_made: boolean (was the first shot of the session made?)
- opening_threes_made: integer out of 20 (always tracked first before drills)
- sleep_hours, sleep_quality ('good'|'fair'|'poor')
- mood (1-10), soreness (0-10)
- nutrition_quality ('good'|'fair'|'poor')
- weight (lb)

## UI patterns
- Dark theme: bg-gray-950 base, bg-gray-900 cards, border-gray-800 borders
- Orange accent: bg-orange-500 primary buttons and selected states
- Purple accent: make_count drills
- Blue accent: free_throw drills
- Mobile-first, max-w-2xl mx-auto content width
- Fixed bottom save button on entry screens
- Sticky top header on all pages
- Swipe left to delete sessions on dashboard

## Known issues / things to be aware of
- Supabase schema must be exposed: shooting_tracker added to Exposed Schemas in API settings
- GRANT USAGE ON SCHEMA shooting_tracker TO anon, authenticated must be run for new tables
- DO $$ blocks don't work in Supabase SQL editor — run statements one at a time
- FOR UPDATE, DELETE in one policy not supported — create separate policies per command
- player_managers circular RLS was fixed with SECURITY DEFINER function can_access_player()

## How to run
npm run dev        — local dev server
npm run build      — production build
deployed on Vercel — push to main branch auto-deploys