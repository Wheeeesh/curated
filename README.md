# Curated

An invite-only atlas of places worth your time — food, bars, nature, music, culture, nightlife and shopping in Antwerp, Istanbul, Tokyo, Seoul and Paris — pinned and scored by members who share your taste.

**How it works**

- Members pin places and score four aspects of every visit: Quality, Vibe, Service, Value (1–10), plus an optional written review.
- You follow members; their pins land on your map. The **Circle** toggle shows only your circle's pins; **For you** shows everything, ranked by your personal **Match %**.
- Every review sharpens your **taste profile** (the radar on your profile). Match % blends what people like you thought of a place with your own category affinities — the more the club reviews, the smarter it gets.
- Horrible experience? Flag a **warning**. It shows in red above everything else and drags the place's Match % down for everyone.
- Genuine contributions earn **credits**: joining (+10), full reviews of 80+ characters (+5), quick reviews (+2), pinning a place (+3), your pin being validated by three good reviews from others (+10), your invitee joining (+5). Anti-gaming guards: no credits for reviewing your own pins, max 3 credited reviews and 5 credited pins per day, edits never re-credit. Perks/payouts come in a later version.
- Growth is invite-only: every member gets 3 codes; the admin can mint more.

---

## Run it now (demo mode, zero setup)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — that's it. With no backend configured the app runs entirely in your browser against a seeded demo: 8 members with distinct taste personalities, ~88 real venues across the five cities, ~130 reviews including three flagged tourist traps. Join with founding code **CURATED1** and walk the full experience (onboarding → map → reviewing → credits). Data persists in the browser; "Reset demo data" on the profile screen starts fresh.

## Go live (Supabase, ~15 minutes)

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Set the admin email**: open `supabase/migrations/0001_init.sql` and change the email inside `admin_email()` (top of the file) to the email YOU will sign up with.
3. **Run the migration**: in the Supabase dashboard → SQL Editor → paste the whole of `supabase/migrations/0001_init.sql` → Run.
4. **Seed it**: same SQL Editor → paste `supabase/seed.sql` → Run. (This loads the 5 cities, 8 seed personas, 88 places and their reviews, plus the founding invite code `CURATED1`.)
5. **Disable email confirmation**: Authentication → Sign In / Providers → Email → turn **off** "Confirm email" (v1 keeps signup frictionless; turn it back on later if you prefer).
6. **Connect the app**: copy `.env.example` to `.env` and fill in Project Settings → API:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
7. `npm run dev` again — the app now runs against Supabase. Sign up with `CURATED1` and your admin email: you become the admin, get 3 codes plus a "Mint 3 (admin)" button on your profile, and can start inviting your first wave.

**Deploying for invitees**: `npm run build` produces a static `dist/` folder — host it anywhere (Netlify, Vercel, Cloudflare Pages; set the two `VITE_…` env vars in the host's settings). It's a PWA: on iPhone/Android, "Add to Home Screen" installs it like an app.

### Good to know

- **Free-tier pausing**: Supabase pauses projects after ~7 days of inactivity; restoring is one click in the dashboard.
- **Seed personas** are display-only members (no logins). Their reviews bootstrap the taste engine so early real members get sensible Match % from day one.
- **Credit rules** live in `src/lib/credits/rules.ts` and are mirrored by SQL triggers in the migration — change them together.
- **Consensus bonus** ("+2 pending" on profiles) is display-only in v1; making it durable needs a scheduled job — planned for v2 along with perks/payouts.
- **Map tiles** are Carto's free dark style (`src/lib/mapStyle.ts`); address search is OpenStreetMap Nominatim (debounced, with a drop-a-pin fallback that never depends on it).
- **Scale tripwire**: taste/Match % math runs in the browser, comfortably up to a few hundred members / tens of thousands of reviews. Beyond that, move it into a Postgres function.

## The imported atlas

The map ships pre-populated with venue **locations** gathered from published guides and open data — names, addresses and coordinates only. No scores, rankings, reviews or editorial are imported from anyone: every rating in Curated comes from a member. Each place carries its provenance as "Listed by …", which is also how the attribution-requiring licences below are satisfied.

Importers live in `scripts/import-*.ts`, one per source, each writing to `scripts/data/`. `scripts/build-imported-seed.ts` merges them, deduplicates by name and rounded coordinates (the same venue often appears in several guides), and writes `public/atlas-places.json`, which the app fetches at runtime and the service worker precaches for offline use. Regenerate with:

```bash
npx tsx scripts/build-imported-seed.ts
```

| Source | What it contributes | Licence / access |
|---|---|---|
| **Wikidata** | Michelin-starred restaurants worldwide, plus notable art museums and galleries | CC0, public SPARQL endpoint |
| **Wikivoyage** | Eat/drink/see/buy listings from Star- and Guide-rated destination articles | CC BY-SA — attribution required |
| **Le Fooding** | France and Belgium | robots.txt permits; schema.org JSON-LD |
| **Gault&Millau** | Belgium, Luxembourg, Netherlands | published `rel="ai-knowledge"` feeds |
| **The World's 50 Best** | Restaurants and bars, global and regional lists | robots.txt names ClaudeBot explicitly; `Crawl-delay: 1` honoured |
| **La Liste** | Top-rated restaurants worldwide | robots.txt unrestricted; open sitemap |
| **Eater** | City "essential" map guides | robots.txt permits wildcard agents |
| **Time Out** | Best-of guides for major cities | robots.txt permits wildcard agents |

Guides with no coordinates (50 Best, La Liste, Time Out) are resolved through `scripts/geocode.ts` — Photon over OpenStreetMap, cached to disk and rate-limited. The selection is the guide's; the coordinates are open data.

**Deliberately not imported.** Michelin, Raisin, Falstaff and Resident Advisor all sit behind bot protection that returns 403 or a JS challenge to an honest crawler. Getting in would mean impersonating a browser to defeat that protection, which this project does not do — the Michelin selection is reached through Wikidata instead. Nightlife and music are consequently the atlas's thinnest categories.

**If Curated ever goes public or commercial**, revisit the licences: CC0 (Wikidata) is unrestricted, but CC BY-SA (Wikivoyage) carries share-alike obligations, and in the EU a guide's *selection* can attract database rights even where the individual addresses are plain facts.

## Tech

React 19 + Vite + TypeScript + Tailwind v4 · MapLibre GL (Carto Positron light basemap) · TanStack Query + Zustand · Supabase (Postgres + RLS + auth) behind a swappable data adapter (`src/lib/api/`) with a zero-setup local demo adapter · PWA via vite-plugin-pwa.

**Design system**: light, native-Apple. Tokens and reusable iOS primitives (`.ios-group`, `.ios-row`, `.btn-primary`, `.segmented`, `.field`, `.t-*` type scale) all live in [src/index.css](src/index.css) — build new screens from those rather than hand-rolling layout. Typography is the system stack, which renders as SF Pro on Apple devices. The accent is monochrome graphite; colour is reserved for map pins and category badges, and red for warnings.
