-- ============================================================
-- Spending credits to unlock, and the veteran bonus.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Unlock state itself is derived from a member's own reviews and their
-- UNLOCK_SPEND entries (see src/lib/unlock.ts), so there is no extra
-- table to keep in step — the ledger is the record.
-- ============================================================

-- Mirrors UNLOCK_COST_CREDITS in src/lib/unlock.ts.
create or replace function public.spend_credits_to_unlock()
returns public.credit_ledger
language plpgsql security definer set search_path = public as $$
declare
  v_cost constant int := 20;
  v_balance int;
  v_row public.credit_ledger;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from credit_ledger where user_id = auth.uid();

  if v_balance < v_cost then
    raise exception 'Not enough credits yet';
  end if;

  insert into credit_ledger (user_id, amount, reason, ref_id)
  values (auth.uid(), -v_cost, 'UNLOCK_SPEND', gen_random_uuid())
  returning * into v_row;

  return v_row;
end $$;

revoke all on function public.spend_credits_to_unlock() from public;
grant execute on function public.spend_credits_to_unlock() to authenticated;

-- ————— veteran bonus —————
-- Past 100 reviews the atlas is permanently open and every further review
-- earns credits. Mirrors veteranBonus() in src/lib/credits/rules.ts.
create or replace function public.award_veteran_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
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
create trigger on_review_veteran
after insert on public.reviews
for each row execute function public.award_veteran_bonus();
