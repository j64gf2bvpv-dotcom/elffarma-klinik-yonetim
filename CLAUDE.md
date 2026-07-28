# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A desktop clinic-management app for a medical aesthetics business (Turkish UI throughout — do not translate strings to English). It bundles customer records, product/stock tracking with a movement ledger, payment (tahsilat) records, and a calendar for appointments/reminders, with one-click WhatsApp messaging via `wa.me` links (no paid WhatsApp Business API). Multiple staff accounts share one Supabase-backed database (admin vs staff roles).

The full architecture rationale and phased build plan live in `/Users/erkankongul/.claude/plans/swift-beaming-mochi.md` — read it for the "why" behind decisions below.

## Commands

```bash
npm run dev       # starts Vite + Electron together (vite-plugin-electron auto-launches the app window)
npm run build      # tsc -b && vite build — builds renderer + electron main/preload into dist/ and dist-electron/
npm run lint        # oxlint
npm run preview     # vite preview (renderer only, no Electron shell)
```

There is no test suite yet. Node.js is installed locally at `~/.local/node/bin` (not via Homebrew/nvm — this machine has no Xcode Command Line Tools) — make sure that's on `PATH` before running npm commands if a fresh shell doesn't have it.

Packaging into a `.dmg`/`.exe` uses `electron-builder` (config to be added in `electron-builder.yml`) — not wired up yet.

## Environment

Copy `.env.example` to `.env` and fill in a real Supabase project's URL/anon key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). `VITE_CLINIC_NAME` controls the app title and the `{{klinik_adi}}` WhatsApp template placeholder. Without valid Supabase credentials the app still boots (using placeholder values) but all data calls fail — `src/lib/supabaseClient.ts` exports `isSupabaseConfigured` for surfacing that state in the UI (see `LoginPage.tsx`).

## Architecture

**Electron + Vite + React + TypeScript**, single renderer window, no separate backend server — the renderer talks directly to Supabase (Postgres + Auth + RLS) using the anon key. `vite-plugin-electron/simple` builds `electron/main.ts` and `electron/preload.ts` alongside the renderer from one `vite.config.ts`.

**Security boundary**: the renderer has `nodeIntegration: false` / `contextIsolation: true`. It never gets direct Node/Electron access — `electron/preload.ts` exposes exactly two methods on `window.electronAPI` (`openWhatsApp`, `notify`) via `contextBridge`, typed in `src/types/global.d.ts`. `electron/main.ts` validates that `openWhatsApp` URLs match `^https://wa.me/` before calling `shell.openExternal`. Do not widen this bridge without keeping that validation.

**Data layer / authorization model**: all access control is enforced in Postgres via Row Level Security, defined in `supabase/schema.sql` — this file is the single source of truth for the schema and is meant to be pasted whole into the Supabase SQL editor (idempotent: uses `create table if not exists`, `drop policy if exists` + recreate, etc.), not run via migrations tooling. Key points a change here must preserve:
- `public.staff` mirrors `auth.users` 1:1 (same `id`). A trigger (`handle_new_user`) auto-inserts a `staff` row on signup — the *first* user ever created becomes `role='admin'` automatically, everyone after that defaults to `role='staff'`; admins reassign roles from the app afterward. There is no separate "create staff" admin UI flow that calls `auth.admin.createUser` — new staff accounts are created directly in the Supabase dashboard.
- `is_admin()` / `is_active_staff()` are `SECURITY DEFINER` SQL functions used inside RLS policies to check the caller's role without recursive-RLS issues; reuse them for any new table's policies rather than inlining subqueries.
- `products.current_quantity` is a denormalized cache. It must only be mutated through the `record_stock_movement(...)` RPC (also `SECURITY DEFINER`), which inserts the audit-trail row into `stock_movements` and updates the cached quantity atomically. Never `update products set current_quantity = ...` directly from the client.
- `customers`, `stock_movements`, `payments`, `appointments` use a shared-trust model: any active staff member can read/write all rows (no per-staff data siloing). `staff`, `products`, `whatsapp_templates` are admin-write / staff-read.

**Frontend structure**:
- `src/lib/auth.tsx` — `AuthProvider`/`useAuth()`. Wraps Supabase session state and loads the matching `staff` profile row (role, active flag) on sign-in; this is what `AppShell` and route guards key off of, not the raw Supabase session.
- `src/lib/supabaseClient.ts` — the one Supabase client instance; also exports `CLINIC_NAME` (from `VITE_CLINIC_NAME`) used for branding and WhatsApp templates.
- `src/features/<name>/` — one folder per domain module (`whatsapp` exists so far; `customers`, `stock`, `payments`, `appointments` follow the same shape as they're built): `api.ts` (raw Supabase calls), `hooks.ts` (TanStack Query wrappers — mutations show `sonner` toasts on success/error and invalidate the relevant query key), plus feature components.
- `src/features/whatsapp/normalizePhone.ts` and `renderTemplate.ts` are the load-bearing WhatsApp utilities: phone numbers are canonicalized to `+90XXXXXXXXXX` before being turned into `https://wa.me/<digits>?text=<encoded message>` links; `openWhatsApp()` calls `window.electronAPI.openWhatsApp` (falls back to `window.open` when running outside Electron, e.g. `vite preview`). `WhatsAppSendDialog.tsx` is the reusable "pick a template → preview → send" dialog meant to be dropped into both the customer detail page and calendar appointment rows, with an optional "mark as sent" checkbox (there's no way to detect an actual send through `wa.me`, so this is a manual, honesty-preserving toggle — see `appointments.reminder_sent`).
- `src/components/ui/` — hand-written shadcn/ui-style primitives (not generated via the shadcn CLI) built on Radix primitives + `class-variance-authority`, styled through Tailwind v4 CSS variables defined in `src/index.css` (`@theme inline` block + `:root`/`.dark` tokens — teal/blue clinic palette). Use `cn()` from `src/lib/utils.ts` for class merging in any new component.
- `src/components/layout/AppShell.tsx` — the persistent sidebar-nav shell (dashboard/customers/calendar/stock/payments, settings gated to `role==='admin'`) plus an online/offline indicator (`src/hooks/useOnlineStatus.ts`) and the sign-out menu. New top-level pages get added to its `navItems` array and to the router in `src/App.tsx`.
- `src/i18n/tr.ts` — centralized lookup tables for enum-like display strings (appointment status, stock movement type, payment method, staff role). Most other UI copy is written directly as Turkish JSX text rather than routed through an i18n layer (no localization abstraction — this is a single-language Turkish app by design).
- `src/types/database.ts` — hand-maintained TypeScript interfaces mirroring `supabase/schema.sql` (no generated types / Supabase CLI codegen in use). Keep these two files in sync manually when the schema changes.

**Path alias**: `@/*` → `src/*`, configured in both `tsconfig.app.json`/`tsconfig.json` and `vite.config.ts`'s `resolve.alias` — keep both in sync if it ever changes.

**Offline behavior is intentionally limited**: no offline write queue. `useOnlineStatus` only drives a visual indicator; failed writes while offline should surface as toasts, not be silently queued (a deliberate scope decision, not an oversight — see the plan doc if reconsidering this).
