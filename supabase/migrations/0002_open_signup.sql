-- ============================================================
-- Open signup — replaces the invite-only gate from 0001_init.sql.
-- Run this once in the Supabase SQL editor.
--
-- Anyone can now create an account. The first member to sign up
-- becomes the admin. Invite codes are no longer required or issued;
-- the invite_codes table is left in place so invite-only can be
-- restored later without a migration.
-- ============================================================

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

  -- First real member is the founder. is_seed excludes the house account,
  -- which is data rather than a person.
  insert into profiles (id, username, display_name, is_admin)
  values (new.id, v_username, v_display,
          not exists (select 1 from profiles where not is_seed));

  -- rules.ts: SIGNUP = 10
  insert into credit_ledger (user_id, amount, reason, ref_id)
  values (new.id, 10, 'SIGNUP', new.id) on conflict do nothing;

  return new;
end $$;
