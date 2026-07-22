-- ============================================================
-- Multiple categories per place, and per-category rating criteria.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Places gain `categories` (an array) and `locality` (free text, so places
-- are no longer tied to a fixed city list). Reviews replace the four fixed
-- columns with a `scores` map of criterion → 1–10, because a gallery and a
-- cocktail bar are not judged on the same things.
-- ============================================================

-- ————— new categories —————
alter type public.category add value if not exists 'art';
alter type public.category add value if not exists 'coffee';

-- ————— places: many categories, free-text locality —————
alter table public.places add column if not exists categories public.category[];
alter table public.places add column if not exists locality text not null default '';

update public.places
   set categories = array[category]
 where categories is null;

alter table public.places alter column categories set not null;
alter table public.places
  add constraint places_categories_not_empty check (array_length(categories, 1) >= 1);

-- city_id becomes optional: places can now exist anywhere in the world.
alter table public.places alter column city_id drop not null;

-- The old single-category column stays for now so nothing breaks mid-deploy.
-- Drop it once the app has been running on `categories` for a while:
--   alter table public.places drop column category;

-- ————— reviews: flexible criteria —————
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

-- The fixed columns are no longer written by the app.
alter table public.reviews alter column quality drop not null;
alter table public.reviews alter column vibe    drop not null;
alter table public.reviews alter column service drop not null;
alter table public.reviews alter column value   drop not null;

-- ————— overall score now means "the mean of whatever was rated" —————
create or replace function public.review_overall_scores(p_scores jsonb)
returns numeric language sql immutable as $$
  select coalesce(avg((value)::numeric), 0)
    from jsonb_each_text(coalesce(p_scores, '{}'::jsonb)) as t(key, value)
$$;

-- Place validation uses the new definition. Mirrors src/lib/credits/rules.ts.
create or replace function public.award_review_credits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_place public.places%rowtype;
  v_today int;
  v_validators int;
begin
  select * into v_place from places where id = new.place_id;

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

  select count(distinct r.user_id) into v_validators from reviews r
   where r.place_id = new.place_id and r.user_id <> v_place.created_by
     and review_overall_scores(r.scores) >= 7;
  if v_validators >= 3 then
    insert into credit_ledger (user_id, amount, reason, ref_id)
    values (v_place.created_by, 10, 'PLACE_VALIDATED', v_place.id)
    on conflict do nothing;
  end if;

  return new;
end $$;

-- ————— new ledger reasons —————
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('SIGNUP','INVITE_JOINED','REVIEW_FULL','REVIEW_BASIC',
                    'PLACE_ADDED','PLACE_VALIDATED','UNLOCK_SPEND',
                    'CREDITS_PURCHASED','VETERAN_BONUS'));
