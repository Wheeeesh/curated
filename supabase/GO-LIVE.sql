-- ============================================================
--  Curated — one-shot "go live" migration.
--  Paste this whole file into the Supabase SQL editor and Run.
--  Safe to run more than once.
--
--  It brings a database that only has 0001_init.sql applied fully
--  up to date: open signup, the nine categories, per-criterion
--  review scores, the unlock economy, saved places — and it lets
--  reviews attach to the 3,794 guide locations that ship inside the
--  app rather than living as database rows.
-- ============================================================

-- ————— home-city centre (everything within 30 km is always unlocked) —————
alter table public.profiles add column if not exists home_lat double precision;
alter table public.profiles add column if not exists home_lng double precision;
-- Onboarding now searches every city on earth, so home_city is free text and
-- can no longer be constrained to the handful of rows in `cities`. Left in
-- place it rejects every member who lives outside that list.
alter table public.profiles drop constraint if exists profiles_home_city_fkey;

-- ————— new categories —————
alter type public.category add value if not exists 'art';
alter type public.category add value if not exists 'coffee';
alter type public.category add value if not exists 'sport';
alter type public.category add value if not exists 'artisan';

-- ————— places: many categories, free-text locality, no city gate —————
alter table public.places add column if not exists categories public.category[];
alter table public.places add column if not exists locality text not null default '';
update public.places set categories = array[category] where categories is null;
alter table public.places alter column categories set not null;
alter table public.places alter column city_id drop not null;
-- The app now writes `categories` (plural); the original single-category
-- column must stop being required or every new pin is rejected.
alter table public.places alter column category drop not null;

-- ————— reviews: a criterion→score map instead of four fixed columns —————
alter table public.reviews add column if not exists scores jsonb;
update public.reviews
   set scores = jsonb_strip_nulls(jsonb_build_object(
         'food',       case when quality is not null then to_jsonb(quality) end,
         'atmosphere', case when vibe    is not null then to_jsonb(vibe)    end,
         'service',    case when service is not null then to_jsonb(service) end,
         'value',      case when value   is not null then to_jsonb(value)   end))
 where scores is null;
alter table public.reviews alter column scores set default '{}'::jsonb;
alter table public.reviews alter column scores set not null;
alter table public.reviews alter column quality drop not null;
alter table public.reviews alter column vibe    drop not null;
alter table public.reviews alter column service drop not null;
alter table public.reviews alter column value   drop not null;

-- Guide locations live in the app bundle, not the DB, so a review or a save
-- may reference a place_id with no matching row. Drop the review foreign key
-- and keep place_id as a plain identifier the app resolves from either source.
-- (saved_places is handled where it is created, further down.)
alter table public.reviews drop constraint if exists reviews_place_id_fkey;

-- ————— overall score = mean of whatever was rated —————
create or replace function public.review_overall_scores(p_scores jsonb)
returns numeric language sql immutable as $$
  select coalesce(avg((value)::numeric), 0)
    from jsonb_each_text(coalesce(p_scores, '{}'::jsonb)) as t(key, value)
$$;

-- ————— open signup: first real member becomes admin, no invite needed —————
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  v_display text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), v_username);
begin
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters: letters, numbers, underscore';
  end if;
  if exists (select 1 from profiles where username = v_username) then
    raise exception 'That username is already taken';
  end if;
  insert into profiles (id, username, display_name, is_admin)
  values (new.id, v_username, v_display,
          not exists (select 1 from profiles where not is_seed));
  insert into credit_ledger (user_id, amount, reason, ref_id)
  values (new.id, 10, 'SIGNUP', new.id) on conflict do nothing;
  return new;
end $$;

-- ————— credit ledger: new reasons + score-aware validation —————
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('SIGNUP','INVITE_JOINED','REVIEW_FULL','REVIEW_BASIC',
                    'PLACE_ADDED','PLACE_VALIDATED','UNLOCK_SPEND',
                    'CREDITS_PURCHASED','VETERAN_BONUS'));

