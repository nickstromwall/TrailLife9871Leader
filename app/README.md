# Trail Life MN-9871 — Signup App

Next.js + Supabase generalized event signup tool for **Trail Life USA Troop MN-9871**.

The first event ported in is the 2026–2027 leadership signup (originally hosted in [`../signup-static/`](../signup-static/)). The same data model handles future leadership rollovers, campout meal signups, work day rosters, etc. — see "Recurring events" below.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **Supabase** (Postgres + Auth + Realtime)
- **Vercel** (deploy)

## Architecture at a glance

Three core tables, defined in [`supabase/migrations/20260513000000_init.sql`](./supabase/migrations/20260513000000_init.sql):

- `events` — a signup occasion (leadership, campout, work day, ...)
- `slots` — a role/seat group inside an event (Trail Guide, Saturday Breakfast Cook, ...)
- `signups` — a single person committed to a slot

Plus an `admins` allowlist that gates writes via RLS.

## First-time setup

Prerequisites: Node 20.9+, npm, a Supabase account.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, **New project**.
2. Pick a region near you (us-east-1 / us-central-1 are good defaults).
3. Wait ~2 minutes for the project to provision.

### 2. Copy credentials into `.env.local`

```bash
cp .env.local.example .env.local
```

Then in Supabase Studio → **Project Settings → API**, copy:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### 3. Run the migration

In Supabase Studio → **SQL Editor**, paste the contents of [`supabase/migrations/20260513000000_init.sql`](./supabase/migrations/20260513000000_init.sql) and run it. You should see four tables in **Table Editor**: `events`, `slots`, `signups`, `admins`.

### 4. Seed the leadership event

Generate the seed SQL from the legacy HTML (only needed if the legacy pages change; the generated `supabase/seed.sql` is checked in):

```bash
npm run seed:build
```

Then run [`supabase/seed.sql`](./supabase/seed.sql) in the SQL Editor. You should get two events (`leadership-adults-2026-27`, `leadership-youth-2026-27`) with 41 + 11 slots.

### 5. Bootstrap the first admin

The `admins` allowlist gates writes, but on a fresh DB there are no admins yet — so you have to insert the first one manually from the SQL Editor (which bypasses RLS as the service role):

```sql
-- 1. Sign in at /admin/login to create your auth.users record.
-- 2. Then run this from Studio's SQL Editor:
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

Subsequent admins can be added through the (future) admin UI or by repeating this insert.

### 6. Run locally

```bash
npm install
npm run dev
```

- Public home: [http://localhost:3000](http://localhost:3000)
- Adults event: [http://localhost:3000/events/leadership-adults-2026-27](http://localhost:3000/events/leadership-adults-2026-27)
- Youth event: [http://localhost:3000/events/leadership-youth-2026-27](http://localhost:3000/events/leadership-youth-2026-27)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Deploying to Vercel

1. Push this branch to GitHub.
2. In Vercel: **Add New → Project → Import** the repo.
3. **Root Directory:** `app`
4. **Environment Variables:** paste the three keys from `.env.local`.
5. Deploy. Vercel auto-rebuilds on every push to `main`.

For Supabase Auth to redirect back from magic links in production, add your Vercel URL to **Supabase → Authentication → URL Configuration → Redirect URLs**.

## Recurring events (annual rollover)

The leadership signup is rerun every troop year. To clone for next season without rebuilding from scratch:

1. From `/admin/events/new`, choose **Clone slots from** = the current leadership event.
2. Set the new slug (e.g. `leadership-adults-2027-28`), new season (`2027-2028`), new title.
3. Edit the prefilled names if a role's prefilled occupant changed.
4. Toggle **Publish** when ready.

Under the hood, this calls the [`clone_event` SQL function](./supabase/migrations/20260513000000_init.sql) — it copies the event row + every slot atomically. Signups are *not* copied; prefilled names *are*.

To archive last year's event so it stops showing on the public home, hit **Archive** on its admin page. The data stays in the DB but it's hidden from public listings.

## Layout

```
app/
├── src/
│   ├── app/
│   │   ├── page.tsx                          # public home — list of published events
│   │   ├── events/[slug]/                    # public event page (live + interactive)
│   │   ├── admin/                            # admin dashboard (auth-gated)
│   │   │   ├── login/                        # magic-link sign in
│   │   │   └── events/                       # create, edit, view signups
│   │   └── auth/                             # OAuth callback + sign-out
│   ├── lib/supabase/                         # browser / server / middleware clients
│   └── proxy.ts                              # session refresh middleware (Next 16: `proxy`)
├── supabase/
│   ├── migrations/                           # SQL migrations (run in Studio)
│   └── seed.sql                              # generated by scripts/build-seed.mjs
└── scripts/
    └── build-seed.mjs                        # extracts roles from ../signup-static/ HTML
```

## Scripts

```bash
npm run dev          # local dev server (Turbopack by default in Next 16)
npm run build        # production build
npm run start        # serve production build locally
npm run seed:build   # regenerate supabase/seed.sql from ../signup-static/ HTML
```

## What's intentionally NOT in v0

These are deliberate cuts to keep the first release shippable:

- User accounts for signers (public signup remains anonymous, like the legacy tool)
- Email confirmations
- File uploads (permission slips, etc.)
- Calendar view
- Custom domain (use the default Vercel URL initially)
- Roster / patrol / advancement / dues management

Bring these in as actual usage surfaces the need.
