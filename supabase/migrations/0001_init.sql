-- ============================================================
-- Curated — full schema, RLS, invite redemption, credit engine
-- Run this ONCE in the Supabase SQL editor of a fresh project,
-- then run seed.sql, then disable "Confirm email" under
-- Authentication → Providers → Email.
--
-- Credit values and guards MIRROR src/lib/credits/rules.ts.
-- Change them together or demo mode and production drift apart.
-- ============================================================

-- The founder is simply the first person to sign up — no email is hard-coded
-- anywhere. Redeem the founding invite code before anyone else and you are
-- the admin; every later member is a normal member.

-- ————— schema —————
create type public.category as enum
  ('food','bars','nature','music','culture','nightlife','shopping');

create table public.cities (
  id text primary key,
  name text not null,
  country text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  default_zoom int not null default 13
);

-- No FK to auth.users: seed personas are display-only members with no login.
create table public.profiles (
  id uuid primary key,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null,
  avatar_color text not null default '#d0a75f',
  bio text not null default '',
  interests public.category[] not null default '{}',
  home_city text references public.cities(id),
  is_admin boolean not null default false,
  invited_by uuid references public.profiles(id),
  onboarded boolean not null default false,
  is_seed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  owner_id uuid not null references public.profiles(id),
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles(id),
  followee_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  city_id text not null references public.cities(id),
  name text not null check (length(name) between 1 and 120),
  category public.category not null,
  lat double precision not null,
  lng double precision not null,
  address text not null default '',
  description text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  quality smallint not null check (quality between 1 and 10),
  vibe smallint not null check (vibe between 1 and 10),
  service smallint not null check (service between 1 and 10),
  value smallint not null check (value between 1 and 10),
  text_review text not null default '',
  is_warning boolean not null default false,
  warning_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id),
  -- WARNING_MIN_CHARS = 30 (rules.ts)
  check (not is_warning or length(warning_reason) >= 30)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount int not null,
  reason text not null check (reason in
    ('SIGNUP','INVITE_JOINED','REVIEW_FULL','REVIEW_BASIC','PLACE_ADDED','PLACE_VALIDATED')),
  ref_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id) -- idempotency: nothing is ever credited twice
);

create index reviews_place_idx on public.reviews (place_id);
create index reviews_user_idx on public.reviews (user_id);
create index places_city_idx on public.places (city_id);
create index ledger_user_idx on public.credit_ledger (user_id);

-- ————— helpers —————
create or replace function public.review_overall(q int, v int, s int, val int)
returns numeric language sql immutable as
$$ select 0.4*q + 0.3*v + 0.15*s + 0.15*val $$; -- mirrors overallScore() in types.ts

create or replace function public.generate_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  v_code text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random()*30)::int, 1), '')
      into v_code from generate_series(1, 8);
    exit when not exists (select 1 from public.invite_codes where code = v_code);
  end loop;
  return v_code;
end $$;

-- ————— invite redemption: the signup trigger —————
-- Runs when Supabase Auth creates the user. Atomically claims the code
-- (the `used_by is null` predicate kills double-redemption races); any
-- exception aborts the whole signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(coalesce(new.raw_user_meta_data->>'invite_code', ''));
  v_username text := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  v_display text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), v_username);
  v_owner uuid;
begin
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters: letters, numbers, underscore';
  end if;

  -- Lock the code row; a concurrent signup with the same code blocks here,
  -- re-reads after commit, finds used_by set, and aborts.
  select owner_id into v_owner from invite_codes
   where code = v_code and used_by is null
   for update;
  if v_owner is null then
    raise exception 'Invalid or already-used invite code';
  end if;

  -- Profile must exist before the code can reference it (used_by FK).
  -- The first real member to join is the founder/admin. `is_seed` excludes
  -- the house account, which is data rather than a person.
  insert into profiles (id, username, display_name, invited_by, is_admin)
  values (new.id, v_username, v_display, v_owner,
          not exists (select 1 from profiles where not is_seed));

  update invite_codes set used_by = new.id, used_at = now()
   where code = v_code;

  -- every new member gets 3 codes to hand out
  insert into invite_codes (code, owner_id)
  select generate_invite_code(), new.id from generate_series(1, 3);

  -- rules.ts: SIGNUP = 10, INVITE_JOINED = 5
  insert into credit_ledger (user_id, amount, reason, ref_id)
  values (new.id, 10, 'SIGNUP', new.id) on conflict do nothing;
  insert into credit_ledger (user_id, amount, reason, ref_id)
  values (v_owner, 5, 'INVITE_JOINED', new.id) on conflict do nothing;

  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ————— pre-signup code check (safe for anon) —————
create or replace function public.check_invite_code(p_code text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from invite_codes
    where code = upper(trim(p_code)) and used_by is null
  )
$$;

-- ————— admin code minting —————
create or replace function public.admin_generate_codes(p_count int)
returns setof public.invite_codes
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'Admins only';
  end if;
  if p_count < 1 or p_count > 50 then
    raise exception 'Count must be between 1 and 50';
  end if;
  return query
    insert into invite_codes (code, owner_id)
    select generate_invite_code(), auth.uid() from generate_series(1, p_count)
    returning *;
