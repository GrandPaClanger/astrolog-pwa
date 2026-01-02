# astrolog-pwa — Astro Session Log PWA (Starter)

This starter implements your agreed MVP:

- **Home page** = Targets catalogue with: Catalog No, Description, Start Date, Last Imaged, Total Integration (**HH:MM:SS**)
- **Target detail** = Session header → multiple Image Runs (Panels) → Filter lines
- Dropdowns seeded for mounts / cameras / filters / locations
- **Storage approach A**: store local/UNC paths in `file_asset.path` (no RAWs in cloud)

## Quick start (local)

1) Put this project in:

`C:\Users\ian\astrolog-pwa`

2) Create `.env.local`:

Copy `.env.local.example` → `.env.local`, then fill in from **Supabase → Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3) Install + run:

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Supabase setup

1) Run the SQL script in Supabase SQL Editor:

- `supabase/schema.sql`

2) In Supabase Auth:
- Enable **Email / Magic Link** (or Email+Password if you prefer)

3) First login:
- Go to `/login` and send yourself a magic link.
- After login, the app calls `public.ensure_person()` when saving your first session.

## Deploy (Vercel)

1) Push this repo to GitHub
2) In Vercel: **Add New → Project → Import Git Repository**
3) Framework preset: **Next.js**
4) Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Pages

- `/targets` — targets catalogue (home)
- `/targets/[targetId]` — target detail (sessions → panels → filters)
- `/sessions/new` — new session + panels + filter lines + file assets
- `/login` — email magic link login