create or replace function public.award_review_credits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_creator uuid;
  v_today int;
  v_validators int;
begin
  select created_by into v_creator from places where id = new.place_id;

  if tg_op = 'INSERT' and (v_creator is null or v_creator <> new.user_id) then
    select count(*) into v_today from credit_ledger
     where user_id = new.user_id and reason in ('REVIEW_FULL','REVIEW_BASIC')
       and created_at::date = (now() at time zone 'utc')::date;
    if v_today < 3 then
      insert into credit_ledger (user_id, amount, reason, ref_id)
      values (new.user_id,
              case when length(trim(new.text_review)) >= 80 then 5 else 2 end,
              case when length(trim(new.text_review)) >= 80 then 'REVIEW_FULL' else 'REVIEW_BASIC' end,
              new.id)
      on conflict do nothing;
    end if;
  end if;

  if v_creator is not null then
    select count(distinct r.user_id) into v_validators from reviews r
     where r.place_id = new.place_id and r.user_id <> v_creator
       and review_overall_scores(r.scores) >= 7;
    if v_validators >= 3 then
      insert into credit_ledger (user_id, amount, reason, ref_id)
      values (v_creator, 10, 'PLACE_VALIDATED', new.place_id) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

-- Past 100 reviews the atlas stays open and every review keeps earning.
create or replace function public.award_veteran_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if tg_op <> 'INSERT' then return new; end if;
  select count(*) into v_count from reviews where user_id = new.user_id;
  if v_count >= 100 then
    insert into credit_ledger (user_id, amount, reason, ref_id)
    values (new.user_id, 2, 'VETERAN_BONUS', new.id) on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_review_veteran on public.reviews;
create trigger on_review_veteran after insert on public.reviews
for each row execute function public.award_veteran_bonus();

-- ————— spend credits to unlock —————
create or replace function public.spend_credits_to_unlock()
returns public.credit_ledger
language plpgsql security definer set search_path = public as $$
declare v_balance int; v_row public.credit_ledger;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select coalesce(sum(amount), 0) into v_balance from credit_ledger where user_id = auth.uid();
  if v_balance < 20 then raise exception 'Not enough credits yet'; end if;
  insert into credit_ledger (user_id, amount, reason, ref_id)
  values (auth.uid(), -20, 'UNLOCK_SPEND', gen_random_uuid()) returning * into v_row;
  return v_row;
end $$;
revoke all on function public.spend_credits_to_unlock() from public;
grant execute on function public.spend_credits_to_unlock() to authenticated;

-- ————— saved places ("want to go"), private to each member —————
create table if not exists public.saved_places (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.saved_places enable row level security;
drop policy if exists saved_read_own on public.saved_places;
create policy saved_read_own on public.saved_places
  for select to authenticated using (user_id = auth.uid());
drop policy if exists saved_insert_own on public.saved_places;
create policy saved_insert_own on public.saved_places
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists saved_delete_own on public.saved_places;
create policy saved_delete_own on public.saved_places
  for delete to authenticated using (user_id = auth.uid());

-- ————— the founder account: owns nothing, just needs to exist —————
insert into public.profiles (id, username, display_name, onboarded, is_seed)
values ('00000000-0000-4000-a000-000000000001', 'curated', 'Curated', false, true)
on conflict do nothing;

-- ————— cities, for the onboarding shortcuts (map roams anywhere regardless) —————
insert into public.cities (id, name, country, center_lat, center_lng, default_zoom) values
  ('antwerp','Antwerp','Belgium',51.2172,4.4078,13),
  ('brussels','Brussels','Belgium',50.8503,4.3517,12),
  ('paris','Paris','France',48.8646,2.3522,13),
  ('istanbul','Istanbul','Türkiye',41.028,28.9784,12),
  ('tokyo','Tokyo','Japan',35.6712,139.7203,12),
  ('seoul','Seoul','South Korea',37.5519,126.9918,12)
on conflict do nothing;
