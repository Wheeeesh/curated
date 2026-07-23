-- ============================================================
-- Saved places ("want to go"), plus the Sport and Artisan categories.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter type public.category add value if not exists 'sport';
alter type public.category add value if not exists 'artisan';

create table if not exists public.saved_places (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index if not exists saved_places_user_idx on public.saved_places (user_id);

alter table public.saved_places enable row level security;

-- A member's saved list is private to them: it is a record of intent, not
-- a contribution to the atlas.
drop policy if exists saved_read_own on public.saved_places;
create policy saved_read_own on public.saved_places
  for select to authenticated using (user_id = auth.uid());

drop policy if exists saved_insert_own on public.saved_places;
create policy saved_insert_own on public.saved_places
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists saved_delete_own on public.saved_places;
create policy saved_delete_own on public.saved_places
  for delete to authenticated using (user_id = auth.uid());