end $$;

-- ————— credit engine (mirrors src/lib/credits/rules.ts) —————
create or replace function public.award_place_credits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_today int;
begin
  -- MAX_CREDITED_PLACES_PER_DAY = 5, PLACE_ADDED = 3
  select count(*) into v_today from credit_ledger
   where user_id = new.created_by and reason = 'PLACE_ADDED'
     and created_at::date = (now() at time zone 'utc')::date;
  if v_today < 5 then
    insert into credit_ledger (user_id, amount, reason, ref_id)
    values (new.created_by, 3, 'PLACE_ADDED', new.id) on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_place_added
after insert on public.places
for each row execute function public.award_place_credits();

create or replace function public.award_review_credits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_place public.places%rowtype;
  v_today int;
  v_validators int;
begin
  select * into v_place from places where id = new.place_id;

  -- Review credit: inserts only (edits never re-credit), never for your own
  -- place, max 3 credited reviews/day. REVIEW_FULL = 5 at ≥80 chars, else
  -- REVIEW_BASIC = 2. Warnings earn full credits like any review.
  if tg_op = 'INSERT' and v_place.created_by <> new.user_id then
    select count(*) into v_today from credit_ledger
     where user_id = new.user_id and reason in ('REVIEW_FULL','REVIEW_BASIC')
       and created_at::date = (now() at time zone 'utc')::date;
    if v_today < 3 then
      if length(trim(new.text_review)) >= 80 then
        insert into credit_ledger (user_id, amount, reason, ref_id)
        values (new.user_id, 5, 'REVIEW_FULL', new.id) on conflict do nothing;
      else
        insert into credit_ledger (user_id, amount, reason, ref_id)
        values (new.user_id, 2, 'REVIEW_BASIC', new.id) on conflict do nothing;
      end if;
    end if;
  end if;

  -- PLACE_VALIDATED = 10: 3 distinct non-creator reviewers with overall ≥ 7.
  -- Idempotent via the (user_id, reason, ref_id) unique key.
  select count(distinct r.user_id) into v_validators from reviews r
   where r.place_id = new.place_id and r.user_id <> v_place.created_by
     and review_overall(r.quality, r.vibe, r.service, r.value) >= 7;
  if v_validators >= 3 then
    insert into credit_ledger (user_id, amount, reason, ref_id)
    values (v_place.created_by, 10, 'PLACE_VALIDATED', v_place.id)
    on conflict do nothing;
  end if;

  return new;
end $$;

create trigger on_review_written
after insert or update on public.reviews
for each row execute function public.award_review_credits();

-- keep updated_at honest
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger reviews_touch before update on public.reviews
for each row execute function public.touch_updated_at();

-- nobody promotes themselves
create or replace function public.protect_profile_columns() returns trigger
language plpgsql as $$
begin
  new.is_admin := old.is_admin;
  new.invited_by := old.invited_by;
  new.is_seed := old.is_seed;
  new.username := old.username;
  new.created_at := old.created_at;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
for each row execute function public.protect_profile_columns();

-- ————— row-level security —————
alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.follows enable row level security;
alter table public.places enable row level security;
alter table public.reviews enable row level security;
alter table public.credit_ledger enable row level security;

-- It's a private club: every table is readable by any signed-in member,
-- writable only through the rules above.
create policy cities_read on public.cities
  for select to authenticated using (true);

create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy invites_read_own on public.invite_codes
  for select to authenticated using (owner_id = auth.uid());

create policy follows_read on public.follows
  for select to authenticated using (true);
create policy follows_insert_own on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete_own on public.follows
  for delete to authenticated using (follower_id = auth.uid());

create policy places_read on public.places
  for select to authenticated using (true);
create policy places_insert_own on public.places
  for insert to authenticated with check (created_by = auth.uid());
create policy places_update_own on public.places
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy places_delete_own on public.places
  for delete to authenticated using (created_by = auth.uid());

create policy reviews_read on public.reviews
  for select to authenticated using (true);
create policy reviews_insert_own on public.reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy reviews_update_own on public.reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on public.reviews
  for delete to authenticated using (user_id = auth.uid());

create policy ledger_read on public.credit_ledger
  for select to authenticated using (true);

-- function grants
revoke all on function public.check_invite_code(text) from public;
grant execute on function public.check_invite_code(text) to anon, authenticated;
revoke all on function public.admin_generate_codes(int) from public;
grant execute on function public.admin_generate_codes(int) to authenticated;

-- ============================================================
-- Sanity test (run manually after seeding, then roll back):
--
-- begin;
--   select check_invite_code('CURATED1');            -- expect: true
--   select check_invite_code('NOPE1234');            -- expect: false
--   -- simulate the founding code being claimed (uses a seed profile id):
--   update invite_codes
--      set used_by = '10000000-0000-4000-a000-000000000001', used_at = now()
--    where code = 'CURATED1' and used_by is null;    -- expect: UPDATE 1
--   select check_invite_code('CURATED1');            -- expect: false
-- rollback;
-- ============================================================
